// Abilities that no class, enemy or item uses yet. They work, and are kept so they can
// be given to one: add the key to a class's learnable, an enemy's abilities or an item.
//
// File format: js/content/README.md.

export const abilities = {
    stone_wall: {
        name: 'Stone Wall',
        type: 'magic',
        range: 3,
        aoePattern: [[-1, 0], [0, 0], [1, 0]],
        requiresLos: false,
        mpCost: 20,
        actionCost: 55,
        targetType: 'tile',
        terrainEffect: { setType: 'wall', raise: 2, affectTiles: 'passable' },
        animType: 'cast',
        projectileColor: '#886644',
        chargeTime: 45,
        desc: 'Raises a three-tile wall of stone from the earth. It blocks the way for the rest of the battle.',
    },

    root_field: {
        name: 'Root Field',
        type: 'magic',
        range: 3,
        aoePattern: [[0, -1], [-1, 0], [0, 0], [1, 0], [0, 1]],
        requiresLos: false,
        mpCost: 16,
        actionCost: 50,
        targetType: 'tile',
        terrainEffect: { setType: 'rubble', affectTiles: 'passable' },
        animType: 'cast',
        projectileColor: '#66aa22',
        chargeTime: 30,
        desc: 'Tangling roots choke a cross-shaped patch of ground, turning it into difficult terrain.',
    },

    // BERSERK — forces target into uncontrolled auto-attacks each turn
    primal_rage: {
        name: 'Primal Rage',
        type: 'magic',
        range: 3,
        aoe: 0,
        mpCost: 12,
        actionCost: 45,
        targetType: 'enemy',
        basePower: 0,
        element: 'nature',
        animType: 'cast',
        projectileColor: '#ff6600',
        chargeTime: 0,
        applyStatus: 'berserk',
        statusDuration: 2,
        desc: 'Floods the target\'s mind with primal fury. For {turns}, they can only attack the nearest foe.',
    },

    focus: {
        name: 'Focus',
        type: 'physical',
        range: 0, aoe: 0, mpCost: 0, actionCost: 30,
        targetType: 'self', animType: 'cast', projectileColor: '#ffeeaa', chargeTime: 0,
        buffs: [{ stat: 'atk', value: 3, duration: 3 }, { stat: 'mat', value: 3, duration: 3 }],
        floatText: 'Focus!',
        desc: 'Steady your breath and remember your training. ATK and MAT +{buff:atk} for 3 turns.',
    },

    soul_siphon: {
        extends: 'spirit_lash',
        name: 'Soul Siphon',
        mpCost: 12,
        basePower: 0.9,
        applyStatus: null,
        drainFrac: 0.5,
        projectileColor: '#99aaee',
        desc: 'A bound spirit tears a sliver of life from the target and carries it back to you. Heals you for half the damage dealt.',
    },

    force_leap: {
        extends: 'move_plus_1',
        name: 'Force Leap',
        moveBonus: 0, climbBonus: 3,
        desc: 'A spell-propelled jump. Climb 3 extra levels of elevation.',
    },

    hallowed_step: {
        extends: 'move_plus_1',
        name: 'Hallowed Step',
        moveBonus: 0,
        onMove: { alliesHealPct: 0.08 },
        desc: 'The ground you walk is blessed. After moving, you and adjacent allies heal 8% of max HP.',
    },

    call_boar: {
        name: 'Call Boar',
        type: 'magic',
        range: 2,
        aoe: 0,
        mpCost: 22,
        actionCost: 55,
        targetType: 'tile',
        isSummon: true,
        summonJob: 'summoned_boar',
        summonName: 'Boar',
        element: 'nature',
        animType: 'cast',
        projectileColor: '#996644',
        chargeTime: 20,
        requiresLos: false,
        desc: 'Conjures a charging boar. Tougher and harder-hitting than the wolf, but slower.',
    },
};
