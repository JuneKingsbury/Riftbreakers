// Abandoned Laboratory: tier 3 of University Ruins.
//
// `realm` is the realm itself, `encounters` its fights by kind, and `events` the '?' events
// only met here. Which acts it appears in is set in realms/index.js. Format: js/content/README.md.
import { fight, e } from './helpers.js';

export const realm = {
    id: 'abandoned_laboratory', name: 'Abandoned Laboratory',
    blurb: 'A laboratory trapped in time, its halls twisting in ways the building\'s outside can\'t explain. Forms of pure chaos guard the research within.',
    look: { sky: '#1e1830', mapBg: '#251d38', blocks: { grass: [['marble', 3], ['cobble', 1]], dirt: 'glyph', carpet: 'glyph', wall: [['warded_wall', 1], ['brick_wall', 1]], stone_wall: 'warded_wall', water: 'bog', lava: 'bog' } },
    maps: ['grand_hall', 'ruined_temple', 'crystal_grotto'],
    // Correction to the retuned power of its fights when folded into another realm (retuneEncounter).
    retuneBias: { elite: 1.15, boss: 1.5 },
};

export const encounters = {
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
        ], { scouting: 'The Arcane Construct was built to win duels. It strikes hard up close, and a lab abomination lumbers along beside it.',
          phases: [
            { at: 0.5, name: 'Overload', say: 'Overload! The Construct\'s core burns white-hot.',
              status: { status: 'haste', duration: 3 }, buffs: [{ stat: 'atk', value: 5, duration: 4 }, { stat: 'mat', value: 5, duration: 4 }] },
            { at: 0.25, name: 'Failsafe', say: 'A failsafe trips. Dormant constructs lurch back to life!',
              summon: [e('kingdom_guard', 'Arcane Construct', 'construct'), e('kingdom_guard', 'Arcane Construct', 'construct')] },
          ] }),
    ],
};

export const events = [
    {
        id: 'lab_stasis',
        title: 'Stasis Chamber',
        text: 'A mutated specimen floats in a cracked stasis tank. Beside it, a researcher\'s emergency kit.',
        choices: [
            { label: 'Grab the kit', outcomes: [
                { weight: 2, effect: { item: 'rare' }, resultText: 'Under the bandages and a field manual: {item}.' },
                { weight: 1, effect: { battle: 'elite' }, resultText: 'The tank gives way.' },
            ] },
            { label: 'Read the research notes', effect: { xp: 70 }, resultText: 'The researcher\'s work lives on in you. Everyone gains 70 XP.' },
        ],
    },

    {
        id: 'lab_reagents',
        title: 'Unstable Reagents',
        text: 'A shelf of bubbling reagents, labels faded. One is marked, in a shaky hand, "DO NOT".',
        choices: [
            { label: 'Someone drinks the "DO NOT"', effect: { memberStatMods: { mat: 2, maxMp: 6 } }, resultText: '{name} glows faintly for an hour. +2 MAT, +6 max MP.' },
            { label: 'Sell the rest', effect: { gold: 70, healPct: -0.1 }, resultText: 'One combusts on the way out, but the rest fetch 70 gold.' },
        ],
    },
];
