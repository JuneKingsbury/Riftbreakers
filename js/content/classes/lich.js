// Lich: a Tier 2 class (Necromancy + Evocation), promoted from the Gravecaller.
//
// File format: js/content/README.md.

export const key = 'lich';

export const job = {
    maxHp: 38, maxMp: 58,
    spd: 7, atk: 5, def: 4, mat: 16, mdf: 10,
    move: 3, eva: 10,
    skillsetName: 'Undeath',
    tier: 2,
    learnable: {
        soul_nova: { sp: 1 },
        wither: { sp: 1, requires: 'soul_nova' },
        bone_spear: { sp: 2, requires: 'soul_nova' },
        phylactery: { sp: 1, requires: 'soul_nova' },
        necrotic_power: { sp: 2, requires: 'wither' },
    },
    builds: [
        {
            key: 'area', name: 'Area Drain',
            desc: 'Drain whole groups: Soul Nova damages every enemy in an area and heals you for part of it. Soul Harvest (from the Gravecaller) refills MP as enemies fall, and Phylactery brings you back once.',
            steps: ['soul_nova+', 'phylactery', 'soul_harvest', 'soul_nova+', 'wither', 'corpse_burst'],
        },
        {
            key: 'single', name: 'Single Target',
            desc: 'Destroy single targets: Bone Spear hits from 5 tiles away with no wait, and Wither drains a huge amount of HP after a short charge. Necrotic Power makes your drains heal more.',
            steps: ['bone_spear', 'wither', 'bone_spear+', 'phylactery', 'wither+', 'necrotic_power', 'bone_spear+'],
        },
    ],
    spriteKey: 'void_herald',
    char: 'X', color: '#88ee99',
    schools: ['necromancy', 'evocation'],
    desc: 'A gravecaller who has stopped fearing death. The Lich drains whole groups with Soul Nova, withers single foes to husks, and rises again once when struck down. The strongest sustained damage of the necromancers.',
    ai: { ranged: true, keep: 3 },
};

export const abilities = {
    soul_nova: {
        extends: 'life_drain', name: 'Soul Nova', aoe: 1, mpCost: 20, actionCost: 50, basePower: 0.7,
        drainFrac: 0.3, chargeTime: 25, requiresLos: false,
        desc: 'Tears the life from every enemy in an area and heals you for 30% of the damage.',
    },

    wither: {
        extends: 'life_drain', name: 'Wither', mpCost: 22, basePower: 1.6, chargeTime: 35,
        desc: 'A long, terrible draining. Heavy damage after a charge, and half of it returns to you as HP.',
    },

    bone_spear: {
        name: 'Bone Spear', type: 'magic', range: 5, aoe: 0, mpCost: 14, actionCost: 46,
        targetType: 'enemy', basePower: 1.15, element: 'necrotic', animType: 'cast',
        projectileColor: '#eeeedd', chargeTime: 0,
        desc: 'Hurls a lance of sharpened bone a long way.',
    },

    phylactery: {
        extends: 'brace', name: 'Phylactery', trigger: 'onDown', chance: 1, oncePerBattle: true,
        selfStatus: null, reviveFrac: 0.3,
        desc: 'Your soul is kept elsewhere. The first time you are knocked out, you rise again with 30% HP.',
    },

    necrotic_power: {
        extends: 'support', name: 'Necrotic Power', passiveMpCost: 1, dmgDealt: null, drainMult: 1.2,
        desc: 'Your drains heal you 20% more. Costs 1 MP per turn.',
    },
};
