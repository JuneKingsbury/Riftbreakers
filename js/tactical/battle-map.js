export const TILE_TYPES = {
    GRASS:  'grass',
    DIRT:   'dirt',
    WATER:  'water',
    WALL:   'wall',
    RUBBLE: 'rubble',
    HIGH:   'high',
};

export const TILE_DEFS = {
    grass:  { char: '.', color: '#4a7c4a', bg: '#1a2e1a', passable: true,  moveCost: 1,  elevation: 0, blocksSight: false, spriteKey: 'grass' },
    dirt:   { char: ',', color: '#7c6a4a', bg: '#2e2418', passable: true,  moveCost: 1,  elevation: 0, blocksSight: false, spriteKey: 'dirt' },
    water:  { char: '~', color: '#3a6a9c', bg: '#0a1e3e', passable: false, moveCost: 99, elevation: 0, blocksSight: false, spriteKey: 'water' },
    wall:   { char: '#', color: '#666677', bg: '#111122', passable: false, moveCost: 99, elevation: 0, blocksSight: true,  spriteKey: 'tall_rock' },
    rubble: { char: ':', color: '#8a7a5a', bg: '#2a1e10', passable: true,  moveCost: 2,  elevation: 0, blocksSight: false, spriteKey: 'gravel' },
    high:   { char: '^', color: '#5a9c5a', bg: '#1a3e1a', passable: true,  moveCost: 1,  elevation: 1, blocksSight: false, spriteKey: 'grass' },
};

export function getTileDef(type) {
    return TILE_DEFS[type] || TILE_DEFS.grass;
}

function T(type) {
    const def = getTileDef(type);
    return { type, ...def };
}

// Build a 22x16 map programmatically so tile placement is easy to read
export const MAP_WIDTH  = 22;
export const MAP_HEIGHT = 16;

// Character -> tile type mapping for the compact grid format used in MAP_DATA.
const CHAR_TO_TILE = {
    '.': TILE_TYPES.GRASS,
    ',': TILE_TYPES.DIRT,
    '~': TILE_TYPES.WATER,
    '#': TILE_TYPES.WALL,
    ':': TILE_TYPES.RUBBLE,
    '^': TILE_TYPES.HIGH,
};

/**
 * Build a map object from a MAP_DATA entry (see data/maps.js).
 * @param {object} mapDef — one entry from MAP_DATA
 * @returns {{ width, height, tiles, playerSpawns, enemySpawns }}
 */
export function loadMapData(mapDef) {
    const { width, height, tiles: tileRows, elevation: elevRows,
            playerSpawns, enemySpawns } = mapDef;

    const tiles = [];
    for (let y = 0; y < height; y++) {
        const tileRow = tileRows[y] || '';
        const elevRow = elevRows[y] || '';
        for (let x = 0; x < width; x++) {
            const ch   = tileRow[x] || '.';
            const type = CHAR_TO_TILE[ch] || TILE_TYPES.GRASS;
            const def  = getTileDef(type);
            const tile = { type, ...def };
            const elevCh = elevRow[x];
            if (elevCh && elevCh !== '0') tile.elevation = parseInt(elevCh, 10) || 0;
            tiles.push(tile);
        }
    }
    return { width, height, tiles, playerSpawns, enemySpawns };
}

