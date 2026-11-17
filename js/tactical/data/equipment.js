// Equipment item definitions.
// Each entry maps to an equipment_worn sprite key (and an items icon of the same key)
// and describes the slot it occupies plus any stat bonuses granted when equipped.
//
// Stat fields (all optional, default 0 if absent):
//   atk, def, mat, mdf, spd, move, eva, maxHp, maxMp
//
// name          Display name
// slot: 'armor' | 'helmet' | 'weapon' | 'tool'
// type          Equipment class; jobs restrict which types they can wear (allowedEquipment)
// rarity        'common' (default) | 'uncommon' | 'rare': which loot and shop pools offer it
// grants        string[] Action abilities the wearer can use while it is equipped
// grantsPassive string[] Reaction/support/movement abilities that are active while it is
//               equipped, on top of the wearer's chosen reaction/support/movement

export const EQUIPMENT = {
    // ============================================================
    // ARMOR
    // ============================================================
    wool_parka:           { name: 'Wool Parka',            slot: 'armor',  type: 'cloth',  def:  2, mdf:  1 },
    wool_tunic:           { name: 'Wool Tunic',            slot: 'armor',  type: 'cloth',  def:  1, mdf:  1 },
    cotton_shirt:         { name: 'Cotton Shirt',          slot: 'armor',  type: 'cloth',  def:  1 },
    leather_vest:         { name: 'Leather Vest',          slot: 'armor',  type: 'light',  def:  4, eva:  2 },
    leather_jacket:       { name: 'Leather Jacket',        slot: 'armor',  type: 'light',  def:  3, eva:  1 },
    leather_jerkin:       { name: 'Leather Jerkin',        slot: 'armor',  type: 'light',  def:  5, eva:  3, rarity: 'uncommon' },
    iron_brigandine:      { name: 'Iron Brigandine',       slot: 'armor',  type: 'medium', def:  7, maxHp: 8 },
    iron_chainmail:       { name: 'Iron Chainmail',        slot: 'armor',  type: 'medium', def:  9, maxHp: 12, spd: -1, rarity: 'uncommon' },
    enchanted_tunic:      { name: 'Enchanted Tunic',       slot: 'armor',  type: 'cloth',  def:  4, mdf:  5, maxMp: 8, rarity: 'uncommon' },
    mana_weave_robe:      { name: 'Manaweave Robe',        slot: 'armor',  type: 'cloth',  def:  2, mdf:  8, mat:  3, maxMp: 14, rarity: 'uncommon' },
    mana_silk_vestments:  { name: 'Manasilk Vestments',    slot: 'armor',  type: 'cloth',  def:  3, mdf:  9, mat:  4, maxMp: 20, rarity: 'rare' },
    runic_plate:          { name: 'Runic Plate',           slot: 'armor',  type: 'heavy',  def: 14, mdf:  4, maxHp: 20, spd: -1, rarity: 'rare' },
    void_armor:           { name: 'Void Armor',            slot: 'armor',  type: 'heavy',  def: 12, mdf: 12, maxHp: 16, spd: -1, rarity: 'rare', grantsPassive: ['void_siphon'] },
    living_bark_armor:    { name: 'Living Bark Armor',     slot: 'armor',  type: 'medium', def: 10, mdf:  6, maxHp: 18, rarity: 'uncommon', grantsPassive: ['take_root'] },
    frostplate:           { name: 'Frostplate',            slot: 'armor',  type: 'heavy',  def: 11, mdf:  7, maxHp: 14, rarity: 'uncommon' },
    berserkers_wraps:     { name: "Berserker's Wraps",     slot: 'armor',  type: 'light',  def:  5, atk:  6, eva:  4, rarity: 'uncommon' },
    duelists_silks:       { name: "Duelist's Silks",       slot: 'armor',  type: 'light',  def:  4, eva:  8, spd:  1, rarity: 'uncommon', grantsPassive: ['farsight'] },
    thornweave_vest:      { name: 'Thornweave Vest',       slot: 'armor',  type: 'light',  def:  6, mdf:  4, eva:  3, rarity: 'uncommon' },
    ashwalkers_cloak:     { name: "Ashwalker's Cloak",     slot: 'armor',  type: 'light',  def:  5, mdf:  3, eva:  5, spd:  1, rarity: 'uncommon', grantsPassive: ['pilgrim_step'] },
    cloak_of_shadows:     { name: 'Cloak of Shadows',      slot: 'armor',  type: 'light',  def:  4, eva: 10, spd:  2, rarity: 'rare', grantsPassive: ['ghost_step'] },
    aegis_of_the_vanguard:{ name: 'Aegis of the Vanguard', slot: 'armor',  type: 'heavy',  def: 13, maxHp: 24, spd: -2 },
    armor_of_the_abyss:   { name: 'Armor of the Abyss',    slot: 'armor',  type: 'heavy',  def: 11, mdf: 11, mat:  5, maxHp: 12, rarity: 'rare' },

    cotton_tunic:         { name: 'Cotton Tunic',          slot: 'armor',  type: 'cloth',  def:  2, mdf:  1 },
    leather_cloak:        { name: 'Leather Cloak',         slot: 'armor',  type: 'light',  def:  3, eva:  2 },
    padded_scout_vest:    { name: 'Padded Scout Vest',     slot: 'armor',  type: 'light',  def:  4, eva:  2, maxHp: 4 },
    foreman_apron:        { name: "Foreman's Apron",       slot: 'armor',  type: 'light',  def:  4, maxHp: 6, grants: ['earth_skin'] },
    huntsmans_leathers:   { name: "Huntsman's Leathers",   slot: 'armor',  type: 'light',  def:  5, atk:  2, eva:  3, rarity: 'uncommon', grantsPassive: ['call_of_the_pack'] },
    channelers_wraps:     { name: "Channeler's Wraps",     slot: 'armor',  type: 'cloth',  def:  3, mdf:  6, mat:  3, maxMp: 10, rarity: 'uncommon' },
    shadow_wraps:         { name: 'Shadow Wraps',          slot: 'armor',  type: 'light',  def:  4, eva:  7, spd:  1, rarity: 'uncommon', grantsPassive: ['omen_step'] },
    shadowstrike_vest:    { name: 'Shadowstrike Vest',     slot: 'armor',  type: 'light',  def:  5, atk:  2, eva:  6, rarity: 'uncommon', grantsPassive: ['momentum'] },
    barbed_chaincoat:     { name: 'Barbed Chaincoat',      slot: 'armor',  type: 'medium', def:  8, maxHp: 10, rarity: 'uncommon', grantsPassive: ['thorn_hide'] },
    voidweave_robes:      { name: 'Voidweave Robes',       slot: 'armor',  type: 'cloth',  def:  3, mdf:  9, mat:  5, maxMp: 16, rarity: 'rare' },
    aether_mantle:        { name: 'Aether Mantle',         slot: 'armor',  type: 'cloth',  def:  4, mdf: 10, mat:  5, maxMp: 18, rarity: 'rare', grantsPassive: ['restorative_step'] },
    abyssal_bramble_plate:{ name: 'Abyssal Bramble Plate', slot: 'armor',  type: 'heavy',  def: 13, mdf:  6, maxHp: 18, rarity: 'rare' },
    chaos_wrought_plate:  { name: 'Chaos-Wrought Plate',   slot: 'armor',  type: 'heavy',  def: 12, atk:  4, mat:  4, maxHp: 14, spd: -1, rarity: 'rare' },

    // ============================================================
    // HELMETS
    // ============================================================
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

    // ============================================================
    // WEAPONS
    // ============================================================
    wooden_club:          { name: 'Wooden Club',           slot: 'weapon', type: 'heavy_weapon', atk:  3 },
    wooden_wand:          { name: 'Wooden Wand',           slot: 'weapon', type: 'magic',        mat:  3, maxMp: 4 },
    stone_spear:          { name: 'Stone Spear',           slot: 'weapon', type: 'heavy_weapon', atk:  5, move:  1, grants: ['rush'] },
    iron_sword:           { name: 'Iron Sword',            slot: 'weapon', type: 'blade',        atk:  8 },
    iron_axe:             { name: 'Iron Axe',              slot: 'weapon', type: 'heavy_weapon', atk: 10, def: -1 },
    iron_hammer:          { name: 'Iron Hammer',           slot: 'weapon', type: 'heavy_weapon', atk: 11, spd: -1 },
    etched_axe:           { name: 'Etched Axe',            slot: 'weapon', type: 'heavy_weapon', atk: 12, def: -1, rarity: 'uncommon' },
    etched_mace:          { name: 'Etched Mace',           slot: 'weapon', type: 'heavy_weapon', atk: 11, mdf: -1, rarity: 'uncommon' },
    runic_blade:          { name: 'Runic Blade',           slot: 'weapon', type: 'blade',        atk: 13, mdf:  2, rarity: 'uncommon' },
    runic_axe:            { name: 'Runic Axe',             slot: 'weapon', type: 'heavy_weapon', atk: 15, def: -2, rarity: 'uncommon' },
    runic_greatsword:     { name: 'Runic Greatsword',      slot: 'weapon', type: 'heavy_weapon', atk: 17, def: -3, spd: -1, rarity: 'rare', grants: ['spellbreaker'] },
    runic_hammer:         { name: 'Runic Hammer',          slot: 'weapon', type: 'heavy_weapon', atk: 16, spd: -2, rarity: 'uncommon' },
    runite_hammer:        { name: 'Runite Hammer',         slot: 'weapon', type: 'heavy_weapon', atk: 18, spd: -2, def: -2, rarity: 'rare' },
    crystalline_hammer:   { name: 'Crystalline Hammer',    slot: 'weapon', type: 'heavy_weapon', atk: 15, mat:  5, spd: -1, rarity: 'uncommon' },
    void_blade:           { name: 'Void Blade',            slot: 'weapon', type: 'blade',        atk: 14, mat:  4, rarity: 'rare' },
    void_dagger:          { name: 'Void Dagger',           slot: 'weapon', type: 'blade',        atk:  9, eva:  5, spd:  1, rarity: 'uncommon', grants: ['draining_edge'] },
    parrying_dagger:      { name: 'Parrying Dagger',       slot: 'weapon', type: 'blade',        atk:  6, def:  4, eva:  4, rarity: 'uncommon', grantsPassive: ['brace'] },
    barbed_blade:         { name: 'Barbed Blade',          slot: 'weapon', type: 'blade',        atk: 11, eva:  3, rarity: 'uncommon' },
    sweeping_glaive:      { name: 'Sweeping Glaive',       slot: 'weapon', type: 'blade',        atk: 13, move:  1, rarity: 'uncommon' },
    enchanted_glaive:     { name: 'Enchanted Glaive',      slot: 'weapon', type: 'blade',        atk: 12, mat:  4, move:  1, rarity: 'uncommon', grantsPassive: ['quake_step'] },
    poison_tipped_spear:  { name: 'Poison-Tipped Spear',   slot: 'weapon', type: 'heavy_weapon', atk: 10, move:  1, eva:  2, rarity: 'uncommon', grants: ['venom_strike'] },
    world_piercer:        { name: 'World Piercer',         slot: 'weapon', type: 'blade',        atk: 16, mat:  6, rarity: 'rare' },
    short_bow:            { name: 'Short Bow',             slot: 'weapon', type: 'bow',          atk:  7, move:  1 },
    hunting_bow:          { name: 'Hunting Bow',           slot: 'weapon', type: 'bow',          atk: 10, move:  1, rarity: 'uncommon' },
    void_longbow:         { name: 'Void Longbow',          slot: 'weapon', type: 'bow',          atk: 14, spd:  1, move:  1, rarity: 'rare', grantsPassive: ['move_plus_2'] },
    iron_crossbow:        { name: 'Iron Crossbow',         slot: 'weapon', type: 'crossbow',     atk: 11 },
    runic_crossbow:       { name: 'Runic Crossbow',        slot: 'weapon', type: 'crossbow',     atk: 14, mat:  3, rarity: 'rare' },
    runic_wand:           { name: 'Runic Wand',            slot: 'weapon', type: 'magic',        mat: 10, maxMp: 8, rarity: 'uncommon', grants: ['mirror_ward'] },
    frostfang_wand:       { name: 'Frostfang Wand',        slot: 'weapon', type: 'magic',        mat: 12, maxMp: 10, rarity: 'uncommon' },
    crystal_staff:        { name: 'Crystal Staff',         slot: 'weapon', type: 'magic',        mat: 13, mdf:  3, maxMp: 12, rarity: 'uncommon' },
    void_staff:           { name: 'Void Staff',            slot: 'weapon', type: 'magic',        mat: 15, mdf:  4, maxMp: 16, rarity: 'rare' },
    ashen_staff:          { name: 'Ashen Staff',           slot: 'weapon', type: 'magic',        mat: 14, atk:  4, maxMp: 10, rarity: 'uncommon' },
    heartwood_staff:      { name: 'Heartwood Staff',       slot: 'weapon', type: 'magic',        mat: 12, mdf:  5, maxMp: 14, rarity: 'uncommon', grants: ['spore_cloud'] },
    staff_of_regrowth:    { name: 'Staff of Regrowth',     slot: 'weapon', type: 'magic',        mat: 11, mdf:  6, maxMp: 16, rarity: 'uncommon', grants: ['purify'] },
    staff_of_distortion:  { name: 'Staff of Distortion',   slot: 'weapon', type: 'magic',        mat: 14, spd:  1, maxMp: 12, rarity: 'rare', grants: ['unravel'] },
    soulbond_scepter:     { name: 'Soulbond Scepter',      slot: 'weapon', type: 'magic',        mat: 13, mdf:  5, maxHp: 10, maxMp: 10, rarity: 'rare', grants: ['bind_will'] },
    drum_of_rallying:     { name: 'Drum of Rallying',      slot: 'weapon', type: 'magic',        mat:  6, mdf:  4, maxMp: 8, move:  1, rarity: 'uncommon', grants: ['focus'] },

    tempered_blade:       { name: 'Tempered Blade',        slot: 'weapon', type: 'blade',        atk:  9 },
    war_axe:              { name: 'War Axe',               slot: 'weapon', type: 'heavy_weapon', atk: 12, def: -1, rarity: 'uncommon' },
    abyssal_dagger:       { name: 'Abyssal Dagger',        slot: 'weapon', type: 'blade',        atk: 10, eva:  5, spd:  1, rarity: 'uncommon' },
    fracture_edge:        { name: 'Fracture Edge',         slot: 'weapon', type: 'blade',        atk: 12, mat:  2, rarity: 'uncommon', grants: ['fire'] },
    void_wand:            { name: 'Void Wand',             slot: 'weapon', type: 'magic',        mat:  9, maxMp: 8, rarity: 'uncommon' },
    abyssal_blade:        { name: 'Abyssal Blade',         slot: 'weapon', type: 'blade',        atk: 15, mat:  3, rarity: 'rare' },
    sovereign_blade:      { name: 'Sovereign Blade',       slot: 'weapon', type: 'blade',        atk: 16, def:  2, mdf:  2, rarity: 'rare' },
    void_edge:            { name: 'Void Edge',             slot: 'weapon', type: 'blade',        atk: 14, eva:  4, spd:  1, rarity: 'rare' },
    void_glaive:          { name: 'Void Glaive',           slot: 'weapon', type: 'blade',        atk: 13, mat:  4, move: 1, rarity: 'rare' },
    abyssal_greatsword:   { name: 'Abyssal Greatsword',    slot: 'weapon', type: 'heavy_weapon', atk: 19, def: -3, spd: -1, rarity: 'rare' },
    abyssal_piercer:      { name: 'Abyssal Piercer',       slot: 'weapon', type: 'heavy_weapon', atk: 14, eva:  2, move: 1, rarity: 'rare' },
    abyssal_longbow:      { name: 'Abyssal Longbow',       slot: 'weapon', type: 'bow',          atk: 15, move: 1, rarity: 'rare' },
    void_recurve:         { name: 'Void Recurve',          slot: 'weapon', type: 'bow',          atk: 13, eva:  3, spd:  1, rarity: 'rare', grantsPassive: ['concentrate'] },
    abyssal_staff:        { name: 'Abyssal Staff',         slot: 'weapon', type: 'magic',        mat: 16, mdf:  4, maxMp: 14, rarity: 'rare', grants: ['gravity_well'] },

    // ============================================================
    // TOOLS / OFF-HAND
    // ============================================================
    lantern:              { name: 'Lantern',               slot: 'tool',   type: 'implement',      eva:  2, grants: ['first_aid'] },
    iron_shield:          { name: 'Iron Shield',           slot: 'tool',   type: 'shield',         def:  7, eva:  3, grantsPassive: ['martyr'] },
    crystal_aegis:        { name: 'Crystal Aegis',         slot: 'tool',   type: 'shield',         def:  6, mdf:  7, rarity: 'rare', grants: ['aegis_ward'] },
    runic_buckler:        { name: 'Runic Buckler',         slot: 'tool',   type: 'shield',         def:  5, eva:  5, rarity: 'uncommon' },
    hunters_quiver:       { name: "Hunter's Quiver",       slot: 'tool',   type: 'quiver',         atk:  3 },
    bottomless_quiver:    { name: 'Bottomless Quiver',     slot: 'tool',   type: 'quiver',         atk:  5, move:  1, rarity: 'uncommon', grantsPassive: ['move_plus_1'] },
    void_hammer:          { name: 'Void Hammer',           slot: 'tool',   type: 'offhand_weapon', atk:  8, spd: -1, rarity: 'uncommon' },
    void_axe:             { name: 'Void Axe',              slot: 'tool',   type: 'offhand_weapon', atk:  7, def: -1, rarity: 'uncommon' },
    void_sickle:          { name: 'Void Sickle',           slot: 'tool',   type: 'offhand_weapon', atk:  5, eva:  3, rarity: 'uncommon' },
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

// Display name for an item key, e.g. 'scholars_spectacles' → "Scholar's Spectacles".
export function itemName(key) {
    return EQUIPMENT[key]?.name ?? String(key).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
