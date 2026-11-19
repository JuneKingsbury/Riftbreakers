// Elite affixes (js/content/affixes.js, run/data/affixes.js): an elite fight's leader gets
// one affix in Acts 1 and 2 and two in Acts 3 and 4; normal and boss fights get none. They
// come from their own stream of the seed, and change the leader in battle as described.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { RunState } from '../../js/run/run-state.js';
import { Rng } from '../../js/run/rng.js';
import { rollEncounter } from '../../js/run/data/encounters.js';
import { AFFIXES, rollAffixes, affixedName } from '../../js/run/data/affixes.js';
import { buildUnits } from '../../js/tactical/build-units.js';
import { passivesOf, inflictStatus } from '../../js/tactical/abilities.js';
import { TacticalBattle } from '../../js/tactical/battle.js';
import { createUnit } from '../../js/tactical/units.js';
import { gridMap } from '../map-fixtures.mjs';

const field = () => gridMap(Array.from({ length: 5 }, () => '.'.repeat(8)));
const spawns = (n, x) => Array.from({ length: n }, (_, i) => ({ x, y: i }));

// A one-enemy encounter whose leader has the given affixes.
const encounterWith = (affixes, job = 'orc_captain') => ({
    enemyLevel: 1, roster: [{ job, name: 'Bandit Captain', affixes }, { job: 'raider', name: 'Raider' }],
});
const leaderWith = (affixes, job) =>
    buildUnits({ party: [], encounter: encounterWith(affixes, job) }, [], spawns(2, 7)).find(u => u.team === 'enemy');

test('elite leaders get one affix in Acts 1 and 2 and two different ones in Acts 3 and 4; other fights none', () => {
    for (let i = 0; i < 40; i++) {
        assert.equal(rollAffixes(7, i, 'elite', 1).length, 1);
        assert.equal(rollAffixes(7, i, 'elite', 2).length, 1);
        for (const act of [3, 4]) {
            const two = rollAffixes(7, i, 'elite', act);
            assert.equal(two.length, 2);
            assert.notEqual(two[0], two[1], 'never the same affix twice');
        }
        for (const act of [1, 2, 3, 4]) {
            assert.deepEqual(rollAffixes(7, i, 'normal', act), []);
            assert.deepEqual(rollAffixes(7, i, 'boss', act), []);
        }
    }
});

test('the same seed and fight always roll the same affixes, and act-limited ones stay in their acts', () => {
    assert.deepEqual(rollAffixes(1234, 5, 'elite', 3), rollAffixes(1234, 5, 'elite', 3));
    const act1 = new Set(Array.from({ length: 200 }, (_, i) => rollAffixes(99, i, 'elite', 1)[0]));
    assert.ok(!act1.has('undying'), 'Undying is for Acts 2 to 4');
    assert.ok(act1.size >= 6, 'Act 1 draws on most of the affixes');
});

test("a run's elite fight puts its affix on the leader only, without shifting the run's other rolls", () => {
    // GIVEN: a run, and a copy of its random state
    const run = RunState.create({ jobs: ['warden', 'evoker', 'runebow'], seed: 42 });
    const twin = new Rng(); twin.state = run.rng.state;
    const seenBefore = [...run.seenEncounters];

    // WHEN: the run rolls an elite fight
    const enc = run._rollEncounter('elite');

    // THEN: the leader has one affix, the rest none, and the run's rolls moved exactly as
    // much as rolling the same fight without affixes
    assert.equal(enc.roster[0].affixes.length, 1);
    assert.ok(enc.roster.slice(1).every(r => !r.affixes));
    const plain = rollEncounter(twin, run.realmId, run.act, 'elite', run.party.length, seenBefore, false);
    assert.equal(plain.id, enc.id);
    assert.equal(run.rng.state, twin.state);
});

test("the leader's affixes go before its name, but its sprite is still found by its own name", () => {
    // GIVEN / WHEN: a leader with two affixes
    const leader = leaderWith(['thorned', 'hasted']);

    // THEN
    assert.equal(leader.name, 'Thorned Hasted Bandit Captain');
    assert.equal(leader.spriteName, 'Bandit Captain');
    assert.equal(affixedName('Raider', []), 'Raider');
});

test('affixes give the leader their statuses, passives and stats', () => {
    const plain = leaderWith([]);

    assert.ok(['protect', 'shell'].every(s => leaderWith(['shielded']).status.includes(s)), 'Shielded starts protected');
    assert.ok(leaderWith(['regenerating']).status.includes('regen'));
    const hasted = leaderWith(['hasted']);
    assert.ok(hasted.status.includes('haste'));
    assert.equal(hasted.spd, plain.spd + 2);
    assert.ok(passivesOf(leaderWith(['thorned']), 'reaction').includes('affix_thorns'));
    const hulking = leaderWith(['hulking']);
    assert.equal(hulking.maxHp, Math.round(plain.maxHp * 1.4));
    assert.equal(hulking.hp, hulking.maxHp, 'it starts at full HP');
});

