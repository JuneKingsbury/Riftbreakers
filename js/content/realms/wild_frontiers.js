// The Wild Frontiers: tier 1 of The Wild Frontiers.
//
// `realm` is the realm itself, `encounters` its fights by kind, and `events` the '?' events
// only met here. Which acts it appears in is set in realms/index.js. Format: js/content/README.md.
import { OUTDOOR_MAPS } from './helpers.js';

export const realm = {
    id: 'wild_frontiers', name: 'The Wild Frontiers',
    blurb: 'Untouched wilderness, much like the lands the settlement was founded on. Beasts roam freely, and bandit camps have spread as the Crusade pushes more people from their homes.',
    look: { sky: '#1a2a3a', mapBg: '#1d2a33', blocks: { grass: [['grass', 5], ['moss', 1]] } },
    maps: OUTDOOR_MAPS,
    bosses: ['boss_bandit_king', 'boss_dire_wolf'],
    // Realms whose fights and events this realm also fields (none: only its own).
    draws: [],
};

export const encounters = {
    normal: [
        { id: 'bandit_ambush', name: 'Bandit Ambush', enemyLevel: 1, roster: [
            { job: 'raider', name: 'Bandit', ct: 20 },
            { job: 'raider', name: 'Bandit', ct: 50 },
            { job: 'raider_archer', name: 'Bandit Archer', ct: 5 },
            { job: 'raider_hexer', name: 'Bandit Hexer', sprite: 'raider_poisoner', ct: 35 },
            { job: 'raider_archer', name: 'Bandit Archer', ct: 25 },
            { job: 'raider', name: 'Bandit', ct: 65 },
        ] },
        { id: 'wolf_pack', name: 'Wolf Pack', enemyLevel: 1, roster: [
            { job: 'wolf', name: 'Gray Wolf', ct: 20 },
            { job: 'wolf', name: 'Gray Wolf', ct: 55 },
            { job: 'boar', name: 'Wild Boar', ct: 25 },
            { job: 'wolf', name: 'Gray Wolf', ct: 35 },
            { job: 'boar', name: 'Wild Boar', ct: 60 },
            { job: 'wolf', name: 'Gray Wolf', ct: 5 },
        ] },
        { id: 'goblin_raid', name: 'Goblin Raid', enemyLevel: 1, easy: true, roster: [
            { job: 'goblin', name: 'Goblin', ct: 10 },
            { job: 'goblin', name: 'Goblin', ct: 40 },
            { job: 'goblin', name: 'Goblin', ct: 60 },
            { job: 'raider_archer', name: 'Goblin Slinger', ct: 30 },
            { job: 'goblin', name: 'Goblin', ct: 20 },
            { job: 'goblin', name: 'Goblin', ct: 50 },
        ] },
        { id: 'spore_hollow', name: 'Spore Hollow', enemyLevel: 1, easy: true, roster: [
            { job: 'spore_walker', name: 'Spore Walker', ct: 10 },
            { job: 'shard_spider', name: 'Shard Spider', ct: 40 },
            { job: 'wolf', name: 'Marsh Wolf', ct: 20 },
            { job: 'spore_walker', name: 'Spore Walker', ct: 60 },
            { job: 'shard_spider', name: 'Shard Spider', ct: 30 },
            { job: 'wolf', name: 'Marsh Wolf', ct: 55 },
        ] },
        { id: 'deserters', name: 'Deserters', enemyLevel: 1, easy: true, roster: [
            { job: 'novice', name: 'Deserter', sprite: 'npc_defecting_soldier', ct: 15 },
            { job: 'raider_archer', name: 'Deserter Archer', ct: 40 },
            { job: 'evoker', name: 'Hedge Mage', sprite: 'npc_lost_scholar', ct: 30 },
            { job: 'novice', name: 'Deserter', sprite: 'npc_defecting_soldier', ct: 55 },
            { job: 'raider', name: 'Sellsword', ct: 25 },
            { job: 'novice', name: 'Deserter', sprite: 'npc_defecting_soldier', ct: 5 },
        ] },
    ],
    elite: [
        { id: 'thornwood_stalkers', name: 'Thornwood Stalkers', enemyLevel: 2, roster: [
            { job: 'canopy_stalker', name: 'Thornwood Cat', ct: 20, statMods: { atk: -3 } },
            { job: 'thorn_beast', name: 'Thorn Beast', ct: 45 },
            { job: 'boar', name: 'Thornboar', ct: 5 },
            { job: 'wolf', name: 'Thornwood Wolf', ct: 35 },
            { job: 'thorn_beast', name: 'Thorn Beast', ct: 10 },
            { job: 'canopy_stalker', name: 'Thornwood Cat', ct: 55 },
        ] },
        { id: 'raider_warband', name: 'Raider Warband', enemyLevel: 2, roster: [
            { job: 'orc_captain', name: 'Raid Leader', sprite: 'raider_brute', ct: 20 },
            { job: 'raider_hexer', name: 'Raider Hexer', ct: 35 },
            { job: 'raider_archer', name: 'Raider Archer', ct: 5 },
            { job: 'raider', name: 'Raider', ct: 50 },
            { job: 'raider_archer', name: 'Raider Archer', ct: 25 },
            { job: 'raider', name: 'Raider', ct: 65 },
        ] },
    ],
    boss: [
        { id: 'boss_bandit_king', name: 'The Bandit King', enemyLevel: 2,
            scouting: 'The Bandit King holds court on the road, with archers on the flanks and a hexer at his ear. Cut down his bodyguards before they close in.',
            roster: [
            { job: 'orc_captain', name: 'Bandit King', sprite: 'raider_brute', ct: 30, statMods: { maxHp: 40, atk: 3, def: 2, spd: 1 } },
            { job: 'raider_archer', name: 'Royal Archer', ct: 10 },
            { job: 'raider_hexer', name: 'Court Hexer', ct: 40 },
            { job: 'raider', name: 'Bodyguard', ct: 20 },
            { job: 'raider', name: 'Bodyguard', ct: 50 },
        ] },
        { id: 'boss_dire_wolf', name: 'The Dire Wolf', enemyLevel: 2,
            scouting: 'The Dire Wolf hunts with its pack and an old boar called Tusk. Wolves bite at the legs to slow you, so keep the party together.',
            roster: [
            { job: 'canopy_stalker', name: 'Dire Wolf', sprite: 'wolf', tint: '#6a6272', ct: 30, statMods: { maxHp: 50, atk: 3, def: 3 } },
            { job: 'wolf', name: 'Pack Wolf', ct: 10 },
            { job: 'wolf', name: 'Pack Wolf', ct: 40 },
            { job: 'boar', name: 'Old Tusk', ct: 20 },
            { job: 'wolf', name: 'Pack Wolf', ct: 55 },
        ] },
    ],
};

