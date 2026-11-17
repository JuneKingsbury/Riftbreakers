import * as THREE from '../../lib/three/three.module.js';
import { MAX_Z, columnCells } from './battle-map.js';
import { getTileRender, tileSprite, lookType, blockTopY, blockBottomY, WATER_DROP } from './tile-render.js';

/**
 * Builds the three.js terrain for a block map (see battle-map.js). Shared by the battle
 * view and the map editor. One block is one world unit wide and ELEV_STEP tall; world X
 * is the column, world Z the row, world Y height.
 *
 * Every quad records an owner id naming the block and face it belongs to, so a raycast
 * hit (faceIndex >> 1) maps straight back to a block with decodeOwner().
 *
 * @par Thread Safety:
 *      Not thread-safe. Main thread only (creates WebGL resources).
 */

// Per-face shade baked into terrain vertex colors.
const SHADE_TOP = 1.0;
const SHADE_SOUTH = 0.82;
const SHADE_EAST  = 0.72;
const SHADE_NORTH = 0.58;
const SHADE_WEST  = 0.5;
const SHADE_BOTTOM = 0.4;
// How dark a top is when something overhangs it.
const ROOF_SHADOW = 0.45;

// Animated terrain overlays, matching the old 2D renderer's timing.
const GRASS_SWAY_PERIOD_MS = 2500;
const GRASS_SWAY_AMPLITUDE = 0.022;   // radians
const WATER_PERIOD_MS = 2200;
const WATER_ALPHA_BASE = 0.72;
const WATER_ALPHA_VARIATION = 0.22;
const WATER_PHASE_BUCKETS = 4;        // one InstancedMesh opacity per bucket, so tiles ripple out of step
const TERRAIN_FX_LIFT = 0.004;        // keeps overlays just above the tile top

function strHash(str) {
    let h = 7;
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
    return h;
}

/** Face directions used in owner ids. */
export const FACE = { TOP: 0, BOTTOM: 1, EAST: 2, WEST: 3, SOUTH: 4, NORTH: 5 };
/** Grid offset {dx, dy, dz} of the neighbouring block across each face. */
export const FACE_NORMAL = [
    { dx: 0, dy: 0, dz: 1 }, { dx: 0, dy: 0, dz: -1 },
    { dx: 1, dy: 0, dz: 0 }, { dx: -1, dy: 0, dz: 0 },
    { dx: 0, dy: 1, dz: 0 }, { dx: 0, dy: -1, dz: 0 },
];

function encodeOwner(map, x, y, z, face) {
    return ((y * map.width + x) * (MAX_Z + 1) + z) * 6 + face;
}

/** Inverse of the owner id stored per quad: {x, y, z, face}. */
export function decodeOwner(map, id) {
    const face = id % 6;
    const rest = (id - face) / 6;
    const z = rest % (MAX_Z + 1);
    const column = (rest - z) / (MAX_Z + 1);
    return { x: column % map.width, y: Math.floor(column / map.width), z, face };
}

/** The cell a block belongs to: the first surface at or above it in its column. */
export function cellForBlock(map, x, y, z) {
    for (const c of columnCells(map, x, y)) if (c.z >= z) return c;
    return null;
}

// Accumulates quads into one BufferGeometry, with an owner id per quad.
export class QuadBatch {
    constructor() { this.pos = []; this.uv = []; this.col = []; this.idx = []; this.owners = []; }

    quad(a, b, c, d, color, owner, uvs = [[0, 1], [0, 0], [1, 0], [1, 1]]) {
        const base = this.pos.length / 3;
        for (const v of [a, b, c, d]) this.pos.push(v[0], v[1], v[2]);
        for (const t of uvs) this.uv.push(t[0], t[1]);
        for (let i = 0; i < 4; i++) this.col.push(color[0], color[1], color[2]);
        this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
        this.owners.push(owner);
    }

    get empty() { return this.owners.length === 0; }

