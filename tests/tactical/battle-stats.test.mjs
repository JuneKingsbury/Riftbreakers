// The battle breakdown (battle-stats.js): what each unit did in a fight. Numbers must be
// the HP that actually changed, credited to the unit responsible, and keeping them must
// never change how the fight goes.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { gridMap } from '../map-fixtures.mjs';
import { createUnit } from '../../js/tactical/units.js';
import { TacticalBattle } from '../../js/tactical/battle.js';
import { runRealtimeBattle } from '../../js/tactical/realtime.js';
import { ABILITIES, inflictStatus } from '../../js/tactical/abilities.js';

const field = (w = 10, h = 5) => gridMap(Array.from({ length: h }, () => '.'.repeat(w)));

// A mid roll: no dodge, no crit, no proc.
function withRandom(value, fn) {
    const orig = Math.random;
    Math.random = () => value;
    try { return fn(); } finally { Math.random = orig; }
}

// A repeatable stream of rolls, so two fights can be compared roll for roll.
function withSeed(seed, fn) {
    const orig = Math.random;
    let s = seed >>> 0;
    Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
    try { return fn(); } finally { Math.random = orig; }
}

const unit = (name, job, team, x, y, extra = {}) =>
    Object.assign(createUnit(name, job, team, x, y), { eva: 0, ...extra });

const rowOf = (battle, team, name) => battle.stats.rows(team).find(r => r.name === name);

test('a finishing blow counts only the HP the target had left, and a knockout', () => {
    // GIVEN: a strong fighter next to an enemy with 5 HP left
    const hero = unit('Hero', 'goblin', 'player', 0, 0, { atk: 200 });
    const foe = unit('Foe', 'goblin', 'enemy', 1, 0, { hp: 5 });
    const battle = new TacticalBattle(field(), [hero, foe]);

    // WHEN: the fighter strikes it down
    withRandom(0.5, () => battle.applyEnemyAbility(hero, 'attack', 1, 0));

    // THEN: 5 damage is dealt and taken, and the fighter is credited with the knockout
    const h = rowOf(battle, 'player', 'Hero');
    assert.equal(foe.hp, 0);
    assert.equal(h.dealt, 5);
    assert.equal(h.kos, 1);
    assert.equal(rowOf(battle, 'enemy', 'Foe').taken, 5);
    assert.deepEqual(h.abilities.map(a => [a.key, a.dealt, a.kos, a.uses]), [['attack', 5, 1, 1]]);
});

test('healing counts only the HP restored, so topping up a healthy ally is no healing', () => {
    // GIVEN: a healer beside one healthy ally and one missing 7 HP
    const healer = unit('Healer', 'novice', 'player', 0, 0, { mat: 50 });
    const fine = unit('Fine', 'goblin', 'player', 1, 0);
    const hurt = unit('Hurt', 'goblin', 'player', 0, 1);
    hurt.hp = hurt.maxHp - 7;
    const foe = unit('Foe', 'goblin', 'enemy', 9, 4);
    const battle = new TacticalBattle(field(), [healer, fine, hurt, foe]);

    // WHEN: each is given first aid
    withRandom(0.5, () => {
        battle.applyEnemyAbility(healer, 'first_aid', 1, 0);
        battle.applyEnemyAbility(healer, 'first_aid', 0, 1);
    });

    // THEN: only the 7 HP that were missing count, over two uses
    const h = rowOf(battle, 'player', 'Healer');
    assert.equal(hurt.hp, hurt.maxHp);
    assert.equal(h.healed, 7);
    assert.deepEqual(h.abilities.map(a => [a.key, a.healed, a.uses]), [['first_aid', 7, 2]]);
});

test('a drain counts both the damage and the HP it gave back', () => {
    // GIVEN: a wounded necromancer in range of an enemy
    const caster = unit('Caster', 'gravecaller', 'player', 0, 0, { mat: 30 });
    caster.hp = 10;
    const foe = unit('Foe', 'goblin', 'enemy', 2, 0, { maxHp: 500, hp: 500 });
    const battle = new TacticalBattle(field(), [caster, foe]);

    // WHEN: it drains the enemy
    withRandom(0.5, () => battle.applyEnemyAbility(caster, 'life_drain', 2, 0));

    // THEN: damage dealt is what the enemy lost, healing is what the caster gained
    const c = rowOf(battle, 'player', 'Caster');
    assert.ok(caster.hp > 10, 'the drain healed the caster');
    assert.equal(c.dealt, 500 - foe.hp);
    assert.equal(c.healed, caster.hp - 10);
});