test('an affix a save names but the game no longer has is ignored', () => {
    const leader = leaderWith(['no_such_affix']);
    assert.equal(leader.name, 'Bandit Captain');
    assert.equal(leader.affixes, undefined);
});

function withRandom(value, fn) {
    const orig = Math.random;
    Math.random = () => value;
    try { return fn(); } finally { Math.random = orig; }
}

test('a Vampiric leader heals for part of the damage it deals, with weapons or spells', () => {
    for (const [job, ability] of [['orc_captain', 'attack'], ['shadow_mage', 'shadow_bolt']]) {
        // GIVEN: a wounded Vampiric leader next to a party member
        const leader = leaderWith(['vampiric'], job);
        leader.x = 1; leader.y = 0; leader.hp = 10;
        const hero = Object.assign(createUnit('Hero', 'goblin', 'player', 0, 0), { eva: 0, maxHp: 500, hp: 500 });
        const battle = new TacticalBattle(field(), [hero, leader]);

        // WHEN: it strikes
        withRandom(0.5, () => battle.applyEnemyAbility(leader, ability, 0, 0));
        if (leader._charging) { leader._charging.ct = leader._charging.needed; withRandom(0.5, () => battle.checkAndFireCharges()); }

        // THEN: it healed 35% of the damage dealt
        const dealt = 500 - hero.hp;
        assert.ok(dealt > 0, `${ability} hit`);
        assert.equal(leader.hp, 10 + Math.round(dealt * 0.35), ability);
    }
});

test('a Warded leader shrugs off stuns, slows and sleep, but not every status', () => {
    const leader = leaderWith(['warded']);
    for (const s of ['stun', 'slow', 'sleep']) {
        assert.equal(inflictStatus(leader, s, 3), false, s);
        assert.ok(!leader.status.includes(s), s);
    }
    assert.equal(inflictStatus(leader, 'doom', 3), true, 'Doom still lands');
});

test('every affix says what it does', () => {
    for (const [k, a] of Object.entries(AFFIXES)) assert.ok(a.desc.length > 10 && a.name, k);
});

test('at Rift Tier VI elite leaders get one more affix, all different', () => {
    for (let i = 0; i < 30; i++) {
        const early = rollAffixes(7, i, 'elite', 1, 6);
        const late = rollAffixes(7, i, 'elite', 3, 6);
        assert.equal(early.length, 2);
        assert.equal(late.length, 3);
        assert.equal(new Set(late).size, 3);
        assert.equal(rollAffixes(7, i, 'elite', 3, 5).length, 2, 'Tier V adds none');
        assert.deepEqual(rollAffixes(7, i, 'boss', 3, 6), [], 'still none on bosses');
    }
});

test('a Splitting leader breaks into two weaker copies when knocked out, and the fight goes on', () => {
    // GIVEN: a Splitting leader, the only enemy, nearly beaten next to a strong party member
    const leader = leaderWith(['splitting']);
    leader.x = 3; leader.y = 2;
    const hero = Object.assign(createUnit('Hero', 'goblin', 'player', 2, 2), { eva: 0, atk: 300, maxHp: 900, hp: 900 });
    leader.eva = 0;
    const battle = new TacticalBattle(field(), [hero, leader]);
    const fullHp = leader.maxHp;
    leader.hp = 1;

    // WHEN: it is knocked out
    withRandom(0.5, () => battle.applyEnemyAbility(hero, 'attack', leader.x, leader.y));

    // THEN: two copies stand beside it, weaker, on its side, and the battle isn't over
    const copies = battle.units.filter(u => u.name === 'Bandit Captain Fragment');
    assert.equal(copies.length, 2);
    for (const c of copies) {
        assert.equal(c.team, 'enemy');
        assert.equal(c.maxHp, Math.round(fullHp * 0.35));
        assert.equal(c.atk, Math.round(leader.atk * 0.7));
        assert.equal(c.spriteName, 'Bandit Captain');
        assert.ok(Math.abs(c.x - leader.x) + Math.abs(c.y - leader.y) <= 3);
        assert.ok(!passivesOf(c, 'reaction').includes('affix_split'), 'copies do not split again');
    }
    assert.equal(battle.winner, null);

    // AND: knocking a copy out splits nothing further
    const [first] = copies;
    first.hp = 1;
    withRandom(0.5, () => battle.applyEnemyAbility(hero, 'attack', first.x, first.y));
    assert.equal(battle.units.filter(u => u.name.endsWith('Fragment')).length, 2);
});
