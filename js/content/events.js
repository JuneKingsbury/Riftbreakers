// General events: '?' events that can be met in any realm (or, with `chains`, only out on the
// road). Events only met in one realm live in that realm's file (realms/<realm>.js).
// Every field is described in vocab.js (SCHEMAS.event); in short:
//
// event: { id, title, text, acts?, chains?, choices: [choice] }
//   acts     Acts the event can appear in (default: all)
//   chains   Realm chains (realms/index.js) the event fits, for events set outdoors on the
//            road (default: all)
//   choice:  { label, requires?, effect?, resultText?, outcomes? }
//     requires  { gold?: n, items?: n }: the choice is disabled unless met
//     outcomes  [{ weight, effect, resultText }]: one is rolled instead of effect/resultText
//   effect: gold, healPct, xp, item, relic, loseItem, memberStatMods, battle (see SCHEMAS.event)
// resultText may use {name} (the member chosen by memberStatMods), {item} and {relic}.

// Chains with open country and roads.
const ROADS = ['wild_frontiers', 'verdant_wilds', 'the_kingdom'];

export const GENERAL_EVENTS = [
    {
        id: 'wounded_traveller',
        chains: ROADS,
        title: 'Wounded Traveler',
        text: 'A wounded merchant slumps against a mile-marker, their saddlebag still intact.',
        choices: [
            { label: 'Tend their wounds', effect: { healPct: -0.1, gold: 50 },
              resultText: 'The party gives up bandages and a night\'s sleep to keep them alive. They press 50 gold into your hands.' },
            { label: 'Take the saddlebag', effect: { gold: 40 },
              resultText: 'You pocket 40 gold and move on. No one will know.' },
            { label: 'Leave them be', resultText: 'You walk on. The road is long enough without other people\'s troubles.' },
        ],
    },
    {
        id: 'strange_cache',
        title: 'Strange Cache',
        text: 'Beneath a pile of stones you find a sealed chest, hidden in a hurry.',
        choices: [
            { label: 'Pry it open', outcomes: [
                { weight: 2, effect: { item: 'uncommon' }, resultText: 'Inside, wrapped in oilcloth: {item}.' },
                { weight: 1, effect: { healPct: -0.15 }, resultText: 'A needle trap. Everyone takes a nasty cut.' },
            ] },
            { label: 'Leave it', resultText: 'Some things are hidden for a reason.' },
        ],
    },
    {
        id: 'hidden_spring',
        title: 'Hidden Spring',
        text: 'A clear spring bubbles up between two boulders. Dip a cut hand in and the sting fades.',
        choices: [
            { label: 'Rest and drink', effect: { healPct: 1, xp: 25 }, resultText: 'The cool water mends every wound and clears every head. Everyone gains 25 XP.' },
            { label: 'Bottle it to sell', effect: { gold: 45 }, resultText: 'A merchant down the road pays 45 gold for "miracle water".' },
        ],
    },
    {
        id: 'wandering_mage',
        chains: ROADS,
        title: 'Wandering Mage',
        text: 'An old mage with ink-stained fingers offers to teach battle tactics, for a price.',
        choices: [
            { label: 'Pay 60 gold', requires: { gold: 60 }, effect: { gold: -60, xp: 60 },
              resultText: 'He lectures through the night, and some of it even sticks. Everyone gains 60 XP.' },
            { label: 'Decline', resultText: 'He shrugs and shuffles off into the trees.' },
        ],
    },
    {
        id: 'old_shrine',
        chains: ROADS,
        title: 'Old Shrine',
        text: 'A roadside shrine to a forgotten deity. Copper offerings sit undisturbed.',
        choices: [
            { label: 'Leave an offering (30 gold)', requires: { gold: 30 }, effect: { gold: -30, xp: 50 },
              resultText: 'Warmth settles over the shrine. Every member gains 50 XP.' },
            { label: 'Pocket the offerings', outcomes: [
                { weight: 1, effect: { gold: 35 }, resultText: 'You pocket 35 gold in old coins.' },
                { weight: 1, effect: { gold: 35, healPct: -0.15 }, resultText: 'You take 35 gold. By evening, a fever is running through the party.' },
            ] },
        ],
    },
    {
        id: 'beast_tracks',
        title: 'Beast Tracks',
        text: 'Enormous tracks cross the path. Something large passed through very recently.',
        acts: [2, 3, 4],
        choices: [
            { label: 'Hunt it (elite battle)', effect: { battle: 'elite' },
              resultText: 'You round a bend and find the beast feeding. It notices you.' },
            { label: 'Give it a wide berth', effect: { healPct: -0.05 },
              resultText: 'The detour is tiring, but everyone walks away whole.' },
        ],
    },
    {
        id: 'ambush',
        chains: ROADS,
        title: 'Ambush!',
        text: 'Armed bandits step out from behind the trees. "Your gold or your lives."',
        acts: [1, 2],
        choices: [
            { label: 'Hand over 50 gold', requires: { gold: 50 }, effect: { gold: -50 },
              resultText: 'They take the gold and vanish. Bitter, but nobody bleeds.' },
            { label: 'Fight back', effect: { battle: 'normal' },
              resultText: 'The party draws steel.' },
        ],
    },
    {
        id: 'training_grounds',
        title: 'Abandoned Training Grounds',
        text: 'Weathered dummies and a rack of blunted weapons stand in a clearing.',
        choices: [
            { label: 'Train hard', effect: { healPct: -0.15, xp: 70 },
              resultText: 'Bruised but sharper. Every member gains 70 XP.' },
            { label: 'Spar lightly', effect: { xp: 30 }, resultText: 'A few easy rounds to loosen up. Everyone gains 30 XP.' },
        ],
    },
    {
        id: 'blacksmith',
        title: 'Traveling Smith',
        text: 'A smith with a portable forge has set up by the road. She takes commissions, and buys scrap.',
        choices: [
            { label: 'Pay 80 gold for a commission', requires: { gold: 80 }, effect: { gold: -80, item: 'rare' },
              resultText: 'Two hours of hammering later, she hands over {item}.' },
            { label: 'Sell her scrap', requires: { items: 1 }, effect: { loseItem: true, gold: 60 },
              resultText: 'She buys a spare piece of gear for 60 gold.' },
            { label: 'Move on', resultText: 'You wave and keep walking.' },
        ],
    },
    {
        id: 'rift_tremor',
        title: 'Rift Tremor',
        text: 'The ground shudders as a rift discharge crackles overhead.',
        acts: [2, 3, 4],
        choices: [
            { label: 'Shield the party', effect: { healPct: -0.1 }, resultText: 'The discharge clips everyone. You go into the next fight a little singed.' },
            { label: 'Study the discharge', outcomes: [
                { weight: 1, effect: { xp: 60 }, resultText: 'The pattern makes a strange kind of sense. Everyone gains 60 XP.' },
                { weight: 1, effect: { healPct: -0.25 }, resultText: 'It arcs straight into you. Everyone is badly burned.' },
            ] },
        ],
    },
    {
        id: 'gambler',
        chains: ROADS,
        title: 'Riverside Gambler',
        text: 'A grinning stranger shuffles a deck. "Double or nothing, friend?"',
        choices: [
            { label: 'Bet 50 gold', requires: { gold: 50 }, outcomes: [
                { weight: 1, effect: { gold: 50 }, resultText: 'Lady luck smiles. You win 50 gold.' },
                { weight: 1, effect: { gold: -50 }, resultText: 'He wins, and is gone before you can ask for a rematch.' },
            ] },
            { label: 'Walk away', resultText: 'Wise.' },
        ],
    },
    {
        id: 'fallen_knight',
        chains: ROADS,
        title: 'Fallen Knight',
        text: 'A knight\'s body lies under a tree, armor intact. A pendant glints at their throat.',
        choices: [
            { label: 'Take the pendant', effect: { relic: 'common' }, resultText: 'You take {relic}. It is warm to the touch.' },
            { label: 'Bury them', effect: { healPct: 1, xp: 20 }, resultText: 'A quiet hour with borrowed shovels. Everyone rests easier for it and gains 20 XP.' },
        ],
    },
    {
        id: 'hermit',
        title: 'Hermit\'s Hut',
        text: 'A hermit offers a strange tea that "opens the body to its potential".',
        choices: [
            { label: 'One of you drinks', effect: { memberStatMods: { maxHp: 8 } },
              resultText: '{name} shudders, then stands taller. +8 max HP.' },
            { label: 'Politely decline', resultText: 'The hermit looks wounded, then pours it out for the cat.' },
        ],
    },
    {
        id: 'arcane_well',
        title: 'Arcane Well',
        text: 'Motes of light drift up out of a dry well.',
        acts: [2, 3, 4],
        choices: [
            { label: 'Reach in', effect: { memberStatMods: { mat: 2, maxMp: 6 } },
              resultText: 'The light pours into {name}. +2 MAT, +6 max MP.' },
            { label: 'Toss in a coin (20 gold)', requires: { gold: 20 }, effect: { gold: -20, xp: 40 },
              resultText: 'The well hums approvingly. Every member gains 40 XP.' },
        ],
    },
    {
        id: 'war_camp',
        title: 'Abandoned War Camp',
        text: 'The smoldering remains of a camp. Whoever was here left in a hurry.',
        choices: [
            { label: 'Search the tents', effect: { gold: 30, item: 'common' }, resultText: 'You find 30 gold and {item}.' },
            { label: 'Search the command tent', outcomes: [
                { weight: 1, effect: { item: 'uncommon' }, resultText: 'Among maps and orders: {item}.' },
                { weight: 1, effect: { battle: 'normal' }, resultText: 'They didn\'t all leave.' },
            ] },
        ],
    },
    {
        id: 'pilgrims',
        chains: ROADS,
        title: 'Pilgrims',
        text: 'A band of pilgrims asks for an escort to the next shrine.',
        acts: [1, 2],
        choices: [
            { label: 'Escort them', effect: { healPct: -0.1, gold: 70 },
              resultText: 'The road is rough, but they pay 70 gold at the shrine gates.' },
            { label: 'Point the way', resultText: 'They thank you and trudge on.' },
        ],
    },
    {
        id: 'void_merchant',
        title: 'Void Merchant',
        text: 'A figure in a too-still cloak offers wares "from the other side".',
        acts: [2, 3, 4],
        choices: [
            { label: 'Pay in blood (lose 20% HP)', effect: { healPct: -0.2, relic: 'uncommon' },
              resultText: 'Something cold passes between you. You now carry {relic}.' },
            { label: 'Pay in coin (120 gold)', requires: { gold: 120 }, effect: { gold: -120, relic: 'rare' },
              resultText: 'The coins vanish mid-air. In your palm: {relic}.' },
            { label: 'Refuse', resultText: 'The figure is gone when you blink.' },
        ],
    },
    {
        id: 'riftscar_echo',
        title: 'Echo of the Rift',
        text: 'For a moment you see yourselves, older and scarred, standing at the end of this road.',
        acts: [3, 4],
        choices: [
            { label: 'Listen', effect: { xp: 90 }, resultText: 'Your future selves have a lot of advice. Some of it is good. Everyone gains 90 XP.' },
            { label: 'Turn away', effect: { gold: 60 }, resultText: 'You look away and keep walking. A little further on, a dropped purse holds 60 gold.' },
        ],
    },
];
