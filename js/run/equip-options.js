// "Who should wear this?": for one item, every party member who could equip it, with what
// they wear in that slot now and what would change. The equip picker (ui/equip-picker.js)
// shows it after a new item is taken, bought or found.
import { EQUIPMENT } from '../tactical/data/equipment.js';
import { ABILITIES } from '../tactical/data-registry.js';
import { JOB_DATA } from '../content/jobs.js';
import { memberJobs } from '../tactical/loadout.js';
import { equipDelta, STATS } from './member-stats.js';

const fieldOf = (key) => `${EQUIPMENT[key]?.slot}Key`;
const skillsOf = (key) => (key ? [...(EQUIPMENT[key]?.grants ?? []), ...(EQUIPMENT[key]?.grantsPassive ?? [])] : []);

// ---- How much a stat is worth to a class ----
// A stat change is weighed by how much the member's class uses that stat, so "+2 MP" isn't
// an upgrade for a Warlord, and "+6 ATK, −1 MAT" isn't a trade-off for an Evoker. Everything
// comes from the class's own data, so new classes are covered without extra content.
//
// Offense: the share of the class's damaging and healing skills (current class and, once
// promoted, the starting one) that are physical vs magic. The plain Attack counts as physical
// only for classes whose base ATK is at least their MAT. A class with no such skills (Seer)
// goes by its base stats. The bigger side weighs 1.
// Other stats weigh roughly what one point is worth next to one point of ATK or MAT.
const BASE_WEIGHTS = { maxHp: 0.12, maxMp: 0.08, mpRegen: 1.5, def: 0.5, mdf: 0.6, spd: 2.5, move: 2, eva: 0.4, crit: 0.4 };
const SKILL_WEIGHT = 2;      // an item skill gained or lost
const VERDICT_MARGIN = 0.75; // a weighted change smaller than this either way is not an up/downgrade

/** Per-stat weights for a member's class: { atk, mat, def, ... } (0 = the class doesn't use it). */
export function statWeights(member) {
    const jobs = memberJobs(member).length ? memberJobs(member) : [member.job];
    const job = JOB_DATA[member.job] ?? {};
    let phys = (job.atk ?? 0) >= (job.mat ?? 0) ? 1 : 0, mag = 0;
    for (const j of jobs) {
        for (const k of Object.keys(JOB_DATA[j]?.learnable ?? {})) {
            const a = ABILITIES[k];
            if (!a || (a.slot ?? 'action') !== 'action' || !(a.basePower > 0)) continue;
            if (a.type === 'physical') phys++;
            else if (a.type === 'magic') mag++;
        }
    }
    if (!phys && !mag) { phys = job.atk ?? 1; mag = job.mat ?? 1; }
    const top = Math.max(phys, mag);
    const usesMp = (job.maxMp ?? 0) > 0;
    return {
        ...BASE_WEIGHTS,
        atk: phys / top, mat: mag / top,
        def: job.ai?.melee ? 0.8 : BASE_WEIGHTS.def,
        maxMp: usesMp ? BASE_WEIGHTS.maxMp : 0,
        mpRegen: usesMp ? BASE_WEIGHTS.mpRegen : 0,
    };
}

/**
 * Rates a gear swap for a member.
 * @returns {{ score: number, verdict: 'upgrade'|'downgrade'|'mixed'|'minor'|'same', unused: string[] }}
 *   score: the weighted change. upgrade / downgrade: clearly better / worse for this class.
 *   mixed: a real trade-off that about evens out. minor: it only changes stats the class
 *   barely uses. same: nothing changes. unused: changed stats the class doesn't use at all.
 */
export function rateSwap(member, delta, gains = [], loses = []) {
    const w = statWeights(member);
    let score = (gains.length - loses.length) * SKILL_WEIGHT, ups = gains.length > 0, downs = loses.length > 0, any = ups || downs;
    const unused = [];
    for (const [s] of STATS) {
        const d = delta[s] ?? 0;
        if (!d) continue;
        any = true;
        if (!(w[s] > 0)) { unused.push(s); continue; }
        score += d * w[s];
        if (d > 0) ups = true; else downs = true;
    }
    let verdict;
    if (!any) verdict = 'same';
    else if (score > VERDICT_MARGIN) verdict = 'upgrade';
    else if (score < -VERDICT_MARGIN) verdict = 'downgrade';
    else verdict = ups && downs ? 'mixed' : 'minor';
    return { score, verdict, unused };
}

