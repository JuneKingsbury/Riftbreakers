// Marshal: a Tier 2 class (Abjuration), promoted from the Warlord.
//
// File format: js/content/README.md.

export const key = 'marshal';

export const job = {
    equipmentExpansions: { armor: ['heavy'], helmet: ['heavy'] },
    maxHp: 64, maxMp: 24,
    spd: 7, atk: 13, def: 13, mat: 4, mdf: 10,
    move: 3, eva: 10,
    skillsetName: 'Defense Orders',
    tier: 2,
    learnable: {
        shield_wall: { sp: 1 },
        challenge: { sp: 1, requires: 'shield_wall' },
        bulwark_bash: { sp: 2, requires: 'shield_wall' },
        interpose: { sp: 1, requires: 'shield_wall' },
        iron_discipline: { sp: 2, requires: 'challenge' },
    },
    spriteKey: 'palace_champion',
    char: 'K', color: '#ccccff',
    schools: ['abjuration'],
    desc: 'A warlord who holds the line in person. The Marshal locks shields with the party, calls out the most dangerous enemy, and steps in front of blows meant for others. The toughest frontliner in the roster.',
    ai: { melee: true },
};

export const abilities = {
    shield_wall: {
        name: 'Shield Wall', type: 'physical', range: 0, aoe: 1, mpCost: 8, actionCost: 45,
        targetType: 'ally', basePower: 0, element: 'command', animType: 'cast',
        projectileColor: '#ccccff', chargeTime: 0, noEvade: true, applyStatus: 'protect', statusDuration: 2,
        desc: 'Lock shields. You and every adjacent ally gain Protect for {duration} turns.',
    },

    challenge: {
        name: 'Challenge', type: 'physical', range: 3, aoe: 0, mpCost: 8, actionCost: 40,
        targetType: 'enemy', basePower: 0, element: 'command', animType: 'cast',
        projectileColor: '#ff6644', chargeTime: 0, noEvade: true, applyStatus: 'taunted', statusDuration: 3,
        buffs: [{ stat: 'def', value: -4, duration: 3 }],
        desc: 'Calls out one enemy. They must attack you for {turns}, and their DEF falls by {buff:def} for 3 turns.',
    },

    bulwark_bash: {
        extends: 'attack', name: 'Bulwark Bash', basePower: 0.9, mpCost: 8, actionCost: 45,
        applyStatus: 'stun', statusDuration: 1,
        desc: 'A blow with the shield\'s rim. Deals damage and stuns the target for {turns}.',
    },

    interpose: {
        extends: 'brace', name: 'Interpose', trigger: 'allyHit', chance: 0.35, selfStatus: null, shareDamageFrac: 1,
        desc: 'When an adjacent ally is hit, you may step in and take the whole blow yourself. It never drops you below 1 HP.',
    },

    iron_discipline: {
        extends: 'support', name: 'Iron Discipline', passiveMpCost: 0, dmgDealt: null,
        turnAlliesBuff: [{ stat: 'def', value: 3, duration: 1 }, { stat: 'mdf', value: 3, duration: 1 }],
        desc: 'At the start of each of your turns, you and adjacent allies gain DEF and MDF +3 for 1 turn.',
    },
};
