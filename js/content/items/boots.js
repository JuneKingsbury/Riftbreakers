// Boots.
// Stats only (they don't show on the sprite), and any class can wear them. Light boots
// quicken the step, greaves protect; only the rarest add Move.
//
// Each item: { name, slot, type, rarity?, <stat bonuses>, grants?, grantsPassive?, acts?, realms? }.
// Every field is described in js/content/vocab.js (SCHEMAS.item); see js/content/README.md.

export const items = {
    leather_boots:        { name: 'Leather Boots',         slot: 'boots',  type: 'boots',  spd:  1, eva:  2 },
    enchanted_sandals:    { name: 'Enchanted Sandals',     slot: 'boots',  type: 'boots',  spd:  1, eva:  3, maxMp: 4 },
    iron_greaves:         { name: 'Iron Greaves',          slot: 'boots',  type: 'boots',  def:  3, maxHp: 6 },
    emberstep_anklet:     { name: 'Emberstep Anklet',      slot: 'boots',  type: 'boots',  spd:  1, mdf:  2, maxHp: 8, rarity: 'uncommon' },
    runic_striders:       { name: 'Runic Striders',        slot: 'boots',  type: 'boots',  spd:  2, eva:  3, rarity: 'uncommon' },
    striders_greaves:     { name: "Strider's Greaves",     slot: 'boots',  type: 'boots',  spd:  1, def:  3, eva:  5, rarity: 'uncommon' },
    void_treads:          { name: 'Void Treads',           slot: 'boots',  type: 'boots',  move: 1, spd:  1, def:  3, rarity: 'rare' },
    boots_of_haste:       { name: 'Boots of Haste',        slot: 'boots',  type: 'boots',  move: 1, spd:  3, eva:  3, rarity: 'legendary' },
    travelers_boots:      { name: "Traveler's Boots",      slot: 'boots',  type: 'boots',  spd:  1, maxHp: 5 },
    soft_slippers:        { name: 'Soft Slippers',         slot: 'boots',  type: 'boots',  eva:  4, maxMp: 2 },
    stoneshod_boots:      { name: 'Stoneshod Boots',       slot: 'boots',  type: 'boots',  def:  2, mdf:  3, maxHp: 8, rarity: 'uncommon' },
    windrunner_boots:     { name: 'Windrunner Boots',      slot: 'boots',  type: 'boots',  spd:  2, eva:  2, maxHp: 4, rarity: 'uncommon' },
    thornstep_boots:      { name: 'Thornstep Boots',       slot: 'boots',  type: 'boots',  def:  2, maxHp: 8, rarity: 'uncommon', grantsPassive: ['take_root'] },
    frostbound_greaves:   { name: 'Frostbound Greaves',    slot: 'boots',  type: 'boots',  def:  4, mdf:  4, maxHp: 10, rarity: 'rare' },
    riftwalker_boots:     { name: 'Riftwalker Boots',      slot: 'boots',  type: 'boots',  move: 1, eva:  6, rarity: 'rare' },
};
