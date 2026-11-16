// Job (class) definitions. The registry in data-registry.js exports the final
// JOB_STATS table for combat use. Jobs do not use `extends`; every stat is
// listed explicitly.
//
// Fields:
//   maxHp, maxMp  number  Base HP/MP
//   spd           number  Speed (determines CT gain per tick)
//   atk, def      number  Physical attack / defense
//   mat, mdf      number  Magic attack / defense
//   move          number  Movement range in tiles
//   eva           number  Evasion (0-100, treated as % with direction modifier)
//   skillsetName  string  Player jobs: name of the job's action command (e.g. 'Evocation')
//   learnable     object  Player jobs: ability key → { sp, requires? }: the skill points it costs
//                         and the skill that must be learned first.
//                         The ability's `slot` decides where it is equipped: action abilities
//                         form the job's skillset; reaction/support/movement abilities go in
//                         those loadout slots. Attack is implicit and never learned.
//                         Each job lists its actions first, then its reaction, support and
//                         movement abilities (Tier 2: no movement). Player jobs share no
//                         action abilities.
//   abilities     string[]  Enemy jobs only: the fixed ability list the unit fights with
//   spriteKey     string  Key into the skin sprite sheet
//   char          string  Fallback ASCII character
//   color         string   Fallback CSS color
//   desc          string   Player-facing class description shown in selection UI
//   schools       string[] Magic schools this job draws from (flavour + future filtering)
//   tier          number  Player jobs: 1 = starting role, 2 = promotion
//   promotions    string[] Tier 1 only: the Tier 2 jobs this role can promote into once per run.
//                 A promoted character keeps everything learned in their Tier 1 job and adds
//                 the Tier 2 skillset (see loadout.js).
//
// Player jobs offer a deliberately short list: Tier 1 has 4 actions and one each of
// reaction/support/movement; Tier 2 adds 3 actions, a reaction and a support. Abilities cut
// from these lists still exist and can be granted by equipment (data/equipment.js).
//
// Novice is not a player job: it is a plain fighter with a fixed kit, used for militia
// enemies and tests.

