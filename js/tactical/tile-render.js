// Presentation properties for each tile type. Kept apart from the gameplay
// MATERIALS in battle-map.js so renderers own their look and rules stay headless.

export const TILE_RENDER = {
    grass:  { char: '.', color: '#4a7c4a', bg: '#1a2e1a', spriteKey: 'grass', side: '#6b4a2a' },
    dirt:   { char: ',', color: '#7c6a4a', bg: '#2e2418', spriteKey: 'dirt', side: '#6b4a2a' },
    water:  { char: '~', color: '#3a6a9c', bg: '#0a1e3e', spriteKey: 'water', side: '#2c5580' },
    wall:   { char: '#', color: '#666677', bg: '#111122', spriteKey: 'tall_rock', side: '#5a5a6a' },
    rubble: { char: ':', color: '#8a7a5a', bg: '#2a1e10', spriteKey: 'gravel', side: '#6e5e40' },
};

export function getTileRender(type) {
    return TILE_RENDER[type] || TILE_RENDER.grass;
}

// World-space height of one elevation level, in tile widths.
export const ELEV_STEP = 0.55;
// Water's surface is drawn slightly below the top of its block. Cosmetic only.
export const WATER_DROP = 0.12;
// Underside of the terrain slab (the bottom of the z = 0 blocks).
export const SLAB_BOTTOM = -0.6;

/** World height of the top of block z (see battle-map.js for the vertical layout). */
export function blockTopY(z) {
    return z * ELEV_STEP;
}

/** World height of the bottom of block z. */
export function blockBottomY(z) {
    return z === 0 ? SLAB_BOTTOM : (z - 1) * ELEV_STEP;
}

/** World height of a cell's top face. A missing cell counts as ground level. */
export function terrainTopY(cell) {
    if (!cell) return 0;
    let y = blockTopY(cell.z || 0);
    if (cell.type === 'water') y -= WATER_DROP;
    return y;
}
