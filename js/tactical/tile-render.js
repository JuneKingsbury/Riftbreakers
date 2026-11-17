// Presentation properties for each block material. Kept apart from the gameplay
// MATERIALS in battle-map.js so renderers own their look and rules stay headless.
//
//   label   Name shown in the map editor
//   color   Flat top color, used when no skin is loaded (and for editor swatches)
//   tex     Skin sprite for the top face, 'category:key'. null: always the flat color
//   tint    Multiplies the texture (recolors a shared sprite, e.g. crystal from stone)
//   side    Flat color of the side faces
//   sideTex true: the sides show the texture too (walls whose art reads from the side)
//   liquid  The surface sits a little below the block top and does not hide the sides of
//           solid ground next to it. Cosmetic only, like everything here.
//   fx      Animated overlay on the top: { kind: 'tuft' | 'waves', tex, tint? }

const tuft  = (tex) => ({ kind: 'tuft', tex });
const waves = (tex, tint) => ({ kind: 'waves', tex, tint });

export const TILE_RENDER = {
    // Natural ground
    grass:   { label: 'Grass',      char: '.', color: '#4a7c4a', tex: 'terrain:grass',  side: '#6b4a2a', fx: tuft('effects:grass_tuft') },
    dirt:    { label: 'Dirt',       char: ',', color: '#7c6a4a', tex: 'terrain:dirt',   side: '#6b4a2a' },
    rubble:  { label: 'Rubble',     char: ':', color: '#8a7a5a', tex: 'terrain:gravel', side: '#6e5e40' },
    sand:    { label: 'Sand',       char: '.', color: '#d8c890', tex: 'terrain:sand',   side: '#a8905a' },
    moss:    { label: 'Moss',       char: '.', color: '#56702e', tex: 'terrain:forest_grass', side: '#4a3a22', fx: tuft('effects:forest_grass_tuft') },
    autumn:  { label: 'Autumn grass', char: '.', color: '#c8a020', tex: 'terrain:grass_autumn', side: '#6b4a2a', fx: tuft('effects:grass_tuft_autumn') },
    swamp:   { label: 'Swamp grass', char: '.', color: '#4d5e26', tex: 'terrain:swamp_grass', side: '#3e3420', fx: tuft('effects:swamp_grass_tuft') },
    fungal:  { label: 'Fungal mat', char: '.', color: '#6a4a7a', tex: 'terrain:swamp_grass', tint: '#c9a0ff', side: '#3e2a48', fx: tuft('buildings:bog_mushrooms') },
    stone:   { label: 'Stone',      char: '.', color: '#8e8c88', tex: 'terrain:rock',   side: '#5e5c5a' },
    redrock: { label: 'Red rock',   char: '.', color: '#9a5324', tex: 'terrain:red_rock', side: '#6a3618' },
    snow:    { label: 'Snow',       char: '*', color: '#e8f0f8', tex: 'terrain:snow_ground', tint: '#e8f2ff', side: '#9aa6b8' },
    mud:     { label: 'Mud',        char: ',', color: '#6d4714', tex: 'terrain:mud',    side: '#4a3010' },
    shallows: { label: 'Shallows',  char: '~', color: '#42acaf', tex: 'terrain:shallow_water', side: '#2c6a70', fx: waves('effects:shallow_water_waves') },
    // Built floors
    cobble:  { label: 'Cobblestone', char: '_', color: '#76746a', tex: 'floors:stone_floor', side: '#55534c' },
    brick:   { label: 'Brick floor', char: '_', color: '#c06a48', tex: 'floors:brick_floor', side: '#7a4030' },
    planks:  { label: 'Planks',     char: '_', color: '#c89a68', tex: 'floors:wood_floor', side: '#7a5a38' },
    marble:  { label: 'Marble tiles', char: '_', color: '#b0896e', tex: 'floors:university_floor', tint: '#fff4ea', side: '#8a7464' },
    carpet:  { label: 'Carpet',     char: '_', color: '#7a2a2a', tex: 'floors:rug',      side: '#4a1a1a' },
    gravel_path: { label: 'Gravel path', char: '_', color: '#968c82', tex: 'floors:gravel_path', side: '#6a625a' },
    verdant_tile: { label: 'Verdant tiles', char: '_', color: '#74a987', tex: 'floors:verdant_floor', side: '#4a6a56' },
    crystal_floor: { label: 'Crystal floor', char: '_', color: '#8ab0d8', tex: 'floors:crystal_floor', tint: '#b8d8ff', side: '#5a7090' },
    abyss_tile: { label: 'Abyss stone', char: '_', color: '#412c4f', tex: 'floors:abyss_floor', side: '#2a1c34' },
    glyph:   { label: 'Rift glyph', char: '_', color: '#c070d0', tex: 'floors:ritual_chalk', tint: '#e0a0ff', side: '#5a3a68' },
    // Walls
    wall:    { label: 'Rock wall',  char: '#', color: '#666677', tex: 'terrain:tall_rock', side: '#5a5a6a' },
    stone_wall: { label: 'Stone wall', char: '#', color: '#8a8a88', tex: 'buildings:stone_wall', side: '#6a6a6a', sideTex: true },
    brick_wall: { label: 'Brick wall', char: '#', color: '#b05a40', tex: 'buildings:brick_wall', side: '#7a3a28', sideTex: true },
    wood_wall: { label: 'Wood wall', char: '#', color: '#a87a48', tex: 'buildings:wood_wall', side: '#6a4a28', sideTex: true },
    kingdom_wall: { label: 'Kingdom wall', char: '#', color: '#9a9aa0', tex: 'buildings:kingdom_wall', tint: '#f4ecdc', side: '#6a6a70', sideTex: true },
    bookshelf: { label: 'Bookshelf', char: '#', color: '#7a5030', tex: 'buildings:university_wall', side: '#5a3a20', sideTex: true },
    hedge:   { label: 'Hedge',      char: '#', color: '#2e5a34', tex: 'buildings:verdant_wall', side: '#24442a', sideTex: true },
    crystal: { label: 'Crystal',    char: '#', color: '#7ab0f0', tex: 'buildings:crystal_wall', tint: '#9cc8ff', side: '#4a70a8', sideTex: true },
    abyss_wall: { label: 'Abyss wall', char: '#', color: '#7040b0', tex: 'buildings:abyss_wall', tint: '#b8a0d8', side: '#402a60', sideTex: true },
    void_wall: { label: 'Void wall', char: '#', color: '#5030a0', tex: 'buildings:void_wall', tint: '#9a80c8', side: '#301c58', sideTex: true },
    warded_wall: { label: 'Warded wall', char: '#', color: '#9050d0', tex: 'buildings:warded_wall', side: '#502a80', sideTex: true },
    // Liquids
    water:   { label: 'Water',      char: '~', color: '#3a6a9c', tex: 'terrain:water', side: '#2c5580', liquid: true, fx: waves('effects:water_waves') },
    bog:     { label: 'Bog water',  char: '~', color: '#4a6a3a', tex: 'terrain:shallow_water', tint: '#90b070', side: '#344a2a', liquid: true, fx: waves('effects:shallow_water_waves', '#a0c080') },
    void_water: { label: 'Void water', char: '~', color: '#2e2258', tex: null, side: '#22183e', liquid: true, fx: waves('effects:water_waves', '#c8b0ff') },
    lava:    { label: 'Lava',       char: '~', color: '#f06a20', tex: null, side: '#8a3010', liquid: true, fx: waves('effects:water_waves', '#ffd040') },
};

