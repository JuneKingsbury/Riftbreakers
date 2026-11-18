// Kingdom Outskirts: tier 1 of The Kingdom.
//
// `realm` is the realm itself, `encounters` its fights by kind, and `events` the '?' events
// only met here. Which acts it appears in is set in realms/index.js. Format: js/content/README.md.
import { fight, e } from './helpers.js';

export const realm = {
    id: 'kingdom_outskirts', name: 'Kingdom Outskirts',
    blurb: 'Cleared forests and farmland at the edge of the human kingdoms. Soldiers patrol the roads, making a peaceful journey to the castle gates nearly impossible.',
    look: { sky: '#1c2a3c', mapBg: '#203043', blocks: { grass: [['grass', 3], ['autumn', 1]], dirt: 'gravel_path', wall: 'stone_wall' } },
    maps: ['crossroads', 'river_ford', 'mountain_pass', 'volcano_plateau'],
    // Correction to the retuned power of its fights when folded into another realm (retuneEncounter).
    retuneBias: { elite: 1.35 },
};

export const encounters = {
    normal: [
        fight('angry_villagers', 'Angry Villagers', 1, [
            e('novice', 'Villager', 'npc_ally'),
            e('novice', 'Villager', 'npc_ally'),
            e('raider_archer', 'Hunter'),
            e('novice', 'Villager', 'npc_ally'),
            e('boar', 'Farm Boar'),
            e('novice', 'Villager', 'npc_ally'),
        ], { easy: true }),
        fight('road_patrol', 'Road Patrol', 1, [
            e('kingdom_guard', 'Kingdom Guard', null, { statMods: { maxHp: -12, atk: -2 } }),
            e('raider_archer', 'Patrol Archer', 'crusader_archer'),
            e('kingdom_guard', 'Kingdom Guard', null, { statMods: { maxHp: -12, atk: -2 } }),
            e('raider', 'Militia', 'npc_defecting_soldier'),
            e('raider_archer', 'Patrol Archer', 'crusader_archer'),
            e('raider', 'Militia', 'npc_defecting_soldier'),
        ]),
        fight('forest_wardens', 'Forest Wardens', 1, [
            e('raider_archer', 'Forester', 'crusader_archer'),
            e('wolf', 'Hunting Hound'),
            e('raider_archer', 'Forester', 'crusader_archer'),
            e('raider', 'Woodcutter', 'npc_defecting_soldier'),
            e('wolf', 'Hunting Hound'),
            e('evoker', 'Court Apprentice', 'royal_mage'),
        ]),
    ],
    elite: [
        fight('knights_errant', 'Knights Errant', 2, [
            e('orc_captain', 'Knight', 'knight', { statMods: { maxHp: -10 } }),
            e('kingdom_guard', 'Squire', 'kingdom_guard'),
            e('raider_hexer', 'Royal Mage', 'royal_mage'),
            e('orc_captain', 'Knight', 'knight', { statMods: { maxHp: -10 } }),
            e('raider_archer', 'Crossbowman', 'crusader_archer'),
            e('kingdom_guard', 'Squire', 'kingdom_guard'),
        ]),
        fight('tax_collectors', 'Tax Collectors', 2, [
            e('orc_captain', 'Reeve', 'knight', { statMods: { maxHp: -15 } }),
            e('raider_archer', 'Bailiff', 'crusader_archer'),
            e('raider', 'Enforcer', 'kingdom_guard'),
            e('raider_hexer', 'Clerk-Mage', 'royal_mage'),
            e('raider', 'Enforcer', 'kingdom_guard'),
            e('raider_archer', 'Bailiff', 'crusader_archer'),
        ]),
    ],
    boss: [
        fight('boss_road_captain', 'The Road Captain', 2, [
            e('orc_captain', 'Road Captain', 'knight', { statMods: { maxHp: 60, atk: 6, def: 4, spd: 3 } }),
            e('raider_archer', 'Patrol Archer', 'crusader_archer'),
            e('raider_hexer', 'Royal Mage', 'royal_mage'),
            e('kingdom_guard', 'Kingdom Guard'),
            e('raider_archer', 'Patrol Archer', 'crusader_archer'),
        ]),
    ],
};

export const events = [
    {
        id: 'ko_supply_wagon', realms: ['kingdom_outskirts', 'crusader_barracks'],
        title: 'Supply Wagon',
        text: 'A Crusader supply wagon sits at the roadside, its driver asleep in the hay.',
        choices: [
            { label: 'Raid it', outcomes: [
                { weight: 2, effect: { gold: 70, item: 'uncommon' }, resultText: 'You slip away with 70 gold and {item}.' },
                { weight: 1, effect: { battle: 'normal' }, resultText: 'An alarm bell clangs. Soldiers come running.' },
            ] },
            { label: 'Let them sleep', resultText: 'You walk on past the snoring driver.' },
        ],
    },

    {
        id: 'ko_villagers',
        title: 'Laboring Villagers',
        text: 'Villagers bring in the harvest. A farmer waves you over: "You don\'t look like soldiers."',
        choices: [
            { label: 'Help with the harvest', effect: { xp: 50, gold: 50 }, resultText: 'Honest work. They pay 50 gold, and every member gains 50 XP.' },
            { label: 'Ask about the patrols', effect: { healPct: 1 }, resultText: 'They hide you in a barn for the night. Everyone rests.' },
        ],
    },
];
