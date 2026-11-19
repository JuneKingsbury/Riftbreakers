// Shifting Labyrinth: tier 2 of The Unraveling.
//
// `realm` is the realm itself, `encounters` its fights by kind, and `events` the '?' events
// only met here. Which acts it appears in is set in realms/index.js. Format: js/content/README.md.
import { fight, e, OUTDOOR_MAPS } from './helpers.js';

export const realm = {
    id: 'shifting_labyrinth', name: 'Shifting Labyrinth',
    blurb: 'The chaos grows stronger and the shifting walls become a labyrinth. One moment a creature looks like a person, the next an animal, the next something else entirely.',
    look: {
        sky: '#20183a', mapBg: '#281e40',
        blocks: {
            grass: [['cobble', 2], ['moss', 2], ['marble', 1], ['abyss_tile', 1]],
            moss: [['moss', 2], ['cobble', 1], ['abyss_tile', 1]],
            marble: [['marble', 2], ['moss', 1], ['cobble', 1]],
            dirt: [['planks', 1], ['brick', 1]],
            wall: [['stone_wall', 2], ['hedge', 1], ['bookshelf', 1], ['warded_wall', 1]],
            stone_wall: [['stone_wall', 2], ['hedge', 1], ['bookshelf', 1]],
        },
    },
    maps: [...OUTDOOR_MAPS, 'grand_hall', 'jungle_ruins'],
    bosses: ['boss_shifting_horror', 'boss_unraveler'],
    // Realms whose fights and events this realm also fields, retuned for its act. Keep the
    // order: seeded runs pick fights from the combined list by position.
    draws: ['fracture_gate', 'unraveling_core'],
    // Its fights were written for act 3, before it moved to a later act (see shiftLevels in run/data/encounters.js).
    writtenFor: 3,
};

export const encounters = {
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
        fight('mirror_maze', 'Mirror Maze', 4, [
            e('echo_mimic', 'Echo Mimic', 'mirror_twin', { tint: '#e0c0ff' }),
            e('void_walker', 'Void Walker'),
            e('echo_mimic', 'Echo Mimic', 'mirror_twin', { tint: '#e0c0ff' }),
            e('shadow_mage', 'Fracture Wraith', 'fracture_wraith'),
            e('void_stalker', 'Rift Crawler', 'glitch_beast'),
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
        ], { scouting: 'The Shifting Horror never keeps one shape for long. Echo beasts run ahead of it, and the wraiths behind it blink through rifts.',
          phases: [
            { at: 0.66, name: 'Split', say: 'The Shifting Horror tears off a piece of itself, and the piece gets up!',
              summon: [e('canopy_stalker', 'Echo Beast', 'echo_beast')] },
            { at: 0.33, name: 'Split Again', say: 'Again the Horror splits, faster now.',
              summon: [e('canopy_stalker', 'Echo Beast', 'echo_beast')], status: { status: 'haste', duration: 3 } },
          ] }),
    ],
};

export const events = [
    {
        id: 'sl_still_room',
        title: 'The Still Room',
        text: 'A perfectly calm room in the middle of the chaos. It wasn\'t here a moment ago.',
        choices: [
            { label: 'Rest here', effect: { healPct: 1, xp: 20 }, resultText: 'For an hour, nothing moves. Everyone heals and gains 20 XP.' },
            { label: 'Search it', effect: { relic: 'uncommon' }, resultText: 'The labyrinth has been carrying {relic} around. Now you are.' },
        ],
    },
];
