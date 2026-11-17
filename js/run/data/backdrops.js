// Title screen backdrops: a skin tile repeated behind the title menu (ui/start-backdrop.js),
// darkened so the menu stays readable. The free ones are always available; the rest are
// bought with renown in Unlocks and picked in Settings > Graphics.
//   tile  [category, key] of the skin sprite
//   cost  renown (0: free)
export const BACKDROPS = {
    abyss_floor:      { name: 'Abyss Floor',      tile: ['floors', 'abyss_floor'],      cost: 0 },
    stone_wall:       { name: 'Stone Wall',       tile: ['buildings', 'stone_wall'],    cost: 0 },
    wood_floor:       { name: 'Wooden Boards',    tile: ['floors', 'wood_floor'],       cost: 10 },
    brick_floor:      { name: 'Old Brick',        tile: ['floors', 'brick_floor'],      cost: 10 },
    verdant_floor:    { name: 'Verdant Depths',   tile: ['floors', 'verdant_floor'],    cost: 15 },
    crystal_floor:    { name: 'Crystal Caves',    tile: ['floors', 'crystal_floor'],    cost: 15 },
    university_floor: { name: 'Arcane Library',   tile: ['floors', 'university_floor'], cost: 15 },
    kingdom_floor:    { name: 'Palace Fortress',  tile: ['floors', 'kingdom_floor'],    cost: 20 },
    void_wall:        { name: 'Void Sanctum',     tile: ['buildings', 'void_wall'],     cost: 20 },
};
export const DEFAULT_BACKDROP = 'abyss_floor';
