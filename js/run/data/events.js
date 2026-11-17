// Random events met on '?' nodes.
//
// These are the general events, met in any realm. Realm-only events live in
// data/realm-events.js; EVENTS holds both.
//
// event: { id, title, text, acts?, chains?, choices: [choice] }
//   acts     Acts the event can appear in (default: all)
//   chains   Realm chains (data/realms.js) the event fits, for events set outdoors on the
//            road (default: all)
//   choice:  { label, requires?, effect?, resultText?, outcomes? }
//     requires  { gold?: n, partyBelow?: n, items?: n }: the choice is disabled unless met
//               (gold: at least n gold; partyBelow: fewer than n members; items: at least
//               n unequipped items)
//     outcomes  [{ weight, effect, resultText }]: one is rolled instead of effect/resultText
//
// effect fields (all optional; see RunState.applyEffect):
//   gold         Gold gained (negative: spent)
//   healPct      Every member heals this fraction of max HP (negative: damage, never below 1 HP).
//                The party fully heals after each won battle, so damage means starting the
//                next fight wounded.
//   xp           XP for every member
//   item         Rarity of a random item to gain: 'common' | 'uncommon' | 'rare'
//   relic        Rarity of a random relic to gain
//   loseItem     true: lose a random unequipped item
//   memberStatMods  Permanent stat bonus for one random member ({name} in resultText)
//   recruit      true: meet recruits (as on a recruit node)
//   battle       'normal' | 'elite': fight before moving on
// resultText may use {name} (the member chosen by memberStatMods), {item} and {relic}.

import { REALMS, realmSources } from './realms.js';
import { REALM_EVENTS } from './realm-events.js';

// Chains with open country and roads.
const ROADS = ['wild_frontiers', 'verdant_wilds', 'the_kingdom'];

