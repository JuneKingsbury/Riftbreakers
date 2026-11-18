// Default behavior for player characters. autoScriptFor() builds a script from the
// abilities a character actually has, so a newly learned or equipped skill gets used
// without the player writing any rules; players can still write their own (see
// script-store.js). defaultScriptFor(job) is the simpler per-job starter. Each call
// returns a fresh copy so callers may mutate the result.
// Enemies do not use these: they keep the scoring AI in enemy-ai.js.
import { ABILITIES, baseKey } from '../data-registry.js';
import { POSITIVE_STATUSES, isHelpful } from '../abilities.js';
import { JOB_DATA } from '../data/jobs.js';

const always = () => ({ test: 'always', params: {} });
const test = (name, params = {}) => ({ test: name, params });
const enemy = (pick, filters) => ({ side: 'enemy', pick, ...(filters ? { filters } : {}) });
const ally = (pick, filters) => ({ side: 'ally', pick, ...(filters ? { filters } : {}) });

const rule = (id, label, when, then) => ({ id, label, enabled: true, when, then });
const attack = (id, label, pick) =>
    rule(id, label, always(), { do: 'ability', ability: 'best_damage', target: enemy(pick), approach: true });
const heal = (id, below) =>
    rule(id, 'Heal the most wounded ally', test('ally_hp_below', { value: below }),
        { do: 'ability', ability: 'best_heal', target: ally('lowest_hp_pct'), approach: true });
const revive = (id) =>
    rule(id, 'Revive a fallen ally', test('ally_unconscious'),
        { do: 'ability', ability: 'best_heal', approach: true,
          target: ally('nearest', [{ kind: 'status', status: 'unconscious', has: true }]) });
// Calls a creature while the team is not clearly ahead, and not when nearly dead.
const summon = (id) =>
    rule(id, 'Call a creature while not clearly ahead',
        { op: 'and', args: [test('team_advantage', { cmp: '<', value: 2 }), test('self_hp_pct', { cmp: '>=', value: 25 })] },
        { do: 'ability', ability: 'best_summon' });

const brace = (id) =>
    rule(id, 'Brace when badly hurt and an enemy is close',
        { op: 'and', args: [test('self_hp_pct', { cmp: '<', value: 25 }), test('enemy_within', { range: 2 })] },
        { do: 'defend' });
// Steps to `range` tiles from the nearest enemy when one gets close, so the unit
// can still use its attack from the new tile. A plain "move away" would run a
// caster out of its own spell range.
const kite = (id, range) =>
    rule(id, 'Back off to attack range when enemies get close', test('enemy_within', { range: 2 }),
        { do: 'move', mode: 'keep_range', range, target: enemy('nearest') });

const GENERIC = () => ({ version: 1, rules: [attack('r1', 'Attack the weakest enemy', 'lowest_hp')] });
const MELEE = () => ({ version: 1, rules: [brace('r1'), attack('r2', 'Attack the nearest enemy', 'nearest')] });
const MELEE_HEALER = () => ({ version: 1, rules: [brace('r1'), heal('r2', 45), attack('r3', 'Attack the nearest enemy', 'nearest')] });
const MELEE_SUMMONER = () => ({ version: 1, rules: [summon('r1'), brace('r2'), attack('r3', 'Attack the nearest enemy', 'nearest')] });
const RANGED = (range = 3) => () => ({ version: 1, rules: [kite('r1', range), attack('r2', 'Hit the weakest enemy with the best attack', 'lowest_hp')] });
const RANGED_SUMMONER = () => ({ version: 1, rules: [summon('r1'), kite('r2', 3), attack('r3', 'Hit the weakest enemy with the best attack', 'lowest_hp')] });
const HEALER = () => ({
    version: 1,
    rules: [revive('r1'), heal('r2', 60), attack('r3', 'Attack the nearest enemy', 'nearest')],
});