/**
 * How an item compares for each party member.
 * @param {import('./run-state.js').RunState} run
 * @param {string} key  An item key (enchanted keys work too).
 * @returns {{ field: string, wearers: Array<{ member: object, current: string|null, delta: object,
 *   after: object, gains: string[], loses: string[], score: number, verdict: string, unused: string[],
 *   best: boolean }>, others: object[] }}
 *   wearers: members who can equip it, in party order. current: what they wear in the slot now.
 *   delta: stat changes (STATS keys). gains / loses: skills the swap adds / takes away.
 *   score, verdict, unused: see rateSwap. best: the clearest upgrade among them, if any.
 *   others: members who can't equip it.
 */
export function equipOptions(run, key) {
    const field = fieldOf(key);
    const wearers = [], others = [];
    for (const m of run.party) {
        if (!run.canEquip(m, key)) { others.push(m); continue; }
        const current = m.appearance?.[field] ?? null;
        const { delta, after } = equipDelta(run, m, field, key);
        const now = skillsOf(current), next = skillsOf(key);
        const gains = next.filter(a => !now.includes(a)), loses = now.filter(a => !next.includes(a));
        const { score, verdict, unused } = rateSwap(m, delta, gains, loses);
        wearers.push({ member: m, current, delta, after, gains, loses, score, verdict, unused, best: false });
    }
    // The member it suits best, when it's a clear upgrade for anyone.
    const top = wearers.filter(w => w.verdict === 'upgrade').sort((a, b) => b.score - a.score)[0];
    if (top) top.best = true;
    return { field, wearers, others };
}

/** Whether to offer "Equip now" for an item: it's in the bag and someone could wear it. */
export function canOfferEquip(run, key) {
    return !!key && (run.inventory?.[key] ?? 0) > 0 && run.party.some(m => run.canEquip(m, key));
}

// ---- Auto-equip ----

/**
 * A strict upgrade, safe to make without asking: an Upgrade where nothing the class uses goes
 * down and no item skill is lost.
 * @param {{ verdict: string, delta: object, unused: string[], loses: string[] }} w  An equipOptions wearer.
 */
export function isStrictUpgrade(w) {
    return w.verdict === 'upgrade' && !w.loses.length
        && STATS.every(([s]) => !((w.delta[s] ?? 0) < 0) || w.unused.includes(s));
}

/**
 * The party members an item would be a strict upgrade for (isStrictUpgrade) over what they
 * wear now, best first. It needn't be owned yet: reward and shop screens flag these picks.
 */
export function strictUpgradeFor(run, key) {
    if (!EQUIPMENT[key]) return [];
    return equipOptions(run, key).wearers.filter(isStrictUpgrade).sort((a, b) => b.score - a.score).map(w => w.member);
}

/**
 * Equips a newly gained item on the member it's the biggest strict upgrade for, then does the
 * same with whatever that member took off, and so on. Every move strictly improves the member
 * receiving it, so the chain ends; the guard is only a backstop.
 * @returns {Array<{ key: string, name: string|null, job: string|null, replaced: string|null }>}
 *   One entry per item placed, in order: the new item first, then each item it displaced.
 *   name null: that item stayed in the bag (no strict upgrade for anyone). Empty: nothing moved.
 */
export function autoEquip(run, key) {
    const moves = [];
    let next = key;
    for (let guard = 0; next && guard < 12; guard++) {
        if (!canOfferEquip(run, next)) break;
        const { field, wearers } = equipOptions(run, next);
        const best = wearers.filter(isStrictUpgrade).sort((a, b) => b.score - a.score)[0];
        if (!best) {
            if (moves.length) moves.push({ key: next, name: null, job: null, replaced: null });
            break;
        }
        if (!run.equip(best.member.name, field, next)) break;
        moves.push({ key: next, name: best.member.name, job: best.member.job, replaced: best.current });
        next = best.current;
    }
    return moves;
}
