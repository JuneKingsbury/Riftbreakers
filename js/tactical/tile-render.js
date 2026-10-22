// Presentation properties for each tile type. Kept apart from the gameplay
// TILE_DEFS in battle-map.js so renderers own their look and rules stay headless.

export const TILE_RENDER = {
    grass:  { char: '.', color: '#4a7c4a', bg: '#1a2e1a', spriteKey: 'grass', side: '#6b4a2a' },
    dirt:   { char: ',', color: '#7c6a4a', bg: '#2e2418', spriteKey: 'dirt', side: '#6b4a2a' },
    water:  { char: '~', color: '#3a6a9c', bg: '#0a1e3e', spriteKey: 'water', side: '#2c5580' },
    wall:   { char: '#', color: '#666677', bg: '#111122', spriteKey: 'tall_rock', side: '#5a5a6a' },
    rubble: { char: ':', color: '#8a7a5a', bg: '#2a1e10', spriteKey: 'gravel', side: '#6e5e40' },
    high:   { char: '^', color: '#5a9c5a', bg: '#1a3e1a', spriteKey: 'grass', side: '#6b4a2a' },
};

export function getTileRender(type) {
    return TILE_RENDER[type] || TILE_RENDER.grass;
}

// World-space height of one elevation level, in tile widths.
export const ELEV_STEP = 0.55;
// Walls are level terrain to the rules (they block by blocksSight) but are drawn tall.
export const WALL_EXTRA_HEIGHT = 1.1;
// Water sits slightly below the ground around it.
export const WATER_DROP = 0.12;
// Underside of the terrain slab.
export const SLAB_BOTTOM = -0.6;

/** World height of a tile's top face. Tiles that are off the map count as ground level. */
export function terrainTopY(tile) {
    if (!tile) return 0;
    let y = (tile.elevation || 0) * ELEV_STEP;
    if (tile.type === 'wall')  y += WALL_EXTRA_HEIGHT;
    if (tile.type === 'water') y -= WATER_DROP;
    return y;
}
