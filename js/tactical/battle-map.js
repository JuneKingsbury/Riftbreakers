export const TILE_TYPES = {
    GRASS:  'grass',
    DIRT:   'dirt',
    WATER:  'water',
    WALL:   'wall',
    RUBBLE: 'rubble',
    HIGH:   'high',
};

export const TILE_DEFS = {
    grass:  { char: '.', color: '#4a7c4a', bg: '#1a2e1a', passable: true,  moveCost: 1,  elevation: 0, spriteKey: 'grass' },
    dirt:   { char: ',', color: '#7c6a4a', bg: '#2e2418', passable: true,  moveCost: 1,  elevation: 0, spriteKey: 'dirt' },
    water:  { char: '~', color: '#3a6a9c', bg: '#0a1e3e', passable: false, moveCost: 99, elevation: 0, spriteKey: 'water' },
    wall:   { char: '#', color: '#666677', bg: '#111122', passable: false, moveCost: 99, elevation: 0, spriteKey: 'tall_rock' },
    rubble: { char: ':', color: '#8a7a5a', bg: '#2a1e10', passable: true,  moveCost: 2,  elevation: 0, spriteKey: 'gravel' },
    high:   { char: '^', color: '#5a9c5a', bg: '#1a3e1a', passable: true,  moveCost: 1,  elevation: 1, spriteKey: 'grass' },
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

export function getTile(map, x, y) {
    if (x < 0 || y < 0 || x >= map.width || y >= map.height) return null;
    return map.tiles[y * map.width + x];
}
