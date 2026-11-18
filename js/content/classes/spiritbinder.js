// Spiritbinder: a Tier 2 class (Enchantment + Conjuration), promoted from the Spellblade.
//
// File format: js/content/README.md.

export const key = 'spiritbinder';

export const job = {
    equipmentExpansions: { weapon: ['magic'], armor: ['cloth'], helmet: ['cloth'] },
    maxHp: 38, maxMp: 50,
    spd: 8, atk: 6, def: 4, mat: 14, mdf: 9,
    move: 4, eva: 16,
    skillsetName: 'Spiritbinding',
    tier: 2,
    learnable: {
        spirit_lash: { sp: 1 },
        call_wisp: { sp: 1, requires: 'spirit_lash' },
        haunting: { sp: 2, requires: 'call_wisp' },
        spirit_hush: { sp: 1, requires: 'spirit_lash' },
        spirit_pact: { sp: 2, requires: 'spirit_lash' },
    },
    spriteKey: 'shadow_imp',
    char: 'X', color: '#aaccff',
    schools: ['enchantment', 'conjuration'],
    desc: 'A medium who binds spirits and sets them on the living. Spirit Lash slows targets at range, a summoned wisp joins the fight, and Haunting stuns a group after a charge. Fragile but slippery, and good at taking turns away from the enemy.',
    ai: { script: 'ranged_summoner', ranged: true, keep: 3 },
};

export const abilities = {
    spirit_lash: {
        name: 'Spirit Lash',
        type: 'magic',
        range: 3,
        aoe: 0,
        mpCost: 10,
        actionCost: 45,
        targetType: 'enemy',
        basePower: 1.0,
        element: 'spirit',
        animType: 'cast',
        projectileColor: '#aaccff',
        chargeTime: 0,
        applyStatus: 'slow',
        statusDuration: 2,
        desc: 'Sets a bound spirit on the target. Its ghostly chill deals damage and slows them for {turns}.',
    },

    haunting: {
        extends: 'spirit_lash',
        name: 'Haunting',
        range: 4,
        aoe: 1,
        mpCost: 16,
        actionCost: 50,
        basePower: 0.85,
        projectileColor: '#8899ff',
        chargeTime: 40,
        applyStatus: 'stun',
        statusDuration: 1,
        desc: 'A spirit seizes the target and everyone beside them, then tears free. Damages them all and stuns them for {turns}.',
    },

    spirit_hush: {
        extends: 'brace',
        name: 'Spirit Hush',
        trigger: 'magicHit', chance: 0.4,
        selfStatus: null,
        attackerStatus: { status: 'silence', duration: 2 },
        desc: 'When hit by magic, a guardian spirit may clamp a hand over the caster\'s mouth. They are silenced for 2 turns.',
    },

    spirit_pact: {
        extends: 'support',
        name: 'Spirit Pact',
        passiveMpCost: 0, dmgDealt: null,
        summonBoost: 0.3,
        desc: 'Creatures you summon share your strength. They get +30% HP, ATK and MAT.',
    },

    call_wisp: {
        name: 'Call Wisp',
        type: 'magic',
        range: 2,
        aoe: 0,
        mpCost: 18,
        actionCost: 50,
        targetType: 'tile',
        isSummon: true,
        summonJob: 'summoned_wisp',
        summonName: 'Wisp',
        element: 'spirit',
        animType: 'cast',
        projectileColor: '#8888ff',
        chargeTime: 0,
        requiresLos: false,
        desc: 'Binds a spectral wisp to fight for you. It chills enemies from range and can put them to sleep.',
    },
};
