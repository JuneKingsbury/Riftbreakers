// Fungal Hollows: tier 2 of Verdant Wilds.
//
// `realm` is the realm itself, `encounters` its fights by kind, and `events` the '?' events
// only met here. Which acts it appears in is set in realms/index.js. Format: js/content/README.md.
import { fight, e } from './helpers.js';

export const realm = {
    id: 'fungal_hollows', name: 'Fungal Hollows',
    blurb: 'Jungle overrun by fungal growth. The trees rot away into clearings of gigantic mushrooms under a foggy purple haze, and fungal horrors poison any who linger.',
    look: { sky: '#26182e', mapBg: '#2a1d33', blocks: { grass: [['fungal', 3], ['swamp', 2]], moss: [['fungal', 3], ['swamp', 2]], dirt: 'swamp', wall: 'hedge', water: 'bog' } },
    maps: ['jungle_ruins', 'river_ford', 'volcano_plateau', 'crossroads'],
};

export const encounters = {
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
        ], {
            scouting: 'The Bog Witch tends a garden of spores and bound spirits. Her brood heals itself while she curses from the back, so get to her fast.',
            phases: [
                { at: 0.5, name: 'Rot Bloom', say: 'The Bog Witch sinks her hands into the mud, and the spores answer!', healPct: 0.15, summon: [e('spore_walker', 'Spore Walker')] },
            ],
        }),
    ],
};

export const events = [
    {
        id: 'fh_puffball',
        title: 'Puffball Field',
        text: 'Phosphorescent caps pulse along the path. A fungal garden, tended by some long-gone cultivator, glows beyond them.',
        choices: [
            { label: 'Harvest the garden', outcomes: [
                { weight: 1, effect: { gold: 60 }, resultText: 'Giant truffles. A fortune to the right cook: 60 gold.' },
                { weight: 1, effect: { gold: 30, healPct: -0.15 }, resultText: 'A puffball bursts in your faces and everyone chokes on spores. You still salvage 30 gold of fungi.' },
            ] },
            { label: 'Harvest it properly', requires: { classes: ['alchemist'] }, effect: { gold: 60 }, resultText: '{name} knows which caps to cut and which to leave. 60 gold of truffles, and nobody coughs.' },
            { label: 'Hold your breath and hurry past', resultText: 'You make it through without a cough.' },
        ],
    },

    {
        id: 'fh_symbiote',
        title: 'Fungal Crown',
        text: 'A ring of mushrooms grows as you watch, forming a crown around a mossy skull.',
        choices: [
            { label: 'Let someone wear it', effect: { memberStatMods: { mat: 2 } }, resultText: 'The crown takes root in {name}\'s hair. Their thoughts sharpen: +2 MAT.' },
            { label: 'Burn it', effect: { xp: 30 }, resultText: 'It shrieks as it burns. Everyone gains 30 XP.' },
        ],
    },
];
