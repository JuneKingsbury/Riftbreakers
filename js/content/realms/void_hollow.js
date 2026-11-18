// Void Hollow: tier 1 of The Void Pact.
//
// `realm` is the realm itself, `encounters` its fights by kind, and `events` the '?' events
// only met here. Which acts it appears in is set in realms/index.js. Format: js/content/README.md.
import { fight, e } from './helpers.js';

export const realm = {
    id: 'void_hollow', name: 'Void Hollow',
    blurb: 'A place darker than the pits of the abyss, where the air swallows lantern light within a few paces. The only way forward is to find a wall and follow it.',
    look: { sky: '#0c0c14', mapBg: '#16162a', blocks: { grass: [['stone', 2], ['abyss_tile', 1]], dirt: 'abyss_tile', wall: 'void_wall', water: 'void_water' } },
    maps: ['crossroads', 'mountain_pass', 'ruined_temple'],
    // Correction to the retuned power of its fights when folded into another realm (retuneEncounter).
    retuneBias: { elite: 0.8 },
};

export const encounters = {
    normal: [
        fight('dark_crawlers', 'Things in the Dark', 1, [
            e('wolf', 'Darkling', 'shade_wraith', { statMods: { maxHp: -6 } }),
            e('goblin', 'Hollow Imp', 'shadow_imp'),
            e('wolf', 'Darkling', 'shade_wraith', { statMods: { maxHp: -6 } }),
            e('goblin', 'Hollow Imp', 'shadow_imp'),
            e('wolf', 'Darkling', 'shade_wraith', { statMods: { maxHp: -6 } }),
            e('goblin', 'Hollow Imp', 'shadow_imp'),
        ], { easy: true }),
        fight('lightless_hunters', 'Lightless Hunters', 1, [
            e('void_walker', 'Void Walker', null, { statMods: { maxHp: -8, mat: -2 } }),
            e('wolf', 'Darkling', 'shade_wraith'),
            e('raider_archer', 'Blind Archer', 'void_penitent'),
            e('void_walker', 'Void Walker', null, { statMods: { maxHp: -8, mat: -2 } }),
            e('wolf', 'Darkling', 'shade_wraith'),
            e('raider_archer', 'Blind Archer', 'void_penitent'),
        ]),
        fight('debtors', 'Runaway Debtors', 1, [
            e('raider', 'Desperate Debtor', 'void_penitent'),
            e('raider_hexer', 'Pact Hexer', 'void_acolyte'),
            e('raider', 'Desperate Debtor', 'void_penitent'),
            e('raider_archer', 'Debtor Archer', 'void_penitent'),
            e('raider', 'Desperate Debtor', 'void_penitent'),
            e('raider_hexer', 'Pact Hexer', 'void_acolyte'),
        ]),
    ],
    elite: [
        fight('hollow_cult', 'Hollow Cult', 2, [
            e('shadow_mage', 'Cultist', 'void_acolyte'),
            e('void_walker', 'Void Wraith'),
            e('raider', 'Zealot', 'void_penitent'),
            e('spectral_wisp', 'Lost Soul', 'ghost'),
            e('void_walker', 'Void Wraith'),
            e('shadow_mage', 'Cultist', 'void_acolyte'),
        ]),
        fight('funnel_watchers', 'Funnel Watchers', 2, [
            e('orc_captain', 'Hollow Brute', 'void_brute'),
            e('void_walker', 'Void Walker'),
            e('wolf', 'Darkling', 'shade_wraith'),
            e('raider_hexer', 'Pact Hexer', 'void_acolyte'),
            e('wolf', 'Darkling', 'shade_wraith'),
            e('void_walker', 'Void Walker'),
        ]),
    ],
    boss: [
        fight('boss_hollow_sentinel', 'The Hollow Sentinel', 2, [
            e('orc_captain', 'Hollow Sentinel', 'hollow_sentinel', { statMods: { maxHp: 45, atk: 3, def: 4, mdf: 2 } }),
            e('void_walker', 'Void Walker'),
            e('wolf', 'Darkling', 'shade_wraith'),
            e('raider_hexer', 'Pact Hexer', 'void_acolyte'),
            e('wolf', 'Darkling', 'shade_wraith'),
        ]),
    ],
};

export const events = [
    {
        id: 'vh_ledger', realms: ['void_hollow', 'void_sanctum'],
        title: 'Open Ledger',
        text: 'A ledger lies open on a stone table. Every entry is a price. One line has your names on it, and a blank space beside them.',
        choices: [
            { label: 'Sign it', effect: { gold: 90, healPct: -0.2 }, resultText: 'Gold appears in your packs: 90 of it. Something is collected in return.' },
            { label: 'Tear out the page', effect: { xp: 40 }, resultText: 'The ink screams. Everyone gains 40 XP.' },
        ],
    },

    {
        id: 'vh_wall_walk',
        title: 'Following the Wall',
        text: 'Lantern light dies within a few paces. The only way forward is a hand on the wall.',
        choices: [
            { label: 'Keep walking', outcomes: [
                { weight: 2, effect: { item: 'uncommon' }, resultText: 'Your fingers find a niche, and in it {item}.' },
                { weight: 1, effect: { healPct: -0.15 }, resultText: 'Something brushes against you and drains a little life from everyone.' },
            ] },
            { label: 'Light a magical flame', effect: { xp: 25 }, resultText: 'It barely helps, but you learn how the dark moves. Everyone gains 25 XP.' },
        ],
    },
];
