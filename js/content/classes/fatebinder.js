// Fatebinder: a Tier 2 class (Enchantment + Divination), promoted from the Seer.
//
// File format: js/content/README.md.

export const key = 'fatebinder';

export const job = {
    maxHp: 36, maxMp: 54,
    spd: 8, atk: 5, def: 4, mat: 14, mdf: 10,
    move: 4, eva: 15,
    skillsetName: 'Fateweaving',
    tier: 2,
    learnable: {
        doom_hex: { sp: 1 },
        fate_seal: { sp: 1, requires: 'doom_hex' },
        death_sentence: { sp: 2, requires: 'fate_seal' },
        karmic_rebound: { sp: 1, requires: 'doom_hex' },
        wyrd_drain: { sp: 2, requires: 'doom_hex' },
    },
    spriteKey: 'spell_wraith',
    char: 'F', color: '#cc44aa',
    schools: ['enchantment', 'divination'],
    desc: "A mage who unravels an enemy's destiny from a safe distance. Doom Hex lays a long slow on a target instantly, Fate Seal stuns a small group after a short charge, and Wyrd Drain makes every curse last longer. Frail, but good at holding down even the fastest enemies.",
    ai: { script: 'ranged', scriptRange: 3, ranged: true, keep: 3 },
};

export const abilities = {
    doom_hex: {
        name: 'Doom Hex',
        type: 'magic',
        range: 4,
        aoe: 0,
        mpCost: 10,
        actionCost: 45,
        targetType: 'enemy',
        basePower: 0.95,
        element: 'shadow',
        animType: 'cast',
        projectileColor: '#cc44aa',
        chargeTime: 0,
        applyStatus: 'slow',
        statusDuration: 3,
        desc: 'Wraps the target in a thread of ill fate. Deals damage and slows them for {duration} turns.',
    },

    fate_seal: {
        extends: 'doom_hex',
        name: 'Fate Seal',
        range: 3,
        aoe: 1,
        mpCost: 16,
        actionCost: 50,
        basePower: 0.7,
        projectileColor: '#aa00cc',
        chargeTime: 40,
        applyStatus: 'stun',
        statusDuration: 1,
        desc: 'Freezes a moment in time around the target. Damages them and every enemy beside them, and stuns them all for {turns}.',
    },

    wyrd_drain: {
        extends: 'support',
        name: 'Wyrd Drain',
        passiveMpCost: 2,
        dmgDealt: null,
        statusDurationBonus: 1,
        desc: 'Pulls the threads of fate tight around your victims. Statuses you inflict last 1 turn longer. Costs 2 MP per turn.',
    },

    death_sentence: {
        name: 'Death Sentence',
        type: 'magic',
        range: 3, aoe: 0, mpCost: 24, actionCost: 50,
        targetType: 'enemy', basePower: 0, element: 'shadow',
        animType: 'cast', projectileColor: '#660033', chargeTime: 30,
        applyStatus: 'doom', statusDuration: 3,
        desc: 'Pronounces Doom on the target. When its {duration} turns run out they fall, unless someone cures it first.',
    },

    karmic_rebound: {
        extends: 'brace',
        name: 'Karmic Rebound',
        trigger: 'anyHit', chance: 0.4,
        selfStatus: null,
        attackerStatus: { status: 'enfeebled', duration: 2 },
        desc: 'Harm done to you may come back around. The attacker is enfeebled, ATK -5 for 2 turns.',
    },
};
