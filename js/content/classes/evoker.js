// Evoker: a starting class (Evocation). Promotes into the Battlemage or the Riftcaller.
//
// File format: js/content/README.md.

export const key = 'evoker';

export const job = {
    maxHp: 38, maxMp: 52,
    spd: 7, atk: 6, def: 3, mat: 15, mdf: 7,
    move: 3, eva: 11,
    skillsetName: 'Evocation',
    tier: 1,
    promotions: ['battlemage', 'riftcaller'],
    learnable: {
        fire: { sp: 1 },
        ice: { sp: 1, requires: 'fire' },
        thunder: { sp: 1, requires: 'fire' },
        flare: { sp: 2, requires: 'thunder' },
        flame_retort: { sp: 1, requires: 'fire' },
        mana_surge: { sp: 2, requires: 'ice' },
        mana_stride: { sp: 1 },
    },
    spriteKey: 'royal_mage',
    char: 'V', color: '#ff8844',
    schools: ['evocation'],
    desc: 'A mage devoted to pure destruction. The Evoker hurls fire, ice and lightning from a distance, but has little HP and even less defense. The simplest way to deal heavy damage.',
    allowedEquipment: { armor: ['cloth'], helmet: ['cloth'], weapon: ['magic'], tool: ['implement'] },
    role: 'Ranged magic damage',
    unlock: { type: 'base', order: 2 },
    startingGear: { armor: 'wool_tunic', helmet: 'wool_cap', weapon: 'wooden_wand' },
    ai: { script: 'ranged', scriptRange: 3, ranged: true, keep: 3 },
};

export const abilities = {
    fire: {
        name: 'Fire',
        type: 'magic',
        range: 3,
        aoe: 1,
        mpCost: 12,
        actionCost: 50,
        targetType: 'enemy',
        basePower: 1.1,
        element: 'fire',
        animType: 'cast',
        projectileColor: '#ff6622',
        chargeTime: 30,
        requiresLos: false,
        desc: 'A burst of flame dropped onto the target. It burns every enemy beside them too.',
    },

    ice: {
        extends: 'fire',
        name: 'Ice',
        aoe: 0,
        requiresLos: true,
        mpCost: 10,
        basePower: 1.0,
        element: 'ice',
        applyStatus: 'slow',
        statusDuration: 2,
        projectileColor: '#88ddff',
        chargeTime: 25,
        desc: 'A shard of ice that chills the target to the bone. Deals damage and slows them for {turns}.',
    },

    thunder: {
        extends: 'fire',
        name: 'Thunder',
        range: 4,
        aoe: 1,
        requiresLos: true,
        mpCost: 14,
        basePower: 1.2,
        element: 'thunder',
        projectileColor: '#ffee44',
        chargeTime: 45,
        desc: 'A bolt of lightning that strikes the target and arcs into every enemy beside them.',
    },

    mana_surge: {
        name: 'Mana Surge',
        type: 'passive',
        slot: 'support',
        passive: true,
        passiveMpCost: 2,
        range: 0,
        aoe: 0,
        mpCost: 0,
        actionCost: 0,
        targetType: 'self',
        dmgDealt: { magic: 1.15 },
        desc: 'A steady trickle of MP feeds every spell you cast. Magic damage +15%. Costs 2 MP per turn.',
        chargeTime: 0,
    },

    flame_retort: {
        extends: 'brace',
        name: 'Flame Retort',
        trigger: 'magicHit', chance: 0.3,
        selfStatus: null,
        counterWith: 'fire',
        desc: 'When hit by magic, you may answer with a Fire spell at the caster, if they are in range. It costs MP as usual.',
    },

    flare: {
        extends: 'fire',
        name: 'Flare',
        range: 4, aoe: 0,
        requiresLos: true,
        mpCost: 26, actionCost: 60,
        basePower: 1.9,
        element: 'arcane',
        projectileColor: '#ffffff',
        chargeTime: 55,
        desc: 'The pinnacle of evocation. A single point of white-hot force that devastates one target.',
    },

    mana_stride: {
        extends: 'move_plus_1',
        name: 'Mana Stride',
        moveBonus: 0,
        onMove: { mpPct: 0.1 },
        desc: 'Draw ambient mana from the ground you cross. Restore 10% of your max MP after moving.',
    },
};
