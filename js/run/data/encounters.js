// Battle encounters for each realm (data/realms.js). An act is set in one realm, so a
// realm's fights are tuned for the act it appears in (actOf in data/realms.js).
//
// ENCOUNTERS[realmId] = { normal: [...], elite: [...], boss: [...] }
//   encounter: { id, name, enemyLevel, roster, map?, easy? }
//     enemyLevel  Level for roster entries on player jobs (see loadout.scaledLoadout)
//     roster      [{ job, name, sprite?, tint?, ct?, level?, statMods?, extraAbilities?, appearance? }]
//                 in priority order. A fight takes the first N entries, where N grows with
//                 the party (enemyCount). A boss roster lists the boss first.
//                 sprite  Entity sprite in place of the job's (Rifthold's realm creatures);
//                         the job still decides how the unit fights
//                 tint    CSS color multiplied over the sprite, to set a unit apart from others
//                         sharing it (the Dire Wolf is darker than its pack)
//     map         Optional map id (js/tactical/data/maps); otherwise one of the realm's maps
//     easy        true: gentle enough for a run's opening fights (see EASY_FIGHTS). Every
//                 act 1 realm has at least one.
//
// ACT_STAT_MODS scale every enemy of an act on top of their job stats; elites (and bosses from
// act 2) add ELITE_STAT_MODS.
//
// A realm's own fights were written for one act (WRITTEN_FOR). When the realm is now fought in
// a later act, its fights move to that act's levels (see shiftLevels); the act's stat mods do
// the rest.
//
// An act realm also fights the encounters of the unlisted realms of its chain (realmSources
// in data/realms.js). Those were written for another act, so retuneEncounter fits them to the
// act they are fought in.
import { JOB_STATS } from '../../tactical/data-registry.js';
import { REALMS, actOf, realmSources } from './realms.js';

// Opening gauge (ct) for roster entries that don't set one, by position, so a fight's
// enemies don't all move at once.
const OPENING_CT = [30, 10, 40, 20, 55, 5];

// A roster entry: job, display name, optional sprite override and extra fields.
function e(job, name, sprite = null, extra = {}) {
    return sprite ? { job, name, sprite, ...extra } : { job, name, ...extra };
}

// An encounter whose roster entries without a ct get one from OPENING_CT.
function fight(id, name, enemyLevel, roster, extra = {}) {
    return { id, name, enemyLevel, ...extra, roster: roster.map((r, i) => ({ ct: OPENING_CT[i % OPENING_CT.length], ...r })) };
}

