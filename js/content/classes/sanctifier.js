// Sanctifier: a Tier 2 class (Enchantment + Abjuration), promoted from the Spellblade.
//
// File format: js/content/README.md.

export const key = 'sanctifier';

export const job = {
    equipmentExpansions: { weapon: ['magic'], armor: ['cloth'], helmet: ['cloth'] },
    maxHp: 44, maxMp: 52,
    spd: 7, atk: 6, def: 8, mat: 11, mdf: 13,
    move: 3, eva: 12,
    skillsetName: 'Sanctity',
    tier: 2,
    learnable: {
        holy_bind: { sp: 1 },
        radiant_heal: { sp: 1, requires: 'holy_bind' },
        holy_chains: { sp: 2, requires: 'radiant_heal' },
        purifying_light: { sp: 1, requires: 'holy_bind' },
        benediction: { sp: 2, requires: 'holy_bind' },
    },
    spriteKey: 'npc_ally',
    char: 'H', color: '#ffeeaa',
    schools: ['enchantment', 'abjuration'],
    desc: 'A holy support who mixes control with healing. Holy Bind stuns enemies at range, Holy Chains stuns whole groups, and Radiant Heal keeps allies fighting. The enemy can never safely ignore a Sanctifier.',
    ai: { script: 'healer', keep: 3, healer: true },
};

export const abilities = {
    holy_bind: {
        name: 'Holy Bind',
        type: 'magic',
        range: 3,
        aoe: 0,
        mpCost: 10,
        actionCost: 45,
        targetType: 'enemy',
        basePower: 0.4,
        element: 'holy',
        animType: 'cast',
        projectileColor: '#ffffaa',
        chargeTime: 0,
        applyStatus: 'stun',
        statusDuration: 1,
        desc: 'Chains of holy light hold the target fast. Light damage, and a stun that lasts {turns}.',
    },

    radiant_heal: {
        extends: 'heal',
        name: 'Radiant Heal',
        range: 4,
        mpCost: 18,
        basePower: 1.1,
        projectileColor: '#ffeeaa',
        desc: 'A stronger prayer that reaches farther. Restores a large amount of HP to one ally.',
    },

    holy_chains: {
        extends: 'holy_bind',
        name: 'Holy Chains',
        aoe: 1,
        mpCost: 22, actionCost: 50,
        chargeTime: 40,
        desc: 'Chains of light lash out across an area. Every enemy caught takes light damage and is stunned for {turns}.',
    },

    purifying_light: {
        extends: 'brace',
        name: 'Purifying Light',
        trigger: 'statusHit', chance: 0.6,
        selfStatus: null,
        cleanseSelf: true,
        desc: 'When hit with a harmful status, holy light may burn it away.',
    },

    benediction: {
        extends: 'support',
        name: 'Benediction',
        passiveMpCost: 0, dmgDealt: null,
        healMult: 1.3,
        desc: 'Your prayers carry extra grace. Healing is 30% stronger.',
    },
};
