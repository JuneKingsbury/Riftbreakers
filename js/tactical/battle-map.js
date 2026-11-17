// Battle maps are columns of stacked one-level blocks. A block's height comes only from
// where it was placed, never from its material, so terrain can float (bridges, ledges)
// with open space underneath that units can walk through.
//
// Vertical layout: block z spans elevation [z-1, z], so its top face is at elevation z.
// The ground layer is z = 0, which keeps level ground at world height 0.
//
// Every block whose block above is empty is a cell: a surface something can stand on or
// target. Positions in the rules are cells, written {x, y, z} with z the cell's elevation.

export const TILE_TYPES = {
    GRASS:  'grass',
    DIRT:   'dirt',
    WATER:  'water',
    WALL:   'wall',
    RUBBLE: 'rubble',
};

// Gameplay properties only. Colors and sprites live in tile-render.js.
//   standable  units can stand on top of the block
//   moveCost   cost of stepping onto the block's top
//   opaque     the block stops line of sight
// Listed in the order the map editor shows them: ground, built floors, walls, liquids.
const GROUND = { standable: true, moveCost: 1, opaque: true };
const ROUGH  = { standable: true, moveCost: 2, opaque: true };
const SOLID  = { standable: false, moveCost: 99, opaque: true };
const LIQUID = { standable: false, moveCost: 99, opaque: false };
export const MATERIALS = {
    // Natural ground
    grass:   GROUND,
    dirt:    GROUND,
    rubble:  ROUGH,
    sand:    GROUND,
    moss:    GROUND,
    autumn:  GROUND,
    swamp:   GROUND,
    fungal:  GROUND,
    stone:   GROUND,
    redrock: GROUND,
    snow:    ROUGH,
    mud:     ROUGH,
    shallows: ROUGH,
    // Built floors
    cobble:  GROUND,
    brick:   GROUND,
    planks:  GROUND,
    marble:  GROUND,
    carpet:  GROUND,
    gravel_path: GROUND,
    verdant_tile: GROUND,
    crystal_floor: GROUND,
    abyss_tile: GROUND,
    glyph:   GROUND,
    // Walls
    wall:    SOLID,
    stone_wall: SOLID,
    brick_wall: SOLID,
    wood_wall: SOLID,
    kingdom_wall: SOLID,
    bookshelf: SOLID,
    hedge:   SOLID,
    crystal: SOLID,
    abyss_wall: SOLID,
    void_wall: SOLID,
    warded_wall: SOLID,
    // Liquids
    water:   LIQUID,
    bog:     LIQUID,
    void_water: LIQUID,
    lava:    LIQUID,
};

export function getMaterial(type) {
    return MATERIALS[type] || MATERIALS.grass;
}

// Highest block layer a map may use.
export const MAX_Z = 15;
// Empty levels a unit needs above a block to stand on it (the sprite is about two levels tall).
export const HEADROOM = 2;
// Maximum elevation step a unit can climb in a single tile transition.
export const MAX_CLIMB = 1;
// How far above or below its centre cell an area effect reaches.
export const AOE_VERTICAL = 2;

export const MAP_FORMAT = 1;

// ---- Keys --------------------------------------------------------------------

/** Set/Map key for a cell position. */
export function cellKey(x, y, z) {
    return `${x},${y},${z}`;
}

/** Key for anything with x, y, z (a unit, a cell, a spawn). */
export function posKey(p) {
    return cellKey(p.x, p.y, p.z);
}

/** Inverse of cellKey. */
export function parseKey(key) {
    const [x, y, z] = key.split(',').map(Number);
    return { x, y, z };
}

// ---- Blocks ------------------------------------------------------------------

function inBounds(map, x, y) {
    return x >= 0 && y >= 0 && x < map.width && y < map.height;
}

/** Material of the block at (x, y, z), or null for empty space. */
export function blockAt(map, x, y, z) {
    if (!inBounds(map, x, y) || z < 0 || z > MAX_Z) return null;
    return map.columns[y * map.width + x][z] ?? null;
}

/** Places (type) or clears (null) one block. Call buildCells afterwards. */
export function setBlock(map, x, y, z, type) {
    if (!inBounds(map, x, y) || z < 0 || z > MAX_Z) return;
    const col = map.columns[y * map.width + x];
    if (type) col[z] = type;
    else delete col[z];
}

