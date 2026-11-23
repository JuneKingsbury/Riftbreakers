// Fracture Gate: tier 1 of The Unraveling.
//
// `realm` is the realm itself, `encounters` its fights by kind, and `events` the '?' events
// only met here. Which acts it appears in is set in realms/index.js. Format: js/content/README.md.
import { fight, e, OUTDOOR_MAPS } from './helpers.js';

export const realm = {
    id: 'fracture_gate', name: 'Fracture Gate',
    blurb: 'A gate to a fractured realm where every step shifts the walls and floors. Its creatures contort with no true form, sometimes wearing faces you almost recognize.',
    look: { sky: '#241634', mapBg: '#2b1c3c', blocks: { grass: [['grass', 3], ['glyph', 1]], dirt: 'redrock', wall: [['warded_wall', 1], ['wall', 2]] } },
    maps: [...OUTDOOR_MAPS],
};

export const encounters = {
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
        ], {
            scouting: 'The Echo Beast leads a pack of rift-hounds and imps through the broken gate. Imps die fast, so clear them before the beast closes in.',
            phases: [
                { at: 0.5, name: 'Echoing Roar', say: 'The Echo Beast roars, and the rift echoes it back as another hound!', summon: [e('wolf', 'Chaos Hound', 'chaos_hound')] },
            ],
        }),
    ],
};

export const events = [
    {
        id: 'fg_two_chests', realms: ['fracture_gate', 'shifting_labyrinth'],
        title: 'A Chest in Two Places',
        text: 'A chest exists in two places at once. Both are the same chest. Both are slightly different.',
        choices: [
            { label: 'Open the left one', effect: { gold: 70 }, resultText: '70 gold, or possibly 70 of something else that spends like gold.' },
            { label: 'Open the right one', outcomes: [
                { weight: 1, effect: { item: 'uncommon' }, resultText: 'Inside: {item}, which may or may not be from this realm.' },
                { weight: 1, effect: { healPct: -0.1 }, resultText: 'The floor inverts, slamming everyone against the ceiling.' },
            ] },
        ],
    },

    {
        id: 'fg_familiar_face',
        title: 'A Familiar Face',
        text: 'A shifting creature wears a face you swear you recognize. It doesn\'t attack. It waits.',
        choices: [
            { label: 'Speak to it', effect: { xp: 60 }, resultText: 'It answers in your own voice and teaches you something. Everyone gains 60 XP.' },
            { label: 'Strike first', effect: { battle: 'normal' }, resultText: 'Its face changes, and more come.' },
        ],
    },
];
