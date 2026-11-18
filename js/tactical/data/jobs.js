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
//   inert         bool     Summons only: never acts (Mirror Image's copies)
//   lure          number   Summons only: how strongly enemies prefer to attack it (see enemy-ai.js)
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
        maxHp: 38, maxMp: 52,
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
        desc: 'A mage devoted to pure destruction. The Evoker hurls fire, ice and lightning from a distance, but has little HP and even less defense. The simplest way to deal heavy damage.',
        allowedEquipment: { armor: ['cloth'], helmet: ['cloth'], weapon: ['magic'], tool: ['implement'] },
    },

    spellblade: {
        maxHp: 46, maxMp: 30,
        spd: 9, atk: 12, def: 6, mat: 9, mdf: 7,
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
        desc: 'A warrior who carves runes and hexes into their blade. The Spellblade fights up close, cursing enemies to sap their strength, speed and magic. Tougher and faster than a pure mage, but needs good positioning to shine.',
        allowedEquipment: { armor: ['light'], helmet: ['light'], weapon: ['blade'], tool: ['offhand_weapon', 'implement'] },
    },

    warden: {
        maxHp: 44, maxMp: 42,
        spd: 7, atk: 7, def: 7, mat: 10, mdf: 11,
        move: 3, eva: 12,
        skillsetName: 'Abjuration',
        tier: 1,
        promotions: ['paladin', 'bastion'],
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
        desc: 'A defensive mage who keeps allies standing with barriers, wards and simple healing. The Warden deals little damage, but the party lasts much longer with one around.',
        // A protector: armored, with a shield, casting its wards through a wand or staff.
        allowedEquipment: { armor: ['medium'], helmet: ['medium'], weapon: ['magic'], tool: ['shield', 'implement'] },
    },

    runebow: {
        maxHp: 40, maxMp: 42,
        spd: 8, atk: 7, def: 4, mat: 10, mdf: 7,
        move: 4, eva: 13,
        skillsetName: 'Runecraft',
        tier: 1,
        promotions: ['skyhunter', 'beastcaller'],
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
        desc: 'An archer who inscribes runes onto arrows to strike from afar. The Runebow mixes plain arrows with conjured magic shots and moves faster than most mages, but lacks raw magical punch.',
        allowedEquipment: { armor: ['light'], helmet: ['light'], weapon: ['bow', 'crossbow'], tool: ['quiver', 'implement'] },
    },

    stoneshaper: {
        maxHp: 47, maxMp: 30,
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
        desc: 'A mage who reshapes stone and earth, turning rock into weapons and armor. The Stoneshaper is a sturdy fighter who does best close to the enemy.',
        allowedEquipment: { armor: ['light', 'medium'], helmet: ['light', 'medium'], weapon: ['blade', 'heavy_weapon'], tool: ['offhand_weapon', 'implement'] },
    },

    seer: {
        maxHp: 44, maxMp: 48,
        spd: 8, atk: 6, def: 6, mat: 11, mdf: 11,
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
        desc: "A mage who reads time and chance, foreseeing attacks before they land and guiding allies out of harm's way. Few classes are harder to hit.",
        allowedEquipment: { armor: ['cloth', 'light'], helmet: ['cloth', 'light'], weapon: ['magic'], tool: ['implement'] },
    },


    // ---- Tier 1: added classes (unlocked with renown, see run/profile.js) ----

    illusionist: {
        maxHp: 40, maxMp: 48,
        spd: 9, atk: 5, def: 4, mat: 14, mdf: 10,
        move: 4, eva: 18,
        skillsetName: 'Illusion',
        tier: 1,
        promotions: ['dreamweaver', 'mirage_oracle'],
        learnable: {
            phantasm: { sp: 1 },
            mirror_image: { sp: 1, requires: 'phantasm' },
            blur: { sp: 1, requires: 'phantasm' },
            vanish: { sp: 2, requires: 'blur' },
            displacement: { sp: 1, requires: 'phantasm' },
            glamour: { sp: 2, requires: 'mirror_image' },
            mirage_step: { sp: 1 },
        },
        spriteKey: 'mirror_shade',
        char: 'I', color: '#e0a0ff',
        schools: ['illusion'],
        desc: 'A mage who bends what enemies see. The Illusionist wins by misdirection: copies that enemies would rather strike, allies blurred or hidden from view, and phantasms only the target can see. Fast and slippery, but frail.',
        allowedEquipment: { armor: ['cloth'], helmet: ['cloth'], weapon: ['magic'], tool: ['implement'] },
    },

    gravecaller: {
        maxHp: 42, maxMp: 44,
        spd: 7, atk: 6, def: 5, mat: 13, mdf: 9,
        move: 3, eva: 10,
        skillsetName: 'Necromancy',
        tier: 1,
        promotions: ['lich', 'gravewarden'],
        learnable: {
            life_drain: { sp: 1 },
            grave_chill: { sp: 1, requires: 'life_drain' },
            raise_dead: { sp: 1, requires: 'life_drain' },
            corpse_burst: { sp: 2, requires: 'raise_dead' },
            lingering_spite: { sp: 1, requires: 'life_drain' },
            soul_harvest: { sp: 2, requires: 'grave_chill' },
            wraithwalk: { sp: 1 },
        },
        spriteKey: 'void_acolyte',
        char: 'N', color: '#7acc7a',
        schools: ['necromancy'],
        desc: 'A mage who bargains with the dead. The Gravecaller drains life to stay standing, and treats every knocked-out enemy as a resource: raise it as a skeleton, or burst it among its friends. Grows stronger as the battle wears on.',
        allowedEquipment: { armor: ['cloth', 'light'], helmet: ['cloth', 'light'], weapon: ['magic'], tool: ['implement'] },
    },

    alchemist: {
        maxHp: 44, maxMp: 0,
        spd: 8, atk: 8, def: 5, mat: 11, mdf: 6,
        move: 4, eva: 12,
        skillsetName: 'Alchemy',
        tier: 1,
        promotions: ['plaguewright', 'field_surgeon'],
        learnable: {
            healing_draught: { sp: 1 },
            acid_flask: { sp: 1, requires: 'healing_draught' },
            smoke_bomb: { sp: 1, requires: 'healing_draught' },
            quicksilver: { sp: 2, requires: 'smoke_bomb' },
            reflex_tonic: { sp: 1, requires: 'healing_draught' },
            potent_brews: { sp: 2, requires: 'acid_flask' },
            light_pack: { sp: 1 },
        },
        spriteKey: 'raider_poisoner',
        char: 'L', color: '#ccff66',
        schools: [],
        desc: 'Not a mage at all: an alchemist whose flasks splash everyone in reach, friend and foe alike. Heals, acid, smoke and quicksilver need no MP, only time to throw and a good eye for where everyone is standing.',
        allowedEquipment: { armor: ['light'], helmet: ['light'], weapon: ['blade', 'magic'], tool: ['implement'] },
    },

    warlord: {
        maxHp: 52, maxMp: 20,
        spd: 8, atk: 11, def: 8, mat: 4, mdf: 6,
        move: 3, eva: 10,
        skillsetName: 'Command',
        tier: 1,
        promotions: ['marshal', 'tactician'],
        learnable: {
            cleave: { sp: 1 },
            rally: { sp: 1, requires: 'cleave' },
            taunt: { sp: 1, requires: 'cleave' },
            reposition: { sp: 2, requires: 'rally' },
            hold_the_line: { sp: 1, requires: 'cleave' },
            field_command: { sp: 2, requires: 'rally' },
            vanguard_step: { sp: 1 },
        },
        spriteKey: 'knight',
        char: 'W', color: '#ffbb55',
        schools: [],
        desc: 'A commander who wins with orders rather than spells. The Warlord sets the pace of the fight: rallying allies to act sooner, taunting enemies into attacking them, and swapping places to pull a friend out of danger.',
        allowedEquipment: { armor: ['light', 'medium'], helmet: ['light', 'medium'], weapon: ['blade', 'heavy_weapon'], tool: ['shield', 'implement'] },
    },

    // ============================================================
    // ---- Tier 2: Promotions ----
    // ============================================================

    battlemage: {
        equipmentExpansions: { weapon: ['blade'], armor: ['light'], helmet: ['light'] },
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
        desc: 'A warrior who weaves enchantments into every swing. The Battlemage fights in melee, using magic to hit harder and to slow or stun targets. Balanced stats mean no single weakness, but no standout strength either.',
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
        desc: 'A holy warrior who balances divine power with protective magic. The Paladin hits hard up close with Smite, keeps allies alive with Heal, and shrugs off blows through Divine Ward. A durable frontliner, never purely offense or purely defense.',
        equipmentExpansions: { armor: ['heavy'], helmet: ['heavy'] },
    },

    riftcaller: {
        equipmentExpansions: { weapon: ['magic'] },
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
        desc: 'A sorcerer who tears open space itself. The Riftcaller picks off targets from long range with Rift Bolt, then sets off Void Burst when enemies bunch up. Quick and far-reaching, but fragile up close.',
    },

    earthshaker: {
        equipmentExpansions: { weapon: ['magic'] },
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
        desc: 'A geomancer who reshapes the battlefield with seismic force. Tremor slows whole enemy formations, and Stone Spike crushes isolated targets. Slow and deliberate, but every cast counts.',
    },

    sanctifier: {
        equipmentExpansions: { weapon: ['magic'], armor: ['cloth'], helmet: ['cloth'] },
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
        desc: 'A holy support who mixes control with healing. Holy Bind stuns enemies at range, Holy Chains stuns whole groups, and Radiant Heal keeps allies fighting. The enemy can never safely ignore a Sanctifier.',
    },

    spiritbinder: {
        equipmentExpansions: { weapon: ['magic'], armor: ['cloth'], helmet: ['cloth'] },
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
        desc: 'A medium who binds spirits and sets them on the living. Spirit Lash slows targets at range, a summoned wisp joins the fight, and Haunting stuns a group after a charge. Fragile but slippery, and good at taking turns away from the enemy.',
    },

    worldsinger: {
        equipmentExpansions: { weapon: ['magic'] },
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
        desc: 'A nature mage who turns living growth into weapons. Verdant Lash slows as it strikes, Toxic Spores poisons whole groups, and a summoned Thorn Beast pelts enemies from range. Regen Aura keeps them on their feet through a long fight.',
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
        desc: "A mage who unravels an enemy's destiny from a safe distance. Doom Hex lays a long slow on a target instantly, Fate Seal stuns a small group after a short charge, and Wyrd Drain makes every curse last longer. Frail, but good at holding down even the fastest enemies.",
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
        desc: 'A prophetic healer who sees wounds coming and undoes them before they land. Foresight Heal is the strongest single-target heal of any class, Mass Foresight mends a cluster of allies at once, and Providence cheats death once per battle. Pure support, with no offensive spells.',
    },

    beastcaller: {
        equipmentExpansions: { weapon: ['magic'] },
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
        desc: 'A shapeshifting fighter with the ferocity of the beasts they call. Wild Surge hits hard and slows, Savage Howl stuns whole groups nearby, and a summoned wolf joins the hunt. Fast and mobile, the Beastcaller belongs in the thick of the enemy line.',
    },

    skyhunter: {
        maxHp: 42, maxMp: 40,
        spd: 9, atk: 12, def: 5, mat: 9, mdf: 7,
        move: 4, eva: 15,
        skillsetName: 'Huntcraft',
        tier: 2,
        learnable: {
            hunters_mark: { sp: 1 },
            piercing_shot: { sp: 1, requires: 'hunters_mark' },
            starfall: { sp: 2, requires: 'piercing_shot' },
            overwatch: { sp: 1, requires: 'hunters_mark' },
            eagle_eye: { sp: 2, requires: 'piercing_shot' },
        },
        spriteKey: 'crusader_archer',
        char: 'H', color: '#ddcc77',
        schools: ['conjuration', 'divination'],
        desc: 'An archer who sees where the quarry will be before it moves. The Skyhunter marks a target so the whole party hits it harder, lands arrows that cannot be dodged, and covers allies with Overwatch. The best pure marksman in the roster, but thin-skinned.',
    },

    bastion: {
        equipmentExpansions: { armor: ['heavy'], helmet: ['heavy'] },
        maxHp: 56, maxMp: 38,
        spd: 6, atk: 9, def: 12, mat: 10, mdf: 13,
        move: 3, eva: 8,
        skillsetName: 'Bulwark Rites',
        tier: 2,
        learnable: {
            bulwark: { sp: 1 },
            ward_circle: { sp: 1, requires: 'bulwark' },
            grasping_stone: { sp: 2, requires: 'ward_circle' },
            mana_shell: { sp: 1, requires: 'bulwark' },
            unbreakable: { sp: 2, requires: 'bulwark' },
        },
        spriteKey: 'kingdom_guard',
        char: 'B', color: '#99bbaa',
        schools: ['abjuration', 'transmutation'],
        desc: 'A warden who turns flesh to stone and wards to walls. The Bastion hardens allies against blows and spells, rings the line with Shell, and pins the enemy in place with grasping stone. Slow, but very hard to bring down.',
    },

    // ---- Tier 2: promotions of the added classes ----

    dreamweaver: {
        maxHp: 36, maxMp: 54,
        spd: 8, atk: 5, def: 4, mat: 14, mdf: 11,
        move: 4, eva: 16,
        skillsetName: 'Dreamcraft',
        tier: 2,
        learnable: {
            mass_sleep: { sp: 1 },
            bewilder: { sp: 1, requires: 'mass_sleep' },
            nightmare: { sp: 2, requires: 'mass_sleep' },
            lull: { sp: 1, requires: 'mass_sleep' },
            deep_dreams: { sp: 2, requires: 'bewilder' },
        },
        spriteKey: 'mirror_shade',
        char: 'D', color: '#cc88ff',
        schools: ['illusion', 'enchantment'],
        desc: 'An illusionist who weaves dreams into weapons. The Dreamweaver puts whole groups to sleep, turns enemies against each other with Bewilder, and makes sleepers pay with Nightmare. Controls a fight rather than ending it.',
    },

    mirage_oracle: {
        maxHp: 38, maxMp: 50,
        spd: 9, atk: 5, def: 4, mat: 13, mdf: 12,
        move: 4, eva: 20,
        skillsetName: 'Mirrors',
        tier: 2,
        learnable: {
            hall_of_mirrors: { sp: 1 },
            mass_blur: { sp: 1, requires: 'hall_of_mirrors' },
            true_strike: { sp: 2, requires: 'hall_of_mirrors' },
            shattered_image: { sp: 1, requires: 'hall_of_mirrors' },
            lasting_images: { sp: 2, requires: 'mass_blur' },
        },
        spriteKey: 'mirror_twin',
        char: 'M', color: '#ddddff',
        schools: ['illusion', 'divination'],
        desc: 'An illusionist who foresees where blows will fall and puts a copy there first. The Mirage Oracle fills the field with mirrors, blurs the whole line, and pierces wards and resistance with True Strike.',
    },

    lich: {
        maxHp: 38, maxMp: 58,
        spd: 7, atk: 5, def: 4, mat: 16, mdf: 10,
        move: 3, eva: 10,
        skillsetName: 'Undeath',
        tier: 2,
        learnable: {
            soul_nova: { sp: 1 },
            wither: { sp: 1, requires: 'soul_nova' },
            bone_spear: { sp: 2, requires: 'soul_nova' },
            phylactery: { sp: 1, requires: 'soul_nova' },
            necrotic_power: { sp: 2, requires: 'wither' },
        },
        spriteKey: 'void_herald',
        char: 'X', color: '#88ee99',
        schools: ['necromancy', 'evocation'],
        desc: 'A gravecaller who has stopped fearing death. The Lich drains whole groups with Soul Nova, withers single foes to husks, and rises again once when struck down. The strongest sustained damage of the necromancers.',
    },

    gravewarden: {
        equipmentExpansions: { armor: ['medium'], helmet: ['medium'] },
        maxHp: 50, maxMp: 46,
        spd: 7, atk: 7, def: 9, mat: 12, mdf: 12,
        move: 3, eva: 10,
        skillsetName: 'Bone Rites',
        tier: 2,
        learnable: {
            bone_ward: { sp: 1 },
            mass_raise: { sp: 1, requires: 'bone_ward' },
            soul_tether: { sp: 2, requires: 'bone_ward' },
            death_ward: { sp: 1, requires: 'bone_ward' },
            grave_legion: { sp: 2, requires: 'mass_raise' },
        },
        spriteKey: 'crypt_warden',
        char: 'G', color: '#ccddcc',
        schools: ['necromancy', 'abjuration'],
        desc: "A gravecaller who guards the living with the dead. The Gravewarden builds barricades of bone, raises skeletons in pairs, and holds allies' souls in their bodies when they should have fallen.",
    },

    plaguewright: {
        maxHp: 46, maxMp: 0,
        spd: 8, atk: 8, def: 6, mat: 13, mdf: 7,
        move: 4, eva: 12,
        skillsetName: 'Plaguecraft',
        tier: 2,
        learnable: {
            plague_flask: { sp: 1 },
            miasma: { sp: 1, requires: 'plague_flask' },
            catalyst: { sp: 2, requires: 'plague_flask' },
            toxic_blood: { sp: 1, requires: 'plague_flask' },
            virulence: { sp: 2, requires: 'miasma' },
        },
        spriteKey: 'raider_poisoner',
        char: 'Q', color: '#99dd33',
        schools: ['transmutation'],
        desc: "An alchemist who brews disease. The Plaguewright poisons wide areas, keeps the poison lingering, then sets it burning with Catalyst. Poison doesn't care whose side you are on, so mind your allies.",
    },

    field_surgeon: {
        maxHp: 48, maxMp: 0,
        spd: 8, atk: 8, def: 7, mat: 12, mdf: 10,
        move: 4, eva: 12,
        skillsetName: 'Field Medicine',
        tier: 2,
        learnable: {
            elixir: { sp: 1 },
            panacea_mist: { sp: 1, requires: 'elixir' },
            stimulant: { sp: 2, requires: 'elixir' },
            triage: { sp: 1, requires: 'elixir' },
            steady_hands: { sp: 2, requires: 'panacea_mist' },
        },
        spriteKey: 'npc_wandering_druid',
        char: 'F', color: '#88ffcc',
        schools: ['abjuration'],
        desc: 'An alchemist who has learned precision. The Field Surgeon doses single allies with Elixir, cures whole groups and hurries them along, and patches up a falling friend on the spot. Steady Hands finally keeps every splash on the right side.',
    },

    marshal: {
        equipmentExpansions: { armor: ['heavy'], helmet: ['heavy'] },
        maxHp: 64, maxMp: 24,
        spd: 7, atk: 13, def: 13, mat: 4, mdf: 10,
        move: 3, eva: 10,
        skillsetName: 'Defense Orders',
        tier: 2,
        learnable: {
            shield_wall: { sp: 1 },
            challenge: { sp: 1, requires: 'shield_wall' },
            bulwark_bash: { sp: 2, requires: 'shield_wall' },
            interpose: { sp: 1, requires: 'shield_wall' },
            iron_discipline: { sp: 2, requires: 'challenge' },
        },
        spriteKey: 'palace_champion',
        char: 'K', color: '#ccccff',
        schools: ['abjuration'],
        desc: 'A warlord who holds the line in person. The Marshal locks shields with the party, calls out the most dangerous enemy, and steps in front of blows meant for others. The toughest frontliner in the roster.',
    },

    tactician: {
        maxHp: 50, maxMp: 34,
        spd: 9, atk: 11, def: 8, mat: 6, mdf: 9,
        move: 4, eva: 14,
        skillsetName: 'Battle Plans',
        tier: 2,
        learnable: {
            seize_the_moment: { sp: 1 },
            delay: { sp: 1, requires: 'seize_the_moment' },
            exploit_opening: { sp: 2, requires: 'seize_the_moment' },
            read_the_battle: { sp: 1, requires: 'seize_the_moment' },
            initiative: { sp: 2, requires: 'delay' },
        },
        spriteKey: 'royal_mage',
        char: 'T', color: '#aa88ff',
        schools: ['divination'],
        desc: 'A warlord who fights the clock. The Tactician sends allies into action at the perfect moment, sets enemies back, and disrupts spells before they land. Every battle starts already a step ahead.',
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

    // ---- Summoned helpers of the added classes ----

    // Mirror Image: a copy that enemies would rather strike (lure). It doesn't act (inert).
    decoy: {
        maxHp: 40, maxMp: 0,
        spd: 1, atk: 0, def: 2, mat: 0, mdf: 2,
        move: 0, eva: 25,
        abilities: ['attack'],
        inert: true, lure: 2,
        spriteKey: 'decoy',
        char: 'i', color: '#e0c0ff',
    },

    // Raised by the Gravecaller from a knocked-out enemy.
    skeleton: {
        maxHp: 34, maxMp: 0,
        spd: 8, atk: 11, def: 6, mat: 2, mdf: 4,
        move: 4, eva: 8,
        abilities: ['attack'],
        spriteKey: 'bone_sentinel',
        char: 'k', color: '#ddddcc',
    },
};
