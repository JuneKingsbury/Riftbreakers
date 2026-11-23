// Seer: a starting class (Divination). Promotes into the Lifeseer or the Fatebinder.
//
// File format: js/content/README.md.

export const key = 'seer';

export const job = {
    maxHp: 44, maxMp: 48,
    spd: 8, atk: 6, def: 6, mat: 11, mdf: 11,
    move: 3, eva: 16,
    skillsetName: 'Divination',
    tier: 1,
    promotions: ['lifeseer', 'fatebinder'],
    learnable: {
        temporal_slip: { sp: 1 },
        time_lapse: { sp: 1, requires: 'temporal_slip' },
        dream_veil: { sp: 1, requires: 'time_lapse' },
        swift_grace: { sp: 2, requires: 'time_lapse' },
        premonition: { sp: 1, requires: 'temporal_slip' },
        swiftcast: { sp: 2, requires: 'time_lapse' },
        featherstep: { sp: 1 },
    },
    builds: [
        {
            key: 'control', name: 'Crowd Control',
            desc: 'Take enemies out of the fight: Dream Veil puts one to sleep and Time Lapse slows another, so they act far less often. Hitting a sleeping enemy wakes it up.',
            steps: ['time_lapse', 'dream_veil', 'premonition', 'dream_veil+', 'time_lapse+', 'featherstep', 'dream_veil+', 'time_lapse+', 'swiftcast'],
        },
        {
            key: 'support', name: 'Ally Buffs',
            desc: 'Make your allies better: Swift Grace hastes one so they act 50% more often, and Temporal Slip makes the next physical attack on an ally miss. Premonition keeps you safe.',
            steps: ['time_lapse', 'swift_grace', 'premonition', 'temporal_slip+', 'swift_grace+', 'premonition+', 'swift_grace+', 'temporal_slip+'],
        },
    ],
    spriteKey: 'npc_ally',
    char: 'D', color: '#99ccff',
    schools: ['divination'],
    desc: "A mage who reads time and chance, foreseeing attacks before they land and guiding allies out of harm's way. Few classes are harder to hit.",
    allowedEquipment: { armor: ['cloth', 'light'], helmet: ['cloth', 'light'], weapon: ['magic'], tool: ['implement'] },
    role: 'Control and support',
    unlock: { type: 'renown', order: 3 },
    startingGear: { armor: 'cotton_shirt', helmet: 'wool_cap', weapon: 'wooden_wand', tool: 'lantern' },
    ai: { script: 'ranged', scriptRange: 3, ranged: true, keep: 3 },
};

export const abilities = {
    // Seer: causes the next physical attack against target to miss
    temporal_slip: {
        name: 'Temporal Slip',
        type: 'magic',
        range: 3,
        aoe: 0,
        mpCost: 14,
        actionCost: 42,
        targetType: 'ally',
        basePower: 0,
        element: 'arcane',
        animType: 'cast',
        projectileColor: '#aaddff',
        chargeTime: 0,
        applyStatus: 'slipped',
        desc: 'Nudges fate around an ally. The next physical attack against them misses, if it comes within 2 turns.',
    },

    // HASTE — cast on ally, CT advance rate ×1.5 for 3 turns
    swift_grace: {
        name: 'Swift Grace',
        type: 'magic',
        range: 3,
        aoe: 0,
        mpCost: 14,
        actionCost: 45,
        targetType: 'ally',
        basePower: 0,
        element: 'arcane',
        animType: 'cast',
        projectileColor: '#ffee88',
        chargeTime: 0,
        applyStatus: 'haste',
        statusDuration: 3,
        desc: 'Quickens an ally\'s flow of time. Haste lets them act 50% more often for {turns}.',
    },

    // SLEEP — skip turns until woken by damage
    dream_veil: {
        name: 'Dream Veil',
        type: 'magic',
        range: 4,
        aoe: 0,
        mpCost: 12,
        actionCost: 45,
        targetType: 'enemy',
        basePower: 0,
        element: 'spirit',
        animType: 'cast',
        projectileColor: '#aabbff',
        chargeTime: 0,
        applyStatus: 'sleep',
        statusDuration: 3,
        desc: 'Draws the target into a deep sleep. They skip their turns for up to {turns}, or until something hits them.',
    },

    featherstep: {
        extends: 'move_plus_1',
        name: 'Levitate',
        moveBonus: 0, climbBonus: 2,
        desc: 'Drift a hand\'s breadth above the ground and rise over ledges. Climb 2 extra levels of elevation.',
    },

    time_lapse: {
        name: 'Time Lapse',
        type: 'magic',
        range: 4, aoe: 0, mpCost: 10, actionCost: 42,
        targetType: 'enemy', basePower: 0.6, element: 'arcane',
        animType: 'cast', projectileColor: '#ccddff', chargeTime: 0,
        applyStatus: 'slow', statusDuration: 3,
        desc: 'Thickens the flow of time around the target, dealing light magic damage and slowing them for {duration} turns.',
    },

    premonition: {
        extends: 'brace',
        name: 'Premonition',
        trigger: 'anyHit', chance: 0.5,
        selfStatus: 'slipped',
        desc: 'After a hit, you may glimpse the next blow coming. The next physical attack against you misses.',
    },

    swiftcast: {
        extends: 'support',
        name: 'Swiftcast',
        passiveMpCost: 0, dmgDealt: null,
        chargeMult: 0.5,
        desc: 'Skip ahead to the moment the spell completes. Charge times are halved.',
    },
};
