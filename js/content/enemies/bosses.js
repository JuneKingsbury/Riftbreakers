// Signature abilities of the bosses that fight on a plain enemy job (Act 1's), given to them
// by their roster entry (`extraAbilities`) in the realm file. Bosses on a player class fight
// with that class's kit. No jobs here: a boss's job is in its realm's roster.
export const jobs = {};

export const abilities = {
    // The Bandit King (Wild Frontiers): a sweeping two-handed blow.
    royal_cleave: {
        extends: 'attack',
        name: 'Royal Cleave',
        aoe: 1,
        actionCost: 55,
        basePower: 0.85,
        desc: 'A sweeping blow that strikes the target and everyone of its side next to it.',
    },
    // The Dire Wolf (Wild Frontiers): a mauling bite that leaves the wound festering.
    rending_maul: {
        extends: 'attack',
        name: 'Rending Maul',
        actionCost: 50,
        basePower: 1.25,
        applyStatus: 'poison',
        statusDuration: 3,
        desc: 'Tears into the target. Deals heavy damage and poisons it for {turns}.',
    },
    // The Thorn Warden (Verdant Depths): vines that reach past the front line.
    bramble_lash: {
        extends: 'attack',
        name: 'Bramble Lash',
        range: 3,
        actionCost: 45,
        basePower: 0.9,
        applyStatus: 'slow',
        statusDuration: 2,
        animType: 'shot',
        desc: 'A thorned vine lashes out from up to 3 tiles away. Deals damage and slows the target for {turns}.',
    },
    // The Crystal Warden (Crystal Caves): slams the ground, raising shards around the target.
    crystal_slam: {
        extends: 'attack',
        name: 'Crystal Slam',
        aoe: 1,
        actionCost: 55,
        basePower: 0.8,
        applyStatus: 'slow',
        statusDuration: 2,
        desc: 'Shards burst from the ground around the target. Damages it and its neighbours and slows them for {turns}.',
    },
};
