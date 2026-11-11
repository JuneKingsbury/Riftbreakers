// Block maps with more than one surface per column: bridges units walk over and under,
// low ceilings, sight under overhangs, height-limited area effects, and the map file format.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    createEmptyMap, setBlock, buildCells, columnCells, getCell, hasLineOfSight,
    loadMapData, serializeMap, validateMapJson, validateMap, applyTerrainEffect, posKey,
} from '../../js/tactical/battle-map.js';
import { computeMoveRange, computeMovePath, computeAoeArea, computeAttackRange } from '../../js/tactical/abilities.js';
import { createUnit } from '../../js/tactical/units.js';
import { TacticalBattle } from '../../js/tactical/battle.js';

// A flat 9x5 field. Stairs on row 0 climb from z1 at x = 0 to z4 at x = 3, a walkway at
// (3,1) leads off them, and a bridge at z4 runs along row 2 from x = 3 to x = 6 with open
// ground underneath.
function bridgeMap() {
    const map = createEmptyMap(9, 5);
    // Stairs on row 0: x=0 z1, x=1 z2, x=2 z3, x=3 z4 (solid stacks).
    for (let x = 0; x < 4; x++) for (let z = 1; z <= x + 1; z++) setBlock(map, x, 0, z, 'dirt');
    // A walkway at z4 from (3,1) down to the bridge row, then the bridge along row 2.
    setBlock(map, 3, 1, 4, 'dirt');
    for (let x = 3; x <= 6; x++) setBlock(map, x, 2, 4, 'dirt');
    return buildCells(map);
}

test('a floating bridge gives its columns two surfaces, and both are walkable', () => {
    const map = bridgeMap();
    const cells = columnCells(map, 5, 2);
    assert.deepEqual(cells.map(c => c.z), [0, 4]);
    assert.ok(cells.every(c => c.passable), 'ground under the bridge has headroom, the bridge top is open');
});

test('a ceiling two levels up leaves no room to stand underneath', () => {
    const map = createEmptyMap(3, 1);
    setBlock(map, 1, 0, 2, 'dirt');
    buildCells(map);
    assert.equal(getCell(map, 1, 0, 0).passable, false, 'only one empty level under a z2 block');
    assert.equal(getCell(map, 1, 0, 2).passable, true);
    setBlock(map, 1, 0, 2, null);
    setBlock(map, 1, 0, 3, 'dirt');
    buildCells(map);
    assert.equal(getCell(map, 1, 0, 0).passable, true, 'two empty levels under a z3 block is enough');
});

test('units walk under the bridge on the ground and over it on top', () => {
    const map = bridgeMap();
    const walker = createUnit('Low', 'novice', 'player', 2, 2, { z: 0 });
    walker.move = 10;
    const under = computeMovePath(walker, map, [walker], 7, 2, 0);
    assert.ok(under, 'ground route exists');
    assert.ok(under.every(s => s.z === 0), 'stays on the ground, passing under the bridge');

    const climber = createUnit('High', 'novice', 'player', 0, 1, { z: 0 });
    climber.move = 20;
    const over = computeMovePath(climber, map, [climber], 6, 2, 4);
    assert.ok(over, 'stairs lead up onto the bridge');
    assert.equal(over[over.length - 1].z, 4);
    for (let i = 1; i < over.length; i++) assert.ok(Math.abs(over[i].z - over[i - 1].z) <= 1, 'no step climbs more than one level');
});

test('a unit on the bridge does not block a unit passing underneath', () => {
    const map = bridgeMap();
    const top = createUnit('Top', 'novice', 'player', 5, 2, { z: 4 });
    const low = createUnit('Low', 'novice', 'player', 3, 2, { z: 0 });
    low.move = 6;
    const range = computeMoveRange(low, map, [top, low]);
    assert.ok(range.has('5,2,0'), 'ground cell under the occupied bridge cell is free');
    assert.ok(!range.has('5,2,4'), 'cannot reach the bridge top from below');
});