test('poison damage, and a knockout from it, go to whoever poisoned the target', () => {
    // GIVEN: an enemy poisoned by a party member, with one tick of HP left
    const plaguer = unit('Plaguer', 'alchemist', 'player', 0, 0);
    const foe = unit('Foe', 'goblin', 'enemy', 5, 0, { maxHp: 100, hp: 3 });
    const battle = new TacticalBattle(field(), [plaguer, foe]);
    inflictStatus(foe, 'poison', 3, plaguer);

    // WHEN: the enemy's turn comes and the poison ticks
    withRandom(0.5, () => battle.startTurn(foe));

    // THEN: the poisoner is credited with the 3 HP and the knockout, listed as Poison
    const p = rowOf(battle, 'player', 'Plaguer');
    assert.equal(foe.hp, 0);
    assert.equal(p.dealt, 3);
    assert.equal(p.kos, 1);
    assert.deepEqual(p.abilities.map(a => a.key), ['status:poison']);
});

test("a summoned creature's damage belongs to its summoner, and the creature isn't its own row", () => {
    // GIVEN: a beastcaller who has called a wolf next to an enemy
    const caller = unit('Caller', 'beastcaller', 'player', 0, 0);
    const foe = unit('Foe', 'goblin', 'enemy', 3, 0, { maxHp: 500, hp: 500 });
    const battle = new TacticalBattle(field(), [caller, foe]);
    const wolf = battle._resolveSummon(caller, ABILITIES.call_wolf, 2, 0);
    wolf.eva = 0;

    // WHEN: the wolf bites the enemy
    withRandom(0.5, () => battle.applyEnemyAbility(wolf, 'wolf_bite', 3, 0));

    // THEN: the summoner's row has the damage, marked as including summons
    const rows = battle.stats.rows('player');
    assert.deepEqual(rows.map(r => r.name), ['Caller']);
    assert.equal(rows[0].dealt, 500 - foe.hp);
    assert.ok(rows[0].dealt > 0);
    assert.equal(rows[0].fromSummons, true);
});

test('splashing your own side is damage taken, not damage dealt', () => {
    // GIVEN: an alchemist with an ally and an enemy standing side by side
    const thrower = unit('Thrower', 'alchemist', 'player', 0, 0, { mat: 30 });
    const ally = unit('Ally', 'goblin', 'player', 3, 0, { maxHp: 500, hp: 500 });
    const foe = unit('Foe', 'goblin', 'enemy', 4, 0, { maxHp: 500, hp: 500 });
    const battle = new TacticalBattle(field(), [thrower, ally, foe]);

    // WHEN: a flask splashes both of them
    withRandom(0.5, () => battle.applyEnemyAbility(thrower, 'acid_flask', 4, 0));

    // THEN: both took damage, but only the enemy's counts as dealt
    assert.ok(ally.hp < 500 && foe.hp < 500, 'the splash hit both');
    assert.equal(rowOf(battle, 'player', 'Ally').taken, 500 - ally.hp);
    assert.equal(rowOf(battle, 'player', 'Thrower').dealt, 500 - foe.hp);
});

test('over a whole fight, damage dealt by one side matches what the other side lost', () => {
    // GIVEN: two squads of plain fighters, with no healing on either side
    const squad = (team, x) => [0, 2, 4].map(y => unit(`${team}${y}`, 'goblin', team, x, y));
    const units = [...squad('player', 0), ...squad('enemy', 9)];
    const battle = new TacticalBattle(field(), units);

    // WHEN: they fight it out
    withSeed(7, () => runRealtimeBattle(battle));

    // THEN: each side's damage dealt equals the HP the other side lost
    assert.ok(battle.winner, 'the fight finished');
    const lost = team => units.filter(u => u.team === team).reduce((n, u) => n + u.maxHp - u.hp, 0);
    const sum = (team, f) => battle.stats.rows(team).reduce((n, r) => n + r[f], 0);
    assert.equal(sum('player', 'dealt'), lost('enemy'));
    assert.equal(sum('enemy', 'dealt'), lost('player'));
    assert.equal(sum('enemy', 'taken'), lost('enemy'));
    assert.equal(sum('player', 'kos') + sum('enemy', 'kos'), units.filter(u => u.hp === 0).length);
});

test('keeping the stats never changes how a fight goes', () => {
    // GIVEN: the same fight, with the same rolls, once with stats and once without
    const fight = (keepStats) => withSeed(42, () => {
        const units = [
            unit('Healer', 'warden', 'player', 0, 1), unit('Mage', 'evoker', 'player', 0, 3),
            unit('Shade', 'shadow_mage', 'enemy', 9, 1), unit('Brute', 'orc_captain', 'enemy', 9, 3),
        ];
        const battle = new TacticalBattle(field(), units);
        if (!keepStats) {
            battle.stats = new Proxy({}, { get: () => () => {} });
        }
        runRealtimeBattle(battle);
        return { winner: battle.winner, log: battle.log.join('\n'), hp: units.map(u => u.hp) };
    });

    // WHEN / THEN: the two play out identically
    assert.deepEqual(fight(true), fight(false));
});
