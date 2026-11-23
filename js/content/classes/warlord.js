// Warlord: a starting class (no school). Promotes into the Marshal or the Tactician.
// Commands are orders, not spells: they can't be dodged (noEvade).
//
// File format: js/content/README.md.

export const key = 'warlord';

export const job = {
    maxHp: 52, maxMp: 20,
    spd: 8, atk: 11, def: 8, mat: 4, mdf: 6,
    move: 3, eva: 10,
    skillsetName: 'Command',
    tier: 1,
    promotions: ['marshal', 'tactician'],
    learnable: {
        cleave: { sp: 1 },
        rally: { sp: 1, requires: 'cleave' },
        taunt: { sp: 1, requires: 'cleave' },
        reposition: { sp: 2, requires: 'rally' },
        hold_the_line: { sp: 1, requires: 'cleave' },
        field_command: { sp: 2, requires: 'rally' },
        vanguard_step: { sp: 1 },
    },
    builds: [
        {
            key: 'tank', name: 'Tanking',
            desc: 'Pull the enemy onto you: Taunt forces nearby enemies to attack you, Hold the Line strikes back when an ally next to you is hit, and Cleave hits everyone around you.',
            steps: ['taunt', 'hold_the_line', 'cleave+', 'vanguard_step', 'taunt+', 'hold_the_line+', 'cleave+', 'hold_the_line+', 'taunt+'],
        },
        {
            key: 'speed', name: 'Ally Speed',
            desc: 'Give your allies extra turns: Rally makes one act sooner, and Field Command gives the whole party a head start each battle. Reposition swaps you with an ally to pull them out of danger.',
            steps: ['rally', 'field_command', 'rally+', 'reposition', 'rally+', 'reposition+', 'vanguard_step'],
        },
    ],
    spriteKey: 'knight',
    char: 'W', color: '#ffbb55',
    schools: [],
    desc: 'A commander who wins with orders rather than spells. The Warlord sets the pace of the fight: rallying allies to act sooner, taunting enemies into attacking them, and swapping places to pull a friend out of danger.',
    allowedEquipment: { armor: ['light', 'medium'], helmet: ['light', 'medium'], weapon: ['blade', 'heavy_weapon'], tool: ['shield', 'implement'] },
    role: 'Commander and taunter',
    unlock: { type: 'renown', order: 4 },
    startingGear: { armor: 'leather_vest', helmet: 'leather_cap', weapon: 'iron_sword', tool: 'iron_shield' },
    ai: { melee: true },
};

export const abilities = {
    cleave: {
        extends: 'attack', name: 'Cleave', aoe: 1, basePower: 0.8, actionCost: 42,
        desc: 'A wide swing that hits the target and every enemy next to it.',
    },

    rally: {
        name: 'Rally', type: 'physical', range: 3, aoe: 0, mpCost: 6, actionCost: 35,
        targetType: 'ally', basePower: 0, element: 'command', animType: 'cast',
        projectileColor: '#ffcc66', chargeTime: 0, ctGain: 45, floatText: 'Rallied!',
        desc: 'Calls an ally to action. Their speed gauge jumps forward, so they act sooner.',
    },

    taunt: {
        name: 'Taunt', type: 'physical', range: 2, aoe: 1, mpCost: 6, actionCost: 38,
        targetType: 'enemy', basePower: 0, element: 'command', animType: 'cast',
        projectileColor: '#ff8844', chargeTime: 0, noEvade: true, applyStatus: 'taunted', statusDuration: 2,
        desc: 'A challenge no one can ignore. Enemies in the area must attack you for {duration} turns.',
    },

    reposition: {
        name: 'Reposition', type: 'physical', range: 3, aoe: 0, mpCost: 8, actionCost: 40,
        targetType: 'ally', basePower: 0, element: 'command', animType: 'cast',
        projectileColor: '#ffdd88', chargeTime: 0, swapPlaces: true,
        desc: 'Swap places with an ally up to 3 tiles away, pulling them out of danger or into the fight.',
    },

    hold_the_line: {
        extends: 'brace', name: 'Hold the Line', trigger: 'allyHit', chance: 0.35, selfStatus: null,
        counterWith: 'attack', counterReach: 2,
        desc: 'When an adjacent ally is hit, you may lunge in and strike back at an attacker up to 2 tiles away.',
    },

    field_command: {
        extends: 'support', name: 'Field Command', passiveMpCost: 0, dmgDealt: null, partyStartCt: 15,
        desc: 'Your orders are given before the battle starts. The whole party opens with a head start on its speed gauges.',
    },

    vanguard_step: {
        extends: 'move_plus_1', name: 'Vanguard Step', moveBonus: 0,
        onMove: { selfBuff: { stat: 'def', value: 2, duration: 1 } },
        desc: 'Advance with your guard up. After moving, DEF +2 for 1 turn.',
    },
};