const BY_JOB = {
    novice: MELEE, spellblade: MELEE, battlemage: MELEE, earthshaker: MELEE, stoneshaper: MELEE,
    paladin: MELEE_HEALER, bastion: MELEE,
    beastcaller: MELEE_SUMMONER,
    evoker: RANGED(3), runebow: RANGED(4), riftcaller: RANGED(4), skyhunter: RANGED(4), fatebinder: RANGED(3), seer: RANGED(3),
    spiritbinder: RANGED_SUMMONER, worldsinger: RANGED_SUMMONER,
    warden: HEALER, sanctifier: HEALER, lifeseer: HEALER,
};

export function defaultScriptFor(job) {
    return (BY_JOB[job] ?? GENERIC)();
}

// ---- Automatic behavior from a character's abilities ----

// Jobs that fight from range and should keep out of harm's way (see positionStyle in
// script-runtime.js). Healers aren't listed: holding them back lost fights.
export const RANGED_ROLES = new Set(['evoker', 'runebow', 'riftcaller', 'skyhunter', 'fatebinder', 'seer', 'spiritbinder', 'worldsinger',
    'illusionist', 'dreamweaver', 'mirage_oracle', 'gravecaller', 'lich', 'alchemist', 'plaguewright']);

const RANGED_KEEP = { evoker: 3, runebow: 4, riftcaller: 4, skyhunter: 4, fatebinder: 3, seer: 3, spiritbinder: 3, worldsinger: 3, sanctifier: 3, lifeseer: 3, warden: 3,
    illusionist: 3, dreamweaver: 3, mirage_oracle: 3, gravecaller: 3, lich: 3, gravewarden: 3, alchemist: 3, plaguewright: 3, field_surgeon: 3 };
const MELEE_JOBS = new Set(['novice', 'spellblade', 'battlemage', 'earthshaker', 'stoneshaper', 'paladin', 'beastcaller',
    'warlord', 'marshal', 'tactician', 'bastion']);
const HEALER_JOBS = new Set(['warden', 'sanctifier', 'lifeseer', 'paladin', 'field_surgeon']);

const statusFilter = (status) => [{ kind: 'status', status, has: false }];

// Order of control spells in automatic behavior (higher first); unlisted statuses count 1.
const CONTROL_VALUE = { charm: 6, stun: 5, silence: 4, slow: 3, poison: 2, sleep: 0 };

