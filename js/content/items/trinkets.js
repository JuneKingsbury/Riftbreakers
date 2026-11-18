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
    bloodstone_pendant:   { name: 'Bloodstone Pendant',    slot: 'trinket', type: 'trinket', atk:  3, maxHp: 12, rarity: 'rare' },
    // A Feats reward (profile COLLECTION_REWARDS): drops only once 66% of all items are found.
    jewelers_loupe:       { name: "Collector's Loupe",     slot: 'trinket', type: 'trinket', atk:  3, mat:  3, eva:  3, crit: 6, rarity: 'rare', featOnly: true },
};