    toGeometry() {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
        g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
        g.setIndex(this.idx);
        g.computeBoundingSphere();
        g.computeBoundingBox();
        return g;
    }
}

export function shadeColor(hex, shade, tint = [1, 1, 1]) {
    const c = new THREE.Color(hex);
    return [c.r * shade * tint[0], c.g * shade * tint[1], c.b * shade * tint[2]];
}

/** Cheap fingerprint of a map's blocks, to tell when the terrain must be rebuilt. */
export function terrainSignature(map) {
    let h = map.width * 131 + map.height;
    if (map.look) h = (h * 31 + strHash(JSON.stringify(map.look.blocks ?? {}))) | 0;
    for (const col of map.columns) {
        for (let z = 0; z <= MAX_Z; z++) {
            const t = col[z];
            if (t) h = (h * 31 + strHash(t) * 17 + z) | 0;
        }
        h = (h * 7 + 1) | 0;
    }
    return h;
}

/**
 * Builds the terrain group for a map.
 * @param {object} map  A loaded block map. map.look, when set, re-dresses its blocks (tile-render.js).
 * @param {object|null} skinManager  Source of terrain images.
 * @param {(image) => THREE.Texture} textureFor  Shared texture cache owned by the caller.
 * @param {{cutAbove?: number}} [opts]  Blocks above this level are left out (editor x-ray).
 * @returns {{group, pickMeshes: THREE.Mesh[], fx, dispose: () => void}}
 */