export const ENCOUNTERS = {
    // ============================================================
    // ---- The Wild Frontiers ----
    // ============================================================
    wild_frontiers: {
        normal: [
            { id: 'bandit_ambush', name: 'Bandit Ambush', enemyLevel: 1, roster: [
                { job: 'raider', name: 'Bandit', ct: 20 },
                { job: 'raider', name: 'Bandit', ct: 50 },
                { job: 'raider_archer', name: 'Bandit Archer', ct: 5 },
                { job: 'raider_hexer', name: 'Bandit Hexer', sprite: 'raider_poisoner', ct: 35 },
                { job: 'raider_archer', name: 'Bandit Archer', ct: 25 },
                { job: 'raider', name: 'Bandit', ct: 65 },
            ] },
            { id: 'wolf_pack', name: 'Wolf Pack', enemyLevel: 1, roster: [
                { job: 'wolf', name: 'Gray Wolf', ct: 20 },
                { job: 'wolf', name: 'Gray Wolf', ct: 55 },
                { job: 'boar', name: 'Wild Boar', ct: 25 },
                { job: 'wolf', name: 'Gray Wolf', ct: 35 },
                { job: 'boar', name: 'Wild Boar', ct: 60 },
                { job: 'wolf', name: 'Gray Wolf', ct: 5 },
            ] },
            { id: 'goblin_raid', name: 'Goblin Raid', enemyLevel: 1, easy: true, roster: [
                { job: 'goblin', name: 'Goblin', ct: 10 },
                { job: 'goblin', name: 'Goblin', ct: 40 },
                { job: 'goblin', name: 'Goblin', ct: 60 },
                { job: 'raider_archer', name: 'Goblin Slinger', ct: 30 },
                { job: 'goblin', name: 'Goblin', ct: 20 },
                { job: 'goblin', name: 'Goblin', ct: 50 },
            ] },
            { id: 'spore_hollow', name: 'Spore Hollow', enemyLevel: 1, easy: true, roster: [
                { job: 'spore_walker', name: 'Spore Walker', ct: 10 },
                { job: 'shard_spider', name: 'Shard Spider', ct: 40 },
                { job: 'wolf', name: 'Marsh Wolf', ct: 20 },
                { job: 'spore_walker', name: 'Spore Walker', ct: 60 },
                { job: 'shard_spider', name: 'Shard Spider', ct: 30 },
                { job: 'wolf', name: 'Marsh Wolf', ct: 55 },
            ] },
            { id: 'deserters', name: 'Deserters', enemyLevel: 1, easy: true, roster: [
                { job: 'novice', name: 'Deserter', sprite: 'npc_defecting_soldier', ct: 15 },
                { job: 'raider_archer', name: 'Deserter Archer', ct: 40 },
                { job: 'evoker', name: 'Hedge Mage', sprite: 'npc_lost_scholar', ct: 30 },
                { job: 'novice', name: 'Deserter', sprite: 'npc_defecting_soldier', ct: 55 },
                { job: 'raider', name: 'Sellsword', ct: 25 },
                { job: 'novice', name: 'Deserter', sprite: 'npc_defecting_soldier', ct: 5 },
            ] },
        ],
        elite: [
            { id: 'thornwood_stalkers', name: 'Thornwood Stalkers', enemyLevel: 2, roster: [
                { job: 'canopy_stalker', name: 'Thornwood Cat', ct: 20, statMods: { atk: -3 } },
                { job: 'thorn_beast', name: 'Thorn Beast', ct: 45 },
                { job: 'boar', name: 'Thornboar', ct: 5 },
                { job: 'wolf', name: 'Thornwood Wolf', ct: 35 },
                { job: 'thorn_beast', name: 'Thorn Beast', ct: 10 },
                { job: 'canopy_stalker', name: 'Thornwood Cat', ct: 55 },
            ] },
            { id: 'raider_warband', name: 'Raider Warband', enemyLevel: 2, roster: [
                { job: 'orc_captain', name: 'Raid Leader', sprite: 'raider_brute', ct: 20 },
                { job: 'raider_hexer', name: 'Raider Hexer', ct: 35 },
                { job: 'raider_archer', name: 'Raider Archer', ct: 5 },
                { job: 'raider', name: 'Raider', ct: 50 },
                { job: 'raider_archer', name: 'Raider Archer', ct: 25 },
                { job: 'raider', name: 'Raider', ct: 65 },
            ] },
        ],
        boss: [
            { id: 'boss_bandit_king', name: 'The Bandit King', enemyLevel: 2, roster: [
                { job: 'orc_captain', name: 'Bandit King', sprite: 'raider_brute', ct: 30, statMods: { maxHp: 40, atk: 3, def: 2, spd: 1 } },
                { job: 'raider_archer', name: 'Royal Archer', ct: 10 },
                { job: 'raider_hexer', name: 'Court Hexer', ct: 40 },
                { job: 'raider', name: 'Bodyguard', ct: 20 },
                { job: 'raider', name: 'Bodyguard', ct: 50 },
            ] },
            { id: 'boss_dire_wolf', name: 'The Dire Wolf', enemyLevel: 2, roster: [
                { job: 'canopy_stalker', name: 'Dire Wolf', sprite: 'wolf', tint: '#6a6272', ct: 30, statMods: { maxHp: 50, atk: 3, def: 3 } },
                { job: 'wolf', name: 'Pack Wolf', ct: 10 },
                { job: 'wolf', name: 'Pack Wolf', ct: 40 },
                { job: 'boar', name: 'Old Tusk', ct: 20 },
                { job: 'wolf', name: 'Pack Wolf', ct: 55 },
            ] },
        ],
    },
    // ============================================================
    // ---- Verdant Wilds ----
    // ============================================================
    verdant_depths: {
        normal: [
            fight('creeping_vines', 'Creeping Vines', 1, [
                e('goblin', 'Vine Creeper', 'vine_creeper'),
                e('spore_walker', 'Spore Walker'),
                e('goblin', 'Vine Creeper', 'vine_creeper'),
                e('goblin', 'Vine Creeper', 'vine_creeper'),
                e('spore_walker', 'Spore Walker'),
                e('goblin', 'Vine Creeper', 'vine_creeper'),
            ], { easy: true }),
            fight('thorn_thicket', 'Thorn Thicket', 1, [
                e('thorn_beast', 'Thorn Beast'),
                e('goblin', 'Vine Creeper', 'vine_creeper'),
                e('wolf', 'Jungle Hound', 'chaos_hound', { statMods: { atk: -1 } }),
                e('thorn_beast', 'Thorn Beast'),
                e('goblin', 'Vine Creeper', 'vine_creeper'),
                e('spore_walker', 'Spore Walker'),
            ]),
            fight('startled_herd', 'Startled Herd', 1, [
                e('boar', 'Wild Tapir', 'tapir'),
                e('boar', 'Striped Okapi', 'okapi', { statMods: { maxHp: -8, spd: 2 } }),
                e('thorn_beast', 'Thorn Beast'),
                e('boar', 'Wild Tapir', 'tapir'),
                e('wolf', 'Jungle Hound', 'chaos_hound'),
                e('boar', 'Striped Okapi', 'okapi', { statMods: { maxHp: -8, spd: 2 } }),
            ]),
        ],
        elite: [
            fight('blighted_grove', 'Blighted Grove', 2, [
                e('spore_walker', 'Blight Bloom', 'blight_bloom', { statMods: { maxHp: 10, mat: 2 } }),
                e('thorn_beast', 'Thorn Beast'),
                e('goblin', 'Vine Creeper', 'vine_creeper'),
                e('spore_walker', 'Blight Bloom', 'blight_bloom'),
                e('thorn_beast', 'Thorn Beast'),
                e('goblin', 'Vine Creeper', 'vine_creeper'),
            ]),
            fight('jungle_poachers', 'Jungle Poachers', 2, [
                e('orc_captain', 'Head Poacher', 'raider_brute', { statMods: { maxHp: -10 } }),
                e('raider_archer', 'Poacher'),
                e('raider_hexer', 'Snare Witch', 'raider_poisoner'),
                e('raider', 'Trapper'),
                e('raider_archer', 'Poacher'),
                e('boar', 'Hunting Boar'),
            ]),
        ],
        boss: [
            fight('boss_thorn_warden', 'The Thorn Warden', 2, [
                e('canopy_stalker', 'Thorn Warden', 'thorn_warden', { statMods: { maxHp: 45, atk: 2, def: 3, mdf: 2 } }),
                e('kingdom_guard', 'Briar Sentinel', 'briar_sentinel', { statMods: { maxHp: -4 } }),
                e('spore_walker', 'Spore Walker'),
                e('goblin', 'Vine Creeper', 'vine_creeper'),
                e('kingdom_guard', 'Briar Sentinel', 'briar_sentinel', { statMods: { maxHp: -4 } }),
            ]),
        ],
    },
    fungal_hollows: {
        normal: [
            fight('fen_spirits', 'Fen Spirits', 2, [
                e('spectral_wisp', 'Marsh Spirit', 'ghost'),
                e('spore_walker', 'Fen Walker'),
                e('shard_spider', 'Fen Spider'),
                e('spectral_wisp', 'Marsh Spirit', 'ghost'),
                e('spore_walker', 'Fen Walker'),
                e('shard_spider', 'Fen Spider'),
            ]),
            fight('spore_cloud', 'Spore Cloud', 2, [
                e('spore_walker', 'Spore Walker'),
                e('spore_walker', 'Blight Bloom', 'blight_bloom'),
                e('goblin', 'Vine Creeper', 'vine_creeper', { statMods: { maxHp: 10 } }),
                e('thorn_beast', 'Rotting Thorn Beast'),
                e('spore_walker', 'Spore Walker'),
                e('goblin', 'Vine Creeper', 'vine_creeper', { statMods: { maxHp: 10 } }),
            ]),
            fight('bog_beasts', 'Bog Beasts', 2, [
                e('boar', 'Bog Boar'),
                e('thorn_beast', 'Mire Beast'),
                e('wolf', 'Fen Wolf'),
                e('boar', 'Bog Boar'),
                e('thorn_beast', 'Mire Beast'),
                e('wolf', 'Fen Wolf'),
            ]),
        ],
        elite: [
            fight('fungal_horrors', 'Fungal Horrors', 3, [
                e('orc_captain', 'Fungal Horror', 'fungal_horror', { extraAbilities: ['spore_burst'], statMods: { maxMp: 30 } }),
                e('spore_walker', 'Spore Walker'),
                e('orc_captain', 'Fungal Horror', 'fungal_horror', { extraAbilities: ['spore_burst'], statMods: { maxMp: 30 } }),
                e('spore_walker', 'Blight Bloom', 'blight_bloom'),
                e('thorn_beast', 'Thorn Beast'),
                e('spectral_wisp', 'Marsh Spirit', 'ghost'),
            ]),
            fight('spider_nest', 'Spider Nest', 3, [
                e('canopy_stalker', 'Web Stalker', 'shard_spider', { statMods: { maxHp: 10 } }),
                e('shard_spider', 'Shard Spider'),
                e('shard_spider', 'Shard Spider'),
                e('spore_walker', 'Egg Tender'),
                e('shard_spider', 'Shard Spider'),
                e('shard_spider', 'Shard Spider'),
            ]),
        ],
        boss: [
            fight('boss_bog_witch', 'The Bog Witch', 4, [
                e('worldsinger', 'Bog Witch', 'npc_wandering_druid', { level: 5, statMods: { maxHp: 50, mat: 3, mdf: 3 } }),
                e('orc_captain', 'Fungal Horror', 'fungal_horror'),
                e('spore_walker', 'Spore Walker'),
                e('spectral_wisp', 'Bound Spirit', 'ghost'),
                e('thorn_beast', 'Thorn Beast'),
                e('spore_walker', 'Spore Walker'),
            ]),
        ],
    },
    primeval_canopy: {
        normal: [
            fight('canopy_serpents', 'Canopy Serpents', 4, [
                e('canopy_stalker', 'Canopy Stalker'),
                e('thorn_beast', 'Thorn Beast'),
                e('canopy_stalker', 'Canopy Stalker'),
                e('spore_walker', 'Spore Walker'),
                e('thorn_beast', 'Thorn Beast'),
                e('canopy_stalker', 'Canopy Stalker'),
            ]),
            fight('heartwood_rot', 'Heartwood Rot', 5, [
                e('orc_captain', 'Fungal Horror', 'fungal_horror'),
                e('spore_walker', 'Spore Walker'),
                e('spore_walker', 'Blight Bloom', 'blight_bloom'),
                e('orc_captain', 'Fungal Horror', 'fungal_horror'),
                e('worldsinger', 'Rotting Druid', 'npc_wandering_druid'),
                e('spore_walker', 'Spore Walker'),
            ]),
            fight('ancient_hunters', 'Ancient Hunters', 4, [
                e('beastcaller', 'Canopy Shaman'),
                e('canopy_stalker', 'Canopy Stalker'),
                e('wolf', 'Primeval Hound', 'chaos_hound'),
                e('boar', 'Elder Tapir', 'tapir'),
                e('wolf', 'Primeval Hound', 'chaos_hound'),
                e('canopy_stalker', 'Canopy Stalker'),
            ]),
        ],
        elite: [
            fight('heartwood_guardians', 'Heartwood Guardians', 6, [
                e('kingdom_guard', 'Thorn Warden', 'thorn_warden', { statMods: { maxHp: 10 } }),
                e('earthshaker', 'Root Shaper', 'briar_sentinel'),
                e('canopy_stalker', 'Canopy Stalker'),
                e('lifeseer', 'Grove Keeper', 'npc_wandering_druid'),
                e('canopy_stalker', 'Canopy Stalker'),
                e('thorn_beast', 'Thorn Beast'),
            ]),
            fight('spore_tide', 'Spore Tide', 6, [
                e('orc_captain', 'Fungal Horror', 'fungal_horror', { extraAbilities: ['spore_burst'], statMods: { maxMp: 30 } }),
                e('spore_walker', 'Spore Walker'),
                e('orc_captain', 'Fungal Horror', 'fungal_horror', { extraAbilities: ['spore_burst'], statMods: { maxMp: 30 } }),
                e('spore_walker', 'Blight Bloom', 'blight_bloom'),
                e('spore_walker', 'Spore Walker'),
                e('spectral_wisp', 'Spore Wisp', 'arcane_wisp'),
            ]),
        ],
        boss: [
            fight('boss_ancient_treant', 'The Ancient Treant', 6, [
                e('earthshaker', 'Ancient Treant', 'boss_ancient_treant', { level: 8, statMods: { maxHp: 90, atk: 4, def: 5, mat: 4, mdf: 3 } }),
                e('canopy_stalker', 'Canopy Stalker'),
                e('orc_captain', 'Fungal Horror', 'fungal_horror'),
                e('thorn_beast', 'Thorn Beast'),
                e('canopy_stalker', 'Canopy Stalker'),
                e('spore_walker', 'Spore Walker'),
            ]),
        ],
    },

    // ============================================================
    // ---- Crystal Caverns ----
    // ============================================================
    crystal_caves: {
        normal: [
            fight('crystal_bats', 'Crystal Bats', 1, [
                e('wolf', 'Crystal Bat', 'crystal_bat', { statMods: { maxHp: -6 } }),
                e('shard_spider', 'Shard Spider'),
                e('wolf', 'Crystal Bat', 'crystal_bat', { statMods: { maxHp: -6 } }),
                e('wolf', 'Crystal Bat', 'crystal_bat', { statMods: { maxHp: -6 } }),
                e('shard_spider', 'Shard Spider'),
                e('wolf', 'Crystal Bat', 'crystal_bat', { statMods: { maxHp: -6 } }),
            ], { easy: true }),
            fight('shard_nest', 'Shard Nest', 1, [
                e('shard_spider', 'Shard Spider'),
                e('shard_spider', 'Shard Spider'),
                e('wolf', 'Crystal Beast', 'crystal_beast'),
                e('shard_spider', 'Shard Spider'),
                e('wolf', 'Crystal Beast', 'crystal_beast'),
                e('shard_spider', 'Shard Spider'),
            ]),
            fight('dormant_golems', 'Dormant Golems', 1, [
                e('kingdom_guard', 'Crystal Golem', 'crystal_golem', { statMods: { spd: -1 } }),
                e('wolf', 'Crystal Beast', 'crystal_beast'),
                e('wolf', 'Crystal Bat', 'crystal_bat', { statMods: { maxHp: -6 } }),
                e('kingdom_guard', 'Crystal Golem', 'crystal_golem', { statMods: { spd: -1 } }),
                e('shard_spider', 'Shard Spider'),
                e('wolf', 'Crystal Bat', 'crystal_bat', { statMods: { maxHp: -6 } }),
            ]),
        ],
        elite: [
            fight('geode_guardians', 'Geode Guardians', 2, [
                e('orc_captain', 'Geode Golem', 'crystal_golem'),
                e('stoneshaper', 'Crystal Shaper', 'runite_elemental'),
                e('wolf', 'Crystal Beast', 'crystal_beast'),
                e('kingdom_guard', 'Crystal Golem', 'crystal_golem'),
                e('shard_spider', 'Shard Spider'),
                e('wolf', 'Crystal Beast', 'crystal_beast'),
            ]),
            fight('lost_expedition', 'Lost Expedition', 2, [
                e('orc_captain', 'Expedition Leader', 'npc_mercenary'),
                e('raider_archer', 'Expedition Scout'),
                e('evoker', 'Expedition Mage'),
                e('raider', 'Desperate Digger', 'npc_trapped_miner'),
                e('raider_archer', 'Expedition Scout'),
                e('raider', 'Desperate Digger', 'npc_trapped_miner'),
            ]),
        ],
        boss: [
            fight('boss_crystal_warden', 'The Crystal Warden', 2, [
                e('orc_captain', 'Crystal Warden', 'crystal_warden', { statMods: { maxHp: 60, atk: 5, def: 5, mdf: 3, spd: 1 } }),
                e('wolf', 'Crystal Beast', 'crystal_beast'),
                e('shard_spider', 'Shard Spider'),
                e('kingdom_guard', 'Crystal Golem', 'crystal_golem'),
                e('wolf', 'Crystal Bat', 'crystal_bat'),
            ]),
        ],
    },
    crystal_mines: {
        normal: [
            fight('mining_golems', 'Mining Golems', 2, [
                e('kingdom_guard', 'Crystal Golem', 'crystal_golem'),
                e('kingdom_guard', 'Miner Golem', 'miner_golem', { statMods: { def: -3, atk: 2 } }),
                e('shard_spider', 'Shard Spider'),
                e('kingdom_guard', 'Crystal Golem', 'crystal_golem'),
                e('shard_spider', 'Shard Spider'),
                e('kingdom_guard', 'Miner Golem', 'miner_golem', { statMods: { def: -3, atk: 2 } }),
            ]),
            fight('shaft_crawlers', 'Shaft Crawlers', 2, [
                e('shard_spider', 'Shard Spider'),
                e('canopy_stalker', 'Crystal Beast', 'crystal_beast'),
                e('shard_spider', 'Shard Spider'),
                e('wolf', 'Crystal Bat', 'crystal_bat'),
                e('canopy_stalker', 'Crystal Beast', 'crystal_beast'),
                e('wolf', 'Crystal Bat', 'crystal_bat'),
            ]),
            fight('runite_surge', 'Runite Surge', 3, [
                e('stoneshaper', 'Runite Elemental', 'runite_elemental'),
                e('kingdom_guard', 'Crystal Golem', 'crystal_golem'),
                e('evoker', 'Runite Spark', 'arcane_wisp'),
                e('stoneshaper', 'Runite Elemental', 'runite_elemental'),
                e('wolf', 'Crystal Bat', 'crystal_bat'),
                e('kingdom_guard', 'Crystal Golem', 'crystal_golem'),
            ]),
        ],
        elite: [
            fight('golem_foreman', 'Golem Foreman', 4, [
                e('orc_captain', 'Combat Golem', 'combat_golem', { statMods: { maxHp: 10 } }),
                e('earthshaker', 'Runite Elemental', 'runite_elemental'),
                e('kingdom_guard', 'Crystal Golem', 'crystal_golem'),
                e('kingdom_guard', 'Miner Golem', 'miner_golem'),
                e('runebow', 'Rail Turret', 'construct'),
                e('kingdom_guard', 'Crystal Golem', 'crystal_golem'),
            ]),
            fight('claim_jumpers', 'Claim Jumpers', 3, [
                e('battlemage', 'Claim Boss', 'raider_brute'),
                e('runebow', 'Claim Sniper', 'raider_archer'),
                e('spellblade', 'Claim Cutter', 'raider'),
                e('warden', 'Claim Medic', 'npc_mercenary'),
                e('runebow', 'Claim Sniper', 'raider_archer'),
                e('spellblade', 'Claim Cutter', 'raider'),
            ]),
        ],
        boss: [
            fight('boss_runite_sentinel', 'The Runite Sentinel', 4, [
                e('paladin', 'Runite Sentinel', 'crystal_sentinel', { level: 5, statMods: { maxHp: 55, atk: 3, def: 4, mdf: 3 } }),
                e('stoneshaper', 'Runite Elemental', 'runite_elemental'),
                e('kingdom_guard', 'Crystal Golem', 'crystal_golem'),
                e('canopy_stalker', 'Crystal Beast', 'crystal_beast'),
                e('kingdom_guard', 'Miner Golem', 'miner_golem'),
                e('shard_spider', 'Shard Spider'),
            ]),
        ],
    },
    crystal_depths: {
        normal: [
            fight('wurm_tunnels', 'Wurm Tunnels', 4, [
                e('orc_captain', 'Crystal Wurm', 'crystal_wurm'),
                e('shard_spider', 'Shard Spider'),
                e('shard_spider', 'Shard Spider'),
                e('orc_captain', 'Crystal Wurm', 'crystal_wurm'),
                e('canopy_stalker', 'Crystal Beast', 'crystal_beast'),
                e('shard_spider', 'Shard Spider'),
            ]),
            fight('living_crystal', 'Living Crystal', 5, [
                e('earthshaker', 'Runite Elemental', 'runite_elemental'),
                e('kingdom_guard', 'Crystal Golem', 'crystal_golem'),
                e('kingdom_guard', 'Crystal Golem', 'crystal_golem'),
                e('stoneshaper', 'Runite Elemental', 'runite_elemental'),
                e('wolf', 'Crystal Bat', 'crystal_bat'),
                e('wolf', 'Crystal Bat', 'crystal_bat'),
            ]),
            fight('imbued_beasts', 'Imbued Beasts', 4, [
                e('canopy_stalker', 'Imbued Beast', 'crystal_beast'),
                e('canopy_stalker', 'Imbued Beast', 'crystal_beast'),
                e('beastcaller', 'Crystal Howler', 'crystal_beast'),
                e('wolf', 'Crystal Bat', 'crystal_bat'),
                e('canopy_stalker', 'Imbued Beast', 'crystal_beast'),
                e('wolf', 'Crystal Bat', 'crystal_bat'),
            ]),
        ],
        elite: [
            fight('heart_wardens', 'Heart Wardens', 6, [
                e('orc_captain', 'Crystal Warden', 'crystal_warden'),
                e('earthshaker', 'Runite Elemental', 'runite_elemental'),
                e('orc_captain', 'Crystal Wurm', 'crystal_wurm'),
                e('lifeseer', 'Crystal Choir', 'crystal_sentinel'),
                e('shard_spider', 'Shard Spider'),
                e('stoneshaper', 'Runite Elemental', 'runite_elemental'),
            ]),
            fight('wurm_mother', 'Wurm Mother', 6, [
                e('orc_captain', 'Wurm Mother', 'crystal_wurm', { statMods: { maxHp: 30, atk: 2 } }),
                e('shard_spider', 'Shard Spider'),
                e('canopy_stalker', 'Crystal Beast', 'crystal_beast'),
                e('orc_captain', 'Crystal Wurm', 'crystal_wurm'),
                e('shard_spider', 'Shard Spider'),
                e('canopy_stalker', 'Crystal Beast', 'crystal_beast'),
            ]),
        ],
        boss: [
            fight('boss_crystal_colossus', 'The Crystal Colossus', 6, [
                e('earthshaker', 'Crystal Colossus', 'boss_crystal_colossus', { level: 8, statMods: { maxHp: 90, atk: 4, def: 6, mat: 4, mdf: 4 } }),
                e('stoneshaper', 'Runite Elemental', 'runite_elemental'),
                e('orc_captain', 'Crystal Wurm', 'crystal_wurm'),
                e('kingdom_guard', 'Crystal Golem', 'crystal_golem'),
                e('stoneshaper', 'Runite Elemental', 'runite_elemental'),
                e('canopy_stalker', 'Crystal Beast', 'crystal_beast'),
            ]),
        ],
    },

    // ============================================================
    // ---- University Ruins ----
    // ============================================================
    arcane_library: {
        // Written for act 2 (see WRITTEN_FOR).
        normal: [
            fight('stray_wisps', 'Wisp Swarm', 2, [
                e('spectral_wisp', 'Arcane Wisp', 'arcane_wisp'),
                e('kingdom_guard', 'Tome Guardian', 'tome_guardian'),
                e('spectral_wisp', 'Arcane Wisp', 'arcane_wisp'),
                e('spectral_wisp', 'Arcane Wisp', 'arcane_wisp'),
                e('kingdom_guard', 'Tome Guardian', 'tome_guardian'),
                e('spectral_wisp', 'Arcane Wisp', 'arcane_wisp'),
            ]),
            fight('tome_keepers', 'Tome Keepers', 2, [
                e('kingdom_guard', 'Tome Guardian', 'tome_guardian'),
                e('spectral_wisp', 'Arcane Wisp', 'arcane_wisp'),
                e('kingdom_guard', 'Tome Guardian', 'tome_guardian'),
                e('raider_hexer', 'Ink Shade', 'shade_wraith'),
                e('shadow_mage', 'Spell Wraith', 'spell_wraith'),
                e('spectral_wisp', 'Arcane Wisp', 'arcane_wisp'),
            ]),
            fight('restless_readers', 'Restless Readers', 3, [
                e('shadow_mage', 'Spell Wraith', 'spell_wraith'),
                e('evoker', 'Lost Scholar', 'npc_lost_scholar'),
                e('seer', 'Mad Librarian', 'npc_lost_scholar'),
                e('kingdom_guard', 'Tome Guardian', 'tome_guardian'),
                e('spectral_wisp', 'Arcane Wisp', 'arcane_wisp'),
                e('shadow_mage', 'Spell Wraith', 'spell_wraith'),
            ]),
        ],
        elite: [
            fight('forbidden_stacks', 'Forbidden Stacks', 3, [
                e('orc_captain', 'Grand Tome Guardian', 'tome_guardian'),
                e('shadow_mage', 'Spell Wraith', 'spell_wraith'),
                e('spectral_wisp', 'Arcane Wisp', 'arcane_wisp'),
                e('kingdom_guard', 'Tome Guardian', 'tome_guardian'),
                e('shadow_mage', 'Spell Wraith', 'spell_wraith'),
                e('spectral_wisp', 'Arcane Wisp', 'arcane_wisp'),
            ]),
            fight('spectral_faculty', 'Spectral Faculty', 4, [
                e('lifeseer', 'Spectral Professor', 'npc_spectral_professor'),
                e('riftcaller', 'Spectral Lecturer', 'npc_spectral_professor'),
                e('kingdom_guard', 'Tome Guardian', 'tome_guardian'),
                e('evoker', 'Spectral Lecturer', 'npc_spectral_professor'),
                e('spectral_wisp', 'Arcane Wisp', 'arcane_wisp'),
                e('kingdom_guard', 'Tome Guardian', 'tome_guardian'),
            ]),
        ],
        boss: [
            fight('boss_arcane_sentinel', 'The Arcane Sentinel', 4, [
                e('fatebinder', 'Arcane Sentinel', 'arcane_sentinel', { level: 5, statMods: { maxHp: 40, mat: 2, def: 2, mdf: 2 } }),
                e('kingdom_guard', 'Tome Guardian', 'tome_guardian'),
                e('shadow_mage', 'Spell Wraith', 'spell_wraith'),
                e('spectral_wisp', 'Arcane Wisp', 'arcane_wisp'),
                e('kingdom_guard', 'Tome Guardian', 'tome_guardian'),
                e('spectral_wisp', 'Arcane Wisp', 'arcane_wisp'),
            ]),
        ],
    },
    ancient_university: {
        normal: [
            fight('rogue_mages', 'Rogue Mages', 3, [
                e('evoker', 'Rogue Evoker', 'royal_mage'),
                e('spellblade', 'Rogue Spellblade'),
                e('warden', 'Rogue Warden'),
                e('runebow', 'Rogue Runebow'),
                e('stoneshaper', 'Rogue Stoneshaper'),
                e('seer', 'Rogue Seer'),
            ]),
            fight('crusader_occupiers', 'Crusader Occupiers', 2, [
                e('kingdom_guard', 'Crusader', 'crusader'),
                e('raider_archer', 'Crusader Archer', 'crusader_archer'),
                e('kingdom_guard', 'Crusader', 'crusader'),
                e('raider_hexer', 'Witch Finder', 'high_priest'),
                e('raider_archer', 'Crusader Archer', 'crusader_archer'),
                e('raider', 'Camp Guard', 'kingdom_guard'),
            ]),
            fight('runaway_constructs', 'Runaway Constructs', 2, [
                e('kingdom_guard', 'Arcane Construct', 'construct'),
                e('spectral_wisp', 'Arcane Wisp', 'arcane_wisp'),
                e('kingdom_guard', 'Scholar Golem', 'scholar_golem', { statMods: { def: -3 } }),
                e('shadow_mage', 'Spell Wraith', 'spell_wraith'),
                e('kingdom_guard', 'Arcane Construct', 'construct'),
                e('spectral_wisp', 'Arcane Wisp', 'arcane_wisp'),
            ]),
        ],
        elite: [
            fight('mage_hunters', 'Mage Hunters', 4, [
                e('battlemage', 'Hunter Captain', 'crusader'),
                e('runebow', 'Hunter Archer', 'crusader_archer'),
                e('spellblade', 'Hunter Blade', 'knight'),
                e('warden', 'Hunter Medic', 'high_priest'),
                e('runebow', 'Hunter Archer', 'crusader_archer'),
                e('spellblade', 'Hunter Blade', 'knight'),
            ]),
            fight('sealed_archive', 'The Sealed Archive', 3, [
                e('orc_captain', 'Archive Construct', 'construct'),
                e('shadow_mage', 'Spell Wraith', 'spell_wraith'),
                e('kingdom_guard', 'Tome Guardian', 'tome_guardian'),
                e('fatebinder', 'Bound Archivist', 'npc_spectral_professor'),
                e('shadow_mage', 'Spell Wraith', 'spell_wraith'),
                e('kingdom_guard', 'Tome Guardian', 'tome_guardian'),
            ]),
        ],
        boss: [
            fight('boss_rune_automaton', 'The Rune Automaton', 4, [
                e('battlemage', 'Rune Automaton', 'rune_automaton', { level: 5, statMods: { maxHp: 55, atk: 3, mat: 3, def: 4, mdf: 3 } }),
                e('kingdom_guard', 'Arcane Construct', 'construct'),
                e('shadow_mage', 'Spell Wraith', 'spell_wraith'),
                e('spectral_wisp', 'Arcane Wisp', 'arcane_wisp'),
                e('kingdom_guard', 'Arcane Construct', 'construct'),
                e('spectral_wisp', 'Arcane Wisp', 'arcane_wisp'),
            ]),
        ],
    },
    abandoned_laboratory: {
        normal: [
            fight('failed_experiments', 'Failed Experiments', 4, [
                e('orc_captain', 'Lab Abomination', 'lab_abomination'),
                e('spore_walker', 'Leaking Specimen', 'monster'),
                e('void_stalker', 'Chaos Form', 'fracture_horror'),
                e('spore_walker', 'Leaking Specimen', 'monster'),
                e('void_stalker', 'Chaos Form', 'fracture_horror'),
                e('orc_captain', 'Lab Abomination', 'lab_abomination'),
            ]),
            fight('runaway_research', 'Runaway Research', 5, [
                e('riftcaller', 'Unstable Wraith', 'spell_wraith'),
                e('kingdom_guard', 'Arcane Construct', 'construct'),
                e('spectral_wisp', 'Arcane Wisp', 'arcane_wisp'),
                e('kingdom_guard', 'Arcane Construct', 'construct'),
                e('shadow_mage', 'Spell Wraith', 'spell_wraith'),
                e('spectral_wisp', 'Arcane Wisp', 'arcane_wisp'),
            ]),
            fight('chaos_forms', 'Forms of Chaos', 4, [
                e('void_stalker', 'Chaos Form', 'fracture_horror'),
                e('wolf', 'Chaos Hound', 'chaos_hound'),
                e('void_walker', 'Chaos Wisp', 'fracture_wraith'),
                e('void_stalker', 'Chaos Form', 'fracture_horror'),
                e('wolf', 'Chaos Hound', 'chaos_hound'),
                e('void_walker', 'Chaos Wisp', 'fracture_wraith'),
            ]),
        ],
        elite: [
            fight('containment_breach', 'Containment Breach', 6, [
                e('orc_captain', 'Lab Abomination', 'lab_abomination', { extraAbilities: ['toxic_spores'], statMods: { maxMp: 30 } }),
                e('earthshaker', 'Rune Golem', 'rune_automaton'),
                e('void_stalker', 'Chaos Form', 'fracture_horror'),
                e('lifeseer', 'Lab Caretaker', 'scholar_golem'),
                e('orc_captain', 'Lab Abomination', 'lab_abomination'),
                e('raider_hexer', 'Spell Wraith', 'spell_wraith'),
            ]),
            fight('final_thesis', 'The Final Thesis', 6, [
                e('riftcaller', 'Ghost of the Dean', 'npc_spectral_professor'),
                e('battlemage', 'Arcane Construct', 'construct'),
                e('fatebinder', 'Spectral Researcher', 'npc_spectral_professor'),
                e('kingdom_guard', 'Tome Guardian', 'tome_guardian'),
                e('shadow_mage', 'Spell Wraith', 'spell_wraith'),
                e('kingdom_guard', 'Tome Guardian', 'tome_guardian'),
            ]),
        ],
        boss: [
            fight('boss_arcane_construct', 'The Arcane Construct', 6, [
                e('battlemage', 'Arcane Construct Prime', 'boss_arcane_construct', { level: 8, statMods: { maxHp: 85, atk: 4, mat: 5, def: 4, mdf: 5 } }),
                e('orc_captain', 'Lab Abomination', 'lab_abomination'),
                e('kingdom_guard', 'Arcane Construct', 'construct'),
                e('shadow_mage', 'Spell Wraith', 'spell_wraith'),
                e('kingdom_guard', 'Arcane Construct', 'construct'),
                e('spectral_wisp', 'Arcane Wisp', 'arcane_wisp'),
            ]),
        ],
    },

    // ============================================================
    // ---- The Abyss ----
    // ============================================================
    shadow_realm: {
        normal: [
            fight('shadow_imps', 'Shadow Imps', 1, [
                e('goblin', 'Shadow Imp'),
                e('goblin', 'Shadow Imp'),
                e('spectral_wisp', 'Watching Eye', 'blight_bloom', { statMods: { maxHp: -4, mat: -2 } }),
                e('goblin', 'Shadow Imp'),
                e('goblin', 'Shadow Imp'),
                e('spectral_wisp', 'Watching Eye', 'blight_bloom', { statMods: { maxHp: -4, mat: -2 } }),
            ], { easy: true }),
            fight('ledge_stalkers', 'Ledge Stalkers', 1, [
                e('void_stalker', 'Void Stalker', null, { statMods: { maxHp: -14, atk: -3 } }),
                e('goblin', 'Shadow Imp'),
                e('raider_archer', 'Ledge Lurker', 'shade_wraith'),
                e('void_stalker', 'Void Stalker', null, { statMods: { maxHp: -14, atk: -3 } }),
                e('goblin', 'Shadow Imp'),
                e('raider_archer', 'Ledge Lurker', 'shade_wraith'),
            ]),
            fight('drifting_shades', 'Drifting Shades', 1, [
                e('shadow_mage', 'Shade', 'shade', { statMods: { maxHp: -6, mat: -3 } }),
                e('spectral_wisp', 'Watching Eye', 'blight_bloom'),
                e('goblin', 'Shadow Imp'),
                e('shadow_mage', 'Shade', 'shade', { statMods: { maxHp: -6, mat: -3 } }),
                e('goblin', 'Shadow Imp'),
                e('spectral_wisp', 'Watching Eye', 'blight_bloom'),
            ]),
        ],
        elite: [
            fight('chasm_hunters', 'Chasm Hunters', 2, [
                e('void_stalker', 'Void Stalker'),
                e('shadow_mage', 'Shade', 'shade'),
                e('void_stalker', 'Void Stalker'),
                e('goblin', 'Shadow Imp'),
                e('shadow_mage', 'Shade', 'shade'),
                e('goblin', 'Shadow Imp'),
            ]),
            fight('lost_delvers', 'Lost Delvers', 2, [
                e('orc_captain', 'Delve Leader', 'npc_mercenary'),
                e('raider_archer', 'Delver'),
                e('raider_hexer', 'Shadow-Touched Delver', 'void_acolyte'),
                e('raider', 'Delver'),
                e('raider_archer', 'Delver'),
                e('raider', 'Delver'),
            ]),
        ],
        boss: [
            fight('boss_shade_warden', 'The Shade Warden', 2, [
                e('shadow_mage', 'Shade Warden', 'shade_warden', { statMods: { maxHp: 50, mat: 3, def: 3, mdf: 3 } }),
                e('void_stalker', 'Void Stalker', null, { statMods: { maxHp: -14 } }),
                e('goblin', 'Shadow Imp'),
                e('spectral_wisp', 'Watching Eye', 'blight_bloom'),
                e('goblin', 'Shadow Imp'),
            ]),
        ],
    },
    void_abyss: {
        normal: [
            fight('island_dwellers', 'Island Dwellers', 2, [
                e('shard_spider', 'Abyssal Crawler', 'void_horror', { statMods: { maxHp: 8 } }),
                e('goblin', 'Shadow Imp', null, { statMods: { maxHp: 8 } }),
                e('shard_spider', 'Abyssal Crawler', 'void_horror', { statMods: { maxHp: 8 } }),
                e('raider_archer', 'Isle Hunter', 'void_stalker'),
                e('goblin', 'Shadow Imp', null, { statMods: { maxHp: 8 } }),
                e('shard_spider', 'Abyssal Crawler', 'void_horror', { statMods: { maxHp: 8 } }),
            ]),
            fight('spectral_shades', 'Spectral Shades', 2, [
                e('shadow_mage', 'Shade', 'shade'),
                e('spectral_wisp', 'Sea Spirit', 'ghost'),
                e('shadow_mage', 'Shade', 'shade'),
                e('spectral_wisp', 'Sea Spirit', 'ghost'),
                e('void_stalker', 'Void Stalker'),
                e('spectral_wisp', 'Sea Spirit', 'ghost'),
            ]),
            fight('oblivion_brood', 'Oblivion Brood', 3, [
                e('orc_captain', 'Oblivion Spawn', 'oblivion_spawn'),
                e('void_stalker', 'Void Stalker'),
                e('shard_spider', 'Abyssal Crawler', 'void_horror'),
                e('void_stalker', 'Void Stalker'),
                e('shard_spider', 'Abyssal Crawler', 'void_horror'),
                e('shadow_mage', 'Shade', 'shade'),
            ]),
        ],
        elite: [
            fight('void_horrors', 'Void Horrors', 3, [
                e('orc_captain', 'Void Horror', 'void_horror', { extraAbilities: ['shadow_bolt'], statMods: { maxMp: 30 } }),
                e('void_stalker', 'Void Stalker'),
                e('orc_captain', 'Void Horror', 'void_horror', { extraAbilities: ['shadow_bolt'], statMods: { maxMp: 30 } }),
                e('shadow_mage', 'Shade', 'shade'),
                e('void_stalker', 'Void Stalker'),
                e('spectral_wisp', 'Sea Spirit', 'ghost'),
            ]),
            fight('raft_raiders', 'Raft Raiders', 4, [
                e('battlemage', 'Raft Captain', 'npc_shadow_merchant'),
                e('runebow', 'Harpooner', 'raider_archer'),
                e('spiritbinder', 'Sea Witch', 'void_acolyte'),
                e('spellblade', 'Boarder', 'raider'),
                e('runebow', 'Harpooner', 'raider_archer'),
                e('spellblade', 'Boarder', 'raider'),
            ]),
        ],
        boss: [
            fight('boss_gloom_sentinel', 'The Gloom Sentinel', 4, [
                e('fatebinder', 'Gloom Sentinel', 'gloom_sentinel', { level: 5, statMods: { maxHp: 55, mat: 3, def: 3, mdf: 3 } }),
                e('orc_captain', 'Oblivion Spawn', 'oblivion_spawn'),
                e('shadow_mage', 'Shade', 'shade'),
                e('void_stalker', 'Void Stalker'),
                e('shadow_mage', 'Shade', 'shade'),
                e('shard_spider', 'Abyssal Crawler', 'void_horror'),
            ]),
        ],
    },
    oblivion_rift: {
        normal: [
            fight('rift_gate_guards', 'Rift Gate Guards', 4, [
                e('orc_captain', 'Oblivion Spawn', 'oblivion_spawn'),
                e('void_stalker', 'Void Champion'),
                e('shadow_mage', 'Shade', 'shade'),
                e('void_stalker', 'Void Champion'),
                e('orc_captain', 'Oblivion Spawn', 'oblivion_spawn'),
                e('shadow_mage', 'Shade', 'shade'),
            ]),
            fight('black_stone_castle', 'Black Stone Castle', 5, [
                e('kingdom_guard', 'Black Knight', 'revenant_knight'),
                e('runebow', 'Shadow Archer', 'shade_wraith'),
                e('kingdom_guard', 'Black Knight', 'revenant_knight'),
                e('riftcaller', 'Court Shade', 'shade'),
                e('void_stalker', 'Void Champion'),
                e('runebow', 'Shadow Archer', 'shade_wraith'),
            ]),
            fight('silent_swarm', 'The Silent Swarm', 4, [
                e('void_stalker', 'Void Horror', 'void_horror'),
                e('shard_spider', 'Oblivion Mite', 'oblivion_spawn', { statMods: { maxHp: 6 } }),
                e('shard_spider', 'Oblivion Mite', 'oblivion_spawn', { statMods: { maxHp: 6 } }),
                e('void_stalker', 'Void Horror', 'void_horror'),
                e('shard_spider', 'Oblivion Mite', 'oblivion_spawn', { statMods: { maxHp: 6 } }),
                e('spectral_wisp', 'Hush Wisp', 'ghost'),
            ]),
        ],
        elite: [
            fight('sovereign_court', 'The Sovereign\'s Court', 6, [
                e('paladin', 'Black Knight', 'revenant_knight'),
                e('spiritbinder', 'Shadow Chancellor', 'shade_warden'),
                e('void_stalker', 'Void Champion'),
                e('fatebinder', 'Court Shade', 'shade'),
                e('void_stalker', 'Void Champion'),
                e('orc_captain', 'Oblivion Spawn', 'oblivion_spawn'),
            ]),
            fight('abyss_titans', 'Abyss Titans', 6, [
                e('orc_captain', 'Oblivion Spawn', 'oblivion_spawn', { statMods: { maxHp: 20 } }),
                e('orc_captain', 'Void Horror', 'void_horror', { extraAbilities: ['shadow_bolt'], statMods: { maxMp: 30 } }),
                e('shadow_mage', 'Shade', 'shade'),
                e('orc_captain', 'Oblivion Spawn', 'oblivion_spawn', { statMods: { maxHp: 20 } }),
                e('shadow_mage', 'Shade', 'shade'),
                e('void_stalker', 'Void Champion'),
            ]),
        ],
        boss: [
            fight('boss_oblivion_sovereign', 'The Oblivion Sovereign', 6, [
                e('spiritbinder', 'Oblivion Sovereign', 'boss_void_sovereign', { level: 8, statMods: { maxHp: 85, atk: 3, mat: 5, def: 3, mdf: 5, spd: 1 } }),
                e('void_stalker', 'Void Champion'),
                e('orc_captain', 'Oblivion Spawn', 'oblivion_spawn'),
                e('shadow_mage', 'Shade', 'shade'),
                e('void_stalker', 'Void Champion'),
                e('kingdom_guard', 'Black Knight', 'revenant_knight'),
            ]),
        ],
    },

    // ============================================================
    // ---- The Void Pact ----
    // ============================================================
    void_hollow: {
        normal: [
            fight('dark_crawlers', 'Things in the Dark', 1, [
                e('wolf', 'Darkling', 'shade_wraith', { statMods: { maxHp: -6 } }),
                e('goblin', 'Hollow Imp', 'shadow_imp'),
                e('wolf', 'Darkling', 'shade_wraith', { statMods: { maxHp: -6 } }),
                e('goblin', 'Hollow Imp', 'shadow_imp'),
                e('wolf', 'Darkling', 'shade_wraith', { statMods: { maxHp: -6 } }),
                e('goblin', 'Hollow Imp', 'shadow_imp'),
            ], { easy: true }),
            fight('lightless_hunters', 'Lightless Hunters', 1, [
                e('void_walker', 'Void Walker', null, { statMods: { maxHp: -8, mat: -2 } }),
                e('wolf', 'Darkling', 'shade_wraith'),
                e('raider_archer', 'Blind Archer', 'void_penitent'),
                e('void_walker', 'Void Walker', null, { statMods: { maxHp: -8, mat: -2 } }),
                e('wolf', 'Darkling', 'shade_wraith'),
                e('raider_archer', 'Blind Archer', 'void_penitent'),
            ]),
            fight('debtors', 'Runaway Debtors', 1, [
                e('raider', 'Desperate Debtor', 'void_penitent'),
                e('raider_hexer', 'Pact Hexer', 'void_acolyte'),
                e('raider', 'Desperate Debtor', 'void_penitent'),
                e('raider_archer', 'Debtor Archer', 'void_penitent'),
                e('raider', 'Desperate Debtor', 'void_penitent'),
                e('raider_hexer', 'Pact Hexer', 'void_acolyte'),
            ]),
        ],
        elite: [
            fight('hollow_cult', 'Hollow Cult', 2, [
                e('shadow_mage', 'Cultist', 'void_acolyte'),
                e('void_walker', 'Void Wraith'),
                e('raider', 'Zealot', 'void_penitent'),
                e('spectral_wisp', 'Lost Soul', 'ghost'),
                e('void_walker', 'Void Wraith'),
                e('shadow_mage', 'Cultist', 'void_acolyte'),
            ]),
            fight('funnel_watchers', 'Funnel Watchers', 2, [
                e('orc_captain', 'Hollow Brute', 'void_brute'),
                e('void_walker', 'Void Walker'),
                e('wolf', 'Darkling', 'shade_wraith'),
                e('raider_hexer', 'Pact Hexer', 'void_acolyte'),
                e('wolf', 'Darkling', 'shade_wraith'),
                e('void_walker', 'Void Walker'),
            ]),
        ],
        boss: [
            fight('boss_hollow_sentinel', 'The Hollow Sentinel', 2, [
                e('orc_captain', 'Hollow Sentinel', 'hollow_sentinel', { statMods: { maxHp: 45, atk: 3, def: 4, mdf: 2 } }),
                e('void_walker', 'Void Walker'),
                e('wolf', 'Darkling', 'shade_wraith'),
                e('raider_hexer', 'Pact Hexer', 'void_acolyte'),
                e('wolf', 'Darkling', 'shade_wraith'),
            ]),
        ],
    },
    void_sanctum: {
        normal: [
            fight('bone_chatter', 'Bone Chatter', 2, [
                e('kingdom_guard', 'Bone Sentinel', 'bone_sentinel', { statMods: { maxHp: -10 } }),
                e('raider', 'Prisoner', 'void_penitent'),
                e('raider', 'Prisoner', 'void_penitent'),
                e('kingdom_guard', 'Bone Sentinel', 'bone_sentinel', { statMods: { maxHp: -10 } }),
                e('raider_archer', 'Prisoner Archer', 'void_penitent'),
                e('raider', 'Prisoner', 'void_penitent'),
            ]),
            fight('sanctum_acolytes', 'Sanctum Acolytes', 3, [
                e('shadow_mage', 'Void Acolyte', 'void_acolyte'),
                e('void_walker', 'Void Walker'),
                e('shadow_mage', 'Void Acolyte', 'void_acolyte'),
                e('void_stalker', 'Void Penitent', 'void_penitent'),
                e('void_walker', 'Void Walker'),
                e('void_stalker', 'Void Penitent', 'void_penitent'),
            ]),
            fight('debt_collectors', 'Debt Collectors', 3, [
                e('battlemage', 'Collector', 'void_broker'),
                e('void_stalker', 'Enforcer', 'void_brute'),
                e('fatebinder', 'Scribe of Debts', 'void_acolyte'),
                e('void_stalker', 'Enforcer', 'void_brute'),
                e('raider_archer', 'Bailiff', 'void_penitent'),
                e('void_stalker', 'Enforcer', 'void_brute'),
            ]),
        ],
        elite: [
            fight('chapel_guardians', 'Chapel Guardians', 3, [
                e('shadow_mage', 'Chapel Shade', 'shade'),
                e('void_walker', 'Void Wraith'),
                e('kingdom_guard', 'Fallen Knight', 'revenant_knight'),
                e('spectral_wisp', 'Lost Soul', 'ghost'),
                e('void_walker', 'Void Wraith'),
                e('spectral_wisp', 'Lost Soul', 'ghost'),
            ]),
            fight('crypt_wardens', 'Crypt Wardens', 4, [
                e('orc_captain', 'Crypt Warden', 'crypt_warden'),
                e('kingdom_guard', 'Bone Sentinel', 'bone_sentinel'),
                e('sanctifier', 'Penitent Priest', 'void_acolyte'),
                e('kingdom_guard', 'Bone Sentinel', 'bone_sentinel'),
                e('void_stalker', 'Void Penitent', 'void_penitent'),
                e('shadow_mage', 'Void Acolyte', 'void_acolyte'),
            ]),
        ],
        boss: [
            fight('boss_hollow_abbot', 'The Hollow Abbot', 4, [
                e('spiritbinder', 'Hollow Abbot', 'penitent_guardian', { level: 5, statMods: { maxHp: 50, mat: 3, mdf: 3 } }),
                e('kingdom_guard', 'Fallen Knight', 'revenant_knight'),
                e('kingdom_guard', 'Fallen Knight', 'revenant_knight'),
                e('shadow_mage', 'Acolyte', 'void_acolyte'),
                e('spectral_wisp', 'Lost Soul', 'ghost'),
                e('shadow_mage', 'Acolyte', 'void_acolyte'),
            ]),
        ],
    },
    void_heart: {
        normal: [
            fight('penitent_guard', 'Penitent Guard', 4, [
                e('kingdom_guard', 'Penitent Guardian', 'penitent_guardian'),
                e('void_stalker', 'Void Penitent', 'void_penitent'),
                e('kingdom_guard', 'Penitent Guardian', 'penitent_guardian'),
                e('void_stalker', 'Void Penitent', 'void_penitent'),
                e('shadow_mage', 'Void Acolyte', 'void_acolyte'),
                e('void_stalker', 'Void Penitent', 'void_penitent'),
            ]),
            fight('void_touched', 'Void-Touched', 5, [
                e('riftcaller', 'Void Caller', 'void_acolyte'),
                e('void_stalker', 'Void Champion'),
                e('spiritbinder', 'Soul Binder', 'shade'),
                e('void_walker', 'Void Walker'),
                e('void_stalker', 'Void Champion'),
                e('spectral_wisp', 'Rift Wisp', 'ghost'),
            ]),
            fight('ledger_keepers', 'Ledger Keepers', 5, [
                e('fatebinder', 'Ledger Keeper', 'void_broker'),
                e('kingdom_guard', 'Void Sentinel', 'void_sentinel'),
                e('void_stalker', 'Void Penitent', 'void_penitent'),
                e('fatebinder', 'Ledger Keeper', 'void_broker'),
                e('kingdom_guard', 'Void Sentinel', 'void_sentinel'),
                e('void_stalker', 'Void Penitent', 'void_penitent'),
            ]),
        ],
        elite: [
            fight('heralds_of_the_void', 'Heralds of the Void', 6, [
                e('riftcaller', 'Void Herald', 'void_herald'),
                e('void_stalker', 'Void Champion'),
                e('kingdom_guard', 'Penitent Guardian', 'penitent_guardian'),
                e('shadow_mage', 'Void Sorcerer', 'void_acolyte'),
                e('void_stalker', 'Void Champion'),
                e('void_walker', 'Void Walker'),
            ]),
            fight('arbiters_tithe', 'The Arbiter\'s Tithe', 6, [
                e('paladin', 'Tithe Knight', 'void_sentinel'),
                e('fatebinder', 'Ledger Keeper', 'void_broker'),
                e('void_stalker', 'Void Penitent', 'void_penitent'),
                e('lifeseer', 'Penitent Mender', 'void_acolyte'),
                e('void_stalker', 'Void Penitent', 'void_penitent'),
                e('raider_hexer', 'Pact Hexer', 'void_acolyte'),
            ]),
        ],
        boss: [
            fight('boss_void_arbiter', 'The Void Arbiter', 6, [
                e('fatebinder', 'Void Arbiter', 'boss_void_arbiter', { level: 8, statMods: { maxHp: 80, mat: 5, mdf: 5, def: 3 } }),
                e('void_stalker', 'Void Champion'),
                e('kingdom_guard', 'Penitent Guardian', 'penitent_guardian'),
                e('void_walker', 'Void Walker'),
                e('riftcaller', 'Void Herald', 'void_herald'),
                e('void_stalker', 'Void Champion'),
            ]),
        ],
    },

    // ============================================================
    // ---- The Kingdom ----
    // ============================================================
    kingdom_outskirts: {
        normal: [
            fight('angry_villagers', 'Angry Villagers', 1, [
                e('novice', 'Villager', 'npc_ally'),
                e('novice', 'Villager', 'npc_ally'),
                e('raider_archer', 'Hunter'),
                e('novice', 'Villager', 'npc_ally'),
                e('boar', 'Farm Boar'),
                e('novice', 'Villager', 'npc_ally'),
            ], { easy: true }),
            fight('road_patrol', 'Road Patrol', 1, [
                e('kingdom_guard', 'Kingdom Guard', null, { statMods: { maxHp: -12, atk: -2 } }),
                e('raider_archer', 'Patrol Archer', 'crusader_archer'),
                e('kingdom_guard', 'Kingdom Guard', null, { statMods: { maxHp: -12, atk: -2 } }),
                e('raider', 'Militia', 'npc_defecting_soldier'),
                e('raider_archer', 'Patrol Archer', 'crusader_archer'),
                e('raider', 'Militia', 'npc_defecting_soldier'),
            ]),
            fight('forest_wardens', 'Forest Wardens', 1, [
                e('raider_archer', 'Forester', 'crusader_archer'),
                e('wolf', 'Hunting Hound'),
                e('raider_archer', 'Forester', 'crusader_archer'),
                e('raider', 'Woodcutter', 'npc_defecting_soldier'),
                e('wolf', 'Hunting Hound'),
                e('evoker', 'Court Apprentice', 'royal_mage'),
            ]),
        ],
        elite: [
            fight('knights_errant', 'Knights Errant', 2, [
                e('orc_captain', 'Knight', 'knight', { statMods: { maxHp: -10 } }),
                e('kingdom_guard', 'Squire', 'kingdom_guard'),
                e('raider_hexer', 'Royal Mage', 'royal_mage'),
                e('orc_captain', 'Knight', 'knight', { statMods: { maxHp: -10 } }),
                e('raider_archer', 'Crossbowman', 'crusader_archer'),
                e('kingdom_guard', 'Squire', 'kingdom_guard'),
            ]),
            fight('tax_collectors', 'Tax Collectors', 2, [
                e('orc_captain', 'Reeve', 'knight', { statMods: { maxHp: -15 } }),
                e('raider_archer', 'Bailiff', 'crusader_archer'),
                e('raider', 'Enforcer', 'kingdom_guard'),
                e('raider_hexer', 'Clerk-Mage', 'royal_mage'),
                e('raider', 'Enforcer', 'kingdom_guard'),
                e('raider_archer', 'Bailiff', 'crusader_archer'),
            ]),
        ],
        boss: [
            fight('boss_road_captain', 'The Road Captain', 2, [
                e('orc_captain', 'Road Captain', 'knight', { statMods: { maxHp: 60, atk: 6, def: 4, spd: 3 } }),
                e('raider_archer', 'Patrol Archer', 'crusader_archer'),
                e('raider_hexer', 'Royal Mage', 'royal_mage'),
                e('kingdom_guard', 'Kingdom Guard'),
                e('raider_archer', 'Patrol Archer', 'crusader_archer'),
            ]),
        ],
    },
    crusader_barracks: {
        normal: [
            fight('drill_squad', 'Drill Squad', 2, [
                e('kingdom_guard', 'Crusader', 'crusader'),
                e('raider', 'Recruit', 'kingdom_guard'),
                e('raider', 'Recruit', 'kingdom_guard'),
                e('raider_archer', 'Crusader Archer', 'crusader_archer'),
                e('kingdom_guard', 'Crusader', 'crusader'),
                e('raider_archer', 'Crusader Archer', 'crusader_archer'),
            ]),
            fight('armory_guard', 'Armory Guard', 3, [
                e('kingdom_guard', 'Knight', 'knight'),
                e('runebow', 'Arbalest', 'crusader_archer'),
                e('kingdom_guard', 'Knight', 'knight'),
                e('warden', 'Field Medic', 'high_priest'),
                e('runebow', 'Arbalest', 'crusader_archer'),
                e('spellblade', 'Duelist', 'crusader'),
            ]),
            fight('war_hounds', 'War Hounds', 2, [
                e('wolf', 'War Hound', 'chaos_hound'),
                e('wolf', 'War Hound', 'chaos_hound'),
                e('kingdom_guard', 'Kennel Master', 'crusader'),
                e('wolf', 'War Hound', 'chaos_hound'),
                e('raider_archer', 'Crusader Archer', 'crusader_archer'),
                e('wolf', 'War Hound', 'chaos_hound'),
            ]),
        ],
        elite: [
            fight('crusader_vanguard', 'Crusader Vanguard', 4, [
                e('paladin', 'Vanguard Captain', 'crusader'),
                e('kingdom_guard', 'Knight', 'knight'),
                e('runebow', 'Arbalest', 'crusader_archer'),
                e('sanctifier', 'War Priest', 'high_priest'),
                e('kingdom_guard', 'Knight', 'knight'),
                e('runebow', 'Arbalest', 'crusader_archer'),
            ]),
            fight('battle_mages', 'Battle Mages', 3, [
                e('battlemage', 'Battle Mage', 'royal_mage'),
                e('evoker', 'Royal Mage', 'royal_mage'),
                e('kingdom_guard', 'Shield Bearer', 'kingdom_guard'),
                e('battlemage', 'Battle Mage', 'royal_mage'),
                e('seer', 'Court Seer', 'high_priest'),
                e('kingdom_guard', 'Shield Bearer', 'kingdom_guard'),
            ]),
        ],
        boss: [
            fight('boss_drillmaster', 'The Drillmaster', 4, [
                e('paladin', 'Drillmaster', 'revenant_knight', { level: 5, statMods: { maxHp: 55, atk: 3, def: 4, mdf: 2 } }),
                e('kingdom_guard', 'Crusader', 'crusader'),
                e('runebow', 'Arbalest', 'crusader_archer'),
                e('kingdom_guard', 'Knight', 'knight'),
                e('warden', 'Field Medic', 'high_priest'),
                e('runebow', 'Arbalest', 'crusader_archer'),
            ]),
        ],
    },
    palace_fortress: {
        normal: [
            fight('citadel_patrol', 'Citadel Patrol', 5, [
                e('kingdom_guard', 'Palace Guard', 'kingdom_guard'),
                e('raider_archer', 'Palace Archer', 'crusader_archer'),
                e('paladin', 'Palace Paladin', 'knight'),
                e('kingdom_guard', 'Palace Guard', 'kingdom_guard'),
                e('runebow', 'Palace Runebow', 'crusader_archer'),
                e('evoker', 'Royal Mage', 'royal_mage'),
            ]),
            fight('white_robes', 'White Robes', 5, [
                e('sanctifier', 'High Priest', 'high_priest'),
                e('kingdom_guard', 'Temple Guard', 'crusader'),
                e('lifeseer', 'Miracle Worker', 'high_priest'),
                e('kingdom_guard', 'Temple Guard', 'crusader'),
                e('evoker', 'Ward Mage', 'royal_mage'),
                e('kingdom_guard', 'Temple Guard', 'crusader'),
            ]),
            fight('etched_guard', 'The Etched Guard', 4, [
                e('orc_captain', 'Palace Champion', 'palace_champion'),
                e('kingdom_guard', 'Royal Guard', 'knight'),
                e('kingdom_guard', 'Royal Guard', 'knight'),
                e('raider_archer', 'Royal Crossbow', 'crusader_archer'),
                e('kingdom_guard', 'Palace Husk', 'palace_husk'),
                e('raider_archer', 'Royal Crossbow', 'crusader_archer'),
            ]),
        ],
        elite: [
            fight('royal_inquisitors', 'Royal Inquisitors', 6, [
                e('sanctifier', 'Inquisitor', 'high_priest'),
                e('paladin', 'Templar', 'crusader'),
                e('battlemage', 'Witch Hunter', 'royal_mage'),
                e('kingdom_guard', 'Royal Guard', 'knight'),
                e('fatebinder', 'Confessor', 'high_priest'),
                e('kingdom_guard', 'Royal Guard', 'knight'),
            ]),
            fight('palace_champions', 'Palace Champions', 6, [
                e('paladin', 'Palace Champion', 'palace_champion'),
                e('orc_captain', 'Palace Champion', 'palace_champion'),
                e('runebow', 'Royal Marksman', 'crusader_archer'),
                e('lifeseer', 'Royal Physician', 'high_priest'),
                e('kingdom_guard', 'Royal Guard', 'knight'),
                e('runebow', 'Royal Marksman', 'crusader_archer'),
            ]),
        ],
        boss: [
            fight('boss_high_king', 'The High King', 6, [
                e('battlemage', 'The High King', 'boss_high_king', { level: 8, statMods: { maxHp: 85, atk: 5, def: 5, mat: 3, mdf: 4 } }),
                e('kingdom_guard', 'King\'s Guard', 'boss_high_king_guard'),
                e('sanctifier', 'High Priest', 'high_priest'),
                e('paladin', 'Palace Champion', 'palace_champion'),
                e('kingdom_guard', 'King\'s Guard', 'boss_high_king_guard'),
                e('runebow', 'Royal Marksman', 'crusader_archer'),
            ]),
            fight('boss_high_priest', 'The High Priest', 6, [
                e('sanctifier', 'The High Priest', 'high_priest', { level: 8, statMods: { maxHp: 80, mat: 5, mdf: 5, def: 3 } }),
                e('paladin', 'Palace Champion', 'palace_champion'),
                e('kingdom_guard', 'Temple Guard', 'crusader'),
                e('lifeseer', 'Miracle Worker', 'royal_mage'),
                e('kingdom_guard', 'Temple Guard', 'crusader'),
                e('evoker', 'Ward Mage', 'royal_mage'),
            ]),
        ],
    },

    // ============================================================
    // ---- The Unraveling ----
    // ============================================================
    fracture_gate: {
        normal: [
            fight('fracture_imps', 'Fracture Imps', 1, [
                e('goblin', 'Fracture Imp', 'fracture_imp'),
                e('goblin', 'Fracture Imp', 'fracture_imp'),
                e('spectral_wisp', 'Reality Shred', 'reality_shred', { statMods: { maxHp: -4, mat: -2 } }),
                e('goblin', 'Fracture Imp', 'fracture_imp'),
                e('goblin', 'Fracture Imp', 'fracture_imp'),
                e('spectral_wisp', 'Reality Shred', 'reality_shred', { statMods: { maxHp: -4, mat: -2 } }),
            ], { easy: true }),
            fight('borrowed_faces', 'Borrowed Faces', 1, [
                e('raider', 'Mirror Twin', 'mirror_twin'),
                e('raider_archer', 'Mirror Shade', 'mirror_shade'),
                e('raider', 'Mirror Twin', 'mirror_twin'),
                e('raider_hexer', 'Echo', 'decoy'),
                e('raider_archer', 'Mirror Shade', 'mirror_shade'),
                e('goblin', 'Fracture Imp', 'fracture_imp'),
            ]),
            fight('chaos_pack', 'Chaos Pack', 1, [
                e('wolf', 'Chaos Hound', 'chaos_hound'),
                e('wolf', 'Chaos Hound', 'chaos_hound'),
                e('goblin', 'Fracture Imp', 'fracture_imp'),
                e('wolf', 'Chaos Hound', 'chaos_hound'),
                e('spectral_wisp', 'Reality Shred', 'reality_shred'),
                e('wolf', 'Chaos Hound', 'chaos_hound'),
            ]),
        ],
        elite: [
            fight('fracture_wraiths', 'Fracture Wraiths', 2, [
                e('shadow_mage', 'Fracture Wraith', 'fracture_wraith'),
                e('void_stalker', 'Fracture Horror', 'fracture_horror', { statMods: { maxHp: -10 } }),
                e('shadow_mage', 'Fracture Wraith', 'fracture_wraith'),
                e('wolf', 'Chaos Hound', 'chaos_hound'),
                e('goblin', 'Fracture Imp', 'fracture_imp'),
                e('wolf', 'Chaos Hound', 'chaos_hound'),
            ]),
            fight('familiar_strangers', 'Familiar Strangers', 2, [
                e('orc_captain', 'Your Reflection', 'mirror_twin', { statMods: { maxHp: -10 } }),
                e('evoker', 'Mirror Mage', 'mirror_shade'),
                e('raider', 'Mirror Twin', 'mirror_twin'),
                e('raider_archer', 'Mirror Shade', 'mirror_shade'),
                e('raider', 'Mirror Twin', 'mirror_twin'),
                e('raider_hexer', 'Echo', 'decoy'),
            ]),
        ],
        boss: [
            fight('boss_echo_beast', 'The Echo Beast', 2, [
                e('canopy_stalker', 'Echo Beast', 'echo_beast', { statMods: { maxHp: 35, atk: 1, def: 2, mdf: 2 } }),
                e('wolf', 'Chaos Hound', 'chaos_hound'),
                e('goblin', 'Fracture Imp', 'fracture_imp'),
                e('goblin', 'Fracture Imp', 'fracture_imp'),
                e('goblin', 'Fracture Imp', 'fracture_imp'),
            ]),
        ],
    },
    shifting_labyrinth: {
        // Written for act 3, now fought in act 4 (see WRITTEN_FOR).
        normal: [
            fight('rift_crawlers', 'Rift Crawlers', 4, [
                e('void_stalker', 'Rift Crawler', 'glitch_beast'),
                e('void_walker', 'Void Walker'),
                e('void_stalker', 'Rift Crawler', 'glitch_beast'),
                e('shadow_mage', 'Fracture Wraith', 'fracture_wraith'),
                e('void_stalker', 'Rift Crawler', 'glitch_beast'),
                e('void_walker', 'Void Walker'),
            ]),
            fight('shapeshifters', 'Shapeshifters', 4, [
                e('beastcaller', 'Shifting Horror', 'shifting_horror'),
                e('spellblade', 'Shifting Knight', 'mirror_twin'),
                e('evoker', 'Shifting Mage', 'mirror_shade'),
                e('wolf', 'Shifting Hound', 'chaos_hound'),
                e('runebow', 'Shifting Archer', 'mirror_shade'),
                e('wolf', 'Shifting Hound', 'chaos_hound'),
            ]),
            fight('glitch_swarm', 'Glitch Swarm', 4, [
                e('canopy_stalker', 'Glitch Beast', 'glitch_beast'),
                e('spectral_wisp', 'Reality Shred', 'reality_shred'),
                e('shard_spider', 'Glitch Mite', 'glitch_beast'),
                e('shard_spider', 'Glitch Mite', 'glitch_beast'),
                e('spectral_wisp', 'Reality Shred', 'reality_shred'),
                e('shard_spider', 'Glitch Mite', 'glitch_beast'),
            ]),
        ],
        elite: [
            fight('labyrinth_horrors', 'Labyrinth Horrors', 6, [
                e('orc_captain', 'Fracture Horror', 'fracture_horror'),
                e('shadow_mage', 'Fracture Wraith', 'fracture_wraith'),
                e('canopy_stalker', 'Echo Beast', 'echo_beast'),
                e('orc_captain', 'Fracture Horror', 'fracture_horror'),
                e('spectral_wisp', 'Reality Shred', 'reality_shred'),
                e('canopy_stalker', 'Echo Beast', 'echo_beast'),
            ]),
            fight('old_enemies', 'Old Enemies', 6, [
                e('orc_captain', 'Echo of a Bandit King', 'raider_brute'),
                e('worldsinger', 'Echo of a Witch', 'npc_wandering_druid'),
                e('kingdom_guard', 'Echo of a Knight', 'knight'),
                e('canopy_stalker', 'Echo of the Dire Wolf', 'wolf', { tint: '#6a6272' }),
                e('runebow', 'Echo of an Archer', 'mirror_shade'),
                e('fatebinder', 'Echo of an Abbot', 'decoy'),
            ]),
        ],
        boss: [
            fight('boss_shifting_horror', 'The Shifting Horror', 6, [
                e('beastcaller', 'Shifting Horror', 'shifting_horror', { level: 8, statMods: { maxHp: 70, atk: 3, def: 3, mdf: 3 } }),
                e('orc_captain', 'Fracture Horror', 'fracture_horror'),
                e('riftcaller', 'Fracture Wraith', 'fracture_wraith'),
                e('canopy_stalker', 'Echo Beast', 'echo_beast'),
                e('void_stalker', 'Rift Crawler', 'glitch_beast'),
                e('canopy_stalker', 'Echo Beast', 'echo_beast'),
            ]),
        ],
    },
    unraveling_core: {
        normal: [
            fight('core_fragments', 'Core Fragments', 4, [
                e('void_stalker', 'Fracture Horror', 'fracture_horror'),
                e('spectral_wisp', 'Reality Shred', 'reality_shred'),
                e('void_stalker', 'Glitch Beast', 'glitch_beast'),
                e('riftcaller', 'Chaos Caller', 'fracture_wraith'),
                e('void_stalker', 'Fracture Horror', 'fracture_horror'),
                e('spectral_wisp', 'Reality Shred', 'reality_shred'),
            ]),
            fight('stolen_memories', 'Stolen Memories', 5, [
                e('paladin', 'Memory of a Templar', 'mirror_twin'),
                e('riftcaller', 'Memory of a Herald', 'mirror_shade'),
                e('void_stalker', 'Memory of a Champion', 'mirror_twin'),
                e('earthshaker', 'Memory of a Golem', 'decoy'),
                e('runebow', 'Memory of an Archer', 'mirror_shade'),
                e('void_stalker', 'Memory of a Champion', 'mirror_twin'),
            ]),
            fight('unbound_chaos', 'Unbound Chaos', 4, [
                e('canopy_stalker', 'Echo Beast', 'echo_beast'),
                e('orc_captain', 'Shifting Horror', 'shifting_horror'),
                e('wolf', 'Chaos Hound', 'chaos_hound'),
                e('canopy_stalker', 'Echo Beast', 'echo_beast'),
                e('shadow_mage', 'Fracture Wraith', 'fracture_wraith'),
                e('wolf', 'Chaos Hound', 'chaos_hound'),
            ]),
        ],
        elite: [
            fight('riftscar_wardens', 'Riftscar Wardens', 6, [
                e('orc_captain', 'Rift Warden', 'fracture_horror'),
                e('earthshaker', 'Rift Geomancer', 'fracture_wraith'),
                e('void_stalker', 'Rift Stalker', 'glitch_beast'),
                e('lifeseer', 'Rift Oracle', 'mirror_shade'),
                e('void_stalker', 'Rift Stalker', 'glitch_beast'),
                e('raider_hexer', 'Rift Hexer', 'reality_shred'),
            ]),
            fight('eyes_of_the_core', 'Eyes of the Core', 6, [
                e('fatebinder', 'Lesser Eye', 'reality_shred'),
                e('orc_captain', 'Shifting Horror', 'shifting_horror'),
                e('spiritbinder', 'Lesser Eye', 'reality_shred'),
                e('canopy_stalker', 'Echo Beast', 'echo_beast'),
                e('orc_captain', 'Fracture Horror', 'fracture_horror'),
                e('canopy_stalker', 'Echo Beast', 'echo_beast'),
            ]),
        ],
        boss: [
            fight('boss_unraveler', 'The Unraveler', 6, [
                e('riftcaller', 'The Unraveler', 'boss_unraveler', { level: 8, statMods: { maxHp: 80, mat: 5, mdf: 5, def: 3 } }),
                e('void_stalker', 'Echo of a Champion', 'mirror_twin'),
                e('void_stalker', 'Echo of a Champion', 'mirror_twin'),
                e('orc_captain', 'Shifting Horror', 'shifting_horror'),
                e('shadow_mage', 'Fracture Wraith', 'fracture_wraith'),
                e('canopy_stalker', 'Echo Beast', 'echo_beast'),
            ]),
        ],
    },
};