test('sight passes under a bridge but not through a wall', () => {
    const map = bridgeMap();
    assert.ok(hasLineOfSight(map, { x: 2, y: 2, z: 0 }, { x: 7, y: 2, z: 0 }), 'under the bridge');
    setBlock(map, 4, 3, 1, 'wall');
    setBlock(map, 4, 3, 2, 'wall');
    buildCells(map);
    assert.ok(!hasLineOfSight(map, { x: 2, y: 3, z: 0 }, { x: 7, y: 3, z: 0 }), 'a wall blocks');
    // Water is not opaque.
    const pond = createEmptyMap(5, 1);
    setBlock(pond, 2, 0, 1, 'water');
    buildCells(pond);
    assert.ok(hasLineOfSight(pond, { x: 0, y: 0, z: 0 }, { x: 4, y: 0, z: 0 }));
});

test('ability range covers every level of a column, filtered by sight', () => {
    const map = bridgeMap();
    const range = computeAttackRange(new Set(['5,1,0']), 1, false, true, map);
    assert.ok(range.has('5,2,0') && range.has('5,2,4'), 'both levels of the neighbouring column');
});

test('an area effect centred on the bridge leaves the ground far below alone', () => {
    const map = bridgeMap();
    const area = computeAoeArea(map, { x: 5, y: 2, z: 4 }, 1);
    assert.ok(area.has('5,2,4') && area.has('4,2,4'));
    assert.ok(!area.has('5,2,0'), 'ground cell four levels down is outside the blast');
});

test('battles resolve clicks to the level the player means', () => {
    const map = bridgeMap();
    const unit = createUnit('Low', 'novice', 'player', 3, 2, { z: 0 });
    unit.ct = 100;
    const foe = createUnit('Foe', 'goblin', 'enemy', 8, 4, { z: 0 });
    const battle = new TacticalBattle(map, [unit, foe]);
    battle.startTurn(unit);
    battle.enterMoveMode();
    assert.ok(battle.commitMove(4, 2), 'column with only one reachable level needs no z');
    assert.equal(unit.z, 0);
});

test('Stone Wall raises blocks on the target cells and the rules see the new height', () => {
    const map = createEmptyMap(3, 1);
    applyTerrainEffect(map, getCell(map, 1, 0, 0), { setType: 'wall', raise: 2, affectTiles: 'passable' });
    assert.deepEqual(columnCells(map, 1, 0).map(c => c.z), [2]);
    assert.equal(getCell(map, 1, 0, 2).type, 'wall');
    assert.equal(getCell(map, 1, 0, 2).passable, false);
});

test('map files round-trip and bad files are rejected with a reason', () => {
    const map = bridgeMap();
    map.id = 'bridge_test';
    map.name = 'Bridge';
    map.playerSpawns = [{ x: 2, y: 2, z: 0 }];
    map.enemySpawns = [{ x: 5, y: 2, z: 4 }];
    const json = serializeMap(map);
    assert.deepEqual(validateMapJson(json), []);
    const again = loadMapData(JSON.parse(JSON.stringify(json)));
    assert.deepEqual(serializeMap(again), json);
    assert.deepEqual(again.columns, map.columns);

    assert.ok(validateMapJson({ ...json, id: '../evil' }).length > 0);
    assert.ok(validateMapJson({ ...json, columns: json.columns.slice(1) }).length > 0);
    assert.ok(validateMapJson({ ...json, palette: ['lava'] }).length > 0);
    assert.throws(() => loadMapData({ ...json, format: 99 }), /format/);
});

test('map checks report unreachable and unstandable spawns', () => {
    const map = bridgeMap();
    map.playerSpawns = [{ x: 0, y: 4, z: 0 }];
    map.enemySpawns = [{ x: 8, y: 4, z: 0 }, { x: 5, y: 2, z: 4 }];
    let { errors } = validateMap(map);
    assert.deepEqual(errors, [], 'the bridge is reachable by the stairs');
    setBlock(map, 3, 1, 4, null);   // cut the walkway
    buildCells(map);
    ({ errors } = validateMap(map));
    assert.ok(errors.some(e => e.includes('cannot be reached')), errors.join('; '));
    map.enemySpawns = [{ x: 8, y: 4, z: 3 }];
    ({ errors } = validateMap(map));
    assert.ok(errors.some(e => e.includes('not on a surface')));
    assert.equal(posKey(map.enemySpawns[0]), '8,4,3');
});
