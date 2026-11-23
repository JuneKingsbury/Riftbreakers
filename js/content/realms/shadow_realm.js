// Abyss Gate: tier 1 of The Abyss.
//
// `realm` is the realm itself, `encounters` its fights by kind, and `events` the '?' events
// only met here. Which acts it appears in is set in realms/index.js. Format: js/content/README.md.
import { fight, e } from './helpers.js';

export const realm = {
    id: 'shadow_realm', name: 'Abyss Gate',
    blurb: 'A chasm into the world\'s abyssal depths. Shadowy monsters and plant-like eyes stalk the narrow ledges, harmless only at a distance.',
    look: { sky: '#140f1e', mapBg: '#1c1528', blocks: { grass: [['stone', 2], ['abyss_tile', 1]], dirt: 'redrock', wall: 'abyss_wall', water: 'void_water' } },
    maps: ['mountain_pass', 'sunken_isles', 'volcano_plateau', 'crossroads'],
};

export const encounters = {
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
        ], {
            scouting: 'The Shade Warden watches from the dark with imps and a floating eye. It casts from range and hides behind its stalker.',
            phases: [
                { at: 0.5, name: 'Deepening Dark', say: 'The Shade Warden pulls the shadows close around its servants!', allies: { buffs: [{ stat: 'eva', value: 15, duration: 3 }] }, summon: [e('goblin', 'Shadow Imp')] },
            ],
        }),
    ],
};

export const events = [
    {
        id: 'ag_fading_rift', realms: ['shadow_realm', 'void_abyss'],
        title: 'Fading Rift',
        text: 'A small rift flickers on the ledge, spilling residual energy as it collapses.',
        choices: [
            { label: 'Absorb the energy', effect: { xp: 45, healPct: -0.1 }, resultText: 'It burns going in. 45 XP for every member.' },
            { label: 'Grab what falls out', effect: { item: 'uncommon' }, resultText: 'A pocket dimension collapses, dropping {item}.' },
        ],
    },

    {
        id: 'ag_living_lantern',
        title: 'Eyes in the Stone',
        text: 'Plant-like eyes rooted in the rock follow your every step. One holds a lantern in its tendrils.',
        choices: [
            { label: 'Take the lantern', outcomes: [
                { weight: 2, effect: { relic: 'uncommon' }, resultText: 'It never goes dark. You now carry {relic}.' },
                { weight: 1, effect: { battle: 'normal' }, resultText: 'The eyes close. Things climb out of the dark.' },
            ] },
            { label: 'Calm the eyes', requires: { classes: ['gravecaller', 'seer'] }, effect: { relic: 'uncommon' }, resultText: '{name} murmurs to them until they close. The lantern comes away freely: {relic}.' },
            { label: 'Keep your distance', resultText: 'You keep to the far edge of the ledge, and the eyes lose interest.' },
        ],
    },
];
