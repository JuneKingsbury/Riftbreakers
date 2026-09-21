// Job (class) definitions. The registry in data-registry.js exports the final
// JOB_STATS table for combat use. Jobs do NOT use `extends` — all stats must be
// listed explicitly. (Inheritance is intentionally avoided here because
// data-registry.unlockedAbilities reads JOB_DATA raw to preserve abilityLevels;
// inheriting abilityLevels via extends would silently lose them.)
//
// Fields:
//   maxHp, maxMp  number  Base HP/MP
//   spd           number  Speed (determines CT gain per tick)
//   atk, def      number  Physical attack / defense
//   mat, mdf      number  Magic attack / defense
//   move          number  Movement range in tiles
//   eva           number  Evasion (0-100, treated as % with direction modifier)
//   abilities     string[]  Ability keys this job can use (all levels combined)
//   abilityLevels object  Maps ability key → job level required to unlock it.
//                         Any key in `abilities` absent here defaults to level 1 (unlocked immediately).
//                         Every ability key in `abilities` should have an entry here to make
//                         unlock timing explicit.
//   spriteKey     string  Key into the skin sprite sheet
//   char          string  Fallback ASCII character
//   color         string   Fallback CSS color
//   desc          string   Player-facing class description shown in selection UI
//   schools       string[] Magic schools this job draws from (flavour + future filtering)
//   prerequisites Array<{ job: string, level: number }> Jobs + levels required to unlock.
//                 Empty array or absent = always available (Tier 0/root).
//
// Job tree tiers:
//   Tier 0  Novice          -- no prerequisites; the universal starting job
//   Tier 1  School basics   -- each requires novice Lv.2
//   Tier 2  Combo jobs      -- each requires its two school basics at Lv.3