export const JOB_DATA = {
    // ============================================================
    // ---- Novice (fixed kit) ----
    // ============================================================

    novice: {
        maxHp: 46, maxMp: 20,
        spd: 8, atk: 9, def: 6, mat: 8, mdf: 6,
        move: 3, eva: 14,
        abilities: ['attack', 'rush', 'throw_stone', 'first_aid'],
        spriteKey: 'npc_ally',
        char: 'N', color: '#cccccc',
        schools: [],
    },

    // ============================================================
    // ---- Tier 1: Starting roles ----
    // ============================================================

    evoker: {
        maxHp: 36, maxMp: 52,
        spd: 7, atk: 6, def: 3, mat: 15, mdf: 7,
        move: 3, eva: 11,
        skillsetName: 'Evocation',
        tier: 1,
        promotions: ['battlemage', 'riftcaller'],
        learnable: {
            fire: { sp: 1 },
            ice: { sp: 1, requires: 'fire' },
            thunder: { sp: 1, requires: 'fire' },
            flare: { sp: 2, requires: 'thunder' },
            flame_retort: { sp: 1, requires: 'fire' },
            mana_surge: { sp: 2, requires: 'ice' },
            mana_stride: { sp: 1 },
        },
        spriteKey: 'royal_mage',
        char: 'V', color: '#ff8844',
        schools: ['evocation'],
        desc: 'A mage who focuses on pure destructive output. The Evoker channels raw elemental energy into fire and lightning, hitting hard from a distance at the cost of low defense and HP. The clearest damage-dealer path.',
        allowedEquipment: { armor: ['cloth'], helmet: ['cloth'], weapon: ['magic'], tool: ['implement'] },
    },

    spellblade: {
        maxHp: 46, maxMp: 22,
        spd: 9, atk: 12, def: 6, mat: 6, mdf: 7,
        move: 3, eva: 15,
        skillsetName: 'Runeblade',
        tier: 1,
        promotions: ['spiritbinder', 'sanctifier'],
        learnable: {
            hex: { sp: 1 },
            sunder: { sp: 1, requires: 'hex' },
            enfeeble: { sp: 1, requires: 'hex' },
            mute: { sp: 2, requires: 'enfeeble' },
            counter: { sp: 1, requires: 'sunder' },
            rune_edge: { sp: 2, requires: 'sunder' },
            momentum: { sp: 1 },
        },
        spriteKey: 'spell_wraith',
        char: 'C', color: '#cc88dd',
        schools: ['enchantment'],
        desc: 'A warrior who imbues their blade with runes and hexes. The Spellblade fights up close, cursing enemies to sap their strength while buffing companions before the charge. Tougher and faster than a pure mage, but relies on positioning and setup to shine.',
        allowedEquipment: { armor: ['light'], helmet: ['light'], weapon: ['blade'], tool: ['offhand_weapon', 'implement'] },
    },

    warden: {
        maxHp: 44, maxMp: 42,
        spd: 7, atk: 7, def: 7, mat: 10, mdf: 11,
        move: 3, eva: 12,
        skillsetName: 'Abjuration',
        tier: 1,
        promotions: ['paladin', 'lifeseer'],
        learnable: {
            ward: { sp: 1 },
            cure: { sp: 1, requires: 'ward' },
            stone_aegis: { sp: 1, requires: 'ward' },
            arcane_veil: { sp: 2, requires: 'stone_aegis' },
            guardian_ward: { sp: 1, requires: 'ward' },
            iron_will: { sp: 2, requires: 'cure' },
            sentinel_step: { sp: 1 },
        },
        spriteKey: 'npc_ally',
        char: 'A', color: '#88ccaa',
        schools: ['abjuration'],
        desc: 'A defensive mage who specialises in protecting allies with barriers and basic healing. The Warden keeps a team alive without dealing much damage.',
        allowedEquipment: { armor: ['cloth', 'medium'], helmet: ['cloth', 'medium'], weapon: ['magic', 'blade'], tool: ['shield', 'implement'] },
    },

    runebow: {
        maxHp: 40, maxMp: 42,
        spd: 9, atk: 8, def: 4, mat: 11, mdf: 7,
        move: 4, eva: 15,
        skillsetName: 'Runecraft',
        tier: 1,
        promotions: ['riftcaller', 'beastcaller'],
        learnable: {
            long_shot: { sp: 1 },
            pinning_shot: { sp: 1, requires: 'long_shot' },
            rune_arrow: { sp: 1, requires: 'long_shot' },
            arrow_rain: { sp: 2, requires: 'pinning_shot' },
            return_fire: { sp: 1, requires: 'long_shot' },
            concentrate: { sp: 2, requires: 'rune_arrow' },
            fleet_step: { sp: 1 },
        },
        spriteKey: 'crusader_archer',
        char: 'J', color: '#aaccff',
        schools: ['conjuration'],
        desc: 'A mage who inscribes runes onto arrows and bolts to strike at range. The Runebow uses conjured projectiles to deliver magical attacks from a distance. Faster than most mages but lacks raw magical punch.',
        allowedEquipment: { armor: ['light'], helmet: ['light'], weapon: ['bow', 'crossbow', 'magic'], tool: ['quiver', 'implement'] },
    },

    stoneshaper: {
        maxHp: 50, maxMp: 30,
        spd: 8, atk: 11, def: 7, mat: 9, mdf: 7,
        move: 4, eva: 14,
        skillsetName: 'Transmutation',
        tier: 1,
        promotions: ['earthshaker', 'worldsinger'],
        learnable: {
            rock_toss: { sp: 1 },
            earth_skin: { sp: 1, requires: 'rock_toss' },
            stone_fist: { sp: 1, requires: 'rock_toss' },
            calcify: { sp: 2, requires: 'stone_fist' },
            stone_reflex: { sp: 1, requires: 'earth_skin' },
            earthen_footing: { sp: 2, requires: 'stone_fist' },
            stone_stride: { sp: 1 },
        },
        spriteKey: 'void_brute',
        char: 'T', color: '#aa8855',
        schools: ['transmutation'],
        desc: 'A mage who reshapes stone and earth, turning raw rock into weapons and armour. The Stoneshaper is a durable melee-range hybrid.',
        allowedEquipment: { armor: ['light', 'medium'], helmet: ['light', 'medium'], weapon: ['blade', 'heavy_weapon'], tool: ['offhand_weapon', 'implement'] },
    },

    seer: {
        maxHp: 40, maxMp: 48,
        spd: 7, atk: 6, def: 5, mat: 10, mdf: 11,
        move: 3, eva: 16,
        skillsetName: 'Divination',
        tier: 1,
        promotions: ['lifeseer', 'fatebinder'],
        learnable: {
            temporal_slip: { sp: 1 },
            time_lapse: { sp: 1, requires: 'temporal_slip' },
            dream_veil: { sp: 1, requires: 'time_lapse' },
            swift_grace: { sp: 2, requires: 'time_lapse' },
            premonition: { sp: 1, requires: 'temporal_slip' },
            swiftcast: { sp: 2, requires: 'time_lapse' },
            featherstep: { sp: 1 },
        },
        spriteKey: 'npc_ally',
        char: 'D', color: '#99ccff',
        schools: ['divination'],
        desc: 'A mage who reads time and probability, foreseeing attacks before they happen and guiding allies away from harm. The Seer has the highest evasion of any starting role.',
        allowedEquipment: { armor: ['cloth', 'light'], helmet: ['cloth', 'light'], weapon: ['magic'], tool: ['implement'] },
    },

    // ============================================================
    // ---- Tier 2: Promotions ----
    // ============================================================

    battlemage: {
        maxHp: 52, maxMp: 36,
        spd: 8, atk: 12, def: 7, mat: 12, mdf: 7,
        move: 3, eva: 14,
        skillsetName: 'Battle Arts',
        tier: 2,
        learnable: {
            arcane_strike: { sp: 1 },
            force_pulse: { sp: 1, requires: 'arcane_strike' },
            blade_storm: { sp: 2, requires: 'force_pulse' },
            arcane_rebuke: { sp: 1, requires: 'arcane_strike' },
            arcane_weapon: { sp: 2, requires: 'arcane_strike' },
        },
        spriteKey: 'royal_mage',
        char: 'B', color: '#aa88ff',
        schools: ['evocation', 'enchantment'],
        desc: 'A warrior who weaves enchantments into every swing. The Battlemage closes to melee and uses magic to amplify strikes and lock down targets, blending physical pressure with short-range crowd control. Balanced stats mean no single weakness, but no dominant strength either.',
    },

    paladin: {
        maxHp: 62, maxMp: 28,
        spd: 7, atk: 13, def: 12, mat: 10, mdf: 12,
        move: 3, eva: 12,
        skillsetName: 'Holy Arts',
        tier: 2,
        learnable: {
            smite: { sp: 1 },
            heal: { sp: 1, requires: 'smite' },
            consecrate: { sp: 2, requires: 'heal' },
            retribution: { sp: 1, requires: 'smite' },
            divine_ward: { sp: 2, requires: 'smite' },
        },
        spriteKey: 'knight',
        char: 'P', color: '#ffee88',
        schools: ['evocation', 'abjuration'],
        desc: 'A crusader who balances offensive holy power with protective Abjuration. The Paladin hits hard up close with Smite, keeps allies alive with Heal, and passively soaks damage through Divine Ward. A durable frontliner who is never purely offensive or purely defensive.',
        equipmentExpansions: { armor: ['heavy'], helmet: ['heavy'] },
    },

    riftcaller: {
        maxHp: 34, maxMp: 56,
        spd: 8, atk: 5, def: 3, mat: 16, mdf: 8,
        move: 4, eva: 16,
        skillsetName: 'Riftcraft',
        tier: 2,
        learnable: {
            rift_bolt: { sp: 1 },
            void_burst: { sp: 1, requires: 'rift_bolt' },
            gravity_well: { sp: 2, requires: 'void_burst' },
            phase_shift: { sp: 1, requires: 'rift_bolt' },
            spell_pierce: { sp: 2, requires: 'rift_bolt' },
        },
        spriteKey: 'spell_wraith',
        char: 'R', color: '#55aaff',
        schools: ['evocation', 'conjuration'],
        desc: 'A sorcerer who blasts with interdimensional energy and tears open space itself. The Riftcaller excels at long-range single-target elimination with Rift Bolt, then detonates Void Burst when enemies cluster. High mobility and range, but fragile up close.',
    },

    earthshaker: {
        maxHp: 56, maxMp: 32,
        spd: 6, atk: 10, def: 9, mat: 13, mdf: 8,
        move: 3, eva: 10,
        skillsetName: 'Geomancy',
        tier: 2,
        learnable: {
            tremor: { sp: 1 },
            stone_spike: { sp: 1, requires: 'tremor' },
            landslide: { sp: 2, requires: 'stone_spike' },
            aftershock: { sp: 1, requires: 'tremor' },
            seismic_power: { sp: 2, requires: 'tremor' },
        },
        spriteKey: 'void_brute',
        char: 'E', color: '#aa7744',
        schools: ['evocation', 'transmutation'],
        desc: 'A geomancer who reshapes the battlefield through seismic force. Tremor disrupts entire enemy formations by slowing them in place, while Stone Spike punishes isolated targets with massive focused damage. Slow and deliberate, but area denial and raw damage make every cast matter.',
    },

    sanctifier: {
        maxHp: 44, maxMp: 52,
        spd: 7, atk: 6, def: 8, mat: 11, mdf: 13,
        move: 3, eva: 12,
        skillsetName: 'Sanctity',
        tier: 2,
        learnable: {
            holy_bind: { sp: 1 },
            radiant_heal: { sp: 1, requires: 'holy_bind' },
            holy_chains: { sp: 2, requires: 'radiant_heal' },
            purifying_light: { sp: 1, requires: 'holy_bind' },
            benediction: { sp: 2, requires: 'holy_bind' },
        },
        spriteKey: 'npc_ally',
        char: 'H', color: '#ffeeaa',
        schools: ['enchantment', 'abjuration'],
        desc: 'A divine support who combines crowd control with healing. Holy Bind stuns enemies at range while Radiant Heal and Cure keep allies fighting. The Sanctifier cannot ignore the enemy line entirely, but their control spells make them a threat the enemy cannot safely dismiss.',
    },

    spiritbinder: {
        maxHp: 38, maxMp: 50,
        spd: 8, atk: 6, def: 4, mat: 14, mdf: 9,
        move: 4, eva: 16,
        skillsetName: 'Spiritbinding',
        tier: 2,
        learnable: {
            spirit_lash: { sp: 1 },
            call_wisp: { sp: 1, requires: 'spirit_lash' },
            haunting: { sp: 2, requires: 'call_wisp' },
            spirit_hush: { sp: 1, requires: 'spirit_lash' },
            spirit_pact: { sp: 2, requires: 'spirit_lash' },
        },
        spriteKey: 'shadow_imp',
        char: 'X', color: '#aaccff',
        schools: ['enchantment', 'conjuration'],
        desc: 'A medium who binds and directs conjured spirits against the living. Spirit Lash provides reliable slowing pressure at range, while Haunting uses a fully possessed spirit to stun a key target after a charge. Fragile but slippery, excelling at disrupting enemy action economy.',
    },

    worldsinger: {
        maxHp: 40, maxMp: 46,
        spd: 7, atk: 6, def: 5, mat: 13, mdf: 10,
        move: 4, eva: 14,
        skillsetName: 'Worldsong',
        tier: 2,
        learnable: {
            verdant_lash: { sp: 1 },
            toxic_spores: { sp: 1, requires: 'verdant_lash' },
            call_thorn_beast: { sp: 2, requires: 'toxic_spores' },
            thorn_hide: { sp: 1, requires: 'verdant_lash' },
            regen_aura: { sp: 2, requires: 'verdant_lash' },
        },
        spriteKey: 'npc_ally',
        char: 'W', color: '#66dd22',
        schools: ['enchantment', 'transmutation'],
        desc: 'A nature mage who shapes living growth into weapons and traps. Verdant Lash provides consistent slowing damage while Toxic Spores poisons whole groups and a summoned Thorn Beast pelts them from range. Regen Aura sustains their own HP over a long fight. Excels at zoning and prolonged attrition.',
    },

    fatebinder: {
        maxHp: 36, maxMp: 54,
        spd: 8, atk: 5, def: 4, mat: 14, mdf: 10,
        move: 4, eva: 15,
        skillsetName: 'Fateweaving',
        tier: 2,
        learnable: {
            doom_hex: { sp: 1 },
            fate_seal: { sp: 1, requires: 'doom_hex' },
            death_sentence: { sp: 2, requires: 'fate_seal' },
            karmic_rebound: { sp: 1, requires: 'doom_hex' },
            wyrd_drain: { sp: 2, requires: 'doom_hex' },
        },
        spriteKey: 'spell_wraith',
        char: 'F', color: '#cc44aa',
        schools: ['enchantment', 'divination'],
        desc: 'A fate-weaver who unravels an enemy\'s destiny from a safe distance. Doom Hex inflicts a long-lasting slow instantly, and Fate Seal locks down a single target after a short charge. Wyrd Drain fuels their curse engine through the turn cycle. Frail but uniquely capable of controlling the fastest enemies.',
    },

    lifeseer: {
        maxHp: 42, maxMp: 52,
        spd: 7, atk: 6, def: 6, mat: 12, mdf: 12,
        move: 3, eva: 14,
        skillsetName: 'Providence',
        tier: 2,
        learnable: {
            foresight_heal: { sp: 1 },
            renewing_light: { sp: 1, requires: 'foresight_heal' },
            mass_foresight: { sp: 2, requires: 'renewing_light' },
            second_sight: { sp: 1, requires: 'foresight_heal' },
            providence: { sp: 2, requires: 'foresight_heal' },
        },
        spriteKey: 'npc_ally',
        char: 'L', color: '#aaddff',
        schools: ['abjuration', 'divination'],
        desc: 'A prophetic healer who foreknows wounds and cancels them before they land. Foresight Heal is the most powerful single-target restore in the roster, Mass Foresight mends the whole line at once, and Providence cheats death once per battle. Pure support with no offensive angle.',
    },

    beastcaller: {
        maxHp: 48, maxMp: 36,
        spd: 9, atk: 13, def: 6, mat: 10, mdf: 7,
        move: 4, eva: 18,
        skillsetName: 'Beastcalling',
        tier: 2,
        learnable: {
            wild_surge: { sp: 1 },
            call_wolf: { sp: 1, requires: 'wild_surge' },
            savage_howl: { sp: 2, requires: 'call_wolf' },
            feral_counter: { sp: 1, requires: 'wild_surge' },
            bloodlust: { sp: 2, requires: 'wild_surge' },
        },
        spriteKey: 'shadow_imp',
        char: 'C', color: '#cc8833',
        schools: ['conjuration', 'transmutation'],
        desc: 'A shapeshifting fighter who battles with the ferocity of the beasts they call. Wild Surge delivers heavy physical hits that leave targets staggered, while Savage Howl disrupts entire groups at short range. Fast and mobile, the Beastcaller wants to be in the thick of the enemy formation rather than hanging back.',
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
