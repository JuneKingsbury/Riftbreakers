// Equipment item definitions.
// Each entry maps to an equipment_worn sprite key and describes the slot it
// occupies plus any stat bonuses granted when equipped.
//
// Stat fields (all optional, default 0 if absent):
//   atk, def, mat, mdf, spd, move, eva, maxHp, maxMp
//
// slot: 'armor' | 'helmet' | 'weapon' | 'tool'

export const EQUIPMENT = {
    // ============================================================
    // ARMOR
    // ============================================================
    wool_parka:           { slot: 'armor',  type: 'cloth',  def:  2, mdf:  1 },
    wool_tunic:           { slot: 'armor',  type: 'cloth',  def:  1, mdf:  1 },
    cotton_shirt:         { slot: 'armor',  type: 'cloth',  def:  1 },
    leather_vest:         { slot: 'armor',  type: 'light',  def:  4, eva:  2 },
    leather_jacket:       { slot: 'armor',  type: 'light',  def:  3, eva:  1 },
    leather_jerkin:       { slot: 'armor',  type: 'light',  def:  5, eva:  3 },
    iron_brigandine:      { slot: 'armor',  type: 'medium', def:  7, maxHp: 8 },
    iron_chainmail:       { slot: 'armor',  type: 'medium', def:  9, maxHp: 12, spd: -1 },
    enchanted_tunic:      { slot: 'armor',  type: 'cloth',  def:  4, mdf:  5, maxMp: 8 },
    mana_weave_robe:      { slot: 'armor',  type: 'cloth',  def:  2, mdf:  8, mat:  3, maxMp: 14 },
    mana_silk_vestments:  { slot: 'armor',  type: 'cloth',  def:  3, mdf:  9, mat:  4, maxMp: 20 },
    runic_plate:          { slot: 'armor',  type: 'heavy',  def: 14, mdf:  4, maxHp: 20, spd: -1 },
    void_armor:           { slot: 'armor',  type: 'heavy',  def: 12, mdf: 12, maxHp: 16, spd: -1 },
    living_bark_armor:    { slot: 'armor',  type: 'medium', def: 10, mdf:  6, maxHp: 18 },
    frostplate:           { slot: 'armor',  type: 'heavy',  def: 11, mdf:  7, maxHp: 14 },
    berserkers_wraps:     { slot: 'armor',  type: 'light',  def:  5, atk:  6, eva:  4 },
    duelists_silks:       { slot: 'armor',  type: 'light',  def:  4, eva:  8, spd:  1 },
    thornweave_vest:      { slot: 'armor',  type: 'light',  def:  6, mdf:  4, eva:  3 },
    ashwalkers_cloak:     { slot: 'armor',  type: 'light',  def:  5, mdf:  3, eva:  5, spd:  1 },
    cloak_of_shadows:     { slot: 'armor',  type: 'light',  def:  4, eva: 10, spd:  2 },
    aegis_of_the_vanguard:{ slot: 'armor',  type: 'heavy',  def: 13, maxHp: 24, spd: -2 },
    armor_of_the_abyss:   { slot: 'armor',  type: 'heavy',  def: 11, mdf: 11, mat:  5, maxHp: 12 },

    // ============================================================
    // HELMETS
    // ============================================================
    wool_cap:             { slot: 'helmet', type: 'cloth',  def:  1 },
    leather_cap:          { slot: 'helmet', type: 'light',  def:  2, eva:  1 },
    iron_helmet:          { slot: 'helmet', type: 'medium', def:  5, maxHp: 6 },
    runic_helm:           { slot: 'helmet', type: 'heavy',  def:  7, mdf:  3, maxHp: 8 },
    runic_hood:           { slot: 'helmet', type: 'cloth',  def:  2, mdf:  6, maxMp: 10 },
    mages_circlet:        { slot: 'helmet', type: 'cloth',  mat:  4, mdf:  4, maxMp: 12 },
    void_crown:           { slot: 'helmet', type: 'cloth',  mat:  7, mdf:  5, maxMp: 16 },
    mycelium_crown:       { slot: 'helmet', type: 'cloth',  mat:  5, mdf:  6, maxMp: 10, maxHp: 6 },
    void_hunters_cowl:    { slot: 'helmet', type: 'light',  def:  3, eva:  6, spd:  1 },
    sharpshooters_visor:  { slot: 'helmet', type: 'light',  atk:  3, eva:  4 },
    scholars_spectacles:  { slot: 'helmet', type: 'cloth',  mat:  3, maxMp: 8 },

    // ============================================================
    // WEAPONS
    // ============================================================
    wooden_club:          { slot: 'weapon', type: 'heavy_weapon', atk:  3 },
    wooden_wand:          { slot: 'weapon', type: 'magic',        mat:  3, maxMp: 4 },
    stone_spear:          { slot: 'weapon', type: 'heavy_weapon', atk:  5, move:  1 },
    iron_sword:           { slot: 'weapon', type: 'blade',        atk:  8 },
    iron_axe:             { slot: 'weapon', type: 'heavy_weapon', atk: 10, def: -1 },
    iron_hammer:          { slot: 'weapon', type: 'heavy_weapon', atk: 11, spd: -1 },
    etched_axe:           { slot: 'weapon', type: 'heavy_weapon', atk: 12, def: -1 },
    etched_mace:          { slot: 'weapon', type: 'heavy_weapon', atk: 11, mdf: -1 },
    runic_blade:          { slot: 'weapon', type: 'blade',        atk: 13, mdf:  2 },
    runic_axe:            { slot: 'weapon', type: 'heavy_weapon', atk: 15, def: -2 },
    runic_greatsword:     { slot: 'weapon', type: 'heavy_weapon', atk: 17, def: -3, spd: -1 },
    runic_hammer:         { slot: 'weapon', type: 'heavy_weapon', atk: 16, spd: -2 },
    runite_hammer:        { slot: 'weapon', type: 'heavy_weapon', atk: 18, spd: -2, def: -2 },
    crystalline_hammer:   { slot: 'weapon', type: 'heavy_weapon', atk: 15, mat:  5, spd: -1 },
    void_blade:           { slot: 'weapon', type: 'blade',        atk: 14, mat:  4 },
    void_dagger:          { slot: 'weapon', type: 'blade',        atk:  9, eva:  5, spd:  1 },
    parrying_dagger:      { slot: 'weapon', type: 'blade',        atk:  6, def:  4, eva:  4 },
    barbed_blade:         { slot: 'weapon', type: 'blade',        atk: 11, eva:  3 },
    sweeping_glaive:      { slot: 'weapon', type: 'blade',        atk: 13, move:  1 },
    enchanted_glaive:     { slot: 'weapon', type: 'blade',        atk: 12, mat:  4, move:  1 },
    poison_tipped_spear:  { slot: 'weapon', type: 'heavy_weapon', atk: 10, move:  1, eva:  2 },
    world_piercer:        { slot: 'weapon', type: 'blade',        atk: 16, mat:  6 },
    short_bow:            { slot: 'weapon', type: 'bow',          atk:  7, move:  1 },
    hunting_bow:          { slot: 'weapon', type: 'bow',          atk: 10, move:  1 },
    void_longbow:         { slot: 'weapon', type: 'bow',          atk: 14, spd:  1, move:  1 },
    iron_crossbow:        { slot: 'weapon', type: 'crossbow',     atk: 11 },
    runic_crossbow:       { slot: 'weapon', type: 'crossbow',     atk: 14, mat:  3 },
    runic_wand:           { slot: 'weapon', type: 'magic',        mat: 10, maxMp: 8 },
    frostfang_wand:       { slot: 'weapon', type: 'magic',        mat: 12, maxMp: 10 },
    crystal_staff:        { slot: 'weapon', type: 'magic',        mat: 13, mdf:  3, maxMp: 12 },
    void_staff:           { slot: 'weapon', type: 'magic',        mat: 15, mdf:  4, maxMp: 16 },
    ashen_staff:          { slot: 'weapon', type: 'magic',        mat: 14, atk:  4, maxMp: 10 },
    heartwood_staff:      { slot: 'weapon', type: 'magic',        mat: 12, mdf:  5, maxMp: 14 },
    staff_of_regrowth:    { slot: 'weapon', type: 'magic',        mat: 11, mdf:  6, maxMp: 16 },
    staff_of_distortion:  { slot: 'weapon', type: 'magic',        mat: 14, spd:  1, maxMp: 12 },
    soulbond_scepter:     { slot: 'weapon', type: 'magic',        mat: 13, mdf:  5, maxHp: 10, maxMp: 10 },
    drum_of_rallying:     { slot: 'weapon', type: 'magic',        mat:  6, mdf:  4, maxMp: 8, move:  1 },

    // ============================================================
    // TOOLS / OFF-HAND
    // ============================================================
    lantern:              { slot: 'tool',   type: 'implement',      eva:  2 },
    iron_shield:          { slot: 'tool',   type: 'shield',         def:  7, eva:  3 },
    crystal_aegis:        { slot: 'tool',   type: 'shield',         def:  6, mdf:  7 },
    runic_buckler:        { slot: 'tool',   type: 'shield',         def:  5, eva:  5 },
    hunters_quiver:       { slot: 'tool',   type: 'quiver',         atk:  3 },
    bottomless_quiver:    { slot: 'tool',   type: 'quiver',         atk:  5, move:  1 },
    void_hammer:          { slot: 'tool',   type: 'offhand_weapon', atk:  8, spd: -1 },
    void_axe:             { slot: 'tool',   type: 'offhand_weapon', atk:  7, def: -1 },
    void_sickle:          { slot: 'tool',   type: 'offhand_weapon', atk:  5, eva:  3 },
    iron_pickaxe:         { slot: 'tool',   type: 'offhand_weapon', atk:  6 },
    runic_pickaxe:        { slot: 'tool',   type: 'offhand_weapon', atk:  9, mat:  2 },
    void_pickaxe:         { slot: 'tool',   type: 'offhand_weapon', atk: 10, mat:  3 },
    stone_axe:            { slot: 'tool',   type: 'offhand_weapon', atk:  4 },
    stone_hammer:         { slot: 'tool',   type: 'offhand_weapon', atk:  4, spd: -1 },
    stone_mattock:        { slot: 'tool',   type: 'offhand_weapon', atk:  3 },
    stone_sickle:         { slot: 'tool',   type: 'offhand_weapon', atk:  3, eva:  1 },
    iron_sickle:          { slot: 'tool',   type: 'offhand_weapon', atk:  5, eva:  2 },
    runic_sickle:         { slot: 'tool',   type: 'offhand_weapon', atk:  7, eva:  4 },
    iron_mattock:         { slot: 'tool',   type: 'offhand_weapon', atk:  5 },
    runic_mattock:        { slot: 'tool',   type: 'offhand_weapon', atk:  8 },
    void_mattock:         { slot: 'tool',   type: 'offhand_weapon', atk:  9, mat:  2 },
};

// Stat fields that equipment can modify.
export const EQUIP_STAT_KEYS = ['atk','def','mat','mdf','spd','move','eva','maxHp','maxMp'];

// Returns the combined stat bonuses from all equipped items on a member's appearance.
export function equipmentStatBonuses(appearance) {
    const bonuses = {};
    if (!appearance) return bonuses;
    for (const field of ['armorKey','helmetKey','weaponKey','toolKey']) {
        const key = appearance[field];
        if (!key) continue;
        const item = EQUIPMENT[key];
        if (!item) continue;
        for (const stat of EQUIP_STAT_KEYS) {
            if (item[stat]) bonuses[stat] = (bonuses[stat] || 0) + item[stat];
        }
    }
    return bonuses;
}
