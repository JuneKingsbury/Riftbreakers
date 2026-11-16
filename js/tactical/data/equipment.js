// Equipment item definitions.
// Each entry maps to an equipment_worn sprite key and describes the slot it
// occupies plus any stat bonuses granted when equipped.
//
// Stat fields (all optional, default 0 if absent):
//   atk, def, mat, mdf, spd, move, eva, maxHp, maxMp
//
// slot: 'armor' | 'helmet' | 'weapon' | 'tool'
// type          Equipment class; jobs restrict which types they can wear (allowedEquipment)
// rarity        'common' (default) | 'uncommon' | 'rare': which loot and shop pools offer it
// grants        string[] Action abilities the wearer can use while it is equipped
// grantsPassive string[] Reaction/support/movement abilities that become selectable in
//               the matching loadout slot while it is equipped

export const EQUIPMENT = {
    // ============================================================
    // ARMOR
    // ============================================================
    wool_parka:           { slot: 'armor',  type: 'cloth',  def:  2, mdf:  1 },
    wool_tunic:           { slot: 'armor',  type: 'cloth',  def:  1, mdf:  1 },
    cotton_shirt:         { slot: 'armor',  type: 'cloth',  def:  1 },
    leather_vest:         { slot: 'armor',  type: 'light',  def:  4, eva:  2 },
    leather_jacket:       { slot: 'armor',  type: 'light',  def:  3, eva:  1 },
    leather_jerkin:       { slot: 'armor',  type: 'light',  def:  5, eva:  3, rarity: 'uncommon' },
    iron_brigandine:      { slot: 'armor',  type: 'medium', def:  7, maxHp: 8 },
    iron_chainmail:       { slot: 'armor',  type: 'medium', def:  9, maxHp: 12, spd: -1, rarity: 'uncommon' },
    enchanted_tunic:      { slot: 'armor',  type: 'cloth',  def:  4, mdf:  5, maxMp: 8, rarity: 'uncommon' },
    mana_weave_robe:      { slot: 'armor',  type: 'cloth',  def:  2, mdf:  8, mat:  3, maxMp: 14, rarity: 'uncommon' },
    mana_silk_vestments:  { slot: 'armor',  type: 'cloth',  def:  3, mdf:  9, mat:  4, maxMp: 20, rarity: 'rare' },
    runic_plate:          { slot: 'armor',  type: 'heavy',  def: 14, mdf:  4, maxHp: 20, spd: -1, rarity: 'rare' },
    void_armor:           { slot: 'armor',  type: 'heavy',  def: 12, mdf: 12, maxHp: 16, spd: -1, rarity: 'rare', grantsPassive: ['void_siphon'] },
    living_bark_armor:    { slot: 'armor',  type: 'medium', def: 10, mdf:  6, maxHp: 18, rarity: 'uncommon', grantsPassive: ['take_root'] },
    frostplate:           { slot: 'armor',  type: 'heavy',  def: 11, mdf:  7, maxHp: 14, rarity: 'uncommon' },
    berserkers_wraps:     { slot: 'armor',  type: 'light',  def:  5, atk:  6, eva:  4, rarity: 'uncommon' },
    duelists_silks:       { slot: 'armor',  type: 'light',  def:  4, eva:  8, spd:  1, rarity: 'uncommon', grantsPassive: ['farsight'] },
    thornweave_vest:      { slot: 'armor',  type: 'light',  def:  6, mdf:  4, eva:  3, rarity: 'uncommon' },
    ashwalkers_cloak:     { slot: 'armor',  type: 'light',  def:  5, mdf:  3, eva:  5, spd:  1, rarity: 'uncommon', grantsPassive: ['pilgrim_step'] },
    cloak_of_shadows:     { slot: 'armor',  type: 'light',  def:  4, eva: 10, spd:  2, rarity: 'rare', grantsPassive: ['ghost_step'] },
    aegis_of_the_vanguard:{ slot: 'armor',  type: 'heavy',  def: 13, maxHp: 24, spd: -2 },
    armor_of_the_abyss:   { slot: 'armor',  type: 'heavy',  def: 11, mdf: 11, mat:  5, maxHp: 12, rarity: 'rare' },

    // ============================================================
    // HELMETS
    // ============================================================
    wool_cap:             { slot: 'helmet', type: 'cloth',  def:  1 },
    leather_cap:          { slot: 'helmet', type: 'light',  def:  2, eva:  1 },
    iron_helmet:          { slot: 'helmet', type: 'medium', def:  5, maxHp: 6 },
    runic_helm:           { slot: 'helmet', type: 'heavy',  def:  7, mdf:  3, maxHp: 8, rarity: 'uncommon' },
    runic_hood:           { slot: 'helmet', type: 'cloth',  def:  2, mdf:  6, maxMp: 10, rarity: 'uncommon' },
    mages_circlet:        { slot: 'helmet', type: 'cloth',  mat:  4, mdf:  4, maxMp: 12, rarity: 'uncommon' },
    void_crown:           { slot: 'helmet', type: 'cloth',  mat:  7, mdf:  5, maxMp: 16, rarity: 'rare', grantsPassive: ['blink'] },
    mycelium_crown:       { slot: 'helmet', type: 'cloth',  mat:  5, mdf:  6, maxMp: 10, maxHp: 6, rarity: 'rare', grants: ['hexform'] },
    void_hunters_cowl:    { slot: 'helmet', type: 'light',  def:  3, eva:  6, spd:  1, rarity: 'uncommon' },
    sharpshooters_visor:  { slot: 'helmet', type: 'light',  atk:  3, eva:  4, rarity: 'uncommon' },
    scholars_spectacles:  { slot: 'helmet', type: 'cloth',  mat:  3, maxMp: 8, rarity: 'uncommon', grantsPassive: ['jp_boost'] },

    // ============================================================
    // WEAPONS
    // ============================================================
    wooden_club:          { slot: 'weapon', type: 'heavy_weapon', atk:  3 },
    wooden_wand:          { slot: 'weapon', type: 'magic',        mat:  3, maxMp: 4 },
    stone_spear:          { slot: 'weapon', type: 'heavy_weapon', atk:  5, move:  1, grants: ['rush'] },
    iron_sword:           { slot: 'weapon', type: 'blade',        atk:  8 },
    iron_axe:             { slot: 'weapon', type: 'heavy_weapon', atk: 10, def: -1 },
    iron_hammer:          { slot: 'weapon', type: 'heavy_weapon', atk: 11, spd: -1 },
    etched_axe:           { slot: 'weapon', type: 'heavy_weapon', atk: 12, def: -1, rarity: 'uncommon' },
    etched_mace:          { slot: 'weapon', type: 'heavy_weapon', atk: 11, mdf: -1, rarity: 'uncommon' },
    runic_blade:          { slot: 'weapon', type: 'blade',        atk: 13, mdf:  2, rarity: 'uncommon' },
    runic_axe:            { slot: 'weapon', type: 'heavy_weapon', atk: 15, def: -2, rarity: 'uncommon' },
    runic_greatsword:     { slot: 'weapon', type: 'heavy_weapon', atk: 17, def: -3, spd: -1, rarity: 'rare', grants: ['spellbreaker'] },
    runic_hammer:         { slot: 'weapon', type: 'heavy_weapon', atk: 16, spd: -2, rarity: 'uncommon' },
    runite_hammer:        { slot: 'weapon', type: 'heavy_weapon', atk: 18, spd: -2, def: -2, rarity: 'rare' },
    crystalline_hammer:   { slot: 'weapon', type: 'heavy_weapon', atk: 15, mat:  5, spd: -1, rarity: 'uncommon' },
    void_blade:           { slot: 'weapon', type: 'blade',        atk: 14, mat:  4, rarity: 'rare' },
    void_dagger:          { slot: 'weapon', type: 'blade',        atk:  9, eva:  5, spd:  1, rarity: 'uncommon', grants: ['draining_edge'] },
    parrying_dagger:      { slot: 'weapon', type: 'blade',        atk:  6, def:  4, eva:  4, rarity: 'uncommon', grantsPassive: ['brace'] },
    barbed_blade:         { slot: 'weapon', type: 'blade',        atk: 11, eva:  3, rarity: 'uncommon' },
    sweeping_glaive:      { slot: 'weapon', type: 'blade',        atk: 13, move:  1, rarity: 'uncommon' },
    enchanted_glaive:     { slot: 'weapon', type: 'blade',        atk: 12, mat:  4, move:  1, rarity: 'uncommon', grantsPassive: ['quake_step'] },
    poison_tipped_spear:  { slot: 'weapon', type: 'heavy_weapon', atk: 10, move:  1, eva:  2, rarity: 'uncommon', grants: ['venom_strike'] },
    world_piercer:        { slot: 'weapon', type: 'blade',        atk: 16, mat:  6, rarity: 'rare' },
    short_bow:            { slot: 'weapon', type: 'bow',          atk:  7, move:  1 },
    hunting_bow:          { slot: 'weapon', type: 'bow',          atk: 10, move:  1, rarity: 'uncommon' },
    void_longbow:         { slot: 'weapon', type: 'bow',          atk: 14, spd:  1, move:  1, rarity: 'rare', grantsPassive: ['move_plus_2'] },
    iron_crossbow:        { slot: 'weapon', type: 'crossbow',     atk: 11 },
    runic_crossbow:       { slot: 'weapon', type: 'crossbow',     atk: 14, mat:  3, rarity: 'rare' },
    runic_wand:           { slot: 'weapon', type: 'magic',        mat: 10, maxMp: 8, rarity: 'uncommon', grants: ['mirror_ward'] },
    frostfang_wand:       { slot: 'weapon', type: 'magic',        mat: 12, maxMp: 10, rarity: 'uncommon' },
    crystal_staff:        { slot: 'weapon', type: 'magic',        mat: 13, mdf:  3, maxMp: 12, rarity: 'uncommon' },
    void_staff:           { slot: 'weapon', type: 'magic',        mat: 15, mdf:  4, maxMp: 16, rarity: 'rare' },
    ashen_staff:          { slot: 'weapon', type: 'magic',        mat: 14, atk:  4, maxMp: 10, rarity: 'uncommon' },
    heartwood_staff:      { slot: 'weapon', type: 'magic',        mat: 12, mdf:  5, maxMp: 14, rarity: 'uncommon', grants: ['spore_cloud'] },
    staff_of_regrowth:    { slot: 'weapon', type: 'magic',        mat: 11, mdf:  6, maxMp: 16, rarity: 'uncommon', grants: ['purify'] },
    staff_of_distortion:  { slot: 'weapon', type: 'magic',        mat: 14, spd:  1, maxMp: 12, rarity: 'rare', grants: ['unravel'] },
    soulbond_scepter:     { slot: 'weapon', type: 'magic',        mat: 13, mdf:  5, maxHp: 10, maxMp: 10, rarity: 'rare', grants: ['bind_will'] },
    drum_of_rallying:     { slot: 'weapon', type: 'magic',        mat:  6, mdf:  4, maxMp: 8, move:  1, rarity: 'uncommon', grants: ['focus'] },

    // ============================================================
    // TOOLS / OFF-HAND
    // ============================================================
    lantern:              { slot: 'tool',   type: 'implement',      eva:  2, grants: ['first_aid'] },
    iron_shield:          { slot: 'tool',   type: 'shield',         def:  7, eva:  3, grantsPassive: ['martyr'] },
    crystal_aegis:        { slot: 'tool',   type: 'shield',         def:  6, mdf:  7, rarity: 'rare', grants: ['aegis_ward'] },
    runic_buckler:        { slot: 'tool',   type: 'shield',         def:  5, eva:  5, rarity: 'uncommon' },
    hunters_quiver:       { slot: 'tool',   type: 'quiver',         atk:  3 },
    bottomless_quiver:    { slot: 'tool',   type: 'quiver',         atk:  5, move:  1, rarity: 'uncommon', grantsPassive: ['move_plus_1'] },
    void_hammer:          { slot: 'tool',   type: 'offhand_weapon', atk:  8, spd: -1, rarity: 'uncommon' },
    void_axe:             { slot: 'tool',   type: 'offhand_weapon', atk:  7, def: -1, rarity: 'uncommon' },
    void_sickle:          { slot: 'tool',   type: 'offhand_weapon', atk:  5, eva:  3, rarity: 'uncommon' },
    iron_pickaxe:         { slot: 'tool',   type: 'offhand_weapon', atk:  6 },
    runic_pickaxe:        { slot: 'tool',   type: 'offhand_weapon', atk:  9, mat:  2, rarity: 'uncommon' },
    void_pickaxe:         { slot: 'tool',   type: 'offhand_weapon', atk: 10, mat:  3, rarity: 'rare' },
    stone_axe:            { slot: 'tool',   type: 'offhand_weapon', atk:  4 },
    stone_hammer:         { slot: 'tool',   type: 'offhand_weapon', atk:  4, spd: -1 },
    stone_mattock:        { slot: 'tool',   type: 'offhand_weapon', atk:  3 },
    stone_sickle:         { slot: 'tool',   type: 'offhand_weapon', atk:  3, eva:  1 },
    iron_sickle:          { slot: 'tool',   type: 'offhand_weapon', atk:  5, eva:  2 },
    runic_sickle:         { slot: 'tool',   type: 'offhand_weapon', atk:  7, eva:  4, rarity: 'uncommon' },
    iron_mattock:         { slot: 'tool',   type: 'offhand_weapon', atk:  5 },
    runic_mattock:        { slot: 'tool',   type: 'offhand_weapon', atk:  8, rarity: 'uncommon' },
    void_mattock:         { slot: 'tool',   type: 'offhand_weapon', atk:  9, mat:  2, rarity: 'rare' },
};

