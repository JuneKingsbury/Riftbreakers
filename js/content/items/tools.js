// Tools and off-hand items.
// Anything held alongside the main weapon: shields, quivers, lanterns and off-hand
// weapons (a parrying dagger, a sickle), so its bonuses stack with the weapon's.
//
// Each item: { name, slot, type, rarity?, <stat bonuses>, grants?, grantsPassive?, acts?, realms? }.
// Every field is described in js/content/vocab.js (SCHEMAS.item); see js/content/README.md.

export const items = {
    lantern:              { name: 'Lantern',               slot: 'tool',   type: 'implement',      eva:  2, grants: ['first_aid'] },
    drum_of_rallying:     { name: 'Drum of Rallying',      slot: 'tool',   type: 'implement',      mdf:  2, rarity: 'uncommon', grants: ['rallying_beat'] },
    iron_shield:          { name: 'Iron Shield',           slot: 'tool',   type: 'shield',         def:  7, eva:  3, grantsPassive: ['martyr'] },
    crystal_aegis:        { name: 'Crystal Aegis',         slot: 'tool',   type: 'shield',         def:  6, mdf:  7, rarity: 'rare', grants: ['aegis_ward'] },
    runic_buckler:        { name: 'Runic Buckler',         slot: 'tool',   type: 'shield',         def:  5, eva:  5, rarity: 'uncommon' },
    aegis_of_the_vanguard:{ name: 'Aegis of the Vanguard', slot: 'tool',   type: 'shield',         def: 12, mdf:  4, maxHp: 18, rarity: 'legendary', grantsPassive: ['martyr'] },
    hunters_quiver:       { name: "Hunter's Quiver",       slot: 'tool',   type: 'quiver',         atk:  3 },
    bottomless_quiver:    { name: 'Bottomless Quiver',     slot: 'tool',   type: 'quiver',         atk:  5, move:  1, rarity: 'uncommon', grantsPassive: ['move_plus_1'] },
    void_hammer:          { name: 'Void Hammer',           slot: 'tool',   type: 'offhand_weapon', atk:  8, spd: -1, rarity: 'uncommon' },
    void_axe:             { name: 'Void Axe',              slot: 'tool',   type: 'offhand_weapon', atk:  7, def: -1, rarity: 'uncommon' },
    void_sickle:          { name: 'Void Sickle',           slot: 'tool',   type: 'offhand_weapon', atk:  5, eva:  3, rarity: 'uncommon' },
    parrying_dagger:      { name: 'Parrying Dagger',       slot: 'tool',   type: 'offhand_weapon', atk:  3, def:  3, eva:  5, rarity: 'uncommon', grantsPassive: ['brace'] },
    iron_pickaxe:         { name: 'Iron Pickaxe',          slot: 'tool',   type: 'offhand_weapon', atk:  6 },
    runic_pickaxe:        { name: 'Runic Pickaxe',         slot: 'tool',   type: 'offhand_weapon', atk:  9, mat:  2, rarity: 'uncommon' },
    void_pickaxe:         { name: 'Void Pickaxe',          slot: 'tool',   type: 'offhand_weapon', atk: 10, mat:  3, rarity: 'rare' },
    stone_axe:            { name: 'Stone Axe',             slot: 'tool',   type: 'offhand_weapon', atk:  4 },
    stone_hammer:         { name: 'Stone Hammer',          slot: 'tool',   type: 'offhand_weapon', atk:  4, spd: -1 },
    stone_mattock:        { name: 'Stone Mattock',         slot: 'tool',   type: 'offhand_weapon', atk:  3 },
    stone_sickle:         { name: 'Stone Sickle',          slot: 'tool',   type: 'offhand_weapon', atk:  3, eva:  1 },
    iron_sickle:          { name: 'Iron Sickle',           slot: 'tool',   type: 'offhand_weapon', atk:  5, eva:  2 },
    runic_sickle:         { name: 'Runic Sickle',          slot: 'tool',   type: 'offhand_weapon', atk:  7, eva:  4, rarity: 'uncommon' },
    iron_mattock:         { name: 'Iron Mattock',          slot: 'tool',   type: 'offhand_weapon', atk:  5 },
    runic_mattock:        { name: 'Runic Mattock',         slot: 'tool',   type: 'offhand_weapon', atk:  8, rarity: 'uncommon' },
    void_mattock:         { name: 'Void Mattock',          slot: 'tool',   type: 'offhand_weapon', atk:  9, mat:  2, rarity: 'rare' },
    stone_pickaxe:        { name: 'Stone Pickaxe',         slot: 'tool',   type: 'offhand_weapon', atk:  3, def:  1 },
};
