// Unraveling Core: tier 3 of The Unraveling.
//
// `realm` is the realm itself, `encounters` its fights by kind, and `events` the '?' events
// only met here. Which acts it appears in is set in realms/index.js. Format: js/content/README.md.
import { fight, e } from './helpers.js';

export const realm = {
    id: 'unraveling_core', name: 'Unraveling Core',
    blurb: 'A core of pure chaos where the world changes at a moment\'s notice. A gargantuan eye floats at its center, harvesting the core\'s energy.',
    look: {
        sky: '#2a1238', mapBg: '#301a40',
        blocks: {
            grass: [['glyph', 2], ['abyss_tile', 2], ['crystal_floor', 1]],
            stone: [['abyss_tile', 2], ['glyph', 1], ['stone', 1]],
            sand: [['abyss_tile', 1], ['glyph', 1]],
            marble: [['glyph', 1], ['abyss_tile', 1]],
            dirt: 'crystal_floor',
            wall: [['warded_wall', 2], ['void_wall', 1], ['crystal', 1]],
            stone_wall: [['warded_wall', 1], ['void_wall', 1]],
            water: 'void_water',
            lava: 'void_water',
        },
    },
    maps: ['crystal_grotto', 'sunken_isles', 'grand_hall', 'volcano_plateau'],
    // Correction to the retuned power of its fights when folded into another realm (retuneEncounter).
    retuneBias: { normal: 1.1, elite: 1.35, boss: 1.35 },
};

export const encounters = {
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
        ], { scouting: 'The Unraveler pulls at the edges of the world. Echoes of old champions fight for it, and nothing stays where you left it.',
          phases: [
            { at: 0.5, name: 'Reality Frays', say: 'Reality frays. Echoes of fallen champions step out of the seams!',
              summon: [e('void_stalker', 'Echo of a Champion', 'mirror_twin'), e('void_stalker', 'Echo of a Champion', 'mirror_twin')] },
            { at: 0.2, name: 'Rewoven', say: 'The Unraveler pulls its own threads back together.',
              healPct: 0.2, cleanse: true },
          ] }),
    ],
};

export const events = [
    {
        id: 'uc_paradox',
        title: 'Paradox',
        text: 'One of you steps forward and arrives back before they leave. The other one looks equally confused.',
        choices: [
            { label: 'Let them merge', effect: { memberStatMods: { maxHp: 10, spd: 1 } }, resultText: '{name} becomes one person again, with the best of both. +10 max HP, +1 SPD.' },
            { label: 'Walk away quickly', effect: { healPct: -0.1 }, resultText: 'A reality tear cuts across the party on the way out.' },
        ],
    },

    {
        id: 'uc_unravelers_eye', realms: ['unraveling_core', 'shifting_labyrinth'],
        title: 'An Eye in the Wall',
        text: 'An eye is embedded in the wall, watching nothing in particular. It hums with chaotic energy.',
        choices: [
            { label: 'Pry it loose', outcomes: [
                { weight: 1, effect: { relic: 'rare' }, resultText: 'It is still watching. You now carry {relic}.' },
                { weight: 1, effect: { healPct: -0.2 }, resultText: 'The wall closes on your hands.' },
            ] },
            { label: 'Stare back', effect: { xp: 50 }, resultText: 'It blinks first. Everyone gains 50 XP.' },
        ],
    },
];