const GENERAL_EVENTS = [
    {
        id: 'wounded_traveller',
        chains: ROADS,
        title: 'Wounded Traveller',
        text: 'A wounded merchant slumps against a mile-marker, their saddlebag still intact.',
        choices: [
            { label: 'Tend their wounds', effect: { healPct: -0.1, gold: 50 },
              resultText: 'Your party gives up bandages and sleep to stabilise them. They press 50 gold into your hands.' },
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
        text: 'Tucked between two boulders: a crystal-clear spring with faint healing properties.',
        choices: [
            { label: 'Rest and drink', effect: { healPct: 1, xp: 25 }, resultText: 'The cool water mends every wound and clears your heads. Every member gains 25 XP.' },
            { label: 'Bottle it to sell', effect: { gold: 45 }, resultText: 'A merchant down the road pays 45 gold for "miracle water".' },
        ],
    },
    {
        id: 'wandering_mage',
        chains: ROADS,
        title: 'Wandering Mage',
        text: 'An eccentric old mage offers to share battle knowledge, for a price.',
        choices: [
            { label: 'Pay 60 gold', requires: { gold: 60 }, effect: { gold: -60, xp: 60 },
              resultText: 'He lectures through the night. Every member gains 60 XP.' },
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
              resultText: 'A warmth suffuses the air. Every member gains 50 XP.' },
            { label: 'Pocket the offerings', outcomes: [
                { weight: 1, effect: { gold: 35 }, resultText: 'You pocket 35 gold of old coins.' },
                { weight: 1, effect: { gold: 35, healPct: -0.15 }, resultText: 'You take 35 gold. On the road, a sudden fever runs through the party.' },
            ] },
        ],
    },
    {
        id: 'beast_tracks',
        title: 'Beast Tracks',
        text: 'Enormous tracks cross the path. Something large passed through very recently.',
        acts: [2, 3],
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
              resultText: 'Your party draws steel.' },
        ],
    },
    {
        id: 'lost_sellsword',
        title: 'Lost Sellsword',
        text: 'A lone fighter sits by a dying fire. Their company was wiped out; they need work.',
        choices: [
            { label: 'Offer them a place', requires: { partyBelow: 6 }, effect: { recruit: true },
              resultText: 'They size up your party and nod.' },
            { label: 'Share your food', effect: { healPct: -0.05, xp: 30 },
              resultText: 'They trade war stories for supper. Every member gains 30 XP.' },
        ],
    },
    {
        id: 'training_grounds',
        title: 'Abandoned Training Grounds',
        text: 'Weathered dummies and a rack of blunted weapons stand in a clearing.',
        choices: [
            { label: 'Drill hard', effect: { healPct: -0.15, xp: 70 },
              resultText: 'Bruised but sharper. Every member gains 70 XP.' },
            { label: 'Spar lightly', effect: { xp: 30 }, resultText: 'Every member gains 30 XP.' },
        ],
    },
    {
        id: 'blacksmith',
        title: 'Travelling Smith',
        text: 'A smith with a portable forge offers to rework a piece of gear.',
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
        text: 'The earth shudders as a Rift discharge crackles overhead.',
        acts: [2, 3],
        choices: [
            { label: 'Shield the party', effect: { healPct: -0.1 }, resultText: 'The discharge clips everyone. You will start the next fight a little hurt.' },
            { label: 'Study the discharge', outcomes: [
                { weight: 1, effect: { xp: 60 }, resultText: 'The pattern is illuminating. Every member gains 60 XP.' },
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
        text: 'A knight\'s body lies under a tree, armour intact. A pendant glints at their throat.',
        choices: [
            { label: 'Take the pendant', effect: { relic: 'common' }, resultText: 'You take {relic}. It is warm to the touch.' },
            { label: 'Bury them', effect: { healPct: 1, xp: 20 }, resultText: 'A quiet hour. The party feels lighter for it. Every member gains 20 XP.' },
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
        acts: [2, 3],
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
        text: 'The smouldering remains of a camp. Whoever was here left in a hurry.',
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
        acts: [2, 3],
        choices: [
            { label: 'Trade your health (lose 20% HP)', effect: { healPct: -0.2, relic: 'uncommon' },
              resultText: 'Something cold passes between you. You now carry {relic}.' },
            { label: 'Buy with gold (120)', requires: { gold: 120 }, effect: { gold: -120, relic: 'rare' },
              resultText: 'The coins vanish mid-air. In your palm: {relic}.' },
            { label: 'Refuse', resultText: 'The figure is gone when you blink.' },
        ],
    },
    {
        id: 'mercenary_captain',
        title: 'Mercenary Captain',
        text: 'A captain is selling off the contract of a recruit who "isn\'t working out".',
        acts: [2, 3],
        choices: [
            { label: 'Buy the contract (60 gold)', requires: { gold: 60, partyBelow: 6 }, effect: { gold: -60, recruit: true },
              resultText: 'The captain counts the coin and points at the waiting recruits.' },
            { label: 'Not today', resultText: 'You keep your coin.' },
        ],
    },
    {
        id: 'riftscar_echo',
        title: 'Echo of the Rift',
        text: 'For a moment you see yourselves, older and scarred, standing at the end of this road.',
        acts: [3],
        choices: [
            { label: 'Listen', effect: { xp: 90 }, resultText: 'Your future selves have advice. Every member gains 90 XP.' },
            { label: 'Turn away', effect: { gold: 60 }, resultText: 'You steady yourselves. On the road you find a fallen purse: 60 gold.' },
        ],
    },
];

export const EVENTS = [...GENERAL_EVENTS, ...REALM_EVENTS];

// Events for a '?' node in `act`, set in `realmId`: { realm: [...], general: [...] }.
// `realm` also holds the events of the realms folded into it (realmSources).
export function eventsFor(act, realmId) {
    const chain = REALMS[realmId]?.chain;
    const sources = realmSources(realmId);
    const inAct = e => !e.acts || e.acts.includes(act);
    return {
        // The realm's own events and those of the realms folded into it.
        realm: REALM_EVENTS.filter(e => inAct(e) && e.realms.some(r => sources.includes(r))),
        general: GENERAL_EVENTS.filter(e => inAct(e) && (!e.chains || e.chains.includes(chain))),
    };
}
