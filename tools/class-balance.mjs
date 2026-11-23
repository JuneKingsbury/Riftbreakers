// Class balance sim: how often each class wins real fights, run headless.
//
//   npm run balance                       every scenario, mixed parties
//   npm run balance -- --mode mono        parties of three of the same class
//   npm run balance -- --scenario a1boss  one scenario (see SCENARIOS)
//   npm run balance -- --battles 40       battles per class per scenario (default 60)
//   npm run balance -- --seed 7           a different set of random numbers
//   npm run balance -- --jobs lich,paladin only these classes (no median or flags)
//   npm run balance -- --build 1          the tested class always takes its second build (0 or 1)
//   npm run balance -- --usage            also what the class did each battle, by ability
//   npm run balance -- --json             machine-readable output
//
// Each battle is the game's own: a party built like a run's (createMember at the scenario's
// level, the class's suggested builds spending its points, promotion at level 5), a fight
// from the act's realms scaled for the act (buildEncounter), a map of its realm, and the
// real-time battle loop every automatic fight uses. The party is the size a run's is by
// then (three, plus a recruit each act), and wears what it would have found: every earlier
// fight's reward is rolled from the run's own tables, the best pick for the party is taken,
// and auto-equip puts it on (gearUp). Relics are left out: they help every class alike.
//
// Mixed mode puts the class beside others of its tier, a different set each battle. Math.random
// is seeded, and every class plays the same list of fights and maps, so a change to one class
// moves its numbers and not the noise.
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { availableParallelism } from 'node:os';
import { loadMapData } from '../js/tactical/battle-map.js';
import { TacticalBattle } from '../js/tactical/battle.js';
import { buildEncounter, realmEncounters } from '../js/run/data/encounters.js';
import { ACT_REALMS, pickRealmMap } from '../js/run/data/realms.js';
import { createMember } from '../js/run/data/recruits.js';
import { Rng } from '../js/run/rng.js';
import { buildUnits } from '../js/tactical/build-units.js';
import { runRealtimeBattle } from '../js/tactical/realtime.js';
import { promote, PROMOTION_LEVEL } from '../js/tactical/loadout.js';
import { buildsFor, focusAllocate } from '../js/run/builds.js';
import { JOB_DATA } from '../js/content/jobs.js';
import { RunState, ITEM_RARITY, START_BONUS_SP } from '../js/run/run-state.js';
import { autoEquip, strictUpgradeFor, equipOptions } from '../js/run/equip-options.js';

// Fights at about the level a party reaches them in a run (Act 1's boss at 5, then roughly
// four levels an act).
// size: party size by then (a recruit floor each act).
export const SCENARIOS = {
    a1elite: { act: 1, kind: 'elite', level: 3,  tier: 1, size: 3 },
    a1boss:  { act: 1, kind: 'boss',  level: 5,  tier: 1, size: 3 },
    a2elite: { act: 2, kind: 'elite', level: 7,  tier: 2, size: 4 },
    a2boss:  { act: 2, kind: 'boss',  level: 9,  tier: 2, size: 4 },
    a3boss:  { act: 3, kind: 'boss',  level: 13, tier: 2, size: 5 },
};

// The rewards a run has collected before a scenario's fight: [act, kind] per won fight.
// An act is about six battles, two elites and its boss; within the act, a fight comes after
// three battles (elite) or six and an elite (boss).
function rewardsBefore(sc) {
    const out = [];
    const add = (act, kind, n) => { for (let i = 0; i < n; i++) out.push([act, kind]); };
    for (let a = 1; a < sc.act; a++) { add(a, 'normal', 6); add(a, 'elite', 2); add(a, 'boss', 1); }
    if (sc.kind === 'elite') add(sc.act, 'normal', 3);
    else if (sc.kind === 'boss') { add(sc.act, 'normal', 6); add(sc.act, 'elite', 1); }
    return out;
}

// Dresses the party in what it would have found by `sc`: each reward offers three items from
// the run's tables, the party takes the one that's the biggest upgrade (the first, if none
// is), and auto-equip puts it on whoever it suits.
export function gearUp(party, sc, seed) {
    const run = RunState.create({ jobs: party.map(m => m.job), seed });
    run.party = party;
    for (const [act, kind] of rewardsBefore(sc)) {
        run.act = act;
        const offer = run._rollItems(ITEM_RARITY[act][kind], 3, kind);
        const score = (k) => {
            const ups = new Set(strictUpgradeFor(run, k));
            const best = equipOptions(run, k).wearers.filter(w => ups.has(w.member));
            return best.length ? Math.max(...best.map(w => w.score)) : -1;
        };
        const pick = offer.map(k => [k, score(k)]).sort((a, b) => b[1] - a[1])[0]?.[0];
        if (!pick) continue;
        run.inventory[pick] = (run.inventory[pick] ?? 0) + 1;
        autoEquip(run, pick);
    }
}