export const JOB_DATA = {
    // ============================================================
    // ---- Tier 0: Root ----
    // ============================================================

    novice: {
        maxHp: 46, maxMp: 20,
        spd: 8, atk: 9, def: 6, mat: 8, mdf: 6,
        move: 3, eva: 14,
        abilities: ['attack', 'fire', 'ward'],
        abilityLevels: { attack: 1, fire: 1, ward: 2 },
        spriteKey: 'npc_ally',
        char: 'N', color: '#cccccc',
        schools: [],
        prerequisites: [],
        desc: 'A student who has barely scratched the surface of every school. The Novice can attack, cast a basic spell, and patch wounds in a pinch, but masters none of it. As they grow they will discover which schools call to them and choose a true path.',
        masteryBonus: { atk: 2, mat: 2 },
    },

    // ============================================================
    // ---- Tier 1: School basics (each requires Novice Lv.2) ----
    // ============================================================

    evoker: {
        maxHp: 36, maxMp: 52,
        spd: 7, atk: 6, def: 3, mat: 15, mdf: 7,
        move: 3, eva: 11,
        abilities: ['attack', 'fire', 'thunder', 'mana_surge'],
        abilityLevels: { attack: 1, fire: 1, thunder: 2, mana_surge: 3 },
        spriteKey: 'royal_mage',
        char: 'V', color: '#ff8844',
        schools: ['evocation'],
        prerequisites: [{ job: 'novice', level: 2 }],
        desc: 'A mage who focuses on pure destructive output. The Evoker channels raw elemental energy into fire and lightning, hitting hard from a distance at the cost of low defense and HP. The clearest damage-dealer path, and the foundation for every offensive combo job.',
        masteryBonus: { mat: 5, maxMp: 8 },
        allowedEquipment: { armor: ['cloth'], helmet: ['cloth'], weapon: ['magic'], tool: ['implement'] },
    },

    spellblade: {
        maxHp: 46, maxMp: 22,
        spd: 9, atk: 12, def: 6, mat: 6, mdf: 7,
        move: 3, eva: 15,
        abilities: ['attack', 'hex', 'enfeeble', 'mute'],
        abilityLevels: { attack: 1, hex: 1, enfeeble: 2, mute: 3 },
        spriteKey: 'spell_wraith',
        char: 'C', color: '#cc88dd',
        schools: ['enchantment'],
        prerequisites: [{ job: 'novice', level: 2 }],
        desc: 'A warrior who imbues their blade with runes and hexes. The Spellblade fights up close, cursing enemies to sap their strength while buffing companions before the charge. Tougher and faster than a pure mage, but relies on positioning and setup to shine.',
        masteryBonus: { atk: 3, spd: 1, eva: 3 },
        allowedEquipment: { armor: ['light'], helmet: ['light'], weapon: ['blade'], tool: ['offhand_weapon', 'implement'] },
    },

    warden: {
        maxHp: 44, maxMp: 42,
        spd: 7, atk: 7, def: 7, mat: 10, mdf: 11,
        move: 3, eva: 12,
        abilities: ['attack', 'ward', 'cure', 'renewing_light', 'stone_aegis', 'arcane_veil'],
        abilityLevels: { attack: 1, ward: 1, cure: 2, renewing_light: 2, stone_aegis: 3, arcane_veil: 3 },
        spriteKey: 'npc_ally',
        char: 'A', color: '#88ccaa',
        schools: ['abjuration'],
        prerequisites: [{ job: 'novice', level: 2 }],
        desc: 'A defensive mage who specialises in protecting allies with barriers and basic healing. The Warden is the entry point for all protective and restorative combo jobs, able to keep a team alive without dealing much damage.',
        masteryBonus: { def: 3, mdf: 3, maxHp: 6 },
        allowedEquipment: { armor: ['cloth', 'medium'], helmet: ['cloth', 'medium'], weapon: ['magic', 'blade'], tool: ['shield', 'implement'] },
    },

    runebow: {
        maxHp: 40, maxMp: 42,
        spd: 9, atk: 8, def: 4, mat: 11, mdf: 7,
        move: 4, eva: 15,
        abilities: ['attack', 'long_shot', 'mana_surge'],
        abilityLevels: { attack: 1, long_shot: 1, mana_surge: 2 },
        spriteKey: 'crusader_archer',
        char: 'J', color: '#aaccff',
        schools: ['conjuration'],
        prerequisites: [{ job: 'novice', level: 2 }],
        desc: 'A mage who inscribes runes onto arrows and bolts to strike at range. The Runebow uses conjured projectiles to deliver magical attacks from a distance and lays the groundwork for summoning- and dimension-based combo jobs. Faster than most mages but lacks raw magical punch.',
        masteryBonus: { spd: 1, move: 1, eva: 3 },
        allowedEquipment: { armor: ['light'], helmet: ['light'], weapon: ['bow', 'crossbow', 'magic'], tool: ['quiver', 'implement'] },
    },

    stoneshaper: {
        maxHp: 50, maxMp: 30,
        spd: 8, atk: 11, def: 7, mat: 9, mdf: 7,
        move: 4, eva: 14,
        abilities: ['attack', 'rock_toss', 'earth_skin', 'stone_aegis'],
        abilityLevels: { attack: 1, rock_toss: 2, earth_skin: 2, stone_aegis: 3 },
        spriteKey: 'void_brute',
        char: 'T', color: '#aa8855',
        schools: ['transmutation'],
        prerequisites: [{ job: 'novice', level: 2 }],
        desc: 'A mage who reshapes stone and earth, turning raw rock into weapons and armour. The Stoneshaper is a durable melee-range hybrid who unlocks nature- and beast-themed combo jobs.',
        masteryBonus: { atk: 4, def: 3, maxHp: 8 },
        allowedEquipment: { armor: ['light', 'medium'], helmet: ['light', 'medium'], weapon: ['blade', 'heavy_weapon'], tool: ['offhand_weapon', 'implement'] },
    },

    seer: {
        maxHp: 40, maxMp: 48,
        spd: 7, atk: 6, def: 5, mat: 10, mdf: 11,
        move: 3, eva: 16,
        abilities: ['attack', 'ward', 'farsight', 'temporal_slip', 'dream_veil', 'swift_grace'],
        abilityLevels: { attack: 1, ward: 1, farsight: 2, temporal_slip: 3, dream_veil: 2, swift_grace: 3 },
        spriteKey: 'npc_ally',
        char: 'D', color: '#99ccff',
        schools: ['divination'],
        prerequisites: [{ job: 'novice', level: 2 }],
        desc: 'A mage who reads time and probability, foreseeing attacks before they happen and guiding allies away from harm. The Seer has the highest evasion of any Tier 1 job, and is the prerequisite for fate- and prophecy-based combo jobs.',
        masteryBonus: { eva: 5, mdf: 3 },
        allowedEquipment: { armor: ['cloth', 'light'], helmet: ['cloth', 'light'], weapon: ['magic'], tool: ['implement'] },
    },

    // ============================================================
    // ---- Tier 2: Combo jobs (each requires two school basics at Lv.3) ----
    // ============================================================

    battlemage: {
        maxHp: 52, maxMp: 36,
        spd: 8, atk: 12, def: 7, mat: 12, mdf: 7,
        move: 3, eva: 14,
        abilities: ['attack', 'arcane_strike', 'force_pulse', 'mana_surge'],
        abilityLevels: { attack: 1, arcane_strike: 1, force_pulse: 2, mana_surge: 4 },
        spriteKey: 'royal_mage',
        char: 'B', color: '#aa88ff',
        schools: ['evocation', 'enchantment'],
        prerequisites: [
            { job: 'evoker',    level: 3 },
            { job: 'spellblade', level: 3 },
        ],
        desc: 'A warrior who weaves enchantments into every swing. The Battlemage closes to melee and uses magic to amplify strikes and lock down targets, blending physical pressure with short-range crowd control. Balanced stats mean no single weakness, but no dominant strength either.',
        masteryBonus: { atk: 3, mat: 3, maxHp: 6 },
    },

    paladin: {
        maxHp: 62, maxMp: 28,
        spd: 7, atk: 13, def: 12, mat: 10, mdf: 12,
        move: 3, eva: 12,
        abilities: ['attack', 'smite', 'heal', 'divine_ward', 'renewing_light', 'last_rites'],
        abilityLevels: { attack: 1, smite: 1, heal: 2, renewing_light: 2, divine_ward: 4, last_rites: 3 },
        spriteKey: 'knight',
        char: 'P', color: '#ffee88',
        schools: ['evocation', 'abjuration'],
        prerequisites: [
            { job: 'evoker', level: 3 },
            { job: 'warden', level: 3 },
        ],
        desc: 'A crusader who balances offensive holy power with protective Abjuration. The Paladin hits hard up close with Smite, keeps allies alive with Heal, and passively soaks damage through Divine Ward. A durable frontliner who is never purely offensive or purely defensive.',
        masteryBonus: { def: 4, mdf: 4, maxHp: 10 },
        equipmentExpansions: { armor: ['heavy'], helmet: ['heavy'] },
    },

    riftcaller: {
        maxHp: 34, maxMp: 56,
        spd: 8, atk: 5, def: 3, mat: 16, mdf: 8,
        move: 4, eva: 16,
        abilities: ['attack', 'rift_bolt', 'void_burst', 'mana_surge', 'mirror_ward'],
        abilityLevels: { attack: 1, rift_bolt: 1, void_burst: 2, mana_surge: 4, mirror_ward: 3 },
        spriteKey: 'spell_wraith',
        char: 'R', color: '#55aaff',
        schools: ['evocation', 'conjuration'],
        prerequisites: [
            { job: 'evoker',   level: 3 },
            { job: 'runebow', level: 3 },
        ],
        desc: 'A sorcerer who blasts with interdimensional energy and tears open space itself. The Riftcaller excels at long-range single-target elimination with Rift Bolt, then detonates Void Burst when enemies cluster. High mobility and range, but fragile up close.',
        masteryBonus: { mat: 5, eva: 3, maxMp: 8 },
    },

    earthshaker: {
        maxHp: 56, maxMp: 32,
        spd: 6, atk: 10, def: 9, mat: 13, mdf: 8,
        move: 3, eva: 10,
        abilities: ['attack', 'tremor', 'stone_spike', 'stone_wall', 'stone_aegis'],
        abilityLevels: { attack: 1, tremor: 1, stone_spike: 3, stone_wall: 2, stone_aegis: 2 },
        spriteKey: 'void_brute',
        char: 'E', color: '#aa7744',
        schools: ['evocation', 'transmutation'],
        prerequisites: [
            { job: 'evoker',     level: 3 },
            { job: 'stoneshaper', level: 3 },
        ],
        desc: 'A geomancer who reshapes the battlefield through seismic force. Tremor disrupts entire enemy formations by slowing them in place, while Stone Spike punishes isolated targets with massive focused damage. Slow and deliberate, but area denial and raw damage make every cast matter.',
        masteryBonus: { mat: 4, def: 4, maxHp: 8 },
    },

    sanctifier: {
        maxHp: 44, maxMp: 52,
        spd: 7, atk: 6, def: 8, mat: 11, mdf: 13,
        move: 3, eva: 12,
        abilities: ['attack', 'holy_bind', 'radiant_heal', 'cure', 'stone_aegis', 'arcane_veil'],
        abilityLevels: { attack: 1, holy_bind: 1, radiant_heal: 2, stone_aegis: 2, arcane_veil: 3, cure: 4 },
        spriteKey: 'npc_ally',
        char: 'H', color: '#ffeeaa',
        schools: ['enchantment', 'abjuration'],
        prerequisites: [
            { job: 'spellblade', level: 3 },
            { job: 'warden',    level: 3 },
        ],
        desc: 'A divine support who combines crowd control with healing. Holy Bind stuns enemies at range while Radiant Heal and Cure keep allies fighting. The Sanctifier cannot ignore the enemy line entirely, but their control spells make them a threat the enemy cannot safely dismiss.',
        masteryBonus: { mdf: 5, maxMp: 8, maxHp: 6 },
    },

    spiritbinder: {
        maxHp: 38, maxMp: 50,
        spd: 8, atk: 6, def: 4, mat: 14, mdf: 9,
        move: 4, eva: 16,
        abilities: ['attack', 'spirit_lash', 'haunting', 'mana_surge', 'mute', 'dream_veil', 'bind_will', 'call_wisp'],
        abilityLevels: { attack: 1, spirit_lash: 1, haunting: 3, mute: 2, dream_veil: 2, call_wisp: 2, bind_will: 3, mana_surge: 4 },
        spriteKey: 'shadow_imp',
        char: 'X', color: '#aaccff',
        schools: ['enchantment', 'conjuration'],
        prerequisites: [
            { job: 'spellblade', level: 3 },
            { job: 'runebow',  level: 3 },
        ],
        desc: 'A medium who binds and directs conjured spirits against the living. Spirit Lash provides reliable slowing pressure at range, while Haunting uses a fully possessed spirit to stun a key target after a charge. Fragile but slippery, excelling at disrupting enemy action economy.',
        masteryBonus: { mat: 4, eva: 4, maxMp: 6 },
    },

    worldsinger: {
        maxHp: 40, maxMp: 46,
        spd: 7, atk: 6, def: 5, mat: 13, mdf: 10,
        move: 4, eva: 14,
        abilities: ['attack', 'verdant_lash', 'spore_cloud', 'root_field', 'regen_aura', 'toxic_spores', 'primal_rage', 'hexform', 'call_thorn_beast'],
        abilityLevels: { attack: 1, verdant_lash: 1, spore_cloud: 2, toxic_spores: 2, root_field: 3, primal_rage: 3, call_thorn_beast: 3, regen_aura: 4, hexform: 4 },
        spriteKey: 'npc_ally',
        char: 'W', color: '#66dd22',
        schools: ['enchantment', 'transmutation'],
        prerequisites: [
            { job: 'spellblade',  level: 3 },
            { job: 'stoneshaper', level: 3 },
        ],
        desc: 'A nature mage who shapes living growth into weapons and traps. Verdant Lash provides consistent slowing damage while Spore Cloud blankets wide areas in movement-hampering spores. Regen Aura sustains their own HP over a long fight. Excels at zoning and prolonged attrition.',
        masteryBonus: { mat: 3, mdf: 3, maxHp: 6 },
    },

    fatebinder: {
        maxHp: 36, maxMp: 54,
        spd: 8, atk: 5, def: 4, mat: 14, mdf: 10,
        move: 4, eva: 15,
        abilities: ['attack', 'doom_hex', 'fate_seal', 'wyrd_drain', 'mute', 'swift_grace', 'hexform'],
        abilityLevels: { attack: 1, doom_hex: 1, fate_seal: 2, mute: 2, swift_grace: 3, hexform: 3, wyrd_drain: 4 },
        spriteKey: 'spell_wraith',
        char: 'F', color: '#cc44aa',
        schools: ['enchantment', 'divination'],
        prerequisites: [
            { job: 'spellblade', level: 3 },
            { job: 'seer',      level: 3 },
        ],
        desc: 'A fate-weaver who unravels an enemy\'s destiny from a safe distance. Doom Hex inflicts a long-lasting slow instantly, and Fate Seal locks down a single target after a short charge. Wyrd Drain fuels their curse engine through the turn cycle. Frail but uniquely capable of controlling the fastest enemies.',
        masteryBonus: { mat: 4, eva: 3, maxMp: 8 },
    },

    lifeseer: {
        maxHp: 42, maxMp: 52,
        spd: 7, atk: 6, def: 6, mat: 12, mdf: 12,
        move: 3, eva: 14,
        abilities: ['attack', 'foresight_heal', 'renewing_light', 'aegis_ward', 'arcane_veil', 'last_rites', 'mirror_ward', 'seers_vigil'],
        abilityLevels: { attack: 1, foresight_heal: 1, renewing_light: 1, arcane_veil: 2, last_rites: 2, mirror_ward: 3, aegis_ward: 3, seers_vigil: 4 },
        spriteKey: 'npc_ally',
        char: 'L', color: '#aaddff',
        schools: ['abjuration', 'divination'],
        prerequisites: [
            { job: 'warden', level: 3 },
            { job: 'seer',   level: 3 },
        ],
        desc: 'A prophetic healer who foreknows wounds and cancels them before they land. Foresight Heal is the most powerful single-target restore in the roster, and Aegis Ward combines a full status cleanse with protection in one cast. Seer\'s Vigil grants passive evasion-like awareness. Pure support with no offensive angle.',
        masteryBonus: { mdf: 4, maxMp: 8, maxHp: 8 },
    },

    beastcaller: {
        maxHp: 48, maxMp: 36,
        spd: 9, atk: 13, def: 6, mat: 10, mdf: 7,
        move: 4, eva: 18,
        abilities: ['attack', 'wild_surge', 'venom_strike', 'toxic_spores', 'primal_rage', 'savage_howl', 'call_wolf', 'call_boar'],
        abilityLevels: { attack: 1, wild_surge: 1, venom_strike: 2, toxic_spores: 2, primal_rage: 3, savage_howl: 3, call_wolf: 2, call_boar: 4 },
        spriteKey: 'shadow_imp',
        char: 'C', color: '#cc8833',
        schools: ['conjuration', 'transmutation'],
        prerequisites: [
            { job: 'runebow',   level: 3 },
            { job: 'stoneshaper', level: 3 },
        ],
        desc: 'A shapeshifting fighter who battles with the ferocity of the beasts they call. Wild Surge delivers heavy physical hits that leave targets staggered, while Savage Howl disrupts entire groups at short range. Fast and mobile, the Beastcaller wants to be in the thick of the enemy formation rather than hanging back.',
        masteryBonus: { atk: 5, spd: 1, move: 1 },
    },

    // ============================================================
    // ---- Enemy jobs ----
    // ============================================================
    goblin: {
        maxHp: 28, maxMp: 0,
        spd: 11, atk: 9, def: 4, mat: 2, mdf: 3,
        move: 4, eva: 18,
        abilities: ['goblin_slash'],
        spriteKey: 'shadow_imp',
        char: 'g', color: '#c84',
    },

    orc_captain: {
        maxHp: 70, maxMp: 0,
        spd: 7, atk: 16, def: 12, mat: 2, mdf: 6,
        move: 3, eva: 8,
        abilities: ['attack', 'shield_bash'],
        spriteKey: 'void_brute',
        char: 'O', color: '#d64',
    },

    shadow_mage: {
        maxHp: 36, maxMp: 50,
        spd: 8, atk: 5, def: 3, mat: 14, mdf: 9,
        move: 3, eva: 12,
        abilities: ['attack', 'shadow_bolt', 'mute'],
        spriteKey: 'spell_wraith',
        char: 'S', color: '#84f',
    },

    // ---- Beast / creature enemies ----

    wolf: {
        maxHp: 30, maxMp: 0,
        spd: 13, atk: 10, def: 3, mat: 1, mdf: 3,
        move: 5, eva: 22,
        abilities: ['wolf_bite'],
        spriteKey: 'wolf',
        char: 'w', color: '#aaaacc',
    },

    boar: {
        maxHp: 48, maxMp: 0,
        spd: 9, atk: 13, def: 6, mat: 1, mdf: 4,
        move: 4, eva: 10,
        abilities: ['attack', 'boar_charge'],
        spriteKey: 'boar',
        char: 'b', color: '#996644',
    },

    thorn_beast: {
        maxHp: 42, maxMp: 28,
        spd: 7, atk: 7, def: 5, mat: 10, mdf: 7,
        move: 3, eva: 12,
        abilities: ['attack', 'thorn_volley'],
        spriteKey: 'thorn_beast',
        char: 't', color: '#449922',
    },

    spore_walker: {
        maxHp: 38, maxMp: 32,
        spd: 6, atk: 6, def: 4, mat: 9, mdf: 6,
        move: 3, eva: 10,
        abilities: ['attack', 'spore_burst', 'toxic_spores'],
        spriteKey: 'spore_walker',
        char: 's', color: '#88bb33',
    },

    shard_spider: {
        maxHp: 26, maxMp: 0,
        spd: 12, atk: 8, def: 3, mat: 1, mdf: 4,
        move: 5, eva: 20,
        abilities: ['spider_bite', 'venom_strike'],
        spriteKey: 'shard_spider',
        char: 'x', color: '#aaccff',
    },

    canopy_stalker: {
        maxHp: 44, maxMp: 0,
        spd: 10, atk: 15, def: 5, mat: 1, mdf: 4,
        move: 5, eva: 16,
        abilities: ['attack', 'pounce'],
        spriteKey: 'canopy_stalker',
        char: 'C', color: '#cc8833',
    },

    spectral_wisp: {
        maxHp: 22, maxMp: 40,
        spd: 9, atk: 3, def: 2, mat: 12, mdf: 12,
        move: 4, eva: 24,
        abilities: ['soul_drain', 'dream_veil'],
        spriteKey: 'spectral_wisp',
        char: 'W', color: '#8888ff',
    },

    void_stalker: {
        maxHp: 52, maxMp: 0,
        spd: 8, atk: 14, def: 7, mat: 2, mdf: 8,
        move: 4, eva: 14,
        abilities: ['attack', 'void_strike'],
        spriteKey: 'void_stalker',
        char: 'V', color: '#6644cc',
    },

    // ---- Human enemy variants ----

    raider: {
        maxHp: 40, maxMp: 0,
        spd: 9, atk: 11, def: 6, mat: 2, mdf: 4,
        move: 4, eva: 13,
        abilities: ['attack'],
        spriteKey: 'raider',
        char: 'r', color: '#cc6633',
    },

    raider_archer: {
        maxHp: 34, maxMp: 0,
        spd: 10, atk: 10, def: 4, mat: 2, mdf: 4,
        move: 4, eva: 16,
        abilities: ['attack', 'long_shot'],
        spriteKey: 'raider_archer',
        char: 'a', color: '#cc8833',
    },

    raider_hexer: {
        maxHp: 30, maxMp: 36,
        spd: 8, atk: 5, def: 3, mat: 11, mdf: 7,
        move: 3, eva: 13,
        abilities: ['attack', 'hex'],
        spriteKey: 'raider_hexer',
        char: 'h', color: '#aa66cc',
    },

    void_walker: {
        maxHp: 44, maxMp: 28,
        spd: 8, atk: 9, def: 5, mat: 11, mdf: 8,
        move: 3, eva: 13,
        abilities: ['attack', 'shadow_bolt'],
        spriteKey: 'void_walker',
        char: 'v', color: '#6644aa',
    },

    kingdom_guard: {
        maxHp: 58, maxMp: 0,
        spd: 7, atk: 13, def: 11, mat: 2, mdf: 8,
        move: 3, eva: 9,
        abilities: ['attack', 'shield_bash'],
        spriteKey: 'kingdom_guard',
        char: 'G', color: '#8888cc',
    },
};