export const ACT_COUNT = 4;

// Enemy stats added per act. The curve climbs evenly: Act 2 sits about halfway between Act 1
// and Act 3 (a steeper Act 2 used to end most runs there; see the balance study notes), and
// Act 4 continues it.
export const ACT_STAT_MODS = {
    1: { maxHp: -4, atk: -1 },
    2: { maxHp: 17, atk: 4, def: 2, mat: 4, mdf: 2 },
    3: { maxHp: 36, atk: 8, def: 4, mat: 8, mdf: 4, spd: 1 },
    4: { maxHp: 55, atk: 12, def: 6, mat: 12, mdf: 6, spd: 1 },
};

// The act a realm's own fights were written for, where that isn't the act it is now fought in
// (realms that moved when Act 4 was added). See shiftLevels.
export const WRITTEN_FOR = { void_sanctum: 2, shifting_labyrinth: 3 };

export const ELITE_STAT_MODS = { maxHp: 8, atk: 1, mat: 1 };

// Gold and the XP every member earns, by encounter kind.
export function battleRewards(kind, act) {
    switch (kind) {
        case 'boss':  return { gold: 100 + 30 * act, xp: 80 + 20 * act, itemChoices: 3, relic: true };
        case 'elite': return { gold: 55 + 15 * act, xp: 55 + 10 * act, itemChoices: 3, relic: true };
        default:      return { gold: 25 + 10 * act, xp: 35 + 5 * act,  itemChoices: 3, relic: false };
    }
}

