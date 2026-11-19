// Supports that buff the owner and adjacent allies at the start of each of the owner's turns
// (Iron Discipline; the Commanding affix): the owner gets its share too, and the buff is
// refreshed each turn rather than piling up.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { gridMap } from '../map-fixtures.mjs';
import { createUnit } from '../../js/tactical/units.js';
import { TacticalBattle } from '../../js/tactical/battle.js';
import { getEffectiveStat } from '../../js/tactical/abilities.js';

const field = () => gridMap(Array.from({ length: 5 }, () => '.'.repeat(8)));

function setup(support) {
    const marshal = Object.assign(createUnit('Marshal', 'goblin', 'player', 1, 1), { support });
    const ally = createUnit('Ally', 'goblin', 'player', 2, 1);
    const foe = createUnit('Foe', 'goblin', 'enemy', 7, 4);
    return { marshal, ally, battle: new TacticalBattle(field(), [marshal, ally, foe]) };
}

test("Iron Discipline's owner braces too, not just its neighbours", () => {
    // GIVEN: a unit with Iron Discipline next to an ally
    const { marshal, ally, battle } = setup('iron_discipline');
    const before = { me: getEffectiveStat(marshal, 'def'), ally: getEffectiveStat(ally, 'def') };

    // WHEN: its turn begins
    battle.startTurn(marshal);

    // THEN: both have DEF +3 for the coming turn
    assert.equal(getEffectiveStat(marshal, 'def'), before.me + 3);
    assert.equal(getEffectiveStat(ally, 'def'), before.ally + 3);
});

test('the turn buff is refreshed each turn, never stacked', () => {
    // GIVEN: a unit with Commanding (a 2-turn buff given every turn) next to an ally
    const { marshal, ally, battle } = setup('affix_command');
    const base = getEffectiveStat(ally, 'atk');

    // WHEN: several of its turns go by
    for (let i = 0; i < 4; i++) battle.startTurn(marshal);

    // THEN: the ally has the bonus once
    assert.equal(getEffectiveStat(ally, 'atk'), base + 3);
});