// A script that uses every kind of ability in `abilities` (unit ability keys, any rank),
// in priority order: revive and heal, cure, summon, ally support (status, then stat buffs), self buffs, control
// spells on healthy enemies, then the best attack. Ranged jobs regroup when cut off and keep
// their distance; melee jobs brace when nearly dead. Every rule uses 'auto' positioning
// (see positionStyle in script-runtime.js): careful for ranged attackers, bold otherwise.
// Rules that have nothing useful to do fall through to the next.
export function autoScriptFor(job, abilities = []) {
    const abs = [...new Set(abilities.map(baseKey))].filter(k => k !== 'attack' && ABILITIES[k] && !ABILITIES[k].passive);
    const of = (pred) => abs.filter(k => pred(ABILITIES[k]));
    const rules = [];
    let n = 0;
    const id = () => `a${++n}`;

    const heals = of(a => a.isHeal);
    if (heals.length) {
        rules.push(revive(id()));
        rules.push(heal(id(), HEALER_JOBS.has(job) ? 60 : 40));
    }
    if (of(a => a.isCure && !a.isHeal).length) {
        rules.push(rule(id(), 'Cure an afflicted ally', always(),
            { do: 'ability', ability: 'best_cure', target: ally('lowest_hp_pct'), approach: true }));
    }
    // Corpse rites (the Gravecaller line) go to work on knocked-out enemies. Each only fires where
    // it has something to do (a burst needs enemies by the body, a ward needs allies), so the
    // situational ones come first and plain raising is the fallback.
    const CORPSE_ORDER = { burst: 0, ward: 1, raise: 2 };
    const rites = of(a => a.targetType === 'corpse')
        .sort((a, b) => CORPSE_ORDER[ABILITIES[a].corpseEffect] - CORPSE_ORDER[ABILITIES[b].corpseEffect]
            || (ABILITIES[b].corpseCount ?? 1) - (ABILITIES[a].corpseCount ?? 1));
    for (const k of rites) {
        rules.push(rule(id(), `${ABILITIES[k].name} on a fallen enemy`, always(),
            { do: 'ability', ability: k, target: enemy('nearest', [{ kind: 'status', status: 'unconscious', has: true }]), approach: true }));
    }
    // Reposition: swap into danger to pull out a badly hurt ally.
    for (const k of of(a => a.swapPlaces)) {
        rules.push(rule(id(), `${ABILITIES[k].name} to rescue a badly hurt ally`, test('ally_hp_below', { value: 35 }),
            { do: 'ability', ability: k, target: ally('lowest_hp_pct', [{ kind: 'hp_below', value: 35 }]), approach: true }));
    }
    if (MELEE_JOBS.has(job)) rules.push(brace(id()));
    const summons = of(a => a.isSummon);
    if (summons.length && summons.every(k => JOB_DATA[ABILITIES[k].summonJob]?.inert)) {
        // Copies (Mirror Image) are a shield, not an army: make one once enemies close in.
        rules.push(rule(id(), 'Make a copy once enemies close in',
            { op: 'and', args: [test('enemy_within', { range: 4 }), test('self_hp_pct', { cmp: '>=', value: 25 })] },
            { do: 'ability', ability: 'best_summon' }));
    } else if (summons.length) rules.push(summon(id()));
    // Delaying an enemy who is charging a spell is worth more than anything but healing.
    const orders = of(a => a.ctGain != null && !a.basePower && !a.swapPlaces && a.targetType !== 'all');
    for (const k of orders.filter(k => ABILITIES[k].ctGain < 0)) {
        rules.push(rule(id(), `${ABILITIES[k].name} an enemy who is charging a spell`, always(),
            { do: 'ability', ability: k, target: enemy('nearest', [{ kind: 'status', status: 'charging', has: true }]), approach: true }));
    }
    // Helpful splashes that reach both sides (Smoke Bomb, Quicksilver, Stimulant) go on the
    // thickest group of allies once the party is taking hits; they are only thrown where they
    // do more good than harm. The rest of the time the Alchemist attacks.
    for (const k of of(a => a.targetType === 'all' && isHelpful(a) && !a.isHeal && !a.isCure)) {
        rules.push(rule(id(), `${ABILITIES[k].name} on the group once it is taking hits`, test('ally_hp_below', { value: 80 }),
            { do: 'ability', ability: k, target: ally('most_clustered'), approach: true }));
    }
    // Haste is always worth it; protective buffs go on allies who are getting hurt;
    // anything else (reflect, reraise) is cast once at the start.
    for (const k of of(a => a.targetType === 'ally' && !a.isHeal && !a.isCure && a.applyStatus && a.ctGain == null)) {
        const ab = ABILITIES[k];
        // Shield Wall and the like only reach the caster and those beside it.
        if (ab.range === 0) {
            rules.push(rule(id(), `${ab.name} when enemies are close`, test('enemy_within', { range: 2 }),
                { do: 'ability', ability: k, target: { side: 'self', pick: 'nearest' } }));
            continue;
        }
        const target = (pick, extra = []) => ally(pick, [...statusFilter(ab.applyStatus), ...extra]);
        const [when, label, tgt] = ab.applyStatus === 'haste'
            ? [test('enemy_within', { range: 7 }), `${ab.name} on an ally without haste`, target('nearest')]
            : ab.applyStatus === 'hidden'
                // Vanish is an escape: only for an ally in real trouble.
                ? [test('ally_hp_below', { value: 40 }), `${ab.name} on a badly hurt ally`, target('lowest_hp_pct', [{ kind: 'hp_below', value: 40 }])]
            : ['protect', 'shell', 'regen'].includes(ab.applyStatus)
                ? [test('ally_hp_below', { value: 70 }), `${ab.name} on a hurt ally`, target('lowest_hp_pct', [{ kind: 'hp_below', value: 70 }])]
                : [test('first_turn'), `${ab.name} on an ally at the start`, target('nearest')];
        rules.push(rule(id(), label, when, { do: 'ability', ability: k, target: tgt, approach: true }));
    }
    // Stat buffs for allies. Offensive ones (Rallying Beat) go on the thickest group once the
    // fight is close; defensive ones (Blur) wait until someone is taking hits, then go on them.
    const DEFENSIVE = new Set(['def', 'mdf', 'eva']);
    for (const k of of(a => a.targetType === 'ally' && a.buffs && !a.basePower && !a.isHeal && !a.applyStatus)) {
        const ab = ABILITIES[k];
        const defensive = ab.buffs.every(b => DEFENSIVE.has(b.stat));
        rules.push(defensive
            ? rule(id(), `${ab.name} on an ally taking hits`, test('ally_hp_below', { value: 80 }),
                { do: 'ability', ability: k, target: ab.aoe ? ally('most_clustered') : ally('lowest_hp_pct', [{ kind: 'hp_below', value: 80 }]), approach: true })
            : rule(id(), `${ab.name} on the main group when enemies are near`, test('enemy_within', { range: 5 }),
                { do: 'ability', ability: k, target: ally('most_clustered'), approach: true }));
    }
    for (const k of of(a => a.targetType === 'self' && !a.isHeal && !a.isSummon)) {
        rules.push(rule(id(), `${ABILITIES[k].name} when enemies are close`, test('enemy_within', { range: 2 }),
            { do: 'ability', ability: k }));
    }
    // Control spells are saved for healthy enemies; weakened ones just get finished off. The most
    // telling go first. Sleep comes last: in a running fight, the next blow wakes the sleeper.
    const controlValue = (k) => CONTROL_VALUE[ABILITIES[k].applyStatus] ?? 1;
    const control = of(a => a.targetType === 'enemy' && a.applyStatus && !a.basePower && !POSITIVE_STATUSES.includes(a.applyStatus));
    for (const k of control.sort((a, b) => controlValue(b) - controlValue(a))) {
        const ab = ABILITIES[k];
        rules.push(rule(id(), `${ab.name} on a healthy enemy without ${ab.applyStatus}`, test('target_hp_pct', { cmp: '>=', value: 60 }),
            { do: 'ability', ability: k, target: enemy('nearest', statusFilter(ab.applyStatus)), approach: true }));
    }
    // Orders that move speed gauges come after control (so a Warlord taunts before it rallies):
    // the biggest rally first, then delaying the nearest enemy.
    for (const k of orders.sort((a, b) => ABILITIES[b].ctGain - ABILITIES[a].ctGain)) {
        const ab = ABILITIES[k];
        rules.push(ab.ctGain > 0
            ? rule(id(), `${ab.name} an ally when enemies are near`, test('enemy_within', { range: 6 }),
                { do: 'ability', ability: k, target: ally('nearest'), approach: true })
            : rule(id(), `${ab.name} the nearest enemy`, test('enemy_within', { range: 6 }),
                { do: 'ability', ability: k, target: enemy('nearest'), approach: true }));
    }
    const keep = RANGED_KEEP[job];
    if (keep && !MELEE_JOBS.has(job)) {
        // Cut off from the group and in reach of enemies: fall back to the others first.
        if (RANGED_ROLES.has(job)) rules.push(rule(id(), 'Regroup when cut off and threatened',
            { op: 'and', args: [test('self_isolated', { range: 5 }), test('self_threatened')] },
            { do: 'move', mode: 'regroup' }));
        rules.push(kite(id(), keep));
    }
    rules.push(MELEE_JOBS.has(job)
        ? attack(id(), 'Attack the nearest enemy', 'nearest')
        : attack(id(), 'Hit the weakest enemy with the best attack', 'lowest_hp'));
    return { version: 1, rules };
}