/** Top block layer in a column, or -1 when the column is empty. */
export function columnTop(map, x, y) {
    if (!inBounds(map, x, y)) return -1;
    const col = map.columns[y * map.width + x];
    for (let z = MAX_Z; z >= 0; z--) if (col[z]) return z;
    return -1;
}

// ---- Cells -------------------------------------------------------------------

/**
 * Rebuilds map.cells and map.columnCells from the blocks. Must run after any block edit.
 * Cells are listed bottom to top within a column.
 */
export function buildCells(map) {
    const cells = [];
    const columnCells = new Array(map.width * map.height);
    for (let y = 0; y < map.height; y++) {
        for (let x = 0; x < map.width; x++) {
            const col = map.columns[y * map.width + x];
            const list = [];
            for (let z = 0; z <= MAX_Z; z++) {
                const type = col[z];
                if (!type || col[z + 1]) continue;
                const mat = getMaterial(type);
                let clear = true;
                for (let k = 1; k <= HEADROOM; k++) if (col[z + k]) { clear = false; break; }
                const cell = {
                    x, y, z, type,
                    elevation: z,
                    passable: mat.standable && clear,
                    moveCost: mat.moveCost,
                    index: cells.length,
                };
                cells.push(cell);
                list.push(cell);
            }
            columnCells[y * map.width + x] = list;
        }
    }
    map.cells = cells;
    map.columnCells = columnCells;
    return map;
}

/** Cells in a column, bottom to top. Empty for off-map positions. */
export function columnCells(map, x, y) {
    if (!inBounds(map, x, y)) return [];
    return map.columnCells[y * map.width + x];
}

/** Highest cell in a column (what the camera looks down on), or null. */
export function topCell(map, x, y) {
    const list = columnCells(map, x, y);
    return list.length ? list[list.length - 1] : null;
}

/**
 * Elevation a unit would stand at in a column: the passable cell nearest preferZ, or the
 * highest passable cell when preferZ is not given. Falls back to the top cell.
 */
export function standZ(map, x, y, preferZ = null) {
    const list = columnCells(map, x, y);
    let best = null;
    for (const c of list) {
        if (!c.passable) continue;
        if (best === null || preferZ === null
            || Math.abs(c.z - preferZ) < Math.abs(best.z - preferZ)) best = c;
    }
    if (best) return best.z;
    return list.length ? list[list.length - 1].z : 0;
}

/**
 * The cell at (x, y, z). With z left out, the column's standing cell (see standZ), which
 * is the only cell on maps without overhangs.
 */
export function getCell(map, x, y, z = null) {
    const list = columnCells(map, x, y);
    if (!list.length) return null;
    if (z === null || z === undefined) z = standZ(map, x, y);
    for (const c of list) if (c.z === z) return c;
    return null;
}

/**
 * Gives every unit without a level (z null, e.g. fresh from createUnit) the standing level
 * of its column. Units placed by the rules always carry z; this covers tests and spawns.
 */
export function settleZ(map, units) {
    for (const u of units) if (u.z === null || u.z === undefined) u.z = standZ(map, u.x, u.y);
}

/** The cell a unit (or any {x, y, z}) stands on. */
export function unitCell(map, p) {
    return getCell(map, p.x, p.y, p.z);
}

/**
 * Passable cells one step from a cell: the four neighbouring columns, within a climb limit.
 * The single movement rule shared by player range, pathing, the AI and the map checks.
 */
export function stepNeighbors(map, cell, climb = MAX_CLIMB) {
    const out = [];
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        for (const c of columnCells(map, cell.x + dx, cell.y + dy)) {
            if (c.passable && Math.abs(c.z - cell.z) <= climb) out.push(c);
        }
    }
    return out;
}

/** Cells in the given columns ("x,y" pairs) within AOE_VERTICAL levels of centerZ. */
export function cellsNear(map, columns, centerZ) {
    const out = new Set();
    for (const [x, y] of columns) {
        for (const c of columnCells(map, x, y)) {
            if (Math.abs(c.z - centerZ) <= AOE_VERTICAL) out.add(posKey(c));
        }
    }
    return out;
}

// ---- Line of sight -------------------------------------------------------------