export function getTileRender(type) {
    return TILE_RENDER[type] || TILE_RENDER.grass;
}

/** The skin image for a 'category:key' sprite reference, or null. */
export function tileSprite(skinManager, ref) {
    if (!ref || !skinManager?.isActive) return null;
    const i = ref.indexOf(':');
    return skinManager.getSprite(ref.slice(0, i), ref.slice(i + 1));
}

// ---- Realm looks ---------------------------------------------------------------------
//
// A look (map.look, set by the run for the act's realm) re-dresses a map without changing
// its rules: look.blocks maps a material to the material drawn in its place, either one
// type or a weighted mix [[type, weight], ...] picked per block. A material keeps its own
// look when the realm doesn't list it. Realms only swap a material for one with the same
// rules (tests/run/realms.test.mjs), so a re-dressed map reads the same as the original.

function blockHash(x, y, z) {
    let h = Math.imul(x + 1, 73856093) ^ Math.imul(y + 1, 19349663) ^ Math.imul(z + 1, 83492791);
    h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
    return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

/** Material drawn for the block of `type` at (x, y, z) under `look` (or no look). */
export function lookType(look, type, x, y, z) {
    const swap = look?.blocks?.[type];
    if (!swap) return type;
    if (typeof swap === 'string') return swap;
    const total = swap.reduce((s, [, w]) => s + w, 0);
    let r = blockHash(x, y, z) * total;
    for (const [t, w] of swap) if ((r -= w) < 0) return t;
    return swap[swap.length - 1][0];
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
    if (getTileRender(cell.type).liquid) y -= WATER_DROP;
    return y;
}
