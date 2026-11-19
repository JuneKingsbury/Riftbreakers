// Crystal Caves: tier 1 of Crystal Caverns.
//
// `realm` is the realm itself, `encounters` its fights by kind, and `events` the '?' events
// only met here. Which acts it appears in is set in realms/index.js. Format: js/content/README.md.
import { fight, e } from './helpers.js';

export const realm = {
    id: 'crystal_caves', name: 'Crystal Caves',
    blurb: 'A maze of tunnels full of great crystal deposits and little else, if you can stomach a tight squeeze. There is no sign of an entrance, only a way down.',
    look: { sky: '#161c2c', mapBg: '#1b2235', blocks: { grass: [['stone', 4], ['crystal_floor', 1]], dirt: 'gravel_path', wall: 'crystal', water: 'water' } },
    maps: ['crystal_grotto', 'mountain_pass', 'volcano_plateau', 'crossroads'],
    bosses: ['boss_crystal_warden', 'boss_crystal_colossus'],
    // Realms whose fights and events this realm also fields, retuned for its act. Keep the
    // order: seeded runs pick fights from the combined list by position.
    draws: ['crystal_mines', 'crystal_depths'],
};

export const encounters = {
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
        fight('prism_hall', 'Hall of Prisms', 1, [
            e('prism_golem', 'Prism Golem', 'crystal_golem', { tint: '#cfe8ff' }),
            e('shard_spider', 'Shard Spider'),
            e('wolf', 'Crystal Bat', 'crystal_bat', { statMods: { maxHp: -6 } }),
            e('prism_golem', 'Prism Golem', 'crystal_golem', { tint: '#cfe8ff' }),
            e('shard_spider', 'Shard Spider'),
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
            e('orc_captain', 'Crystal Warden', 'crystal_warden', { extraAbilities: ['crystal_slam'], statMods: { maxHp: 60, atk: 5, def: 5, mdf: 3, spd: 1 } }),
            e('wolf', 'Crystal Beast', 'crystal_beast'),
            e('shard_spider', 'Shard Spider'),
            e('kingdom_guard', 'Crystal Golem', 'crystal_golem'),
            e('wolf', 'Crystal Bat', 'crystal_bat'),
        ], { scouting: 'The Crystal Warden keeps the caves with golems and shard spiders. The spiders slow whatever they bite.',
          phases: [
            { at: 0.5, name: 'Crystal Armor', say: 'The Crystal Warden\'s armor hardens, and a bat bursts from the cracks!',
              status: { status: 'protect', duration: 3 },
              summon: [e('wolf', 'Crystal Bat', 'crystal_bat')] },
          ] }),
    ],
};

export const events = [
    {
        id: 'cc_geode', realms: ['crystal_caves', 'crystal_mines'],
        title: 'Humming Geode',
        text: 'A geode the size of a barrel hums with resonant energy. The walls around it chime in answer.',
        choices: [
            { label: 'Crack it open', outcomes: [
                { weight: 2, effect: { gold: 55 }, resultText: 'Raw runite inside. It sells for 55 gold.' },
                { weight: 1, effect: { healPct: -0.15 }, resultText: 'It explodes in a spray of crystal shards.' },
            ] },
            { label: 'Listen to it', effect: { xp: 30 }, resultText: 'The chime settles your minds. Everyone gains 30 XP.' },
        ],
    },

    {
        id: 'cc_dwarven_cache',
        title: 'Dwarven Cache',
        text: 'Behind a crumbled seal, an ancient dwarven storeroom. A strange compass sits embedded in crystal.',
        choices: [
            { label: 'Take the compass', effect: { relic: 'uncommon' }, resultText: 'You feel compelled to keep it. You now carry {relic}.' },
            { label: 'Take the supplies', effect: { gold: 40, item: 'common' }, resultText: 'Old but well kept: 40 gold and {item}.' },
        ],
    },
];
