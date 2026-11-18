// Bastion: a Tier 2 class (Abjuration + Transmutation), promoted from the Warden.
//
// File format: js/content/README.md.

export const key = 'bastion';

export const job = {
    equipmentExpansions: { armor: ['heavy'], helmet: ['heavy'] },
    maxHp: 56, maxMp: 38,
    spd: 6, atk: 9, def: 12, mat: 10, mdf: 13,
    move: 3, eva: 8,
    skillsetName: 'Bulwark Rites',
    tier: 2,
    learnable: {
        bulwark: { sp: 1 },
        ward_circle: { sp: 1, requires: 'bulwark' },
        grasping_stone: { sp: 2, requires: 'ward_circle' },
        mana_shell: { sp: 1, requires: 'bulwark' },
        unbreakable: { sp: 2, requires: 'bulwark' },
    },
    spriteKey: 'kingdom_guard',
    char: 'B', color: '#99bbaa',
    schools: ['abjuration', 'transmutation'],
    desc: 'A warden who turns flesh to stone and wards to walls. The Bastion hardens allies against blows and spells, rings the line with Shell, and pins the enemy in place with grasping stone. Slow, but very hard to bring down.',
    ai: { script: 'melee', melee: true },
};

export const abilities = {
    bulwark: {
        name: 'Bulwark', type: 'magic', range: 3, aoe: 0, mpCost: 12, actionCost: 42,
        targetType: 'ally', basePower: 0, element: 'earth', animType: 'cast',
        projectileColor: '#bbaa88', chargeTime: 0,
        applyStatus: 'protect', statusDuration: 3,
        buffs: [{ stat: 'mdf', value: 3, duration: 3 }],
        desc: 'Turns an ally\'s skin to living stone. They gain Protect for {turns} and MDF +{buff:mdf} for 3 turns.',
    },

    ward_circle: {
        name: 'Ward Circle', type: 'magic', range: 0, aoe: 1, mpCost: 16, actionCost: 45,
        targetType: 'ally', basePower: 0, element: 'arcane', animType: 'cast',
        projectileColor: '#aaccdd', chargeTime: 0,
        applyStatus: 'shell', statusDuration: 3,
        desc: 'Draws a ring of runes around your feet. You and every adjacent ally gain Shell for {turns}.',
    },

    grasping_stone: {
        name: 'Grasping Stone', type: 'magic', range: 3, aoe: 1, requiresLos: false, mpCost: 18, actionCost: 50,
        targetType: 'enemy', basePower: 0.6, element: 'earth', animType: 'cast',
        projectileColor: '#998866', chargeTime: 35,
        applyStatus: 'slow', statusDuration: 2,
        desc: 'Stone hands rise from the ground and seize everyone in the area. Damages each enemy and slows them for {turns}.',
    },

    mana_shell: {
        extends: 'brace', name: 'Mana Shell', trigger: 'magicHit', chance: 0.5, selfStatus: 'shell',
        desc: 'When a spell hits you, you may harden your wards against the next. You gain Shell.',
    },

    unbreakable: {
        extends: 'support', name: 'Unbreakable', passiveMpCost: 0, dmgDealt: null,
        dmgTaken: { physical: 0.85, magic: 0.85 },
        desc: 'Stone in body and will. All damage you take is 15% lower.',
    },
};
