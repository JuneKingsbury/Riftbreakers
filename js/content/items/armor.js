// Armor: body armor, by type (cloth, light, medium, heavy).
//
// Each item: { name, slot, type, rarity?, <stat bonuses>, grants?, grantsPassive?, acts?, realms? }.
// Every field is described in js/content/vocab.js (SCHEMAS.item); see js/content/README.md.

export const items = {
    wool_parka:           { name: 'Wool Parka',            slot: 'armor',  type: 'cloth',  def:  2, mdf:  1 },
    wool_tunic:           { name: 'Wool Tunic',            slot: 'armor',  type: 'cloth',  def:  1, mdf:  1 },
    cotton_shirt:         { name: 'Cotton Shirt',          slot: 'armor',  type: 'cloth',  def:  1 },
    leather_vest:         { name: 'Leather Vest',          slot: 'armor',  type: 'light',  def:  4, eva:  2 },
    leather_jacket:       { name: 'Leather Jacket',        slot: 'armor',  type: 'light',  def:  3, eva:  1 },
    leather_jerkin:       { name: 'Leather Jerkin',        slot: 'armor',  type: 'light',  def:  5, eva:  3, rarity: 'uncommon' },
    iron_brigandine:      { name: 'Iron Brigandine',       slot: 'armor',  type: 'medium', def:  7, maxHp: 8 },
    iron_chainmail:       { name: 'Iron Chainmail',        slot: 'armor',  type: 'medium', def:  9, maxHp: 12, spd: -1, rarity: 'uncommon' },
    enchanted_tunic:      { name: 'Enchanted Tunic',       slot: 'armor',  type: 'cloth',  def:  4, mdf:  5, maxMp: 8, rarity: 'uncommon' },
    mana_weave_robe:      { name: 'Mana-Weave Robe',       slot: 'armor',  type: 'cloth',  def:  2, mdf:  8, mat:  3, maxMp: 14, mpRegen: 1, rarity: 'uncommon' },
    mana_silk_vestments:  { name: 'Mana-Silk Vestments',   slot: 'armor',  type: 'cloth',  def:  3, mdf:  9, mat:  4, maxMp: 20, mpRegen: 2, rarity: 'rare' },
    runic_plate:          { name: 'Runic Plate',           slot: 'armor',  type: 'heavy',  def: 14, mdf:  4, maxHp: 20, spd: -1, rarity: 'rare' },
    void_armor:           { name: 'Void Armor',            slot: 'armor',  type: 'heavy',  def: 14, mdf: 13, maxHp: 22, rarity: 'legendary', grantsPassive: ['void_siphon'] },
    living_bark_armor:    { name: 'Living Bark Armor',     slot: 'armor',  type: 'medium', def: 10, mdf:  6, maxHp: 18, rarity: 'uncommon', grantsPassive: ['take_root'] },
    frostplate:           { name: 'Frostplate',            slot: 'armor',  type: 'heavy',  def: 11, mdf:  7, maxHp: 14, rarity: 'uncommon' },
    berserkers_wraps:     { name: "Berserker's Wraps",     slot: 'armor',  type: 'light',  def:  5, atk:  6, eva:  4, rarity: 'uncommon' },
    duelists_silks:       { name: "Duelist's Silks",       slot: 'armor',  type: 'light',  def:  4, eva:  8, spd:  1, rarity: 'uncommon', grantsPassive: ['farsight'] },
    thornweave_vest:      { name: 'Thornweave Vest',       slot: 'armor',  type: 'light',  def:  6, mdf:  4, eva:  3, rarity: 'uncommon' },
    ashwalkers_cloak:     { name: "Ashwalker's Cloak",     slot: 'armor',  type: 'light',  def:  5, mdf:  3, eva:  5, spd:  1, rarity: 'uncommon', grantsPassive: ['pilgrim_step'] },
    cloak_of_shadows:     { name: 'Cloak of Shadows',      slot: 'armor',  type: 'light',  def:  5, atk:  3, eva: 12, spd:  2, rarity: 'legendary', grantsPassive: ['ghost_step'] },
    armor_of_the_abyss:   { name: 'Armor of the Abyss',    slot: 'armor',  type: 'heavy',  def: 11, mdf: 11, mat:  5, maxHp: 12, rarity: 'rare' },

    cotton_tunic:         { name: 'Cotton Tunic',          slot: 'armor',  type: 'cloth',  def:  2, mdf:  1 },
    leather_cloak:        { name: 'Leather Cloak',         slot: 'armor',  type: 'light',  def:  3, eva:  2 },
    padded_scout_vest:    { name: 'Padded Scout Vest',     slot: 'armor',  type: 'light',  def:  4, eva:  2, maxHp: 4 },
    foreman_apron:        { name: "Foreman's Apron",       slot: 'armor',  type: 'light',  def:  4, maxHp: 6, grants: ['earth_skin'] },
    huntsmans_leathers:   { name: "Huntsman's Leathers",   slot: 'armor',  type: 'light',  def:  5, atk:  2, eva:  3, rarity: 'uncommon', grantsPassive: ['call_of_the_pack'] },
    channelers_wraps:     { name: "Channeler's Wraps",     slot: 'armor',  type: 'cloth',  def:  3, mdf:  6, mat:  3, maxMp: 10, mpRegen: 1, rarity: 'uncommon' },
    shadow_wraps:         { name: 'Shadow Wraps',          slot: 'armor',  type: 'light',  def:  4, eva:  7, spd:  1, rarity: 'uncommon', grantsPassive: ['omen_step'] },
    shadowstrike_vest:    { name: 'Shadowstrike Vest',     slot: 'armor',  type: 'light',  def:  5, atk:  2, eva:  6, rarity: 'uncommon', grantsPassive: ['momentum'] },
    barbed_chaincoat:     { name: 'Barbed Chaincoat',      slot: 'armor',  type: 'medium', def:  8, maxHp: 10, rarity: 'uncommon', grantsPassive: ['thorn_hide'] },
    voidweave_robes:      { name: 'Voidweave Robes',       slot: 'armor',  type: 'cloth',  def:  3, mdf:  9, mat:  5, maxMp: 16, rarity: 'rare' },
    aether_mantle:        { name: 'Aether Mantle',         slot: 'armor',  type: 'cloth',  def:  5, mdf: 12, mat:  7, maxMp: 22, mpRegen: 2, rarity: 'legendary', grantsPassive: ['restorative_step'] },
    abyssal_bramble_plate:{ name: 'Abyssal Bramble Plate', slot: 'armor',  type: 'heavy',  def: 13, mdf:  6, maxHp: 18, rarity: 'rare' },
    chaos_wrought_plate:  { name: 'Chaos-Wrought Plate',   slot: 'armor',  type: 'heavy',  def: 12, atk:  4, mat:  4, maxHp: 14, spd: -1, rarity: 'rare' },
};
