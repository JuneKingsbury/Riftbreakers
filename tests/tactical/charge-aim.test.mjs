// Charged abilities aim when they go off, not when they begin: they follow the unit they
// were aimed at, turn to another foe in range if it has fallen, and fizzle (MP back) when
// there is no foe in reach. Harmful abilities pass over knocked-out units.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { gridMap } from '../map-fixtures.mjs';
import { createUnit, isUnconscious, isDead } from '../../js/tactical/units.js';
import { TacticalBattle } from '../../js/tactical/battle.js';

const field = (w = 12, h = 7) => gridMap(Array.from({ length: h }, () => '.'.repeat(w)));

function withRandom(value, fn) {
    const orig = Math.random;
    Math.random = () => value;
    try { return fn(); } finally { Math.random = orig; }
}

const unit = (name, job, team, x, y, extra = {}) =>
    Object.assign(createUnit(name, job, team, x, y), { eva: 0, ...extra });
const sturdy = { maxHp: 500, hp: 500 };

// Starts `key` from `caster` at (tx, ty), lets the charge complete and fires it.
function chargeThenFire(battle, caster, key, tx, ty, during = () => {}) {
    withRandom(0.5, () => battle.applyEnemyAbility(caster, key, tx, ty));
    assert.ok(caster._charging, `${key} is charged`);
    during();
    caster._charging.ct = caster._charging.needed;
    withRandom(0.5, () => battle.checkAndFireCharges());
}

const knockOut = (u) => { u.hp = 0; u.status.push('unconscious'); u.deathTimer = 3; };

test('a charged spell follows its target when it walks away during the charge', () => {
    // GIVEN: a mage charging Fire at an enemy within range
    const mage = unit('Mage', 'evoker', 'player', 0, 3, { mat: 30 });
    const foe = unit('Foe', 'goblin', 'enemy', 3, 3, sturdy);
    const battle = new TacticalBattle(field(), [mage, foe]);

    // WHEN: the enemy walks out of the blast area (but not out of range) before it goes off
    chargeThenFire(battle, mage, 'fire', 3, 3, () => { foe.x = 1; foe.y = 1; });

    // THEN: the spell still lands on it
    assert.ok(foe.hp < 500, 'the moved enemy was hit');
});

test('when its target has fallen, a charged spell turns to the nearest standing foe and leaves the body alone', () => {
    // GIVEN: a mage charging Fire at one enemy, with another enemy in range
    const mage = unit('Mage', 'evoker', 'player', 0, 3, { mat: 30 });
    const first = unit('First', 'goblin', 'enemy', 3, 3, sturdy);
    const second = unit('Second', 'goblin', 'enemy', 1, 5, sturdy);   // in range, outside the blast
    const battle = new TacticalBattle(field(), [mage, first, second]);

    // WHEN: the first enemy is knocked out by someone else before the spell goes off
    chargeThenFire(battle, mage, 'fire', 3, 3, () => knockOut(first));

    // THEN: the other enemy takes the spell, and the fallen one is still only knocked out
    assert.ok(second.hp < 500, 'the standing enemy was hit');
    assert.ok(isUnconscious(first) && !isDead(first), 'the body was not finished off');
    assert.ok(battle.log.some(l => l.includes('turns Fire on Second')), 'the log says where it went');
});

test('a charged spell with no foe left in reach fizzles and gives its MP back', () => {
    // GIVEN: a mage charging Fire at the only enemy
    const mage = unit('Mage', 'evoker', 'player', 0, 3, { mat: 30 });
    const foe = unit('Foe', 'goblin', 'enemy', 3, 3, sturdy);
    const battle = new TacticalBattle(field(), [mage, foe]);
    const mpBefore = mage.mp;

    // WHEN: the enemy runs well out of range before it goes off
    chargeThenFire(battle, mage, 'fire', 3, 3, () => { foe.x = 11; });

    // THEN: nobody is hit and the caster has the MP it spent
    assert.equal(foe.hp, 500);
    assert.equal(mage.mp, mpBefore);
    assert.ok(battle.log.some(l => l.includes('fizzles')));
});

test('a charged spell aimed at a cell with standing foes still lands there', () => {
    // GIVEN: a mage charging Fire at an empty cell between two enemies
    const mage = unit('Mage', 'evoker', 'player', 0, 3, { mat: 30 });
    const a = unit('A', 'goblin', 'enemy', 3, 2, sturdy);
    const b = unit('B', 'goblin', 'enemy', 3, 4, sturdy);
    const battle = new TacticalBattle(field(), [mage, a, b]);

    // WHEN: it goes off with both still in place
    chargeThenFire(battle, mage, 'fire', 3, 3);

    // THEN: the area catches both, as aimed
    assert.ok(a.hp < 500 && b.hp < 500);
});

test('harmful abilities pass over knocked-out enemies caught in the area', () => {
    // GIVEN: an alchemist's splash covering a standing enemy and a knocked-out one
    const thrower = unit('Thrower', 'alchemist', 'player', 0, 3, { mat: 30 });
    const standing = unit('Standing', 'goblin', 'enemy', 4, 3, sturdy);
    const fallen = unit('Fallen', 'goblin', 'enemy', 4, 4, sturdy);
    knockOut(fallen);
    const battle = new TacticalBattle(field(), [thrower, standing, fallen]);

    // WHEN: the flask lands
    withRandom(0.5, () => battle.applyEnemyAbility(thrower, 'acid_flask', 4, 3));

    // THEN: the standing enemy is hurt and the fallen one is still only knocked out
    assert.ok(standing.hp < 500);
    assert.ok(isUnconscious(fallen) && !isDead(fallen));
});

test('a heal still reaches a knocked-out ally and revives them', () => {
    // GIVEN: a medic beside a knocked-out ally
    const medic = unit('Medic', 'novice', 'player', 0, 3, { mat: 30 });
    const ally = unit('Ally', 'goblin', 'player', 1, 3);
    knockOut(ally);
    const foe = unit('Foe', 'goblin', 'enemy', 11, 6);
    const battle = new TacticalBattle(field(), [medic, ally, foe]);

    // WHEN: the medic gives first aid
    withRandom(0.5, () => battle.applyEnemyAbility(medic, 'first_aid', 1, 3));

    // THEN: the ally is back on their feet
    assert.ok(ally.hp > 0 && !isUnconscious(ally));
});
