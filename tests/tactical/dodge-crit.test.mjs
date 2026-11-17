// Dodging and critical hits: both exist, both are capped, and the AI's damage estimate uses
// the same rules the battle does.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { gridMap } from '../map-fixtures.mjs';
import { createUnit } from '../../js/tactical/units.js';
import { standZ } from '../../js/tactical/battle-map.js';
import { resolveAbility, dodgeChance, critChance, MAX_DODGE, MAX_CRIT, CRIT_MULT, BASE_CRIT } from '../../js/tactical/abilities.js';
import { ABILITIES } from '../../js/tactical/data-registry.js';
import { EQUIPMENT } from '../../js/tactical/data/equipment.js';

const map = gridMap(Array.from({ length: 5 }, () => '.'.repeat(10)));
function mk(name, job, team, x, y, extra = {}) {
    const u = createUnit(name, job, team, x, y, { z: standZ(map, x, y) });
    return Object.assign(u, { abilities: ['attack'], reaction: null, support: null, movement: null }, extra);
}
const withRandom = (value, fn) => {
    const orig = Math.random;
    Math.random = () => value;
    try { return fn(); } finally { Math.random = orig; }
};

test('the caps are 60% dodge and 40% crit, with a 5% crit base and 1.5x crit damage', () => {
    assert.equal(MAX_DODGE, 0.6);
    assert.equal(MAX_CRIT, 0.4);
    assert.equal(BASE_CRIT, 5);
    assert.equal(CRIT_MULT, 1.5);
});

test('no amount of evasion makes a unit unhittable', () => {
    const atk = mk('A', 'warlord', 'player', 1, 2);
    const foe = mk('B', 'illusionist', 'enemy', 2, 2, { eva: 500, facing: 'west' });   // facing the attacker
    foe.status.push('defend');
    assert.equal(dodgeChance(atk, foe, ABILITIES.attack), MAX_DODGE);
    // A roll just above the cap always hits, however evasive the target.
    const r = withRandom(MAX_DODGE + 0.001, () => resolveAbility(atk, foe, 'attack', map));
    assert.ok(!r.missed && r.damage > 0);
});

test('dodging is only against physical attacks, and halves from the side and vanishes from behind', () => {
    const atk = mk('A', 'warlord', 'player', 1, 2);
    const foe = mk('B', 'goblin', 'enemy', 2, 2, { eva: 40 });
    foe.facing = 'west';  assert.equal(dodgeChance(atk, foe, ABILITIES.attack), 0.4);
    foe.facing = 'north'; assert.equal(dodgeChance(atk, foe, ABILITIES.attack), 0.2);
    foe.facing = 'east';  assert.equal(dodgeChance(atk, foe, ABILITIES.attack), 0);
    assert.equal(dodgeChance(atk, foe, ABILITIES.fire), 0, 'spells are never dodged');
});

test('every unit has a 5% crit chance, gear raises it, and it never passes 40%', () => {
    const plain = mk('A', 'warlord', 'player', 1, 2);
    assert.equal(plain.crit, BASE_CRIT);
    assert.equal(critChance(plain, ABILITIES.attack), 0.05);
    assert.equal(critChance(plain, ABILITIES.fire), 0.05, 'spells crit too');
    assert.equal(critChance(plain, ABILITIES.heal), 0, 'heals never crit');
    assert.ok(EQUIPMENT.strikers_band.crit > 0 && EQUIPMENT.rabbits_paw.crit > 0);
    const lucky = mk('L', 'warlord', 'player', 1, 2, { crit: 999 });
    assert.equal(critChance(lucky, ABILITIES.attack), MAX_CRIT);
});

test('a critical hit deals 1.5x damage and says so', () => {
    const atk = mk('A', 'warlord', 'player', 1, 2, { crit: 40 });
    const foe = () => mk('B', 'goblin', 'enemy', 2, 2, { eva: 0, maxHp: 999, hp: 999 });
    // Rolls: dodge (0.99, a hit), crit (0.99 = none or 0.01 = crit), variance (0.5 = none).
    const roll = (seq) => { let i = 0; return withRandom(0, () => { Math.random = () => seq[i++] ?? 0.5; return resolveAbility(atk, foe(), 'attack', map); }); };
    const normal = roll([0.99, 0.99, 0.5]);
    const crit = roll([0.99, 0.01, 0.5]);
    assert.ok(!normal.crit && crit.crit);
    assert.ok(Math.abs(crit.damage - normal.damage * CRIT_MULT) <= 1, `${crit.damage} vs ${normal.damage}`);
});

test('Concentrate makes attacks much harder to dodge, but never certain to land', () => {
    const archer = mk('A', 'runebow', 'player', 1, 2, { support: 'concentrate' });
    archer.learned = ['concentrate'];
    const plain = mk('P', 'runebow', 'player', 1, 2);
    const foe = mk('B', 'illusionist', 'enemy', 2, 2, { eva: 40, facing: 'west' });
    const base = dodgeChance(plain, foe, ABILITIES.attack);
    const focused = dodgeChance(archer, foe, ABILITIES.attack);
    assert.equal(base, 0.4);
    assert.ok(focused > 0, 'still dodgeable');
    assert.ok(Math.abs(focused - base * 0.25) < 1e-9, `a quarter as often: ${focused}`);
});
