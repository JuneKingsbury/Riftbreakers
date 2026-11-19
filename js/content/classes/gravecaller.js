// Gravecaller: a starting class (Necromancy). Promotes into the Lich or the Gravewarden.
//
// File format: js/content/README.md.

export const key = 'gravecaller';

export const job = {
    maxHp: 42, maxMp: 44,
    spd: 7, atk: 6, def: 5, mat: 13, mdf: 9,
    move: 3, eva: 10,
    skillsetName: 'Necromancy',
    tier: 1,
    promotions: ['lich', 'gravewarden'],
    learnable: {
        life_drain: { sp: 1 },
        grave_chill: { sp: 1, requires: 'life_drain' },
        raise_dead: { sp: 1, requires: 'life_drain' },
        corpse_burst: { sp: 2, requires: 'raise_dead' },
        lingering_spite: { sp: 1, requires: 'life_drain' },
        soul_harvest: { sp: 2, requires: 'grave_chill' },
        wraithwalk: { sp: 1 },
    },
    builds: [
        {
            key: 'drain', name: 'Life Drain',
            desc: 'Stay alive by draining your foes: Life Drain heals you for half the damage it deals, Grave Chill slows anyone chasing you, and Soul Harvest refills MP whenever anyone falls.',
            steps: ['grave_chill', 'life_drain+', 'soul_harvest', 'life_drain+', 'lingering_spite', 'grave_chill+', 'wraithwalk'],
        },
        {
            key: 'corpses', name: 'Corpse Magic',
            desc: 'Turn every fallen enemy into an advantage: Raise Dead brings one back as a skeleton that fights for you, or Corpse Burst blows it up to hurt the enemies around it.',
            steps: ['raise_dead', 'corpse_burst', 'grave_chill', 'soul_harvest', 'corpse_burst+', 'raise_dead+', 'corpse_burst+'],
        },
    ],
    spriteKey: 'void_acolyte',
    char: 'N', color: '#7acc7a',
    schools: ['necromancy'],
    desc: 'A mage who bargains with the dead. The Gravecaller drains life to stay standing, and treats every knocked-out enemy as a resource: raise it as a skeleton, or burst it among its friends. Grows stronger as the battle wears on.',
    allowedEquipment: { armor: ['cloth', 'light'], helmet: ['cloth', 'light'], weapon: ['magic'], tool: ['implement'] },
    role: 'Life-draining necromancer',
    unlock: { type: 'renown', order: 7 },
    startingGear: { armor: 'wool_tunic', helmet: 'wool_cap', weapon: 'wooden_wand', tool: 'lantern' },
    ai: { ranged: true, keep: 3 },
};

export const abilities = {
    life_drain: {
        name: 'Life Drain', type: 'magic', range: 3, aoe: 0, mpCost: 9, actionCost: 44,
        targetType: 'enemy', basePower: 0.85, element: 'necrotic', animType: 'cast',
        projectileColor: '#7acc7a', chargeTime: 0, drainFrac: 0.5,
        desc: 'Draws the life out of the target. Deals damage and heals you for half of it.',
    },

    grave_chill: {
        name: 'Grave Chill', type: 'magic', range: 4, aoe: 0, mpCost: 10, actionCost: 44,
        targetType: 'enemy', basePower: 0.6, element: 'necrotic', animType: 'cast',
        projectileColor: '#99bbcc', chargeTime: 0, applyStatus: 'slow', statusDuration: 2,
        desc: 'The cold of the grave seeps into the target. Light damage, and they are slowed for {duration} turns.',
    },

    raise_dead: {
        name: 'Raise Dead', type: 'magic', range: 3, aoe: 0, mpCost: 16, actionCost: 50,
        targetType: 'corpse', corpseEffect: 'raise', summonJob: 'skeleton', summonName: 'Skeleton',
        element: 'necrotic', animType: 'cast', projectileColor: '#ccddcc', chargeTime: 20, requiresLos: false,
        desc: 'A knocked-out enemy rises as a skeleton that fights for you. The body is used up.',
    },

    corpse_burst: {
        name: 'Corpse Burst', type: 'magic', range: 4, aoe: 1, mpCost: 14, actionCost: 46,
        targetType: 'corpse', corpseEffect: 'burst', basePower: 1.2, element: 'necrotic', animType: 'cast',
        projectileColor: '#aa66aa', chargeTime: 0, requiresLos: false,
        desc: 'Detonates a knocked-out enemy, damaging every enemy next to it. The body is used up.',
    },

    lingering_spite: {
        extends: 'brace', name: 'Lingering Spite', trigger: 'onDown', chance: 1, selfStatus: null,
        downBurst: 'spite_burst',
        desc: 'When you are knocked out, your spite bursts out and hurts every adjacent enemy.',
    },

    spite_burst: {
        name: 'Spite Burst', type: 'magic', range: 1, aoe: 0, mpCost: 0, actionCost: 0,
        targetType: 'enemy', basePower: 0.9, element: 'necrotic', animType: 'cast',
        projectileColor: '#aa66aa', chargeTime: 0,
        desc: 'The burst of Lingering Spite.',
    },

    soul_harvest: {
        extends: 'support', name: 'Soul Harvest', passiveMpCost: 0, dmgDealt: null, mpOnFall: 8,
        desc: 'Whenever anyone on the field falls, friend or foe, you regain 8 MP.',
    },

    wraithwalk: {
        extends: 'move_plus_1', name: 'Wraithwalk', moveBonus: 0, passThroughUnits: true,
        desc: 'Walk half in the world of the dead. You pass through other units.',
    },
};
