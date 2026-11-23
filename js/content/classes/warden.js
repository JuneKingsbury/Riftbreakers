// Warden: a starting class (Abjuration). Promotes into the Paladin or the Bastion.
//
// File format: js/content/README.md.

export const key = 'warden';

export const job = {
    maxHp: 44, maxMp: 42,
    spd: 7, atk: 7, def: 7, mat: 10, mdf: 11,
    move: 3, eva: 12,
    skillsetName: 'Abjuration',
    tier: 1,
    promotions: ['paladin', 'bastion'],
    learnable: {
        ward: { sp: 1 },
        cure: { sp: 1, requires: 'ward' },
        stone_aegis: { sp: 1, requires: 'ward' },
        arcane_veil: { sp: 2, requires: 'stone_aegis' },
        guardian_ward: { sp: 1, requires: 'ward' },
        iron_will: { sp: 2, requires: 'cure' },
        sentinel_step: { sp: 1 },
    },
    builds: [
        {
            key: 'healer', name: 'Healing',
            desc: 'Keep the party standing: Ward heals one ally, Guardian Ward heals allies next to you on its own when they\'re hit, and Cure removes harmful statuses.',
            steps: ['guardian_ward', 'ward+', 'cure', 'ward+', 'sentinel_step', 'guardian_ward+', 'iron_will', 'cure+', 'guardian_ward+'],
        },
        {
            key: 'shields', name: 'Shielding',
            desc: 'Stop damage before it lands: Stone Aegis cuts the physical damage an ally takes, Arcane Veil cuts magic damage, and Sentinel Step raises DEF for allies around you.',
            steps: ['stone_aegis', 'sentinel_step', 'arcane_veil', 'guardian_ward', 'stone_aegis+', 'arcane_veil+', 'stone_aegis+', 'arcane_veil+'],
        },
    ],
    spriteKey: 'npc_ally',
    char: 'A', color: '#88ccaa',
    schools: ['abjuration'],
    desc: 'A defensive mage who keeps allies standing with barriers, wards and simple healing. The Warden deals little damage, but the party lasts much longer with one around.',
    // A protector: armored, with a shield, casting its wards through a wand or staff.
    allowedEquipment: { armor: ['medium'], helmet: ['medium'], weapon: ['magic'], tool: ['shield', 'implement'] },
    role: 'Healer and protector',
    unlock: { type: 'base', order: 1 },
    startingGear: { armor: 'iron_brigandine', helmet: 'iron_helmet', weapon: 'wooden_wand', tool: 'iron_shield' },
    ai: { script: 'healer', keep: 3, healer: true },
};

export const abilities = {
    cure: {
        name: 'Cure',
        type: 'magic',
        range: 2,
        aoe: 0,
        mpCost: 8,
        actionCost: 40,
        targetType: 'ally',
        isCure: true,
        animType: 'cast',
        projectileColor: '#aaffcc',
        chargeTime: 0,
        desc: 'Washes an ally clean of poison, sleep, curses and every other harmful status.',
    },

    // Warden basic: a modest single-target heal, weaker than full Heal
    ward: {
        name: 'Ward',
        type: 'magic',
        range: 3,
        aoe: 0,
        mpCost: 10,
        actionCost: 38,
        targetType: 'ally',
        basePower: 0.6,
        isHeal: true,
        animType: 'cast',
        projectileColor: '#88ccaa',
        chargeTime: 0,
        desc: 'A simple protective charm. Restores a modest amount of HP to one ally.',
    },

    // PROTECT — reduce incoming physical damage by 25%
    stone_aegis: {
        name: 'Stone Aegis',
        type: 'magic',
        range: 3,
        aoe: 0,
        mpCost: 12,
        actionCost: 42,
        targetType: 'ally',
        basePower: 0,
        element: 'earth',
        animType: 'cast',
        projectileColor: '#aa8855',
        chargeTime: 0,
        applyStatus: 'protect',
        statusDuration: 3,
        desc: 'Wraps an ally in transmuted stone. Protect cuts the physical damage they take by 25% for {turns}.',
    },

    // SHELL — reduce incoming magic damage by 25%
    arcane_veil: {
        name: 'Arcane Veil',
        type: 'magic',
        range: 3,
        aoe: 0,
        mpCost: 12,
        actionCost: 42,
        targetType: 'ally',
        basePower: 0,
        element: 'arcane',
        animType: 'cast',
        projectileColor: '#88aaff',
        chargeTime: 0,
        applyStatus: 'shell',
        statusDuration: 3,
        desc: 'Wraps an ally in an arcane ward. Shell cuts the magic damage they take by 25% for {turns}.',
    },

    guardian_ward: {
        extends: 'brace',
        name: 'Guardian Ward',
        trigger: 'allyHit', chance: 0.4,
        selfStatus: null,
        allyCast: 'ward',
        desc: 'When an adjacent ally is hurt, you may cast Ward on them. It costs your MP as usual.',
    },

    iron_will: {
        extends: 'support',
        name: 'Iron Will',
        passiveMpCost: 0, dmgDealt: null,
        statusImmune: ['stun', 'sleep', 'charm', 'berserk'],
        desc: 'An unbreakable mind. You are immune to Stun, Sleep, Charm and Berserk.',
    },

    sentinel_step: {
        extends: 'move_plus_1',
        name: 'Sentinel Step',
        moveBonus: 0,
        onMove: { alliesBuff: { stat: 'def', value: 4, duration: 1 } },
        desc: 'Take up a guarding position. After moving, you and adjacent allies gain DEF +4 for 1 turn.',
    },
};
