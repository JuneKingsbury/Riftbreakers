// Map data validity plus the rule that a unit's facing after a move is settled
// by game logic alone (no renderer involved).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { loadMapData, getTile, MAX_CLIMB } from '../../js/tactical/battle-map.js';
import { CHARACTER_DATA } from '../../js/tactical/data/characters.js';
import { BATTLE_SCENARIOS } from '../../js/tactical/world-map-data.js';
import { MAP_DATA } from '../../js/tactical/data/maps.js';
import { createUnit } from '../../js/tactical/units.js';
import { moveEntityAlongPath } from '../../js/systems/movement-lerp.js';
import { viewState } from '../../js/tactical/view-state.js';
import { terrainTopY } from '../../js/tactical/tile-render.js';
import { TacticalBattle } from '../../js/tactical/battle.js';
import { buildUnits } from '../../js/tactical/build-units.js';
import { executeIntent } from '../../js/tactical/ai/executor.js';

const MAP_DEF = MAP_DATA[0];

const everyMap = MAP_DATA.map(def => [def.id, def]);

test('every map has a tile and elevation row for each grid row, each as wide as the map', () => {
    for (const [name, def] of everyMap) {
        assert.equal(def.tiles.length, def.height, `${name} tile rows`);
        assert.equal(def.elevation.length, def.height, `${name} elevation rows`);
        for (let y = 0; y < def.height; y++) {
            assert.equal(def.tiles[y].length, def.width, `${name} tile row ${y}`);
            assert.equal(def.elevation[y].length, def.width, `${name} elevation row ${y}`);
        }
    }
});

test('spawn points sit on passable tiles inside the map and never overlap', () => {
    for (const [name, def] of everyMap) {
        const map = loadMapData(def);
        const seen = new Set();
        for (const s of [...map.playerSpawns, ...map.enemySpawns]) {
            const tile = getTile(map, s.x, s.y);
            assert.ok(tile, `${name} spawn (${s.x},${s.y}) is on the map`);
            assert.ok(tile.passable, `${name} spawn (${s.x},${s.y}) is passable`);
            const key = `${s.x},${s.y}`;
            assert.ok(!seen.has(key), `${name} spawn ${key} is unique`);
            seen.add(key);
        }
    }
});

test('terrain heights stay within the 0-3 range the renderers support', () => {
    for (const [name, def] of everyMap) {
        for (const t of loadMapData(def).tiles) {
            assert.ok(t.elevation >= 0 && t.elevation <= 3, `${name} elevation ${t.elevation}`);
        }
    }
});

test('a unit finishes a multi-step move facing its last step, not the bearing to the destination', () => {
    // Start (2,2) -> (2,3) -> (2,4) -> (3,4): the last step is east, but the bearing from
    // the start to the destination is mostly south, so facing-toward-destination would fail.
    const unit = createUnit('Tester', 'novice', 'player', 2, 2);
    moveEntityAlongPath(unit, [{ x: 2, y: 3 }, { x: 2, y: 4 }, { x: 3, y: 4 }], 100);
    assert.equal(unit.facing, 'east');
    assert.deepEqual([unit.x, unit.y], [3, 4]);
});

test('a single-step move faces the step direction', () => {
    const unit = createUnit('Tester', 'novice', 'player', 5, 5);
    moveEntityAlongPath(unit, [{ x: 4, y: 5 }], 100);
    assert.equal(unit.facing, 'west');
});

test('walk animation data is kept off the unit', () => {
    const unit = createUnit('Tester', 'novice', 'player', 1, 1);
    moveEntityAlongPath(unit, [{ x: 2, y: 1 }, { x: 2, y: 2 }], 100);
    assert.deepEqual(Object.keys(unit).filter(k => /^_(viz|prev|move|facing|ms|anim|float)/.test(k)), []);
    assert.equal(viewState(unit).moveQueue.length, 1);
});

test('terrain height rises with elevation and walls stand taller than level ground', () => {
    // Independent literals on purpose: a changed constant should fail here.
    assert.equal(terrainTopY({ type: 'grass', elevation: 0 }), 0);
    assert.ok(Math.abs(terrainTopY({ type: 'high', elevation: 2 }) - 1.1) < 1e-9);
    assert.ok(terrainTopY({ type: 'wall', elevation: 0 }) > terrainTopY({ type: 'high', elevation: 1 }));
    assert.ok(terrainTopY({ type: 'water', elevation: 0 }) < 0);
    assert.equal(terrainTopY(null), 0);
});

