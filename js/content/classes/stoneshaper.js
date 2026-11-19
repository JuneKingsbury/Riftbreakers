// Stoneshaper: a starting class (Transmutation). Promotes into the Earthshaker or the Worldsinger.
//
// File format: js/content/README.md.

export const key = 'stoneshaper';

export const job = {
    maxHp: 47, maxMp: 30,
    spd: 8, atk: 11, def: 7, mat: 9, mdf: 7,
    move: 4, eva: 14,
    skillsetName: 'Transmutation',
    tier: 1,
    promotions: ['earthshaker', 'worldsinger'],
    learnable: {
        rock_toss: { sp: 1 },
        earth_skin: { sp: 1, requires: 'rock_toss' },
        stone_fist: { sp: 1, requires: 'rock_toss' },
        calcify: { sp: 2, requires: 'stone_fist' },
        stone_reflex: { sp: 1, requires: 'earth_skin' },
        earthen_footing: { sp: 2, requires: 'stone_fist' },
        stone_stride: { sp: 1 },
    },
    builds: [
        {
            key: 'tank', name: 'Tanking',
            desc: 'Stand in front and soak hits: Earth Skin and Stone Reflex pile on DEF, so enemies wear themselves out on you. Stone Fist gives you a heavy hit back.',
            steps: ['earth_skin', 'stone_reflex', 'stone_fist', 'earth_skin+', 'stone_stride', 'stone_reflex+', 'earth_skin+', 'stone_reflex+', 'stone_fist+'],
        },
        {
            key: 'melee', name: 'Melee Damage',
            desc: 'Hit hard up close: Stone Fist is a crushing blow and Calcify stuns. Stone Stride gets you onto high ground, where Earthen Footing makes your hits land harder.',
            steps: ['stone_fist', 'stone_fist+', 'calcify', 'stone_stride', 'earthen_footing', 'stone_fist+', 'calcify+', 'calcify+'],
        },
    ],
    spriteKey: 'void_brute',
    char: 'T', color: '#aa8855',
    schools: ['transmutation'],
    desc: 'A mage who reshapes stone and earth, turning rock into weapons and armor. The Stoneshaper is a sturdy fighter who does best close to the enemy.',
    allowedEquipment: { armor: ['light', 'medium'], helmet: ['light', 'medium'], weapon: ['blade', 'heavy_weapon'], tool: ['offhand_weapon', 'implement'] },
    role: 'Durable melee bruiser',
    unlock: { type: 'renown', order: 2 },
    startingGear: { armor: 'leather_jacket', helmet: 'leather_cap', weapon: 'wooden_club', tool: 'stone_axe' },
    ai: { script: 'melee', melee: true },
};

export const abilities = {
    // Transmuter basic: hurls a conjured stone at range, purely physical
    rock_toss: {
        name: 'Rock Toss',
        type: 'physical',
        range: 3,
        aoe: 0,
        mpCost: 0,
        actionCost: 38,
        targetType: 'enemy',
        basePower: 0.85,
        animType: 'shot',
        projectileColor: '#886644',
        chargeTime: 0,
        desc: 'Turns loose stone underfoot into a thrown missile. Physical damage at range.',
    },

    // Transmuter: self-buff, raises DEF for 2 turns
    earth_skin: {
        name: 'Earth Skin',
        type: 'magic',
        range: 0,
        aoe: 0,
        mpCost: 10,
        actionCost: 35,
        targetType: 'self',
        animType: 'cast',
        projectileColor: '#886644',
        chargeTime: 0,
        buffs: [{ stat: 'def', value: 8, duration: 2 }],
        floatText: 'DEF UP!',
        desc: 'Your skin hardens into stone. DEF +{buff:def} for 2 turns.',
    },

    stone_reflex: {
        extends: 'brace',
        name: 'Stone Reflex',
        trigger: 'physicalHit', chance: 0.5,
        selfStatus: null,
        selfBuff: { stat: 'def', value: 6, duration: 2 },
        desc: 'When struck by a physical attack, your skin may harden. DEF +6 for 2 turns.',
    },

    stone_stride: {
        extends: 'move_plus_1',
        name: 'Stone Stride',
        moveBonus: 0, ignoreTerrainCost: true,
        desc: 'The earth parts beneath your feet. Every tile costs only 1 Move, whatever the terrain.',
    },

    stone_fist: {
        extends: 'attack',
        name: 'Stone Fist',
        actionCost: 45,
        basePower: 1.35,
        desc: 'Your fist turns to granite mid-swing. A crushing blow.',
    },

    calcify: {
        name: 'Calcify',
        type: 'magic',
        range: 2, aoe: 0, mpCost: 12, actionCost: 45,
        targetType: 'enemy', basePower: 0.3, element: 'earth',
        animType: 'cast', projectileColor: '#bbaa88', chargeTime: 0,
        applyStatus: 'stun', statusDuration: 1,
        desc: 'Turns the target\'s joints briefly to stone. Light damage, and a stun that lasts {turns}.',
    },

    earthen_footing: {
        extends: 'support',
        name: 'Earthen Footing',
        passiveMpCost: 0, dmgDealt: null,
        highGroundMult: 1.5,
        desc: 'The earth answers you. Attacking from higher ground deals +50% damage instead of +25%, and enemies above you get no height bonus.',
    },
};
