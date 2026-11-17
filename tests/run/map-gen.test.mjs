// Act map generation: deterministic, connected, and follows the floor rules.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Rng } from '../../js/run/rng.js';
import { generateActMap, reachableIds, BOSS_FLOOR, TREASURE_FLOOR, RECRUIT_FLOOR, LANES } from '../../js/run/map-gen.js';

const SEEDS = Array.from({ length: 60 }, (_, i) => i + 1);

// Every route from floor 1 to the boss, as lists of nodes.
function allRoutes(m) {
    const routes = [];
    const walk = (node, path) => {
        const p = [...path, node];
        if (!node.next.length) { routes.push(p); return; }
        for (const id of node.next) walk(m.nodes[id], p);
    };
    for (const n of m.floors[0]) walk(n, []);
    return routes;
}

test('the same seed gives the same map', () => {
    const a = generateActMap(new Rng(42), 1);
    const b = generateActMap(new Rng(42), 1);
    assert.deepEqual(a, b);
    assert.notDeepEqual(a, generateActMap(new Rng(43), 1));
});

test('every node is reachable from floor 1 and leads to the boss', () => {
    for (const seed of SEEDS) {
        const m = generateActMap(new Rng(seed), 1);
        assert.equal(m.floors.length, BOSS_FLOOR);
        assert.equal(m.nodes[m.bossId].type, 'boss');
        const reached = new Set(m.floors[0].map(n => n.id));
        for (const row of m.floors) {
            for (const n of row) {
                assert.ok(reached.has(n.id), `seed ${seed}: ${n.id} unreachable`);
                if (n.type !== 'boss') assert.ok(n.next.length > 0, `seed ${seed}: ${n.id} is a dead end`);
                for (const id of n.next) {
                    assert.equal(m.nodes[id].floor, n.floor + 1);
                    assert.ok(Math.abs(m.nodes[id].lane - n.lane) <= 1 || id === m.bossId);
                    reached.add(id);
                }
            }
        }
    }
});

test('edges between two floors never cross', () => {
    for (const seed of SEEDS) {
        const m = generateActMap(new Rng(seed), 1);
        for (const row of m.floors.slice(0, BOSS_FLOOR - 2)) {
            const edges = row.flatMap(n => n.next.map(id => [n.lane, m.nodes[id].lane]));
            for (const [a, b] of edges) {
                assert.ok(!edges.some(([c, d]) => c === b && d === a && a !== b), `seed ${seed}: crossing at floor ${row[0].floor}`);
            }
        }
    }
});

test('floor rules: combat first, treasure mid-act, rest before the boss, no early elites or rests', () => {
    for (const seed of SEEDS) {
        const m = generateActMap(new Rng(seed), 1);
        for (const n of Object.values(m.nodes)) {
            if (n.floor === 1) assert.equal(n.type, 'combat');
            if (n.floor === TREASURE_FLOOR) assert.equal(n.type, 'treasure');
            if (n.floor === BOSS_FLOOR - 1) assert.equal(n.type, 'rest');
            if (n.floor < 5) assert.ok(!['elite', 'rest'].includes(n.type), `seed ${seed}: ${n.type} on floor ${n.floor}`);
            assert.ok(n.lane >= 0 && n.lane < LANES);
            for (const id of n.next) {
                const c = m.nodes[id];
                if (['elite', 'shop'].includes(n.type)) assert.notEqual(c.type, n.type, `seed ${seed}: ${n.type} twice in a row`);
            }
        }
    }
});

test('every route to the boss meets exactly one recruit, on the mid-act recruit floor', () => {
    assert.equal(RECRUIT_FLOOR, 7);
    for (const act of [1, 2, 3]) {
        for (const seed of SEEDS) {
            const m = generateActMap(new Rng(seed), act);
            for (const n of Object.values(m.nodes)) {
                assert.equal(n.type === 'recruit', n.floor === 7, `seed ${seed} act ${act}: ${n.type} on floor ${n.floor}`);
            }
            for (const route of allRoutes(m)) {
                assert.equal(route.filter(n => n.type === 'recruit').length, 1, `seed ${seed} act ${act}: route recruit count`);
            }
        }
    }
});

test('the player starts on any floor 1 node and then follows edges', () => {
    const m = generateActMap(new Rng(5), 1);
    assert.deepEqual(reachableIds(m, null), m.floors[0].map(n => n.id));
    const first = m.floors[0][0];
    assert.deepEqual(reachableIds(m, first.id), first.next);
});
