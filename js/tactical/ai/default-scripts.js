// Default behavior for player characters. autoScriptFor() builds a script from the
// abilities a character actually has, so a newly learned or equipped skill gets used
// without the player writing any rules; players can still write their own (see
// script-store.js). defaultScriptFor(job) is the simpler per-job starter. Each call
// returns a fresh copy so callers may mutate the result.
// Enemies do not use these: they keep the scoring AI in enemy-ai.js.
import { ABILITIES, baseKey } from '../data-registry.js';
import { POSITIVE_STATUSES } from '../abilities.js';

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
    paladin: MELEE_HEALER,
    beastcaller: MELEE_SUMMONER,
    evoker: RANGED(3), runebow: RANGED(4), riftcaller: RANGED(4), fatebinder: RANGED(3), seer: RANGED(3),
    spiritbinder: RANGED_SUMMONER, worldsinger: RANGED_SUMMONER,
    warden: HEALER, sanctifier: HEALER, lifeseer: HEALER,
};

export function defaultScriptFor(job) {
    return (BY_JOB[job] ?? GENERIC)();
}

// ---- Automatic behavior from a character's abilities ----

// Jobs that fight from range and should keep out of harm's way (see positionStyle in
// script-runtime.js). Healers aren't listed: holding them back lost fights.
export const RANGED_ROLES = new Set(['evoker', 'runebow', 'riftcaller', 'fatebinder', 'seer', 'spiritbinder', 'worldsinger']);

const RANGED_KEEP = { evoker: 3, runebow: 4, riftcaller: 4, fatebinder: 3, seer: 3, spiritbinder: 3, worldsinger: 3, sanctifier: 3, lifeseer: 3, warden: 3 };
const MELEE_JOBS = new Set(['novice', 'spellblade', 'battlemage', 'earthshaker', 'stoneshaper', 'paladin', 'beastcaller']);
const HEALER_JOBS = new Set(['warden', 'sanctifier', 'lifeseer', 'paladin']);

const statusFilter = (status) => [{ kind: 'status', status, has: false }];

// A script that uses every kind of ability in `abilities` (unit ability keys, any rank),
// in priority order: revive and heal, cure, summon, ally support, self buffs, control
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
    if (MELEE_JOBS.has(job)) rules.push(brace(id()));
    if (of(a => a.isSummon).length) rules.push(summon(id()));
    // Haste is always worth it; protective buffs go on allies who are getting hurt;
    // anything else (reflect, reraise) is cast once at the start.
    for (const k of of(a => a.targetType === 'ally' && !a.isHeal && !a.isCure && a.applyStatus)) {
        const ab = ABILITIES[k];
        const target = (pick, extra = []) => ally(pick, [...statusFilter(ab.applyStatus), ...extra]);
        const [when, label, tgt] = ab.applyStatus === 'haste'
            ? [test('enemy_within', { range: 7 }), `${ab.name} on an ally without haste`, target('nearest')]
            : ['protect', 'shell', 'regen'].includes(ab.applyStatus)
                ? [test('ally_hp_below', { value: 70 }), `${ab.name} on a hurt ally`, target('lowest_hp_pct', [{ kind: 'hp_below', value: 70 }])]
                : [test('first_turn'), `${ab.name} on an ally at the start`, target('nearest')];
        rules.push(rule(id(), label, when, { do: 'ability', ability: k, target: tgt, approach: true }));
    }
    for (const k of of(a => a.targetType === 'self' && !a.isHeal && !a.isSummon)) {
        rules.push(rule(id(), `${ABILITIES[k].name} when enemies are close`, test('enemy_within', { range: 2 }),
            { do: 'ability', ability: k }));
    }
    // Control spells are saved for healthy enemies; weakened ones just get finished off.
    for (const k of of(a => a.targetType === 'enemy' && a.applyStatus && !a.basePower && !POSITIVE_STATUSES.includes(a.applyStatus))) {
        const ab = ABILITIES[k];
        rules.push(rule(id(), `${ab.name} on a healthy enemy without ${ab.applyStatus}`, test('target_hp_pct', { cmp: '>=', value: 60 }),
            { do: 'ability', ability: k, target: enemy('nearest', statusFilter(ab.applyStatus)), approach: true }));
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
