// Primeval Canopy: tier 3 of Verdant Wilds.
//
// `realm` is the realm itself, `encounters` its fights by kind, and `events` the '?' events
// only met here. Which acts it appears in is set in realms/index.js. Format: js/content/README.md.
import { fight, e } from './helpers.js';

export const realm = {
    id: 'primeval_canopy', name: 'Primeval Canopy',
    blurb: 'The deepest jungle, where the canopy blocks nearly all light and the snarls of beasts echo through the foliage. At its center, the withered Heartwood spreads spores through its roots.',
    look: { sky: '#102418', mapBg: '#16291c', blocks: { grass: [['moss', 3], ['swamp', 1], ['fungal', 1]], moss: [['moss', 3], ['swamp', 1], ['fungal', 1]], dirt: [['dirt', 1], ['verdant_tile', 1]], wall: 'hedge', water: 'bog' } },
    maps: ['jungle_ruins', 'river_ford', 'mountain_pass', 'ruined_temple'],
};

export const encounters = {
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
        ], { scouting: 'The Ancient Treant wakes when the forest is threatened. It shakes the ground under you, and the canopy above is full of stalkers.' }),
    ],
};

export const events = [
    {
        id: 'pc_world_root',
        title: 'The World-Root',
        text: 'Roots thicker than castle walls converge on a nexus of primal energy. Spores drift up from rotted patches.',
        choices: [
            { label: 'Draw on its power', effect: { memberStatMods: { maxHp: 8 } }, resultText: 'Living wood laces through {name}\'s skin. +8 max HP.' },
            { label: 'Cut away the rot', effect: { healPct: -0.1, xp: 70 }, resultText: 'Hard, filthy work, but the root breathes easier. 70 XP for every member.' },
        ],
    },

    {
        id: 'pc_wasp_nest', realms: ['primeval_canopy', 'verdant_depths'],
        title: 'Hanging Nest',
        text: 'A wasp nest the size of a cart hangs over the only way forward. Something drips from it, golden and thick.',
        choices: [
            { label: 'Raid the honey', outcomes: [
                { weight: 1, effect: { item: 'uncommon', healPct: -0.15 }, resultText: 'Stung everywhere, but inside the comb is {item}.' },
                { weight: 1, effect: { battle: 'normal' }, resultText: 'The nest wakes, and so does everything nearby.' },
            ] },
            { label: 'Sneak beneath it', effect: { xp: 20 }, resultText: 'Slow and silent. Everyone gains 20 XP.' },
        ],
    },
];