export function buildTerrainMesh(map, skinManager, textureFor, { cutAbove = Infinity } = {}) {
    const W = map.width, H = map.height;
    const topsByType = new Map();   // drawn type -> QuadBatch
    const sideTexByType = new Map(); // drawn type -> QuadBatch, for textured (sideTex) sides
    const sides = new QuadBatch();
    const fxTiles = new Map();      // overlay sprite ref -> { kind, tint, tiles: [...] }

    const typeAt = (x, y, z) => {
        if (x < 0 || y < 0 || x >= W || y >= H || z < 0 || z > cutAbove) return null;
        return map.columns[y * W + x][z] ?? null;
    };
    const columnTopZ = (x, y) => {
        for (let z = Math.min(MAX_Z, cutAbove); z >= 0; z--) if (typeAt(x, y, z)) return z;
        return -1;
    };
    const batchFor = (table, type) => {
        let batch = table.get(type);
        if (!batch) { batch = new QuadBatch(); table.set(type, batch); }
        return batch;
    };
    const isLiquid = t => !!(t && getTileRender(t).liquid);

    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            for (let z = 0; z <= Math.min(MAX_Z, cutAbove); z++) {
                const type = typeAt(x, y, z);
                if (!type) continue;
                const shown = lookType(map.look, type, x, y, z);
                const def = getTileRender(shown);
                const liquid = isLiquid(type);
                const top = blockTopY(z) - (liquid ? WATER_DROP : 0);
                const bottom = blockBottomY(z);
                const x0 = x - 0.5, x1 = x + 0.5, z0 = y - 0.5, z1 = y + 0.5;
                const owner = face => encodeOwner(map, x, y, z, face);

                if (!typeAt(x, y, z + 1)) {
                    // Soft shadow from taller terrain to the south (light comes from the south),
                    // and a darker one under anything overhanging this top.
                    let shadow = 0;
                    for (let k = 1; k <= 5; k++) {
                        const len = columnTopZ(x, y + k) - z;
                        if (len >= k) shadow = Math.max(shadow, Math.min(0.58, 0.38 * (1 - (k - 1) / len)));
                    }
                    if (columnTopZ(x, y) > z) shadow = Math.max(shadow, ROOF_SHADOW);
                    const dim = 1 - shadow * 0.9;
                    const topColor = [SHADE_TOP * dim, SHADE_TOP * dim, SHADE_TOP * (1 - shadow * 0.6)];

                    const id = owner(FACE.TOP);
                    batchFor(topsByType, shown).quad([x0, top, z0], [x0, top, z1], [x1, top, z1], [x1, top, z0], topColor, id);

                    if (def.fx) {
                        let entry = fxTiles.get(def.fx.tex);
                        if (!entry) { entry = { kind: def.fx.kind, tint: def.fx.tint ?? null, tiles: [] }; fxTiles.set(def.fx.tex, entry); }
                        entry.tiles.push({ x, z: y, top, index: id, topColor });
                    }
                }

                // Textured sides use one batch per material; the rest share the flat batch.
                const sideBatch = def.sideTex ? batchFor(sideTexByType, shown) : sides;
                const sideColor = shade => def.sideTex ? [shade, shade, shade] : shadeColor(def.side, shade);
                // Crop the texture to the face height so wall art isn't squashed.
                const vSpan = Math.min(1, top - bottom);
                const sideUv = [[0, 1], [1, 1], [1, 1 - vSpan], [0, 1 - vSpan]];
                if (z > 0 && !typeAt(x, y, z - 1)) {
                    sides.quad([x0, bottom, z1], [x0, bottom, z0], [x1, bottom, z0], [x1, bottom, z1],
                        shadeColor(def.side, SHADE_BOTTOM), owner(FACE.BOTTOM));
                }
                // A side shows wherever the neighbour at this level is open. A liquid does not
                // hide the side of solid ground next to it, since its surface sits lower.
                const face = (nx, ny, shade, a, b, f) => {
                    const n = typeAt(nx, ny, z);
                    if (n && (!isLiquid(n) || liquid)) return;
                    sideBatch.quad([a[0], top, a[1]], [b[0], top, b[1]], [b[0], bottom, b[1]], [a[0], bottom, a[1]],
                        sideColor(shade), owner(f), sideUv);
                };
                face(x + 1, y, SHADE_EAST,  [x1, z1], [x1, z0], FACE.EAST);
                face(x - 1, y, SHADE_WEST,  [x0, z0], [x0, z1], FACE.WEST);
                face(x, y + 1, SHADE_SOUTH, [x0, z1], [x1, z1], FACE.SOUTH);
                face(x, y - 1, SHADE_NORTH, [x1, z0], [x0, z0], FACE.NORTH);
            }
        }
    }

    const group = new THREE.Group();
    const pickMeshes = [];
    const sm = skinManager;
    const addMesh = (geometry, material, owners) => {
        const mesh = new THREE.Mesh(geometry, material);
        mesh.userData.owners = owners;
        group.add(mesh);
        pickMeshes.push(mesh);
    };
    // A textured material when the skin has the sprite, else the flat color.
    const surfaceMaterial = (def, flatHex, opts = {}) => {
        const image = def.tex ? tileSprite(sm, def.tex) || (sm?.isActive ? sm.getSprite('terrain', 'grass') : null) : null;
        return new THREE.MeshBasicMaterial({
            vertexColors: true,
            map: image ? textureFor(image) : null,
            color: image ? new THREE.Color(def.tint ?? 0xffffff) : new THREE.Color(flatHex),
            ...opts,
        });
    };
    for (const [type, batch] of topsByType) {
        const def = getTileRender(type);
        addMesh(batch.toGeometry(), surfaceMaterial(def, def.color), batch.owners);
    }
    for (const [type, batch] of sideTexByType) {
        const def = getTileRender(type);
        addMesh(batch.toGeometry(), surfaceMaterial(def, def.side, { side: THREE.DoubleSide }), batch.owners);
    }
    addMesh(sides.toGeometry(), new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }), sides.owners);
    const fx = buildTerrainFx(group, fxTiles, sm, textureFor);

    const dispose = () => {
        for (const mesh of pickMeshes) { mesh.geometry.dispose(); mesh.material.dispose(); }
        if (fx) {
            const meshes = [...fx.tufts.map(t => t.mesh), ...fx.water.map(w => w.mesh)];
            for (const mesh of meshes) { mesh.material.dispose(); mesh.dispose(); }
            fx.geometry.dispose();
        }
    };
    return { group, pickMeshes, fx, dispose };
}