/**
 * Bresenham line-of-sight check between two positions ({x, y, z}).
 * The sight line runs half a level above the higher endpoint. A column on the path blocks
 * it when an opaque block sits at that height, so tall terrain blocks over the top while a
 * bridge overhead does not. The endpoint columns themselves are never treated as blockers.
 */
export function hasLineOfSight(map, from, to) {
    const eyeZ = Math.max(from.z ?? standZ(map, from.x, from.y), to.z ?? standZ(map, to.x, to.y)) + 1;

    let x = from.x, y = from.y;
    const x2 = to.x, y2 = to.y;
    const dx = Math.abs(x2 - x), dy = Math.abs(y2 - y);
    const sx = x < x2 ? 1 : -1, sy = y < y2 ? 1 : -1;
    let err = dx - dy;

    while (!(x === x2 && y === y2)) {
        const e2 = err * 2;
        if (e2 > -dy) { err -= dy; x += sx; }
        if (e2 <  dx) { err += dx; y += sy; }
        if (x === x2 && y === y2) break;
        if (!inBounds(map, x, y)) return false;
        const block = blockAt(map, x, y, eyeZ);
        if (block && getMaterial(block).opaque) return false;
    }
    return true;
}

// ---- Terrain effects -------------------------------------------------------------

/**
 * Reshapes the terrain at a cell. setType repaints the top block; raise stacks that many
 * blocks of setType (or the cell's own material) on top. Rebuilds the cells.
 */
export function applyTerrainEffect(map, cell, effect) {
    if (!cell) return;
    const { setType, raise = 0, affectTiles = 'all' } = effect;
    if (affectTiles === 'passable'   && !cell.passable) return;
    if (affectTiles === 'impassable' &&  cell.passable) return;
    const type = setType || cell.type;
    if (raise > 0) {
        for (let k = 1; k <= raise; k++) setBlock(map, cell.x, cell.y, cell.z + k, type);
    }
    if (setType) setBlock(map, cell.x, cell.y, cell.z, setType);
    buildCells(map);
}

// ---- Loading and saving ------------------------------------------------------------

/**
 * Checks a map file (see data/maps/*.json) and returns a list of problems, empty when valid.
 * Shared by the loader, the dev server and the editor.
 */
export function validateMapJson(json) {
    const errors = [];
    if (!json || typeof json !== 'object') return ['map is not an object'];
    if (json.format !== MAP_FORMAT) errors.push(`format must be ${MAP_FORMAT}`);
    if (typeof json.id !== 'string' || !/^[a-z0-9_]{1,40}$/.test(json.id)) errors.push('id must be 1-40 chars of a-z, 0-9, _');
    const { width, depth } = json;
    if (!Number.isInteger(width) || width < 1 || width > 128) errors.push('width must be 1-128');
    if (!Number.isInteger(depth) || depth < 1 || depth > 128) errors.push('depth must be 1-128');
    if (!Array.isArray(json.palette) || json.palette.some(t => !MATERIALS[t])) errors.push('palette has an unknown material');
    if (!Array.isArray(json.columns) || json.columns.length !== width * depth) {
        errors.push('columns must have width * depth entries');
    } else {
        json.columns.forEach((runs, i) => {
            if (!Array.isArray(runs)) { errors.push(`column ${i} is not a list`); return; }
            for (const run of runs) {
                const [z0, z1, m] = Array.isArray(run) ? run : [];
                if (!Number.isInteger(z0) || !Number.isInteger(z1) || z0 < 0 || z1 < z0 || z1 > MAX_Z
                    || !Number.isInteger(m) || !json.palette?.[m]) {
                    errors.push(`column ${i} has a bad run ${JSON.stringify(run)}`);
                    return;
                }
            }
        });
    }
    for (const side of ['playerSpawns', 'enemySpawns']) {
        if (!Array.isArray(json[side])) { errors.push(`${side} must be a list`); continue; }
        for (const s of json[side]) {
            if (!s || !Number.isInteger(s.x) || !Number.isInteger(s.y) || s.x < 0 || s.y < 0 || s.x >= width || s.y >= depth) {
                errors.push(`${side} has an off-map spawn ${JSON.stringify(s)}`);
            }
        }
    }
    return errors;
}

/** An empty map: every column holds one ground block of the given material. */
export function createEmptyMap(width, height, type = TILE_TYPES.GRASS) {
    const map = { id: '', name: '', width, height, playerSpawns: [], enemySpawns: [] };
    map.columns = Array.from({ length: width * height }, () => ({ 0: type }));
    return buildCells(map);
}

