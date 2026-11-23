// Paladin: a Tier 2 class (Evocation + Abjuration), promoted from the Warden.
//
// File format: js/content/README.md.

export const key = 'paladin';

export const job = {
    maxHp: 58, maxMp: 28,
    spd: 7, atk: 13, def: 12, mat: 10, mdf: 12,
    move: 3, eva: 12,
    skillsetName: 'Holy Arts',
    tier: 2,
    learnable: {
        smite: { sp: 1 },
        heal: { sp: 1, requires: 'smite' },
        consecrate: { sp: 2, requires: 'heal' },
        retribution: { sp: 1, requires: 'smite' },
        divine_ward: { sp: 2, requires: 'smite' },
    },
    builds: [
        {
            key: 'tank', name: 'Retaliation',
            desc: 'Hold the front line: Divine Ward cuts the physical damage you take, and Retribution answers attackers next to you with a Smite. Each Smite upgrade lowers its MP cost and makes those counters hit harder.',
            steps: ['divine_ward', 'retribution', 'smite+', 'retribution+', 'smite+', 'heal', 'retribution+'],
        },
        {
            key: 'healer', name: 'Healing',
            desc: 'Heal from the front line: Heal restores a solid amount of HP, and Guardian Ward (from the Warden) heals allies next to you on its own when they\'re hit. Smite is there when you need to hit back.',
            steps: ['heal', 'guardian_ward', 'heal+', 'heal+', 'smite+', 'divine_ward', 'guardian_ward+'],
        },
    ],
    spriteKey: 'knight',
    char: 'P', color: '#ffee88',
    schools: ['evocation', 'abjuration'],
    desc: 'A holy warrior who balances divine power with protective magic. The Paladin hits hard up close with Smite, keeps allies alive with Heal, and shrugs off blows through Divine Ward. A durable frontliner, never purely offense or purely defense.',
    equipmentExpansions: { armor: ['heavy'], helmet: ['heavy'] },
    ai: { script: 'melee_healer', melee: true, healer: true },
};

export const abilities = {
    heal: {
        name: 'Heal',
        type: 'magic',
        range: 3,
        aoe: 0,
        mpCost: 18,
        actionCost: 45,
        targetType: 'ally',
        basePower: 1.0,
        isHeal: true,
        animType: 'cast',
        projectileColor: '#66ff99',
        chargeTime: 0,
        desc: 'Closes an ally\'s wounds with gentle magic. Restores a solid amount of HP.',
    },

    smite: {
        name: 'Smite',
        type: 'magic',
        range: 1,
        aoe: 1,
        mpCost: 16,
        actionCost: 50,
        targetType: 'enemy',
        basePower: 1.3,
        element: 'holy',
        animType: 'slash',
        projectileColor: '#fff8aa',
        chargeTime: 35,
        desc: 'Holy fire poured through your weapon into a foe within reach. A heavy blow that also scorches enemies beside them.',
    },

    divine_ward: {
        extends: 'support',
        name: 'Divine Ward',
        passiveMpCost: 1,
        dmgDealt: null,
        dmgTaken: { physical: 0.85 },
        desc: 'A constant barrier of holy force. Physical damage taken -15%. Costs 1 MP per turn.',
    },

    retribution: {
        extends: 'brace',
        name: 'Retribution',
        trigger: 'anyHit', chance: 0.3,
        selfStatus: null,
        counterWith: 'smite',
        desc: 'When struck by an adjacent attacker, you may answer with an instant Smite. It costs MP as usual.',
    },

    consecrate: {
        name: 'Consecrate',
        type: 'magic',
        range: 2, aoe: 1, requiresLos: false, mpCost: 18, actionCost: 50,
        targetType: 'enemy', basePower: 0.8, element: 'holy',
        animType: 'cast', projectileColor: '#fff4bb', chargeTime: 30,
        desc: 'Hallows the ground in a burst of light that sears every enemy standing on it.',
    },
};
