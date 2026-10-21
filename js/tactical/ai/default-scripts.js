// Starter scripts for player characters, chosen by job until the player edits
// one. Each call returns a fresh deep copy so callers may mutate the result.
// Enemies do not use these: they keep the scoring AI in enemy-ai.js.

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
