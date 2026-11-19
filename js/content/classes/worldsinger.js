// Worldsinger: a Tier 2 class (Enchantment + Transmutation), promoted from the Stoneshaper.
//
// File format: js/content/README.md.

export const key = 'worldsinger';

export const job = {
    equipmentExpansions: { weapon: ['magic'] },
    maxHp: 40, maxMp: 46,
    spd: 7, atk: 6, def: 5, mat: 13, mdf: 10,
    move: 4, eva: 14,
    skillsetName: 'Worldsong',
    tier: 2,
    learnable: {
        verdant_lash: { sp: 1 },
        toxic_spores: { sp: 1, requires: 'verdant_lash' },
        call_thorn_beast: { sp: 2, requires: 'toxic_spores' },
        thorn_hide: { sp: 1, requires: 'verdant_lash' },
        regen_aura: { sp: 2, requires: 'verdant_lash' },
    },
    builds: [
        {
            key: 'poison', name: 'Poison',
            desc: 'Poison groups of enemies with Toxic Spores and let it work over time. Regen Aura heals you a little every turn, and Verdant Lash slows anything that comes close.',
            steps: ['toxic_spores', 'toxic_spores+', 'regen_aura', 'verdant_lash+', 'toxic_spores+', 'call_thorn_beast', 'thorn_hide'],
        },
        {
            key: 'summoner', name: 'Summoner',
            desc: 'Let a Thorn Beast do the fighting: it pelts enemies from range while Verdant Lash slows anything that comes for you. Thorn Hide hurts anyone who hits you in melee.',
            steps: ['toxic_spores', 'call_thorn_beast', 'regen_aura', 'call_thorn_beast+', 'verdant_lash+', 'thorn_hide', 'call_thorn_beast+'],
        },
    ],
    spriteKey: 'npc_ally',
    char: 'W', color: '#66dd22',
    schools: ['enchantment', 'transmutation'],
    desc: 'A nature mage who turns living growth into weapons. Verdant Lash slows as it strikes, Toxic Spores poisons whole groups, and a summoned Thorn Beast pelts enemies from range. Regen Aura keeps them on their feet through a long fight.',
    ai: { script: 'ranged_summoner', ranged: true, keep: 3 },
};

export const abilities = {
    regen_aura: {
        extends: 'support',
        name: 'Regen Aura',
        passiveMpCost: 1,
        dmgDealt: null,
        turnRegenHp: 5,
        desc: 'Living growth knits your wounds closed. Heal 5 HP at the start of each turn. Costs 1 MP per turn.',
    },

    verdant_lash: {
        name: 'Verdant Lash',
        type: 'magic',
        range: 3,
        aoe: 0,
        mpCost: 10,
        actionCost: 45,
        targetType: 'enemy',
        basePower: 1.0,
        element: 'nature',
        animType: 'cast',
        projectileColor: '#66dd22',
        chargeTime: 0,
        applyStatus: 'slow',
        statusDuration: 1,
        desc: 'A whip of enchanted vine. Deals damage and tangles the target\'s legs, slowing them for {turns}.',
    },

    // POISON — AoE poison cloud
    toxic_spores: {
        name: 'Toxic Spores',
        type: 'magic',
        range: 3,
        aoe: 1,
        requiresLos: false,
        mpCost: 12,
        actionCost: 48,
        targetType: 'enemy',
        basePower: 0.4,
        element: 'nature',
        animType: 'cast',
        projectileColor: '#88ff22',
        chargeTime: 20,
        applyStatus: 'poison',
        statusDuration: 3,
        desc: 'A burst of toxic spores. Light damage, and every enemy in the area is poisoned for {turns}.',
    },

    thorn_hide: {
        extends: 'counter',
        name: 'Thorn Hide',
        chance: 1,
        counterWith: null,
        thornsFrac: 0.3,
        desc: 'Bark and thorn cover your skin. Whoever hits you in melee takes back 30% of the damage they dealt.',
    },

    call_thorn_beast: {
        name: 'Call Thorn Beast',
        type: 'magic',
        range: 2,
        aoe: 0,
        mpCost: 20,
        actionCost: 50,
        targetType: 'tile',
        isSummon: true,
        summonJob: 'summoned_thorn_beast',
        summonName: 'Thorn Beast',
        element: 'nature',
        animType: 'cast',
        projectileColor: '#449922',
        chargeTime: 0,
        requiresLos: false,
        desc: 'Calls a thorn beast that pelts enemies with thorns from range.',
    },
};
