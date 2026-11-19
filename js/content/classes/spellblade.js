// Spellblade: a starting class (Enchantment). Promotes into the Spiritbinder or the Sanctifier.
//
// File format: js/content/README.md.

export const key = 'spellblade';

export const job = {
    maxHp: 46, maxMp: 30,
    spd: 9, atk: 12, def: 6, mat: 9, mdf: 7,
    move: 3, eva: 15,
    skillsetName: 'Runeblade',
    tier: 1,
    promotions: ['spiritbinder', 'sanctifier'],
    learnable: {
        hex: { sp: 1 },
        sunder: { sp: 1, requires: 'hex' },
        enfeeble: { sp: 1, requires: 'hex' },
        mute: { sp: 2, requires: 'enfeeble' },
        counter: { sp: 1, requires: 'sunder' },
        rune_edge: { sp: 2, requires: 'sunder' },
        momentum: { sp: 1 },
    },
    builds: [
        {
            key: 'breaker', name: 'Armor Breaker',
            desc: 'Fight up close and strip armor: Sunder lowers a target\'s DEF so the whole party hits it harder, and Counter strikes back whenever you\'re hit in melee.',
            steps: ['sunder', 'counter', 'sunder+', 'momentum', 'rune_edge', 'sunder+', 'counter+', 'counter+'],
        },
        {
            key: 'debuffer', name: 'Debuffer',
            desc: 'Weaken the enemy\'s biggest threats from 3 tiles away: Mute stops a caster from casting and Enfeeble cuts a fighter\'s ATK. Counter covers you when they get close.',
            steps: ['enfeeble', 'mute', 'enfeeble+', 'sunder', 'counter', 'mute+', 'enfeeble+', 'mute+'],
        },
    ],
    spriteKey: 'spell_wraith',
    char: 'C', color: '#cc88dd',
    schools: ['enchantment'],
    desc: 'A warrior who carves runes and hexes into their blade. The Spellblade fights up close, cursing enemies to sap their strength, speed and magic. Tougher and faster than a pure mage, but needs good positioning to shine.',
    allowedEquipment: { armor: ['light'], helmet: ['light'], weapon: ['blade'], tool: ['offhand_weapon', 'implement'] },
    role: 'Melee debuffer',
    unlock: { type: 'renown', order: 1 },
    startingGear: { armor: 'leather_vest', helmet: 'leather_cap', weapon: 'iron_sword' },
    ai: { script: 'melee', melee: true },
};

export const abilities = {
    // Enchanter basic: a cheap single-target hex with a short slow
    hex: {
        name: 'Hex',
        type: 'magic',
        range: 3,
        aoe: 0,
        mpCost: 8,
        actionCost: 40,
        targetType: 'enemy',
        basePower: 0.5,
        element: 'shadow',
        animType: 'cast',
        projectileColor: '#cc88dd',
        chargeTime: 0,
        applyStatus: 'slow',
        statusDuration: 1,
        desc: 'A crude curse that scratches at the target\'s will. Deals light damage and slows them for {turns}.',
    },

    // Enchanter: ranged ATK debuff
    enfeeble: {
        name: 'Enfeeble',
        type: 'magic',
        range: 3,
        aoe: 0,
        mpCost: 10,
        actionCost: 42,
        targetType: 'enemy',
        basePower: 0.4,
        element: 'shadow',
        animType: 'cast',
        projectileColor: '#aa44cc',
        chargeTime: 0,
        applyStatus: 'enfeebled',
        desc: 'Saps the target\'s fighting spirit. Light damage, and ATK -5 for 2 turns.',
    },

    // SILENCE — prevent target from casting magic
    mute: {
        name: 'Mute',
        type: 'magic',
        range: 3,
        aoe: 0,
        mpCost: 10,
        actionCost: 42,
        targetType: 'enemy',
        basePower: 0,
        element: 'shadow',
        animType: 'cast',
        projectileColor: '#cc44cc',
        chargeTime: 0,
        applyStatus: 'silence',
        statusDuration: 2,
        desc: 'Seals the target\'s voice. They can\'t cast any magic for {turns}.',
    },

    counter: {
        extends: 'brace',
        name: 'Counter',
        trigger: 'physicalHit', chance: 0.5, adjacentOnly: true,
        selfStatus: null,
        counterWith: 'attack',
        desc: 'When struck in melee, you may hit the attacker back.',
    },

    sunder: {
        extends: 'attack',
        name: 'Sunder',
        actionCost: 40,
        basePower: 0.8,
        buffs: [{ stat: 'def', value: -5, duration: 2 }],
        desc: 'A rune-etched cut that splits armor. Deals damage and lowers the target\'s DEF by {buff:def} for 2 turns.',
    },

    rune_edge: {
        extends: 'support',
        name: 'Rune Edge',
        passiveMpCost: 0, dmgDealt: null,
        attackProc: { status: 'slow', chance: 0.35, duration: 1 },
        desc: 'A binding rune on your weapon. Physical hits have a 35% chance to slow the target for 1 turn.',
    },

    momentum: {
        extends: 'move_plus_1',
        name: 'Momentum',
        moveBonus: 0,
        momentumPct: 0.06,
        desc: 'Every step builds power. +6% damage per tile moved this turn, up to +30%.',
    },
};
