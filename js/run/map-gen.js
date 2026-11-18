// Act map generation (Slay the Spire style). Pure and deterministic from the Rng.
//
// The map is FLOORS floors of up to LANES lanes. PATHS paths are walked upward from
// floor 1, each step going to the lane left, ahead or right without crossing an
// existing edge; only nodes some path touches are kept. Every top-floor node leads to
// the single boss node on BOSS_FLOOR.
//
// Node types:
//   combat, elite, event, shop, rest, treasure, recruit, boss
// Floor rules:
//   floor 1 is all combat, RECRUIT_FLOOR is all recruit (except in an act generated with
//   recruit: false, where it rolls like any other floor), TREASURE_FLOOR is all treasure, the
//   last floor before the boss is all rest; no elite or rest before floor 5; a shop, elite or
//   rest never follows another of the same type; siblings avoid sharing those types. Every
//   route crosses each floor once, so it meets exactly one recruit per act that has them
//   (three per run: the last act has none).
//
// Output: { act, floors: [[node]], nodes: { id: node }, bossId }
//   node: { id, floor, lane, type, next: [ids] }

export const LANES = 7;
export const PATHS = 6;
export const BOSS_FLOOR = 15;
export const RECRUIT_FLOOR = 7;
export const TREASURE_FLOOR = 8;
const TOP_FLOOR = BOSS_FLOOR - 1;

const BASE_WEIGHTS = { combat: 45, event: 22, elite: 10, shop: 8, rest: 10 };
const NO_REPEAT = new Set(['elite', 'shop', 'rest']);

const nodeId = (floor, lane) => `${floor}-${lane}`;

/**
 * @param {Rng} rng
 * @param {number} [act=1]
 * @param {{ recruit?: boolean }} [opts]  recruit: false leaves out the recruit floor.
 */
export function generateActMap(rng, act = 1, { recruit = true } = {}) {
    // ---- Paths ----
    const edges = new Map();   // nodeId → Set of next lanes
    const used = new Set();
    const hasEdge = (f, from, to) => edges.get(nodeId(f, from))?.has(to);
    const firstLane = rng.int(LANES);
    for (let p = 0; p < PATHS; p++) {
        let lane = p === 0 ? firstLane : rng.int(LANES);
        if (p === 1) while (lane === firstLane) lane = rng.int(LANES);
        used.add(nodeId(1, lane));
        for (let f = 1; f < TOP_FLOOR; f++) {
            const options = rng.shuffle([lane - 1, lane, lane + 1].filter(l => l >= 0 && l < LANES));
            // A diagonal step crosses an edge running the other way between the same lanes.
            const next = options.find(c => c === lane || !hasEdge(f, c, lane)) ?? lane;
            const key = nodeId(f, lane);
            if (!edges.has(key)) edges.set(key, new Set());
            edges.get(key).add(next);
            used.add(nodeId(f + 1, next));
            lane = next;
        }
    }

    // ---- Nodes ----
    const nodes = {};
    const floors = [];
    for (let f = 1; f <= TOP_FLOOR; f++) {
        const row = [];
        for (let l = 0; l < LANES; l++) {
            const id = nodeId(f, l);
            if (!used.has(id)) continue;
            const next = [...(edges.get(id) || [])].sort((a, b) => a - b).map(n => nodeId(f + 1, n));
            nodes[id] = { id, floor: f, lane: l, type: null, next };
            row.push(nodes[id]);
        }
        floors.push(row);
    }
    const bossId = nodeId(BOSS_FLOOR, Math.floor(LANES / 2));
    nodes[bossId] = { id: bossId, floor: BOSS_FLOOR, lane: Math.floor(LANES / 2), type: 'boss', next: [] };
    floors.push([nodes[bossId]]);
    for (const n of floors[TOP_FLOOR - 1]) n.next = [bossId];

    const parents = {};
    for (const n of Object.values(nodes)) {
        for (const c of n.next) (parents[c] = parents[c] || []).push(n);
    }

    // ---- Types ----
    for (const row of floors.slice(0, TOP_FLOOR)) {
        for (const n of row) n.type = rollType(rng, n, parents[n.id] || [], nodes, recruit);
    }

    return { act, floors, nodes, bossId };
}

function rollType(rng, n, nodeParents, nodes, recruit) {
    if (n.floor === 1) return 'combat';
    if (n.floor === RECRUIT_FLOOR && recruit) return 'recruit';
    if (n.floor === TREASURE_FLOOR) return 'treasure';
    if (n.floor === TOP_FLOOR) return 'rest';
    const weights = { ...BASE_WEIGHTS };
    if (n.floor < 5) { delete weights.elite; delete weights.rest; }
    if (n.floor === TOP_FLOOR - 1) delete weights.rest;
    for (const p of nodeParents) {
        if (NO_REPEAT.has(p.type)) delete weights[p.type];
        for (const sib of p.next.map(id => nodes[id])) {
            if (sib !== n && NO_REPEAT.has(sib.type)) delete weights[sib.type];
        }
    }
    return rng.weighted(weights) ?? 'combat';
}

// Ids of nodes the player may move to next: floor 1 at the start of an act,
// otherwise the current node's children.
export function reachableIds(actMap, currentId) {
    if (!currentId) return actMap.floors[0].map(n => n.id);
    return [...(actMap.nodes[currentId]?.next || [])];
}
