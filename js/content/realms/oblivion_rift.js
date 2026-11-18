// Oblivion Rift: tier 3 of The Abyss.
//
// `realm` is the realm itself, `encounters` its fights by kind, and `events` the '?' events
// only met here. Which acts it appears in is set in realms/index.js. Format: js/content/README.md.
import { fight, e } from './helpers.js';

export const realm = {
    id: 'oblivion_rift', name: 'Oblivion Rift',
    blurb: 'Where the abyssal ocean plunges over a vast waterfall into blackness. Beyond the rift gate stands a castle of black stone, home to the master of the abyss.',
    look: { sky: '#0e0a18', mapBg: '#191226', blocks: { grass: 'abyss_tile', marble: 'abyss_tile', sand: 'stone', dirt: 'stone', wall: 'void_wall', stone_wall: 'void_wall', bookshelf: 'void_wall', water: 'void_water' } },
    maps: ['sunken_isles', 'ruined_temple', 'grand_hall'],
    // Correction to the retuned power of its fights when folded into another realm (retuneEncounter).
    retuneBias: { boss: 1.35 },
};

export const encounters = {
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
        ], { scouting: 'The Oblivion Sovereign commands spirits and void champions. Strike quickly: the longer the fight, the more it binds.' }),
    ],
};

export const events = [
    {
        id: 'or_waterfall',
        title: 'Edge of the World',
        text: 'The abyssal ocean pours over the edge into blackness. Fragments of a destroyed world tumble past.',
        choices: [
            { label: 'Salvage a fragment', outcomes: [
                { weight: 1, effect: { relic: 'uncommon' }, resultText: 'You pull {relic} from the wreckage of another world.' },
                { weight: 1, effect: { healPct: -0.25 }, resultText: 'Colliding fragments crush the ledge you stand on.' },
            ] },
            { label: 'Stare into it', effect: { xp: 60, healPct: -0.1 }, resultText: 'For a moment you understand. It hurts. Everyone gains 60 XP.' },
        ],
    },

    {
        id: 'or_sovereign_gaze',
        title: 'A Silent Gaze',
        text: 'The Sovereign\'s attention turns briefly toward your party. Even partial focus is agony.',
        choices: [
            { label: 'Endure it', effect: { healPct: -0.2, memberStatMods: { mdf: 2 } }, resultText: 'Everyone suffers. {name} stares back and comes away hardened. +2 MDF.' },
            { label: 'Hide in the black stone', effect: { gold: 50 }, resultText: 'You wait it out in a collapsed vault and find 50 gold in the dark.' },
        ],
    },
];