// How many enemies a fight brings for a party of `partySize`: one more for elites (from
// act 2) and bosses. The first EASY_FIGHTS normal fights of a run bring one fewer.
export const EASY_FIGHTS = 2;
export function enemyCount(kind, partySize, easy = false, act = 1) {
    if (easy) return Math.max(2, partySize - 1);
    const delta = kind === 'boss' || (kind === 'elite' && act > 1) ? 1 : 0;
    return Math.max(3, Math.min(6, partySize + delta));
}

function addMods(...mods) {
    const out = {};
    for (const m of mods) for (const [k, v] of Object.entries(m || {})) out[k] = (out[k] || 0) + v;
    return out;
}

// A concrete battle for the run: the encounter with its roster cut to size and
// act scaling folded into every entry's statMods.
//   kind   'normal' | 'elite' | 'boss'
//   realm  The act's realm; zone  the realm the fight comes from (its look and maps)
export function buildEncounter(def, kind, act, partySize, easy = false, realm = null, zone = realm) {
    const roster = def.roster.slice(0, enemyCount(kind, partySize, easy, act));
    const scale = actScale(kind, act);
    return {
        id: def.id,
        name: def.name,
        kind,
        act,
        realm,
        zone,
        enemyLevel: def.enemyLevel,
        map: def.map ?? null,
        roster: roster.map(r => ({ ...r, statMods: addMods(scale, r.statMods) })),
    };
}

