// Alchemist: a starting class (no school). Promotes into the Plaguewright or the Field Surgeon.
// Flasks cost no MP (alchemists have none) but take longer to throw. Most splash
// everyone in the area, friend and foe alike (targetType 'all').
//
// File format: js/content/README.md.

export const key = 'alchemist';

export const job = {
    maxHp: 44, maxMp: 0,
    spd: 8, atk: 8, def: 5, mat: 11, mdf: 6,
    move: 4, eva: 12,
    skillsetName: 'Alchemy',
    tier: 1,
    promotions: ['plaguewright', 'field_surgeon'],
    learnable: {
        healing_draught: { sp: 1 },
        acid_flask: { sp: 1, requires: 'healing_draught' },
        smoke_bomb: { sp: 1, requires: 'healing_draught' },
        quicksilver: { sp: 2, requires: 'smoke_bomb' },
        reflex_tonic: { sp: 1, requires: 'healing_draught' },
        potent_brews: { sp: 2, requires: 'acid_flask' },
        light_pack: { sp: 1 },
    },
    spriteKey: 'raider_poisoner',
    char: 'L', color: '#ccff66',
    schools: [],
    desc: 'Not a mage at all: an alchemist whose flasks splash everyone in reach, friend and foe alike. Heals, acid, smoke and quicksilver need no MP, only time to throw and a good eye for where everyone is standing.',
    allowedEquipment: { armor: ['light'], helmet: ['light'], weapon: ['blade', 'magic'], tool: ['implement'] },
    role: 'Splash healing and damage',
    unlock: { type: 'renown', order: 5 },
    startingGear: { armor: 'leather_jacket', helmet: 'leather_cap', weapon: 'wooden_wand' },
    ai: { ranged: true, keep: 3 },
};

export const abilities = {
    healing_draught: {
        name: 'Healing Draught', type: 'magic', range: 4, aoe: 1, mpCost: 0, actionCost: 62,
        targetType: 'all', basePower: 0.6, isHeal: true, element: 'alchemy', animType: 'cast',
        projectileColor: '#66ff99', chargeTime: 0, requiresLos: false,
        desc: 'A splash of healing tonic. Heals everyone it reaches, enemies included.',
    },

    acid_flask: {
        name: 'Acid Flask', type: 'magic', range: 4, aoe: 1, mpCost: 0, actionCost: 58,
        targetType: 'all', basePower: 0.7, element: 'alchemy', animType: 'cast',
        projectileColor: '#ccff44', chargeTime: 0, requiresLos: false,
        buffs: [{ stat: 'def', value: -4, duration: 3 }],
        desc: 'Burns everyone in the splash, allies included, and lowers their DEF by {buff:def} for 3 turns.',
    },

    smoke_bomb: {
        name: 'Smoke Bomb', type: 'magic', range: 4, aoe: 1, mpCost: 0, actionCost: 50,
        targetType: 'all', basePower: 0, element: 'alchemy', animType: 'cast',
        projectileColor: '#aaaaaa', chargeTime: 0, requiresLos: false,
        applyStatus: 'slipped', statusDuration: 3,
        desc: 'A cloud of smoke. For {turns}, everyone inside, on both sides, dodges the next physical attack against them.',
    },

    quicksilver: {
        name: 'Quicksilver', type: 'magic', range: 4, aoe: 1, mpCost: 0, actionCost: 58,
        targetType: 'all', basePower: 0, element: 'alchemy', animType: 'cast',
        projectileColor: '#ddeeff', chargeTime: 0, requiresLos: false,
        applyStatus: 'haste', statusDuration: 2,
        desc: 'A shimmering splash that hastes everyone it reaches, on both sides, for {turns}.',
    },

    reflex_tonic: {
        extends: 'brace', name: 'Reflex Tonic', trigger: 'lowHp', chance: 1, oncePerBattle: true,
        selfStatus: null, selfCast: 'tonic_draught',
        desc: 'Once per battle, when a blow leaves you below 30% HP, you gulp down a tonic and heal.',
    },

    tonic_draught: {
        name: 'Tonic', type: 'magic', range: 0, aoe: 0, mpCost: 0, actionCost: 0,
        targetType: 'ally', basePower: 1, isHeal: true, element: 'alchemy', animType: 'cast',
        projectileColor: '#66ff99', chargeTime: 0,
        desc: 'The tonic of Reflex Tonic.',
    },

    potent_brews: {
        extends: 'support', name: 'Potent Brews', passiveMpCost: 0,
        dmgDealt: { magic: 1.25, physical: 1.25 }, healMult: 1.25,
        desc: 'Stronger mixtures. All your damage and healing is 25% stronger.',
    },

    light_pack: {
        extends: 'move_plus_1', name: 'Light Pack', moveBonus: 1, climbBonus: 1,
        desc: 'Travel light. Move +1, and climb 1 extra level of elevation.',
    },
};
