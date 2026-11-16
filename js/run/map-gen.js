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
//   floor 1 is all combat, TREASURE_FLOOR is all treasure, the last floor before the
//   boss is all rest; no elite or rest before floor 5; a shop, elite or rest never
//   follows another of the same type; siblings avoid sharing those types. Every route
//   meets at least one recruit on floors 3-12.
//
// Output: { act, floors: [[node]], nodes: { id: node }, bossId }
//   node: { id, floor, lane, type, next: [ids] }

export const LANES = 7;
export const PATHS = 6;
export const BOSS_FLOOR = 15;
export const TREASURE_FLOOR = 8;
const TOP_FLOOR = BOSS_FLOOR - 1;
const RECRUIT_FLOORS = [3, 12];

const BASE_WEIGHTS = { combat: 45, event: 22, elite: 10, shop: 8, rest: 10 };
const NO_REPEAT = new Set(['elite', 'shop', 'rest']);

const nodeId = (floor, lane) => `${floor}-${lane}`;

export function generateActMap(rng, act = 1) {
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
        for (const n of row) n.type = rollType(rng, n, parents[n.id] || [], nodes);
    }
    ensureRecruits(rng, floors, nodes);

    return { act, floors, nodes, bossId };
}

function rollType(rng, n, nodeParents, nodes) {
    if (n.floor === 1) return 'combat';
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

// While some route from floor 1 to the boss avoids every recruit, turn the combat or
// event node (floors 3-12) that the most recruit-free routes pass through into a
// recruit. Picking the busiest node keeps it to about one recruit per route.
function ensureRecruits(rng, floors, nodes) {
    const inRange = n => n.floor >= RECRUIT_FLOORS[0] && n.floor <= RECRUIT_FLOORS[1] && n.floor !== TREASURE_FLOOR;
    for (;;) {
        const cover = recruitFreeCoverage(floors, nodes);
        const ranked = (pred) => {
            const list = Object.values(nodes).filter(n => (cover[n.id] || 0) > 0 && inRange(n) && pred(n));
            const best = Math.max(0, ...list.map(n => cover[n.id]));
            return list.filter(n => cover[n.id] === best);
        };
        let pool = ranked(n => n.type === 'combat' || n.type === 'event');
        if (!pool.length) pool = ranked(() => true);
        if (!pool.length) return;
        rng.pick(pool).type = 'recruit';
    }
}

// Number of recruit-free routes (floor 1 to the top floor) through each node.
function recruitFreeCoverage(floors, nodes) {
    const top = floors.slice(0, TOP_FLOOR);
    const ok = n => n.type !== 'recruit';
    const fwd = {}, back = {};
    for (const n of top[0]) fwd[n.id] = ok(n) ? 1 : 0;
    for (const row of top) {
        for (const n of row) {
            for (const id of n.next) {
                if (nodes[id].floor > TOP_FLOOR) continue;
                fwd[id] = (fwd[id] || 0) + (ok(nodes[id]) ? (fwd[n.id] || 0) : 0);
            }
        }
    }
    for (let i = top.length - 1; i >= 0; i--) {
        for (const n of top[i]) {
            back[n.id] = !ok(n) ? 0 : i === top.length - 1 ? 1
                : n.next.reduce((s, id) => s + (back[id] || 0), 0);
        }
    }
    const cover = {};
    for (const row of top) for (const n of row) cover[n.id] = (fwd[n.id] || 0) * (back[n.id] || 0);
    return cover;
}

// Ids of nodes the player may move to next: floor 1 at the start of an act,
// otherwise the current node's children.
export function reachableIds(actMap, currentId) {
    if (!currentId) return actMap.floors[0].map(n => n.id);
    return [...(actMap.nodes[currentId]?.next || [])];
}