export function createDemoMap() {
    const W = MAP_WIDTH;
    const H = MAP_HEIGHT;
    const tiles = Array.from({ length: W * H }, () => T(TILE_TYPES.GRASS));

    function set(x, y, type) {
        if (x >= 0 && x < W && y >= 0 && y < H) tiles[y * W + x] = T(type);
    }
    function fillRect(x1, y1, x2, y2, type) {
        for (let y = y1; y <= y2; y++)
            for (let x = x1; x <= x2; x++) set(x, y, type);
    }
    function setElev(x, y, elev) {
        if (x >= 0 && x < W && y >= 0 && y < H) tiles[y * W + x].elevation = elev;
    }
    function fillRectElev(x1, y1, x2, y2, elev) {
        for (let y = y1; y <= y2; y++)
            for (let x = x1; x <= x2; x++) setElev(x, y, elev);
    }

    // Border walls
    fillRect(0, 0, W - 1, 0,         TILE_TYPES.WALL);
    fillRect(0, H - 1, W - 1, H - 1, TILE_TYPES.WALL);
    fillRect(0, 0, 0, H - 1,         TILE_TYPES.WALL);
    fillRect(W - 1, 0, W - 1, H - 1, TILE_TYPES.WALL);

    // Water cluster top-left area
    fillRect(3, 2, 4, 5, TILE_TYPES.WATER);
    set(5, 3, TILE_TYPES.WATER);
    set(5, 4, TILE_TYPES.WATER);

    // Elevation-1 platform center-left (existing)
    fillRect(8, 3, 10, 5, TILE_TYPES.HIGH);
    // fillRectElev already at 1 via TILE_DEFS.high

    // Elevation-2 stepped mesa: base at elev 1, peak at elev 2
    fillRect(7, 9, 11, 12, TILE_TYPES.HIGH);
    fillRectElev(7, 9, 11, 12, 1);
    fillRect(8, 10, 10, 11, TILE_TYPES.HIGH);
    fillRectElev(8, 10, 10, 11, 2);

    // Elevation-3 tall spire: small 2x2 spike
    fillRect(13, 4, 14, 5, TILE_TYPES.HIGH);
    fillRectElev(13, 4, 14, 5, 3);
    // Surrounding base at elev 1 to show the step-up
    fillRect(12, 3, 15, 6, TILE_TYPES.HIGH);
    fillRectElev(12, 3, 15, 6, 1);
    // The inner 2x2 overwrites with 3
    fillRectElev(13, 4, 14, 5, 3);

    // Small wall barrier in center
    fillRect(11, 5, 11, 8, TILE_TYPES.WALL);

    // Rubble patches
    fillRect(4, 8, 6, 10, TILE_TYPES.RUBBLE);
    set(5, 7, TILE_TYPES.RUBBLE);
    fillRect(16, 3, 17, 5, TILE_TYPES.RUBBLE);
    set(15, 4, TILE_TYPES.RUBBLE);

    // Water cluster lower-right
    fillRect(17, 9, 18, 11, TILE_TYPES.WATER);
    set(16, 10, TILE_TYPES.WATER);

    // Elevation-1 platform center-right (existing, shifted to avoid spire)
    fillRect(13, 8, 15, 10, TILE_TYPES.HIGH);

    // Dirt path across center
    for (let x = 1; x < W - 1; x++) {
        const t = tiles[7 * W + x];
        if (t.type === TILE_TYPES.GRASS) set(x, 7, TILE_TYPES.DIRT);
    }

    return { width: W, height: H, tiles };
}

// Maximum elevation step a unit can climb in a single tile transition.
export const MAX_CLIMB = 1;

/**
 * Bresenham line-of-sight check between two grid positions.
 * A tile blocks sight if tile.blocksSight is true OR its elevation exceeds
 * the higher of the two endpoints' elevations (tall terrain blocks over the top).
 * The source and destination tiles themselves are never treated as blockers —
 * only the intermediate tiles on the path are checked.
 */
export function hasLineOfSight(map, x1, y1, x2, y2) {
    const srcTile  = getTile(map, x1, y1);
    const destTile = getTile(map, x2, y2);
    const eyeElev  = Math.max(srcTile?.elevation ?? 0, destTile?.elevation ?? 0);

    let x = x1, y = y1;
    const dx = Math.abs(x2 - x1), dy = Math.abs(y2 - y1);
    const sx = x1 < x2 ? 1 : -1, sy = y1 < y2 ? 1 : -1;
    let err = dx - dy;

    while (!(x === x2 && y === y2)) {
        const e2 = err * 2;
        if (e2 > -dy) { err -= dy; x += sx; }
        if (e2 <  dx) { err += dx; y += sy; }
        if (x === x2 && y === y2) break;
        const tile = getTile(map, x, y);
        if (!tile) return false;
        if (tile.blocksSight) return false;
        if (tile.elevation > eyeElev) return false;
    }
    return true;
}

export function applyTerrainEffect(map, x, y, effect) {
    const tile = getTile(map, x, y);
    if (!tile) return;
    const { setType, setElevation, affectTiles = 'all' } = effect;
    if (affectTiles === 'passable'   && !tile.passable) return;
    if (affectTiles === 'impassable' &&  tile.passable) return;
    const def = getTileDef(setType);
    Object.assign(tile, def);
    tile.type = setType;
    if (setElevation !== undefined) tile.elevation = setElevation;
}

export function getTile(map, x, y) {
    if (x < 0 || y < 0 || x >= map.width || y >= map.height) return null;
    return map.tiles[y * map.width + x];
}
