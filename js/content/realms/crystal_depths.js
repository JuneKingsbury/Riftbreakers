// Crystal Depths: tier 3 of Crystal Caverns.
//
// `realm` is the realm itself, `encounters` its fights by kind, and `events` the '?' events
// only met here. Which acts it appears in is set in realms/index.js. Format: js/content/README.md.
import { fight, e } from './helpers.js';

export const realm = {
    id: 'crystal_depths', name: 'Crystal Depths',
    blurb: 'Vast chambers coated in crystal that glows and pulses with life, the brightest part of the caverns. Its source lies at the heart of the depths.',
    look: { sky: '#18264a', mapBg: '#1d2b4c', blocks: { grass: [['crystal_floor', 3], ['stone', 1]], dirt: 'crystal_floor', wall: 'crystal' } },
    maps: ['crystal_grotto', 'volcano_plateau', 'mountain_pass', 'ruined_temple'],
};

export const encounters = {
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
        ], { scouting: 'The Crystal Colossus is the cave itself, stood up. Its quakes slow the whole party, and runite elementals hurl stone from range.',
          phases: [
            { at: 0.6, name: 'Fracture', say: 'Cracks race across the Colossus. It sheds its broken plates and comes on harder!',
              cleanse: true, buffs: [{ stat: 'atk', value: 4, duration: 5 }, { stat: 'mat', value: 4, duration: 5 }] },
            { at: 0.3, name: 'Shardborn', say: 'A golem tears itself out of the cavern wall to defend the Colossus!',
              summon: [e('kingdom_guard', 'Crystal Golem', 'crystal_golem')] },
          ] }),
    ],
};

export const events = [
    {
        id: 'cd_crystal_heart',
        title: 'Heart-Shaped Formation',
        text: 'A massive runite formation in the shape of a heart pulses in time with the whole cavern.',
        choices: [
            { label: 'Touch it', effect: { memberStatMods: { def: 2 } }, resultText: 'Crystal spines grow along {name}\'s arms, then settle into a hard sheen. +2 DEF.' },
            { label: 'Chip off a piece', effect: { gold: 60, healPct: -0.15 }, resultText: 'The cavern shudders and shards rain down, but the piece sells for 60 gold.' },
        ],
    },
];