export const TIER1 = Object.keys(JOB_DATA).filter(j => JOB_DATA[j].promotions?.length);
export const TIER2 = TIER1.flatMap(j => JOB_DATA[j].promotions);
const originOf = (job) => TIER1.find(j => JOB_DATA[j].promotions.includes(job)) ?? job;

// mulberry32: a small seeded generator to stand in for Math.random.
function seeded(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// A member of `job` (tier 1 or 2) at `level`, spending points on build `b` (0 or 1), as a
// player using build focus would.
export function makeMember(rng, job, level, b, taken) {
    const origin = originOf(job);
    const m = createMember(rng, origin, taken, { level: 1 });
    m.sp += START_BONUS_SP;
    const focus = buildsFor(origin)[b % Math.max(1, buildsFor(origin).length)]?.key;
    m.build = { mode: 'focus', focus };
    // Level up one at a time, so points go where they would on the way up.
    for (let l = 1; l <= level; l++) {
        m.level = l;
        if (l > 1) m.sp = (m.sp || 0) + 1;
        if (job !== origin && l === PROMOTION_LEVEL) {
            promote(m, job);
            m.build.promoFocus = buildsFor(job)[b % Math.max(1, buildsFor(job).length)]?.key;
        }
        focusAllocate(m);
    }
    return m;
}

/** Plays `battles` fights for `job` in scenario `sc`. Returns { wins, battles, hpLeft }. */
export function simClass(job, sc, { battles = 60, mode = 'mixed', seed = 1, build = null } = {}) {
    const pool = sc.tier === 1 ? TIER1 : TIER2;
    const others = pool.filter(j => j !== job && originOf(j) !== originOf(job));
    const fights = ACT_REALMS[sc.act].flatMap(realm => realmEncounters(realm, sc.kind).map(f => ({ ...f, realm })));
    let wins = 0, hpLeft = 0;
    const usage = { dealt: 0, healed: 0, taken: 0, abilities: {} };
    const realRandom = Math.random;
    try {
        for (let i = 0; i < battles; i++) {
            // The same numbers for every class: fight, map and companions depend only on i.
            Math.random = seeded(seed * 100003 + i * 7919);
            const rng = new Rng(seed * 31 + i);
            const jobs = [job];
            while (jobs.length < sc.size) {
                if (mode === 'mono') { jobs.push(job); continue; }
                // Companions from different starting classes, as recruits are.
                const free = others.filter(j => !jobs.some(x => originOf(x) === originOf(j)));
                jobs.push(rng.pick(free));
            }
            const party = [];
            jobs.forEach((j, k) => party.push(makeMember(rng, j, sc.level, k === 0 && build != null ? build : (i + k) % 2, party.map(m => m.name))));
            gearUp(party, sc, seed * 977 + i);
            const { def, zone, realm } = fights[i % fights.length];
            const encounter = buildEncounter(def, sc.kind, sc.act, party.length, false, realm, zone);
            const map = loadMapData(pickRealmMap(zone, Math.random));
            const units = buildUnits({ party, encounter }, map.playerSpawns, map.enemySpawns);
            const battle = new TacticalBattle(map, units);
            runRealtimeBattle(battle, {});
            // The tested member (the party's first): what it did, by ability.
            const line = battle.stats?.byUnit.get(units.find(u => u.name === party[0].name)?.id);
            if (line) {
                usage.dealt += line.dealt; usage.healed += line.healed; usage.taken += line.taken;
                for (const [k, a] of Object.entries(line.abilities)) {
                    const u = (usage.abilities[k] ??= { uses: 0, dealt: 0, healed: 0 });
                    u.uses += a.uses; u.dealt += a.dealt; u.healed += a.healed;
                }
            }
            if (battle.winner === 'player') {
                wins++;
                const mine = battle.units.filter(u => u.team === 'player' && u.summonerId == null);
                hpLeft += mine.reduce((s, u) => s + Math.max(0, u.hp), 0) / mine.reduce((s, u) => s + u.maxHp, 0);
            }
        }
    } finally {
        Math.random = realRandom;
    }
    return { wins, battles, hpLeft: wins ? hpLeft / wins : 0, usage };
}

/** Win rates for every class of the scenario's tier (or `jobs`): [{ job, rate, hpLeft }], best first. */
export function simScenario(sc, opts = {}, jobs = sc.tier === 1 ? TIER1 : TIER2) {
    return jobs.map(job => {
        const r = simClass(job, sc, opts);
        return { job, rate: r.wins / r.battles, hpLeft: r.hpLeft };
    }).sort((a, b) => b.rate - a.rate);
}

// The same, one class per worker thread, so a full table takes a fraction of the time.
async function simScenarioParallel(name, opts, jobs) {
    const queue = [...jobs], rows = [];
    const threads = Math.max(1, Math.min(queue.length, availableParallelism() - 1));
    const runWorker = () => new Promise((resolve, reject) => {
        const next = () => {
            const job = queue.shift();
            if (!job) { w.terminate(); resolve(); return; }
            w.postMessage({ name, opts, job });
        };
        const w = new Worker(new URL(import.meta.url), { workerData: { worker: true } });
        w.on('message', (r) => { rows.push(r); next(); });
        w.on('error', reject);
        next();
    });
    await Promise.all(Array.from({ length: threads }, runWorker));
    return rows.sort((a, b) => b.rate - a.rate);
}

const median = (xs) => {
    const s = [...xs].sort((a, b) => a - b);
    return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

// A class this far from the median, either way, is flagged.
export const BALANCE_BAND = 0.10;

async function main(argv) {
    const arg = (name, fallback) => {
        const i = argv.indexOf(`--${name}`);
        return i >= 0 ? argv[i + 1] : fallback;
    };
    const opts = { battles: +arg('battles', 60), mode: arg('mode', 'mixed'), seed: +arg('seed', 1), build: arg('build', null) == null ? null : +arg('build') };
    const only = arg('scenario', null);
    const pick = arg('jobs', null)?.split(',');
    const names = only ? only.split(',') : Object.keys(SCENARIOS);
    const out = {};
    for (const name of names) {
        const sc = SCENARIOS[name];
        if (!sc) throw new Error(`Unknown scenario ${name}. Known: ${Object.keys(SCENARIOS).join(', ')}`);
        const tierJobs = sc.tier === 1 ? TIER1 : TIER2;
        const jobs = pick ? tierJobs.filter(j => pick.includes(j)) : tierJobs;
        if (!jobs.length) continue;
        const t0 = Date.now();
        const rows = await simScenarioParallel(name, opts, jobs);
        out[name] = rows;
        if (argv.includes('--json')) continue;
        // With --jobs the median isn't the whole tier's, so nothing is flagged.
        const med = pick ? null : median(rows.map(r => r.rate));
        console.log(`\n${name} (act ${sc.act} ${sc.kind}, level ${sc.level}, ${opts.mode}, ${opts.battles} battles each, ${((Date.now() - t0) / 1000).toFixed(1)}s)${med == null ? '' : `  median ${(med * 100).toFixed(0)}%`}`);
        for (const r of rows) {
            const off = med == null ? 0 : r.rate - med;
            const flag = off > BALANCE_BAND ? '  ▲ strong' : off < -BALANCE_BAND ? '  ▼ weak' : '';
            console.log(`  ${r.job.padEnd(14)} ${(r.rate * 100).toFixed(0).padStart(3)}%   hp left ${(r.hpLeft * 100).toFixed(0).padStart(3)}%${flag}`);
            // --usage: per battle, what the tested member dealt, healed and took, and each ability's share.
            if (argv.includes('--usage')) {
                const per = (x) => (x / r.battles).toFixed(0);
                console.log(`      dealt ${per(r.usage.dealt)}  healed ${per(r.usage.healed)}  taken ${per(r.usage.taken)}`);
                for (const [k, a] of Object.entries(r.usage.abilities).sort((x, y) => y[1].uses - x[1].uses)) {
                    console.log(`        ${k.padEnd(22)} ${(a.uses / r.battles).toFixed(1).padStart(5)} uses  ${per(a.dealt).padStart(4)} dmg  ${per(a.healed).padStart(4)} heal`);
                }
            }
        }
    }
    if (argv.includes('--json')) console.log(JSON.stringify(out, null, 2));
}

if (!isMainThread && workerData?.worker) {
    parentPort.on('message', ({ name, opts, job }) => {
        const r = simClass(job, SCENARIOS[name], opts);
        parentPort.postMessage({ job, rate: r.wins / r.battles, hpLeft: r.hpLeft, usage: r.usage, battles: r.battles });
    });
} else if (import.meta.url === `file://${process.argv[1]}`) {
    main(process.argv.slice(2));
}