// Stat fields that equipment can modify.
export const EQUIP_STAT_KEYS = ['atk','def','mat','mdf','spd','move','eva','maxHp','maxMp'];

// Returns the combined stat bonuses from all equipped items on a member's appearance.
export function equipmentStatBonuses(appearance) {
    const bonuses = {};
    if (!appearance) return bonuses;
    for (const key of equippedItems(appearance)) {
        const item = EQUIPMENT[key];
        for (const stat of EQUIP_STAT_KEYS) {
            if (item[stat]) bonuses[stat] = (bonuses[stat] || 0) + item[stat];
        }
    }
    return bonuses;
}

export const EQUIP_FIELDS = ['armorKey', 'helmetKey', 'weaponKey', 'toolKey'];

// Keys of the items equipped on an appearance, in slot order.
export function equippedItems(appearance) {
    if (!appearance) return [];
    return EQUIP_FIELDS.map(f => appearance[f]).filter(k => k && EQUIPMENT[k]);
}

// Abilities granted by everything equipped: { actions: [...], passives: [...] }.
export function equipmentGrants(appearance) {
    const actions = [], passives = [];
    for (const key of equippedItems(appearance)) {
        for (const a of EQUIPMENT[key].grants || []) if (!actions.includes(a)) actions.push(a);
        for (const a of EQUIPMENT[key].grantsPassive || []) if (!passives.includes(a)) passives.push(a);
    }
    return { actions, passives };
}

export function itemRarity(key) {
    return EQUIPMENT[key]?.rarity ?? 'common';
}

// Shop price: by rarity, plus a premium for items that grant an ability.
export function itemPrice(key) {
    const item = EQUIPMENT[key];
    if (!item) return 0;
    const base = { common: 60, uncommon: 120, rare: 220 }[itemRarity(key)];
    return base + ((item.grants || item.grantsPassive) ? 40 : 0);
}
