// Trinkets.
// Rings, charms and pendants: stats only, for any class.
//
// Each item: { name, slot, type, rarity?, <stat bonuses>, grants?, grantsPassive?, acts?, realms? }.
// Every field is described in js/content/vocab.js (SCHEMAS.item); see js/content/README.md.

export const items = {
    hearthstone_pendant:  { name: 'Hearthstone Pendant',   slot: 'trinket', type: 'trinket', maxHp: 8, mdf: 1 },
    rabbits_paw:          { name: "Rabbit's Paw",          slot: 'trinket', type: 'trinket', eva:  2, crit: 4 },
    sharpened_fang_necklace: { name: 'Sharpened Fang Necklace', slot: 'trinket', type: 'trinket', atk: 2 },
    merchants_ring:       { name: "Merchant's Ring",       slot: 'trinket', type: 'trinket', mat:  2, maxMp: 4 },
    jesters_bauble:       { name: "Jester's Bauble",       slot: 'trinket', type: 'trinket', mdf:  3, maxHp: 4 },
    amulet_of_fortune:    { name: 'Amulet of Fortune',     slot: 'trinket', type: 'trinket', eva:  3, mdf:  3, rarity: 'uncommon' },
    seedkeepers_locket:   { name: "Seedkeeper's Locket",   slot: 'trinket', type: 'trinket', mdf:  4, eva:  2, maxHp: 6, rarity: 'uncommon' },
    charmweave_band:      { name: 'Charmweave Band',       slot: 'trinket', type: 'trinket', mat:  3, maxMp: 8, rarity: 'uncommon' },
    healers_pendant:      { name: "Healer's Pendant",      slot: 'trinket', type: 'trinket', mat:  3, mdf:  3, rarity: 'uncommon' },
    verdant_talisman:     { name: 'Verdant Talisman',      slot: 'trinket', type: 'trinket', mat:  2, maxHp: 10, rarity: 'uncommon' },
    ghost_step_charm:     { name: 'Ghost-Step Charm',      slot: 'trinket', type: 'trinket', eva:  8, rarity: 'uncommon' },
    strikers_band:        { name: "Striker's Band",        slot: 'trinket', type: 'trinket', atk:  3, crit: 5, rarity: 'uncommon' },
    ember_sigil:          { name: 'Ember Sigil',           slot: 'trinket', type: 'trinket', mat:  6, rarity: 'rare' },
    void_charm:           { name: 'Void Charm',            slot: 'trinket', type: 'trinket', atk:  5, def:  2, rarity: 'rare' },
    bloodstone_pendant:   { name: 'Bloodstone Pendant',    slot: 'trinket', type: 'trinket', atk:  5, maxHp: 18, crit: 4, rarity: 'legendary' },
    blight_ward:          { name: 'Blight Ward',           slot: 'trinket', type: 'trinket', mdf:  3, eva:  1 },
    hagglers_coin:        { name: 'Lucky Coin',            slot: 'trinket', type: 'trinket', spd:  1, crit: 3 },
    compass_of_greed:     { name: "Wayfinder's Compass",   slot: 'trinket', type: 'trinket', eva:  3, maxHp: 4 },
    burnished_relic:      { name: 'Burnished Relic',       slot: 'trinket', type: 'trinket', def:  3, mdf:  3, rarity: 'uncommon' },
    iron_clad_effigy:     { name: 'Ironclad Effigy',       slot: 'trinket', type: 'trinket', def:  3, maxHp: 10, rarity: 'uncommon', grantsPassive: ['brace'] },
    lodestone_of_prosperity: { name: 'Lodestone',          slot: 'trinket', type: 'trinket', maxMp: 8, mpRegen: 1, rarity: 'uncommon' },
    stitched_poppet:      { name: 'Stitched Poppet',       slot: 'trinket', type: 'trinket', maxHp: 8, rarity: 'uncommon', grantsPassive: ['reflex_tonic'] },
    chaos_shard:          { name: 'Chaos Shard',           slot: 'trinket', type: 'trinket', mat:  4, crit: 5, rarity: 'rare' },
    sanguine_fang:        { name: 'Sanguine Fang',         slot: 'trinket', type: 'trinket', atk:  4, crit: 4, rarity: 'rare', grantsPassive: ['counter'] },
    hourglass_of_diligence: { name: 'Hourglass of Diligence', slot: 'trinket', type: 'trinket', spd: 2, mpRegen: 1, rarity: 'rare' },
    shard_of_oblivion:    { name: 'Shard of Oblivion',     slot: 'trinket', type: 'trinket', atk:  3, mat:  3, rarity: 'rare', grantsPassive: ['karmic_rebound'] },
    voidheart:            { name: 'Voidheart',             slot: 'trinket', type: 'trinket', mat:  6, maxMp: 10, mpRegen: 2, rarity: 'legendary' },
    // A Feats reward (profile COLLECTION_REWARDS): drops only once 66% of all items are found.
    jewelers_loupe:       { name: "Collector's Loupe",     slot: 'trinket', type: 'trinket', atk:  3, mat:  3, eva:  3, crit: 6, rarity: 'rare', featOnly: true },
};