// Act scaling for every enemy of a fight. Elite fights, and boss fights after the first act,
// add ELITE_STAT_MODS.
function actScale(kind, act) {
    const tough = kind === 'elite' || (kind === 'boss' && act > 1);
    return addMods(ACT_STAT_MODS[act], tough ? ELITE_STAT_MODS : null);
}

// ---- Retuning fights for another act -------------------------------------------------

// Typical encounter level by kind and act, and the level of a boss on a player job.
const ACT_LEVEL = { normal: { 1: 1, 2: 2, 3: 4, 4: 6 }, elite: { 1: 2, 2: 3, 3: 6, 4: 8 }, boss: { 1: 2, 2: 4, 3: 6, 4: 8 } };
const BOSS_LEVEL = { 1: 2, 2: 5, 3: 8, 4: 11 };
// A retuned fight may be scaled down to half or up to double its power, no further.
const SCALE_LIMITS = [0.5, 2.5];
// Power is only a rough guide: kits matter too (a tier 3 boss scaled down keeps tricks its
// stats don't show). These factors on the target power were set by playing the retuned fights
// against the realm's own in simulated battles (a leveled party, several maps and seeds), so
// each lands near the home realm's win rate. > 1 makes the folded-in fights harder.
const RETUNE_BIAS = {
    abandoned_laboratory: { elite: 1.15, boss: 1.5 },
    oblivion_rift:        { boss: 1.35 },
    void_hollow:          { elite: 0.8 },
    kingdom_outskirts:    { elite: 1.35 },
    unraveling_core:      { normal: 1.1, elite: 1.35, boss: 1.35 },
};