/**
 * Build a map object from a map file (see data/maps/*.json).
 * Note the file calls the row count depth; the map object keeps it as height.
 * @param {object} json
 * @returns {{ id, name, width, height, columns, cells, columnCells, playerSpawns, enemySpawns }}
 */
export function loadMapData(json) {
    const errors = validateMapJson(json);
    if (errors.length) throw new Error(`Bad map ${json?.id ?? '?'}: ${errors[0]}`);
    const { width, depth, palette } = json;
    const map = { id: json.id, name: json.name || json.id, width, height: depth };
    map.columns = json.columns.map(runs => {
        const col = {};
        for (const [z0, z1, m] of runs) for (let z = z0; z <= z1; z++) col[z] = palette[m];
        return col;
    });
    buildCells(map);
    const place = s => ({ x: s.x, y: s.y, z: Number.isInteger(s.z) ? s.z : standZ(map, s.x, s.y) });
    map.playerSpawns = json.playerSpawns.map(place);
    map.enemySpawns  = json.enemySpawns.map(place);
    return map;
}

/** Inverse of loadMapData. */
export function serializeMap(map) {
    const palette = [];
    const indexOf = type => {
        let i = palette.indexOf(type);
        if (i < 0) { i = palette.length; palette.push(type); }
        return i;
    };
    const columns = map.columns.map(col => {
        const runs = [];
        for (let z = 0; z <= MAX_Z; z++) {
            const type = col[z];
            if (!type) continue;
            const last = runs[runs.length - 1];
            const m = indexOf(type);
            if (last && last[1] === z - 1 && last[2] === m) last[1] = z;
            else runs.push([z, z, m]);
        }
        return runs;
    });
    const spawn = s => ({ x: s.x, y: s.y, z: s.z });
    return {
        format: MAP_FORMAT,
        id: map.id,
        name: map.name,
        width: map.width,
        depth: map.height,
        palette,
        columns,
        playerSpawns: map.playerSpawns.map(spawn),
        enemySpawns: map.enemySpawns.map(spawn),
    };
}

/** Every passable cell key reachable from a position by walking. */
export function reachableFrom(map, start, climb = MAX_CLIMB) {
    const first = unitCell(map, start);
    if (!first) return new Set();
    const seen = new Set([posKey(first)]);
    const queue = [first];
    while (queue.length) {
        const cur = queue.shift();
        for (const n of stepNeighbors(map, cur, climb)) {
            const key = posKey(n);
            if (seen.has(key)) continue;
            seen.add(key);
            queue.push(n);
        }
    }
    return seen;
}

/**
 * Gameplay checks on a loaded map. Returns {errors, warnings} as lists of strings.
 * Errors make a map unplayable; warnings are worth a look.
 */
export function validateMap(map) {
    const errors = [];
    const warnings = [];
    const spawns = [...map.playerSpawns, ...map.enemySpawns];
    const seen = new Set();
    for (const s of spawns) {
        const cell = unitCell(map, s);
        const where = `(${s.x},${s.y},${s.z})`;
        if (!cell) errors.push(`spawn ${where} is not on a surface`);
        else if (!cell.passable) errors.push(`spawn ${where} is not standable`);
        const key = posKey(s);
        if (seen.has(key)) errors.push(`spawn ${where} is used twice`);
        seen.add(key);
    }
    if (map.playerSpawns.length !== 6) warnings.push(`${map.playerSpawns.length} player spawns (battles expect 6)`);
    if (map.enemySpawns.length !== 6) warnings.push(`${map.enemySpawns.length} enemy spawns (battles expect 6)`);
    if (spawns.length) {
        const reach = reachableFrom(map, spawns[0]);
        for (const s of spawns) {
            if (!reach.has(posKey(s))) errors.push(`spawn (${s.x},${s.y},${s.z}) cannot be reached from (${spawns[0].x},${spawns[0].y},${spawns[0].z})`);
        }
        const walkable = map.cells.filter(c => c.passable).length;
        if (walkable && reach.size / walkable < 0.9) {
            warnings.push(`only ${reach.size}/${walkable} walkable cells can be reached from the spawns`);
        }
    }
    return { errors, warnings };
}
