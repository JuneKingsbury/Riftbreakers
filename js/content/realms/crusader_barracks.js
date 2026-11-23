// Crusader Barracks: tier 2 of The Kingdom.
//
// `realm` is the realm itself, `encounters` its fights by kind, and `events` the '?' events
// only met here. Which acts it appears in is set in realms/index.js. Format: js/content/README.md.
import { fight, e } from './helpers.js';

export const realm = {
    id: 'crusader_barracks', name: 'Crusader Barracks',
    blurb: 'The training grounds of the Crusader forces, stocked with weapons and armor. Only a small reserve stands guard, and the barracks are the only way into the castle.',
    look: { sky: '#22222c', mapBg: '#292a36', blocks: { grass: [['cobble', 2], ['dirt', 1]], marble: 'cobble', dirt: 'planks', wall: [['kingdom_wall', 2], ['wood_wall', 1]], bookshelf: 'wood_wall', stone_wall: 'kingdom_wall' } },
    maps: ['crossroads', 'grand_hall', 'ruined_temple'],
};

export const encounters = {
    normal: [
        fight('drill_squad', 'Drill Squad', 2, [
            e('kingdom_guard', 'Crusader', 'crusader'),
            e('raider', 'Recruit', 'kingdom_guard'),
            e('raider', 'Recruit', 'kingdom_guard'),
            e('raider_archer', 'Crusader Archer', 'crusader_archer'),
            e('kingdom_guard', 'Crusader', 'crusader'),
            e('raider_archer', 'Crusader Archer', 'crusader_archer'),
        ]),
        fight('armory_guard', 'Armory Guard', 3, [
            e('kingdom_guard', 'Knight', 'knight'),
            e('runebow', 'Arbalest', 'crusader_archer'),
            e('kingdom_guard', 'Knight', 'knight'),
            e('warden', 'Field Medic', 'high_priest'),
            e('runebow', 'Arbalest', 'crusader_archer'),
            e('spellblade', 'Duelist', 'crusader'),
        ]),
        fight('war_hounds', 'War Hounds', 2, [
            e('wolf', 'War Hound', 'chaos_hound'),
            e('wolf', 'War Hound', 'chaos_hound'),
            e('kingdom_guard', 'Kennel Master', 'crusader'),
            e('wolf', 'War Hound', 'chaos_hound'),
            e('raider_archer', 'Crusader Archer', 'crusader_archer'),
            e('wolf', 'War Hound', 'chaos_hound'),
        ]),
    ],
    elite: [
        fight('crusader_vanguard', 'Crusader Vanguard', 4, [
            e('paladin', 'Vanguard Captain', 'crusader'),
            e('kingdom_guard', 'Knight', 'knight'),
            e('runebow', 'Arbalest', 'crusader_archer'),
            e('sanctifier', 'War Priest', 'high_priest'),
            e('kingdom_guard', 'Knight', 'knight'),
            e('runebow', 'Arbalest', 'crusader_archer'),
        ]),
        fight('battle_mages', 'Battle Mages', 3, [
            e('battlemage', 'Battle Mage', 'royal_mage'),
            e('evoker', 'Royal Mage', 'royal_mage'),
            e('kingdom_guard', 'Shield Bearer', 'kingdom_guard'),
            e('battlemage', 'Battle Mage', 'royal_mage'),
            e('seer', 'Court Seer', 'high_priest'),
            e('kingdom_guard', 'Shield Bearer', 'kingdom_guard'),
        ]),
    ],
    boss: [
        fight('boss_drillmaster', 'The Drillmaster', 4, [
            e('paladin', 'Drillmaster', 'revenant_knight', { level: 5, statMods: { maxHp: 55, atk: 3, def: 4, mdf: 2 } }),
            e('kingdom_guard', 'Crusader', 'crusader'),
            e('runebow', 'Arbalest', 'crusader_archer'),
            e('kingdom_guard', 'Knight', 'knight'),
            e('warden', 'Field Medic', 'high_priest'),
            e('runebow', 'Arbalest', 'crusader_archer'),
        ], {
            scouting: 'The Drillmaster trains the barracks\' best: knights in front, arbalests behind, and a medic to patch them up. Take out the medic first.',
            phases: [
                { at: 0.5, name: 'Close Ranks', say: 'The Drillmaster barks an order, and the line locks shields!', allies: { status: { status: 'protect', duration: 2 } }, summon: [e('kingdom_guard', 'Crusader', 'crusader')] },
            ],
        }),
    ],
};

export const events = [
    {
        id: 'cb_training_dummy',
        title: 'Training Yard',
        text: 'Racks of rune-forged steel stand beside rigged training dummies.',
        choices: [
            { label: 'Train with them', effect: { healPct: -0.15, xp: 75 }, resultText: 'One dummy swings a live blade. Bruised but sharper, everyone gains 75 XP.' },
            { label: 'Strip the weapons rack', effect: { item: 'rare' }, resultText: 'You take {item}.' },
        ],
    },

    {
        id: 'cb_battle_standard',
        title: 'Battle Standard',
        text: 'A battle standard hangs on the barracks wall, its enchantments still potent.',
        choices: [
            { label: 'Tear it down', effect: { relic: 'uncommon' }, resultText: 'It is yours now: {relic}.' },
            { label: 'Burn it', effect: { xp: 60 }, resultText: 'A small blow to the Crusade. Everyone gains 60 XP.' },
        ],
    },
];
