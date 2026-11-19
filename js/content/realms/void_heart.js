// Void Heart: tier 3 of The Void Pact.
//
// `realm` is the realm itself, `encounters` its fights by kind, and `events` the '?' events
// only met here. Which acts it appears in is set in realms/index.js. Format: js/content/README.md.
import { fight, e } from './helpers.js';

export const realm = {
    id: 'void_heart', name: 'Void Heart',
    blurb: 'The heart of the Void. Its penitents are nothing but skin and bone now, remade into better tools for their creditor.',
    look: { sky: '#160c22', mapBg: '#20142e', blocks: { grass: [['abyss_tile', 3], ['glyph', 1]], marble: 'abyss_tile', sand: 'abyss_tile', carpet: 'glyph', dirt: 'glyph', wall: 'warded_wall', stone_wall: 'warded_wall', bookshelf: 'void_wall', water: 'void_water' } },
    maps: ['grand_hall', 'sunken_isles', 'ruined_temple'],
};

export const encounters = {
    normal: [
        fight('penitent_guard', 'Penitent Guard', 4, [
            e('kingdom_guard', 'Penitent Guardian', 'penitent_guardian'),
            e('void_stalker', 'Void Penitent', 'void_penitent'),
            e('kingdom_guard', 'Penitent Guardian', 'penitent_guardian'),
            e('void_stalker', 'Void Penitent', 'void_penitent'),
            e('shadow_mage', 'Void Acolyte', 'void_acolyte'),
            e('void_stalker', 'Void Penitent', 'void_penitent'),
        ]),
        fight('void_touched', 'Void-Touched', 5, [
            e('riftcaller', 'Void Caller', 'void_acolyte'),
            e('void_stalker', 'Void Champion'),
            e('spiritbinder', 'Soul Binder', 'shade'),
            e('void_walker', 'Void Walker'),
            e('void_stalker', 'Void Champion'),
            e('spectral_wisp', 'Rift Wisp', 'ghost'),
        ]),
        fight('ledger_keepers', 'Ledger Keepers', 5, [
            e('fatebinder', 'Ledger Keeper', 'void_broker'),
            e('kingdom_guard', 'Void Sentinel', 'void_sentinel'),
            e('void_stalker', 'Void Penitent', 'void_penitent'),
            e('fatebinder', 'Ledger Keeper', 'void_broker'),
            e('kingdom_guard', 'Void Sentinel', 'void_sentinel'),
            e('void_stalker', 'Void Penitent', 'void_penitent'),
        ]),
    ],
    elite: [
        fight('heralds_of_the_void', 'Heralds of the Void', 6, [
            e('riftcaller', 'Void Herald', 'void_herald'),
            e('void_stalker', 'Void Champion'),
            e('kingdom_guard', 'Penitent Guardian', 'penitent_guardian'),
            e('shadow_mage', 'Void Sorcerer', 'void_acolyte'),
            e('void_stalker', 'Void Champion'),
            e('void_walker', 'Void Walker'),
        ]),
        fight('arbiters_tithe', 'The Arbiter\'s Tithe', 6, [
            e('paladin', 'Tithe Knight', 'void_sentinel'),
            e('fatebinder', 'Ledger Keeper', 'void_broker'),
            e('void_stalker', 'Void Penitent', 'void_penitent'),
            e('lifeseer', 'Penitent Mender', 'void_acolyte'),
            e('void_stalker', 'Void Penitent', 'void_penitent'),
            e('raider_hexer', 'Pact Hexer', 'void_acolyte'),
        ]),
    ],
    boss: [
        fight('boss_void_arbiter', 'The Void Arbiter', 6, [
            e('fatebinder', 'Void Arbiter', 'boss_void_arbiter', { level: 8, statMods: { maxHp: 80, mat: 5, mdf: 5, def: 3 } }),
            e('void_stalker', 'Void Champion'),
            e('kingdom_guard', 'Penitent Guardian', 'penitent_guardian'),
            e('void_walker', 'Void Walker'),
            e('riftcaller', 'Void Herald', 'void_herald'),
            e('void_stalker', 'Void Champion'),
        ], { scouting: 'The Void Arbiter weighs every debt. A herald tears rifts open for it, and its champions collect.',
          phases: [
            { at: 0.5, name: 'Judgment', say: 'Judgment! The Void Arbiter casts off every curse laid on it.',
              cleanse: true, buffs: [{ stat: 'mat', value: 5, duration: 5 }, { stat: 'mdf', value: 5, duration: 5 }],
              summon: [e('void_walker', 'Void Walker')] },
            { at: 0.25, name: 'Final Verdict', say: 'The Arbiter speeds toward its final verdict.',
              status: { status: 'haste', duration: 3 } },
          ] }),
    ],
};

export const events = [
    {
        id: 'vheart_tribute',
        title: 'Uncollected Tribute',
        text: 'At the very heart of the void, a tribute sits uncollected before a door with no lock. Beside it lies the Pact\'s own ledger, every debt it is owed written in a careful hand.',
        choices: [
            { label: 'Collect it', outcomes: [
                { weight: 2, effect: { gold: 80 }, resultText: 'Nobody stops you. 80 gold.' },
                { weight: 1, effect: { gold: 40, healPct: -0.2 }, resultText: 'A clause you never read takes effect and drains everyone. You keep 40 gold.' },
            ] },
            { label: 'Burn a page of the ledger', effect: { memberStatMods: { atk: 2, mat: 2 } }, resultText: 'The flames leap to {name}, who feels lighter and freer. +2 ATK, +2 MAT.' },
        ],
    },
];
