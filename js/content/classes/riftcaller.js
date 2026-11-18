// Riftcaller: a Tier 2 class (Evocation + Conjuration), promoted from the Evoker.
//
// File format: js/content/README.md.

export const key = 'riftcaller';

export const job = {
    equipmentExpansions: { weapon: ['magic'] },
    maxHp: 34, maxMp: 56,
    spd: 8, atk: 5, def: 3, mat: 16, mdf: 8,
    move: 4, eva: 16,
    skillsetName: 'Riftcraft',
    tier: 2,
    learnable: {
        rift_bolt: { sp: 1 },
        void_burst: { sp: 1, requires: 'rift_bolt' },
        gravity_well: { sp: 2, requires: 'void_burst' },
        phase_shift: { sp: 1, requires: 'rift_bolt' },
        spell_pierce: { sp: 2, requires: 'rift_bolt' },
    },
    spriteKey: 'spell_wraith',
    char: 'R', color: '#55aaff',
    schools: ['evocation', 'conjuration'],
    desc: 'A sorcerer who tears open space itself. The Riftcaller picks off targets from long range with Rift Bolt, then sets off Void Burst when enemies bunch up. Quick and far-reaching, but fragile up close.',
    ai: { script: 'ranged', scriptRange: 4, ranged: true, keep: 4 },
};

export const abilities = {
    rift_bolt: {
        name: 'Rift Bolt',
        type: 'magic',
        range: 5,
        aoe: 1,
        mpCost: 16,
        actionCost: 50,
        targetType: 'enemy',
        basePower: 1.25,
        element: 'void',
        animType: 'cast',
        projectileColor: '#55aaff',
        chargeTime: 40,
        desc: 'Tears a pinhole rift in space and blasts the target with whatever pours through. Enemies right beside them are caught too.',
    },

    void_burst: {
        extends: 'rift_bolt',
        name: 'Void Burst',
        range: 3,
        aoe: 2,
        requiresLos: false,
        mpCost: 20,
        actionCost: 55,
        basePower: 0.8,
        projectileColor: '#3355ff',
        chargeTime: 50,
        desc: 'Opens a rift that collapses violently outward, hitting every enemy in a wide area.',
    },

    gravity_well: {
        extends: 'rift_bolt',
        name: 'Gravity Well',
        range: 4, aoe: 1,
        requiresLos: false,
        mpCost: 18, actionCost: 50,
        basePower: 0.6,
        projectileColor: '#3344aa',
        chargeTime: 30,
        applyStatus: 'slow', statusDuration: 2,
        desc: 'Collapses a pocket of space into crushing weight. Damages every enemy inside and slows them for {turns}.',
    },

    phase_shift: {
        extends: 'brace',
        name: 'Phase Shift',
        trigger: 'anyHit', chance: 0.4,
        selfStatus: null,
        phaseAway: 3,
        desc: 'When hit, you may slip through a rift and reappear up to 3 tiles away, as far from the attacker as you can get.',
    },

    spell_pierce: {
        extends: 'support',
        name: 'Spell Pierce',
        passiveMpCost: 1, dmgDealt: null,
        mdfPierce: 0.5,
        desc: 'Your spells arrive from just outside reality. They ignore half the target\'s MDF. Costs 1 MP per turn.',
    },
};
