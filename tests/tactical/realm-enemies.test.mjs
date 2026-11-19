// Realm enemies (js/content/enemies/realm.js): each has a trick from its job's `passives` or
// `battleStart`, and fights in its own realm.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { gridMap } from '../map-fixtures.mjs';
import { createUnit, isUnconscious } from '../../js/tactical/units.js';
import { TacticalBattle } from '../../js/tactical/battle.js';
import { inflictStatus } from '../../js/tactical/abilities.js';
import { ENCOUNTERS } from '../../js/run/data/encounters.js';
import { jobs as REALM_JOBS } from '../../js/content/enemies/realm.js';

const field = () => gridMap(Array.from({ length: 5 }, () => '.'.repeat(8)));

function withRandom(value, fn) {
    const orig = Math.random;
    Math.random = () => value;
    try { return fn(); } finally { Math.random = orig; }
}

const unit = (name, job, team, x, y, extra = {}) =>
    Object.assign(createUnit(name, job, team, x, y), { eva: 0, ...extra });

test('a Prism Golem starts with Reflect, so a spell aimed at it hits the caster', () => {
    // GIVEN: a mage facing a Prism Golem
    const mage = unit('Mage', 'evoker', 'player', 0, 2, { mat: 30, maxHp: 500, hp: 500 });
    const golem = unit('Golem', 'prism_golem', 'enemy', 2, 2);

    // THEN: it has Reflect from the start
    assert.ok(golem.status.includes('reflect'));

    // WHEN: the mage casts at it
    const battle = new TacticalBattle(field(), [mage, golem]);
    const golemHp = golem.hp;
    withRandom(0.5, () => battle.applyEnemyAbility(mage, 'fire', 2, 2));
    if (mage._charging) { mage._charging.ct = mage._charging.needed; withRandom(0.5, () => battle.checkAndFireCharges()); }

    // THEN: the mage took it, not the golem
    assert.equal(golem.hp, golemHp);
    assert.ok(mage.hp < 500);
});

test('a Shieldbearer steps in front of a blow meant for an adjacent ally', () => {
    // GIVEN: a Shieldbearer beside its ally, and an attacker next to the ally
    const hero = unit('Hero', 'goblin', 'player', 1, 3, { atk: 40 });
    const ally = unit('Ally', 'goblin', 'enemy', 1, 2, { maxHp: 500, hp: 500 });
    const bearer = unit('Bearer', 'palace_shieldbearer', 'enemy', 2, 2, { maxHp: 500, hp: 500 });
    const battle = new TacticalBattle(field(), [hero, ally, bearer]);

    // WHEN: the ally is hit (with a roll that lets the Shieldbearer react)
    withRandom(0.1, () => battle.applyEnemyAbility(hero, 'attack', 1, 2));

    // THEN: the Shieldbearer took the blow instead
    assert.equal(ally.hp, 500);
    assert.ok(bearer.hp < 500);
});

test('a Void Martyr bursts when knocked out, hurting the party members next to it', () => {
    // GIVEN: a nearly beaten martyr between two party members
    const a = unit('A', 'goblin', 'player', 1, 2, { atk: 300, maxHp: 500, hp: 500 });
    const b = unit('B', 'goblin', 'player', 3, 2, { maxHp: 500, hp: 500 });
    const martyr = unit('Martyr', 'void_martyr', 'enemy', 2, 2, { hp: 5 });
    const battle = new TacticalBattle(field(), [a, b, martyr]);

    // WHEN: one of them knocks it out
    withRandom(0.5, () => battle.applyEnemyAbility(a, 'attack', 2, 2));

    // THEN: it is down, and both neighbours are hurt by the burst
    assert.ok(isUnconscious(martyr));
    assert.ok(a.hp < 500 && b.hp < 500);
});

test('a Living Tome cannot be silenced, and an Abyssal Leech heals from its bites', () => {
    const tome = unit('Tome', 'living_tome', 'enemy', 0, 0);
    assert.equal(inflictStatus(tome, 'silence', 3), false);

    const hero = unit('Hero', 'goblin', 'player', 0, 2, { maxHp: 500, hp: 500 });
    const leech = unit('Leech', 'abyssal_leech', 'enemy', 1, 2, { hp: 10 });
    const battle = new TacticalBattle(field(), [hero, leech]);
    withRandom(0.5, () => battle.applyEnemyAbility(leech, 'attack', 0, 2));
    assert.equal(leech.hp, 10 + Math.round((500 - hero.hp) * 0.3));
});

test('every realm enemy fights somewhere', () => {
    const fielded = new Set(Object.values(ENCOUNTERS).flatMap(z => Object.values(z).flat()).flatMap(e => e.roster.map(r => r.job)));
    for (const job of Object.keys(REALM_JOBS)) assert.ok(fielded.has(job), `${job} is in a fight`);
});