export const events = [
    {
        id: 'wf_overgrown_trail',
        title: 'Overgrown Trail',
        text: 'Your scouts find a half-overgrown trail leading deeper into the wilds. A collapsed lean-to sits where it forks.',
        choices: [
            { label: 'Search the lean-to', effect: { gold: 25, item: 'common' }, resultText: 'Under the fallen roof: 25 gold and {item}, left by an earlier traveler.' },
            { label: 'Follow the game trail', outcomes: [
                { weight: 2, effect: { healPct: 1, xp: 20 }, resultText: 'It ends in a quiet clearing by a stream. Everyone rests, recovers and gains 20 XP.' },
                { weight: 1, effect: { healPct: -0.1 }, resultText: 'A hunter\'s snare snaps shut on the lead walker. Nobody is badly hurt, but it stings.' },
            ] },
        ],
    },

    {
        id: 'wf_ritual_site',
        title: 'Old Ritual Site',
        text: 'Standing stones ring a patch of scorched earth. Amid the rubble, something glints.',
        choices: [
            { label: 'Dig through the rubble', effect: { relic: 'common' }, resultText: 'You uncover {relic}, still warm from whatever happened here.' },
            { label: 'Leave it undisturbed', effect: { xp: 25 }, resultText: 'You study the carvings instead. Everyone gains 25 XP.' },
        ],
    },

    {
        id: 'wf_refugees',
        title: 'Displaced Family',
        text: 'A family driven from home by the Crusade has stopped by the trail, everything they own piled on one cart.',
        choices: [
            { label: 'Share your supplies', effect: { healPct: -0.05, xp: 30 }, resultText: 'Lean rations tonight, but their stories of the Crusade are worth hearing. 30 XP for every member.' },
            { label: 'Point them to the settlement', effect: { gold: 20 }, resultText: 'They press 20 gold on you for the directions.' },
        ],
    },

    {
        id: 'wf_blight_bloom',
        title: 'Blight Bloom',
        text: 'A swollen purple flower pulses at the edge of the clearing. The grass around it is grey and dead.',
        choices: [
            { label: 'Burn it out', effect: { xp: 35 }, resultText: 'It pops and hisses in the fire. Every member gains 35 XP.' },
            { label: 'Harvest the spores', outcomes: [
                { weight: 2, effect: { gold: 45 }, resultText: 'An alchemist will pay well for these: 45 gold.' },
                { weight: 1, effect: { healPct: -0.15 }, resultText: 'The bloom bursts. Everyone coughs for an hour.' },
            ] },
        ],
    },

    {
        id: 'wf_hedge_mages',
        title: 'Hedge Mages\' Camp',
        text: 'A circle of wagons painted with runes. The hedge mages inside eye your weapons, then your purses.',
        choices: [
            { label: 'Buy a charm (50 gold)', requires: { gold: 50 }, effect: { gold: -50, relic: 'common' }, resultText: 'They hand over {relic} and count your coins twice.' },
            { label: 'Trade stories', effect: { xp: 25 }, resultText: 'They know a few tricks worth hearing. Everyone gains 25 XP.' },
        ],
    },
];
