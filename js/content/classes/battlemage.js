// Battlemage: a Tier 2 class (Evocation + Enchantment), promoted from the Evoker.
//
// File format: js/content/README.md.

export const key = 'battlemage';

export const job = {
    equipmentExpansions: { weapon: ['blade'], armor: ['light'], helmet: ['light'] },
    maxHp: 52, maxMp: 36,
    spd: 8, atk: 12, def: 7, mat: 12, mdf: 7,
    move: 3, eva: 14,
    skillsetName: 'Battle Arts',
    tier: 2,
    learnable: {
        arcane_strike: { sp: 1 },
        force_pulse: { sp: 1, requires: 'arcane_strike' },
        blade_storm: { sp: 2, requires: 'force_pulse' },
        arcane_rebuke: { sp: 1, requires: 'arcane_strike' },
        arcane_weapon: { sp: 2, requires: 'arcane_strike' },
    },
    spriteKey: 'royal_mage',
    char: 'B', color: '#aa88ff',
    schools: ['evocation', 'enchantment'],
    desc: 'A warrior who weaves enchantments into every swing. The Battlemage fights in melee, using magic to hit harder and to slow or stun targets. Balanced stats mean no single weakness, but no standout strength either.',
    ai: { script: 'melee', melee: true },
};

export const abilities = {
    arcane_strike: {
        extends: 'attack',
        name: 'Arcane Strike',
        actionCost: 40,
        basePower: 1.15,
        applyStatus: 'slow',
        statusDuration: 1,
        desc: 'Arcane force runs down the blade. Hits harder than a normal attack and slows the target for {turns}.',
    },

    force_pulse: {
        name: 'Force Pulse',
        type: 'magic',
        range: 2,
        aoe: 1,
        requiresLos: false,
        mpCost: 14,
        actionCost: 55,
        targetType: 'enemy',
        basePower: 0.9,
        element: 'arcane',
        animType: 'cast',
        projectileColor: '#cc88ff',
        chargeTime: 25,
        applyStatus: 'stun',
        statusDuration: 1,
        desc: 'A concussive burst of raw force. Damages every enemy in the area and stuns them for {turns}.',
    },

    blade_storm: {
        extends: 'attack',
        name: 'Blade Storm',
        aoe: 1,
        actionCost: 55,
        basePower: 0.75,
        desc: 'A whirling, spell-driven sweep. Hits the target and every enemy beside them.',
    },

    arcane_rebuke: {
        extends: 'counter',
        name: 'Arcane Rebuke',
        chance: 0.45,
        counterWith: 'arcane_strike',
        desc: 'When struck in melee, may answer with an Arcane Strike that slows the attacker for 1 turn.',
    },

    arcane_weapon: {
        extends: 'support',
        name: 'Arcane Weapon',
        passiveMpCost: 1, dmgDealt: null,
        matToPhysical: 0.5,
        desc: 'Your weapon is sheathed in magic. Half your MAT is added to ATK for physical damage. Costs 1 MP per turn.',
    },
};