/**
 * Rough strength of a whole roster as fought in `act`: the sum over its units of HP times
 * their best attack stat. Used only to compare fights with each other.
 */
export function rosterPower(def, kind, act) {
    const scale = actScale(kind, act);
    let total = 0;
    for (const r of def.roster) {
        const base = JOB_STATS[r.job];
        const m = addMods(scale, r.statMods);
        const hp = base.maxHp + (m.maxHp ?? 0);
        const offense = Math.max(base.atk + (m.atk ?? 0), base.mat + (m.mat ?? 0));
        total += Math.max(1, hp) * Math.max(1, offense);
    }
    return total;
}

const median = (xs) => {
    const s = [...xs].sort((a, b) => a - b);
    return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

const _targets = new Map();
// Median roster power of the realm's own fights of `kind`, fought in its own act.
function targetPower(realm, kind) {
    const key = `${realm}:${kind}`;
    if (!_targets.has(key)) {
        const act = actOf(realm);
        _targets.set(key, median(ENCOUNTERS[realm][kind].map(d => rosterPower(d, kind, act))));
    }
    return _targets.get(key);
}

/**
 * A fight written for `fromAct`, refitted for `realm`'s act: encounter and boss levels move
 * to that act's, and every unit's HP, attack and defense stats are scaled together so the
 * roster's power matches the median of the realm's own fights of the same kind. That holds even
 * for a fight already written for this act, since realms of the same tier weren't tuned evenly.
 * `zone` (the realm the fight comes from) picks its RETUNE_BIAS. The roster, names and sprites
 * stay as written.
 */
export function retuneEncounter(def, kind, fromAct, realm, zone = null) {
    const toAct = actOf(realm);
    const out = { ...shiftLevels(def, kind, fromAct, toAct), easy: false };
    const leveled = out.roster;

    const target = targetPower(realm, kind) * (RETUNE_BIAS[zone]?.[kind] ?? 1);
    const k = Math.min(SCALE_LIMITS[1], Math.max(SCALE_LIMITS[0], target / rosterPower(out, kind, toAct)));
    // HP and offense each take the square root, so their product (the power) scales by k.
    const f = Math.sqrt(k);
    const scale = actScale(kind, toAct);
    out.roster = leveled.map(r => {
        const base = JOB_STATS[r.job];
        const m = addMods(scale, r.statMods);
        const delta = (stat) => Math.round((base[stat] + (m[stat] ?? 0)) * (f - 1));
        return { ...r, statMods: addMods(r.statMods, {
            maxHp: delta('maxHp'), atk: delta('atk'), mat: delta('mat'), def: delta('def'), mdf: delta('mdf'),
        }) };
    });
    return out;
}

/**
 * A fight written for `fromAct` at `toAct`'s levels: the encounter level moves by the act's
 * typical level for its kind, and roster entries with their own level (bosses on player jobs)
 * by BOSS_LEVEL. Stats are left alone: buildEncounter adds the act's stat mods.
 */
export function shiftLevels(def, kind, fromAct, toAct) {
    if (fromAct === toAct) return def;
    const shift = ACT_LEVEL[kind][toAct] - ACT_LEVEL[kind][fromAct];
    const bossShift = BOSS_LEVEL[toAct] - BOSS_LEVEL[fromAct];
    const roster = def.roster.map(r => (r.level == null ? r : { ...r, level: Math.max(1, r.level + bossShift) }));
    return { ...def, enemyLevel: Math.max(1, def.enemyLevel + shift), roster };
}

// Every encounter of `kind` the realm can field: [{ def, zone }], its own first (at its act's
// levels, see WRITTEN_FOR), then those of the realms folded into it, retuned for its act.
// Bosses are limited to the realm's `bosses` list when it has one.
export function realmEncounters(realm, kind) {
    const bosses = kind === 'boss' ? REALMS[realm]?.bosses : null;
    const act = actOf(realm);
    return realmSources(realm).flatMap(zone => (ENCOUNTERS[zone]?.[kind] ?? [])
        .filter(def => !bosses || bosses.includes(def.id))
        .map(def => ({
            zone,
            def: zone === realm ? shiftLevels(def, kind, WRITTEN_FOR[realm] ?? act, act) : retuneEncounter(def, kind, actOf(zone), realm, zone),
        })));
}

// Picks an encounter of `kind` from the realm's fights (its own and those folded into it),
// avoiding ids in `seen` while others remain. `act` sets the scaling.
export function rollEncounter(rng, realm, act, kind, partySize, seen = [], easy = false) {
    const all = realmEncounters(realm, kind);
    const gentle = all.filter(e => e.def.easy);
    const pool = easy && gentle.length ? gentle : all;
    const fresh = pool.filter(e => !seen.includes(e.def.id));
    const { def, zone } = rng.pick(fresh.length ? fresh : pool);
    return buildEncounter(def, kind, act, partySize, easy, realm, zone);
}
