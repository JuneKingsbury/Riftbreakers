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
    wool_parka:           { slot: 'armor',  def:  2, mdf:  1 },
    wool_tunic:           { slot: 'armor',  def:  1, mdf:  1 },
    cotton_shirt:         { slot: 'armor',  def:  1 },
    leather_vest:         { slot: 'armor',  def:  4, eva:  2 },
    leather_jacket:       { slot: 'armor',  def:  3, eva:  1 },
    leather_jerkin:       { slot: 'armor',  def:  5, eva:  3 },
    iron_brigandine:      { slot: 'armor',  def:  7, maxHp: 8 },
    iron_chainmail:       { slot: 'armor',  def:  9, maxHp: 12, spd: -1 },
    enchanted_tunic:      { slot: 'armor',  def:  4, mdf:  5, maxMp: 8 },
    mana_weave_robe:      { slot: 'armor',  def:  2, mdf:  8, mat:  3, maxMp: 14 },
    mana_silk_vestments:  { slot: 'armor',  def:  3, mdf:  9, mat:  4, maxMp: 20 },
    runic_plate:          { slot: 'armor',  def: 14, mdf:  4, maxHp: 20, spd: -1 },
    void_armor:           { slot: 'armor',  def: 12, mdf: 12, maxHp: 16, spd: -1 },
    living_bark_armor:    { slot: 'armor',  def: 10, mdf:  6, maxHp: 18 },
    frostplate:           { slot: 'armor',  def: 11, mdf:  7, maxHp: 14 },
    berserkers_wraps:     { slot: 'armor',  def:  5, atk:  6, eva:  4 },
    duelists_silks:       { slot: 'armor',  def:  4, eva:  8, spd:  1 },
    thornweave_vest:      { slot: 'armor',  def:  6, mdf:  4, eva:  3 },
    ashwalkers_cloak:     { slot: 'armor',  def:  5, mdf:  3, eva:  5, spd:  1 },
    cloak_of_shadows:     { slot: 'armor',  def:  4, eva: 10, spd:  2 },
    aegis_of_the_vanguard:{ slot: 'armor',  def: 13, maxHp: 24, spd: -2 },
    armor_of_the_abyss:   { slot: 'armor',  def: 11, mdf: 11, mat:  5, maxHp: 12 },

    // ============================================================
    // HELMETS
    // ============================================================
    wool_cap:             { slot: 'helmet', def:  1 },
    leather_cap:          { slot: 'helmet', def:  2, eva:  1 },
    iron_helmet:          { slot: 'helmet', def:  5, maxHp: 6 },
    runic_helm:           { slot: 'helmet', def:  7, mdf:  3, maxHp: 8 },
    runic_hood:           { slot: 'helmet', def:  2, mdf:  6, maxMp: 10 },
    mages_circlet:        { slot: 'helmet', mat:  4, mdf:  4, maxMp: 12 },
    void_crown:           { slot: 'helmet', mat:  7, mdf:  5, maxMp: 16 },
    mycelium_crown:       { slot: 'helmet', mat:  5, mdf:  6, maxMp: 10, maxHp: 6 },
    void_hunters_cowl:    { slot: 'helmet', def:  3, eva:  6, spd:  1 },
    sharpshooters_visor:  { slot: 'helmet', atk:  3, eva:  4 },
    scholars_spectacles:  { slot: 'helmet', mat:  3, maxMp: 8 },

    // ============================================================
    // WEAPONS
    // ============================================================
    wooden_club:          { slot: 'weapon', atk:  3 },
    wooden_wand:          { slot: 'weapon', mat:  3, maxMp: 4 },
    stone_spear:          { slot: 'weapon', atk:  5, move:  1 },
    iron_sword:           { slot: 'weapon', atk:  8 },
    iron_axe:             { slot: 'weapon', atk: 10, def: -1 },
    iron_hammer:          { slot: 'weapon', atk: 11, spd: -1 },
    etched_axe:           { slot: 'weapon', atk: 12, def: -1 },
    etched_mace:          { slot: 'weapon', atk: 11, mdf: -1 },
    runic_blade:          { slot: 'weapon', atk: 13, mdf:  2 },
    runic_axe:            { slot: 'weapon', atk: 15, def: -2 },
    runic_greatsword:     { slot: 'weapon', atk: 17, def: -3, spd: -1 },
    runic_hammer:         { slot: 'weapon', atk: 16, spd: -2 },
    runite_hammer:        { slot: 'weapon', atk: 18, spd: -2, def: -2 },
    crystalline_hammer:   { slot: 'weapon', atk: 15, mat:  5, spd: -1 },
    void_blade:           { slot: 'weapon', atk: 14, mat:  4 },
    void_dagger:          { slot: 'weapon', atk:  9, eva:  5, spd:  1 },
    parrying_dagger:      { slot: 'weapon', atk:  6, def:  4, eva:  4 },
    barbed_blade:         { slot: 'weapon', atk: 11, eva:  3 },
    sweeping_glaive:      { slot: 'weapon', atk: 13, move:  1 },
    enchanted_glaive:     { slot: 'weapon', atk: 12, mat:  4, move:  1 },
    poison_tipped_spear:  { slot: 'weapon', atk: 10, move:  1, eva:  2 },
    world_piercer:        { slot: 'weapon', atk: 16, mat:  6 },
    short_bow:            { slot: 'weapon', atk:  7, move:  1 },
    hunting_bow:          { slot: 'weapon', atk: 10, move:  1 },
    void_longbow:         { slot: 'weapon', atk: 14, spd:  1, move:  1 },
    iron_crossbow:        { slot: 'weapon', atk: 11 },
    runic_crossbow:       { slot: 'weapon', atk: 14, mat:  3 },
    runic_wand:           { slot: 'weapon', mat: 10, maxMp: 8 },
    frostfang_wand:       { slot: 'weapon', mat: 12, maxMp: 10 },
    crystal_staff:        { slot: 'weapon', mat: 13, mdf:  3, maxMp: 12 },
    void_staff:           { slot: 'weapon', mat: 15, mdf:  4, maxMp: 16 },
    ashen_staff:          { slot: 'weapon', mat: 14, atk:  4, maxMp: 10 },
    heartwood_staff:      { slot: 'weapon', mat: 12, mdf:  5, maxMp: 14 },
    staff_of_regrowth:    { slot: 'weapon', mat: 11, mdf:  6, maxMp: 16 },
    staff_of_distortion:  { slot: 'weapon', mat: 14, spd:  1, maxMp: 12 },
    soulbond_scepter:     { slot: 'weapon', mat: 13, mdf:  5, maxHp: 10, maxMp: 10 },
    drum_of_rallying:     { slot: 'weapon', mat:  6, mdf:  4, maxMp: 8, move:  1 },

    // ============================================================
    // TOOLS / OFF-HAND
    // ============================================================
    lantern:              { slot: 'tool',   eva:  2 },
    iron_shield:          { slot: 'tool',   def:  7, eva:  3 },
    crystal_aegis:        { slot: 'tool',   def:  6, mdf:  7 },
    runic_buckler:        { slot: 'tool',   def:  5, eva:  5 },
    hunters_quiver:       { slot: 'tool',   atk:  3 },
    bottomless_quiver:    { slot: 'tool',   atk:  5, move:  1 },
    void_hammer:          { slot: 'tool',   atk:  8, spd: -1 },
    void_axe:             { slot: 'tool',   atk:  7, def: -1 },
    void_sickle:          { slot: 'tool',   atk:  5, eva:  3 },
    iron_pickaxe:         { slot: 'tool',   atk:  6 },
    runic_pickaxe:        { slot: 'tool',   atk:  9, mat:  2 },
    void_pickaxe:         { slot: 'tool',   atk: 10, mat:  3 },
    stone_axe:            { slot: 'tool',   atk:  4 },
    stone_hammer:         { slot: 'tool',   atk:  4, spd: -1 },
    stone_mattock:        { slot: 'tool',   atk:  3 },
    stone_sickle:         { slot: 'tool',   atk:  3, eva:  1 },
    iron_sickle:          { slot: 'tool',   atk:  5, eva:  2 },
    runic_sickle:         { slot: 'tool',   atk:  7, eva:  4 },
    iron_mattock:         { slot: 'tool',   atk:  5 },
    runic_mattock:        { slot: 'tool',   atk:  8 },
    void_mattock:         { slot: 'tool',   atk:  9, mat:  2 },
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
