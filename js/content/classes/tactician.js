// Tactician: a Tier 2 class (Divination), promoted from the Warlord.
//
// File format: js/content/README.md.

export const key = 'tactician';

export const job = {
    maxHp: 50, maxMp: 34,
    spd: 9, atk: 11, def: 8, mat: 6, mdf: 9,
    move: 4, eva: 14,
    skillsetName: 'Battle Plans',
    tier: 2,
    learnable: {
        seize_the_moment: { sp: 1 },
        delay: { sp: 1, requires: 'seize_the_moment' },
        exploit_opening: { sp: 2, requires: 'seize_the_moment' },
        read_the_battle: { sp: 1, requires: 'seize_the_moment' },
        initiative: { sp: 2, requires: 'delay' },
    },
    builds: [
        {
            key: 'speed', name: 'Ally Speed',
            desc: 'Give your allies extra turns: Initiative gives the whole party a big head start each battle, and Seize the Moment sends one ally into action right away. Rally (from the Warlord) is a cheaper version.',
            steps: ['delay', 'initiative', 'seize_the_moment+', 'rally', 'seize_the_moment+', 'rally+'],
        },
        {
            key: 'disrupt', name: 'Disrupt Enemies',
            desc: 'Slow down the enemy\'s turns: Delay pushes an enemy\'s next turn back, and Read the Battle breaks up spells while they charge. Exploit Opening is a quick strike that brings your own turn sooner.',
            steps: ['read_the_battle', 'delay', 'delay+', 'exploit_opening', 'read_the_battle+', 'delay+', 'exploit_opening+'],
        },
    ],
    spriteKey: 'royal_mage',
    char: 'T', color: '#aa88ff',
    schools: ['divination'],
    desc: 'A warlord who fights the clock. The Tactician sends allies into action at the perfect moment, sets enemies back, and disrupts spells before they land. Every battle starts already a step ahead.',
    ai: { melee: true },
};

export const abilities = {
    seize_the_moment: {
        extends: 'rally', name: 'Seize the Moment', range: 4, mpCost: 12, ctGain: 55,
        desc: 'You spot the perfect moment for an ally. Their speed gauge jumps far forward.',
    },

    delay: {
        name: 'Delay', type: 'physical', range: 4, aoe: 0, mpCost: 10, actionCost: 40,
        targetType: 'enemy', basePower: 0, element: 'command', animType: 'cast',
        projectileColor: '#aa88ff', chargeTime: 0, ctGain: -40, floatText: 'Delayed!',
        desc: 'A feint that makes the enemy hesitate. Their speed gauge falls back, so they act later.',
    },

    exploit_opening: {
        extends: 'attack', name: 'Exploit Opening', basePower: 0.9, mpCost: 6, actionCost: 38, selfCtGain: 25,
        desc: 'A strike into a gap in the enemy\'s guard. Your own next turn comes sooner.',
    },

    read_the_battle: {
        extends: 'brace', name: 'Read the Battle', trigger: 'enemyCharge', chance: 0.4, selfStatus: null,
        delayCharge: 30, chargeRange: 4,
        desc: 'When an enemy within 4 tiles starts charging a spell, may disrupt it and set the charge back.',
    },

    initiative: {
        extends: 'support', name: 'Initiative', passiveMpCost: 0, dmgDealt: null, partyStartCt: 30,
        desc: 'Every battle is planned in advance. The whole party opens with a big head start on its speed gauges.',
    },
};
