// Helmets, by type (cloth, light, medium, heavy).
//
// Each item: { name, slot, type, rarity?, <stat bonuses>, grants?, grantsPassive?, acts?, realms? }.
// Every field is described in js/content/vocab.js (SCHEMAS.item); see js/content/README.md.

export const items = {
    wool_cap:             { name: 'Wool Cap',              slot: 'helmet', type: 'cloth',  def:  1 },
    leather_cap:          { name: 'Leather Cap',           slot: 'helmet', type: 'light',  def:  2, eva:  1 },
    iron_helmet:          { name: 'Iron Helmet',           slot: 'helmet', type: 'medium', def:  5, maxHp: 6 },
    runic_helm:           { name: 'Runic Helm',            slot: 'helmet', type: 'heavy',  def:  7, mdf:  3, maxHp: 8, rarity: 'uncommon' },
    runic_hood:           { name: 'Runic Hood',            slot: 'helmet', type: 'cloth',  def:  2, mdf:  6, maxMp: 10, rarity: 'uncommon' },
    mages_circlet:        { name: "Mage's Circlet",        slot: 'helmet', type: 'cloth',  mat:  4, mdf:  4, maxMp: 12, rarity: 'uncommon' },
    void_crown:           { name: 'Void Crown',            slot: 'helmet', type: 'cloth',  mat:  7, mdf:  5, maxMp: 16, rarity: 'rare', grantsPassive: ['blink'] },
    mycelium_crown:       { name: 'Mycelium Crown',        slot: 'helmet', type: 'cloth',  mat:  5, mdf:  6, maxMp: 10, maxHp: 6, rarity: 'rare', grants: ['hexform'] },
    void_hunters_cowl:    { name: "Void Hunter's Cowl",    slot: 'helmet', type: 'light',  def:  3, eva:  6, spd:  1, rarity: 'uncommon' },
    sharpshooters_visor:  { name: "Sharpshooter's Visor",  slot: 'helmet', type: 'light',  atk:  3, eva:  4, rarity: 'uncommon' },
    scholars_spectacles:  { name: "Scholar's Spectacles",  slot: 'helmet', type: 'cloth',  mat:  3, maxMp: 8, rarity: 'uncommon', grantsPassive: ['jp_boost'] },

    cotton_cap:           { name: 'Cotton Cap',            slot: 'helmet', type: 'cloth',  def:  1, mdf:  1 },
    scouts_hood:          { name: "Scout's Hood",          slot: 'helmet', type: 'light',  def:  2, eva:  2 },
    ironbark_hat:         { name: 'Ironbark Hat',          slot: 'helmet', type: 'cloth',  def:  2, mdf:  2 },
    runic_furskin_hood:   { name: 'Runic Furskin Hood',    slot: 'helmet', type: 'light',  def:  3, mdf:  3, maxHp: 6, rarity: 'uncommon' },
    shadowweave_cowl:     { name: 'Shadowweave Cowl',      slot: 'helmet', type: 'cloth',  def:  2, mdf:  5, eva:  3, rarity: 'uncommon' },
    shadowweave_hat:      { name: 'Shadowweave Hat',       slot: 'helmet', type: 'cloth',  mat:  4, mdf:  3, maxMp: 8, rarity: 'uncommon' },
    spiritweave_hat:      { name: 'Spiritweave Hat',       slot: 'helmet', type: 'cloth',  mat:  3, mdf:  4, maxMp: 10, rarity: 'uncommon', grants: ['last_rites'] },
    spiked_iron_coif:     { name: 'Spiked Iron Coif',      slot: 'helmet', type: 'medium', def:  6, atk:  1, maxHp: 6, rarity: 'uncommon' },
    unravelers_eye:       { name: "Unraveler's Eye",       slot: 'helmet', type: 'cloth',  mat:  5, mdf:  5, eva:  3, rarity: 'rare', grantsPassive: ['second_sight'] },
    void_sages_tiara:     { name: "Void Sage's Tiara",     slot: 'helmet', type: 'cloth',  mat:  6, mdf:  6, maxMp: 14, rarity: 'rare' },
    voidpulse_circlet:    { name: 'Voidpulse Circlet',     slot: 'helmet', type: 'cloth',  mat:  8, mdf:  3, maxMp: 10, rarity: 'rare' },
    void_dancers_mask:    { name: "Void Dancer's Mask",    slot: 'helmet', type: 'light',  def:  2, eva:  8, spd:  1, rarity: 'rare', grantsPassive: ['phase_shift'] },
    commanders_crown:     { name: "Commander's Crown",     slot: 'helmet', type: 'medium', def:  4, mdf:  4, atk:  2, mat:  2, rarity: 'rare', grantsPassive: ['sentinel_step'] },
    abyss_wardens_helm:   { name: "Abyss Warden's Helm",   slot: 'helmet', type: 'heavy',  def:  8, mdf:  4, maxHp: 10, rarity: 'rare' },
};