// Overlay quads for the skin's animated sprites: swaying tufts on grassy tops, shimmering
// waves on liquids. Only built for sprites the skin supplies, so ascii mode and skins
// without them simply skip it.
function buildTerrainFx(group, fxTiles, sm, textureFor) {
    if (!sm || !sm.isActive) return null;
    const quad = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const fx = { geometry: quad, tufts: [], water: [] };

    const makeMesh = (image, tiles, tint) => {
        const mat = new THREE.MeshBasicMaterial({
            map: textureFor(image), transparent: true, depthWrite: false,
            polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
        });
        const mesh = new THREE.InstancedMesh(quad, mat, Math.max(1, tiles.length));
        mesh.count = tiles.length;
        mesh.frustumCulled = false;
        mesh.renderOrder = 2;
        const color = new THREE.Color();
        const t = tint ? new THREE.Color(tint) : new THREE.Color(1, 1, 1);
        tiles.forEach((tile, i) => mesh.setColorAt(i, color.setRGB(tile.topColor[0] * t.r, tile.topColor[1] * t.g, tile.topColor[2] * t.b)));
        group.add(mesh);
        return mesh;
    };

    for (const [ref, { kind, tint, tiles }] of fxTiles) {
        const image = tileSprite(sm, ref);
        if (!image || !tiles.length) continue;
        if (kind === 'tuft') {
            fx.tufts.push({ mesh: makeMesh(image, tiles, tint), tiles });
            continue;
        }
        // Split the liquid tiles by phase so each bucket can have its own opacity.
        const buckets = Array.from({ length: WATER_PHASE_BUCKETS }, () => []);
        for (const t of tiles) {
            const phase = (t.index % 1000) / 1000;
            buckets[Math.min(WATER_PHASE_BUCKETS - 1, Math.floor(phase * WATER_PHASE_BUCKETS))].push(t);
        }
        buckets.forEach((bucket, b) => {
            if (!bucket.length) return;
            const mesh = makeMesh(image, bucket, tint);
            const m = new THREE.Matrix4();
            bucket.forEach((t, i) => mesh.setMatrixAt(i, m.makeTranslation(t.x, t.top + TERRAIN_FX_LIFT, t.z)));
            mesh.instanceMatrix.needsUpdate = true;
            fx.water.push({ mesh, phase: ((b + 0.5) / WATER_PHASE_BUCKETS) * Math.PI * 2 });
        });
    }
    return fx;
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _pos = new THREE.Vector3();
const _scl = new THREE.Vector3(1, 1, 1);
const _up = new THREE.Vector3(0, 1, 0);

/** Animates grass sway and water shimmer. fx is the value from buildTerrainMesh. */
export function updateTerrainFx(fx, now) {
    if (!fx) return;
    const t = (now / GRASS_SWAY_PERIOD_MS) * Math.PI * 2;
    for (const tuft of fx.tufts) {
        tuft.tiles.forEach((tile, i) => {
            const sway = Math.sin(t + ((tile.index % 1000) / 1000) * 6.28) * GRASS_SWAY_AMPLITUDE;
            _q.setFromAxisAngle(_up, sway);
            tuft.mesh.setMatrixAt(i, _m.compose(_pos.set(tile.x, tile.top + TERRAIN_FX_LIFT, tile.z), _q, _scl));
        });
        tuft.mesh.instanceMatrix.needsUpdate = true;
    }
    for (const w of fx.water) {
        const a = WATER_ALPHA_BASE + WATER_ALPHA_VARIATION * Math.cos((now / WATER_PERIOD_MS) * Math.PI * 2 + w.phase);
        w.mesh.material.opacity = Math.max(0, Math.min(1, a));
    }
}