test('walking speed follows the battle\'s moveMsPerStep for both manual and scripted moves', () => {
    const map = loadMapData(MAP_DEF);
    const units = buildUnits(null, 'none', map.playerSpawns, map.enemySpawns);
    const battle = new TacticalBattle(map, units);
    battle.moveMsPerStep = 45;   // what the scene sets at 4x

    // Manual move.
    let unit = battle.advanceCT();
    while (unit.team !== 'player') { battle.startTurn(unit); battle.endTurn(60); unit = battle.advanceCT(); }
    battle.startTurn(unit);
    battle.enterMoveMode();
    const [tx, ty] = [...battle.moveRange].map(k => k.split(',').map(Number))
        .find(([x, y]) => Math.abs(x - unit.x) + Math.abs(y - unit.y) >= 2);
    assert.ok(battle.commitMove(tx, ty));
    assert.equal(viewState(unit).msPerStep, 45);

    // Scripted/AI move through the executor.
    const other = units.find(u => u.team === 'player' && u !== unit);
    const dest = { x: other.x + 1, y: other.y };
    executeIntent(other, { move: dest, act: { kind: 'wait' } }, battle, null);
    assert.equal(viewState(other).msPerStep, 45);
});

// Flood fill from a tile using the same rules as computeMoveRange: passable, 4-way, climb limit.
function reachableFrom(map, start) {
    const seen = new Set([`${start.x},${start.y}`]);
    const queue = [start];
    while (queue.length) {
        const cur = queue.shift();
        const curTile = getTile(map, cur.x, cur.y);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const x = cur.x + dx, y = cur.y + dy;
            const tile = getTile(map, x, y);
            if (!tile || !tile.passable) continue;
            if (Math.abs(tile.elevation - curTile.elevation) > MAX_CLIMB) continue;
            const key = `${x},${y}`;
            if (seen.has(key)) continue;
            seen.add(key);
            queue.push({ x, y });
        }
    }
    return seen;
}

test('every map gives each side six spawns and all twelve can walk to each other', () => {
    for (const [name, def] of everyMap) {
        const map = loadMapData(def);
        assert.equal(map.playerSpawns.length, 6, `${name} player spawns`);
        assert.equal(map.enemySpawns.length, 6, `${name} enemy spawns`);
        const reach = reachableFrom(map, map.playerSpawns[0]);
        for (const s of [...map.playerSpawns, ...map.enemySpawns]) {
            assert.ok(reach.has(`${s.x},${s.y}`), `${name}: spawn (${s.x},${s.y}) is cut off`);
        }
    }
});

test('no map has a sealed-off pocket holding a large share of its walkable ground', () => {
    for (const [name, def] of everyMap) {
        const map = loadMapData(def);
        const walkable = map.tiles.filter(t => t.passable).length;
        const reach = reachableFrom(map, map.playerSpawns[0]);
        assert.ok(reach.size / walkable >= 0.9, `${name}: only ${reach.size}/${walkable} walkable tiles reachable`);
    }
});

test('maps are much larger than the old ones (all under 400 tiles) and have no stone wall around the outside', () => {
    for (const [name, def] of everyMap) {
        assert.ok(def.width * def.height >= 700, `${name} is only ${def.width}x${def.height}`);
        const map = loadMapData(def);
        const edge = [];
        for (let x = 0; x < map.width; x++) edge.push(getTile(map, x, 0), getTile(map, x, map.height - 1));
        for (let y = 0; y < map.height; y++) edge.push(getTile(map, 0, y), getTile(map, map.width - 1, y));
        const walls = edge.filter(t => t.type === 'wall').length;
        assert.ok(walls / edge.length < 0.25, `${name}: ${walls}/${edge.length} edge tiles are wall`);
    }
});

test('the default party and every enemy roster field six units a side', () => {
    assert.equal(CHARACTER_DATA.filter(c => c.team === 'player').length, 6);
    assert.equal(CHARACTER_DATA.filter(c => c.team === 'enemy').length, 6);
    for (const [id, sc] of Object.entries(BATTLE_SCENARIOS)) {
        if (sc.roster) assert.equal(sc.roster.length, 6, `${id} roster`);
    }
});
