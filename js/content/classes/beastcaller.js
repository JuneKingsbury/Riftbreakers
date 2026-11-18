// Beastcaller: a Tier 2 class (Conjuration + Transmutation), promoted from the Runebow.
//
// File format: js/content/README.md.

export const key = 'beastcaller';

export const job = {
    equipmentExpansions: { weapon: ['magic'] },
    maxHp: 48, maxMp: 36,
    spd: 9, atk: 13, def: 6, mat: 10, mdf: 7,
    move: 4, eva: 18,
    skillsetName: 'Beastcalling',
    tier: 2,
    learnable: {
        wild_surge: { sp: 1 },
        call_wolf: { sp: 1, requires: 'wild_surge' },
        savage_howl: { sp: 2, requires: 'call_wolf' },
        feral_counter: { sp: 1, requires: 'wild_surge' },
        bloodlust: { sp: 2, requires: 'wild_surge' },
    },
    spriteKey: 'shadow_imp',
    char: 'C', color: '#cc8833',
    schools: ['conjuration', 'transmutation'],
    desc: 'A shapeshifting fighter with the ferocity of the beasts they call. Wild Surge hits hard and slows, Savage Howl stuns whole groups nearby, and a summoned wolf joins the hunt. Fast and mobile, the Beastcaller belongs in the thick of the enemy line.',
    ai: { script: 'melee_summoner', melee: true },
};

export const abilities = {
    wild_surge: {
        extends: 'attack',
        name: 'Wild Surge',
        actionCost: 40,
        basePower: 1.2,
        applyStatus: 'slow',
        statusDuration: 1,
        desc: 'A savage strike fueled by bestial rage. Hits harder than a normal attack and slows the target for {turns}.',
    },

    savage_howl: {
        name: 'Savage Howl',
        type: 'magic',
        range: 2,
        aoe: 2,
        requiresLos: false,
        mpCost: 14,
        actionCost: 55,
        targetType: 'enemy',
        basePower: 0.75,
        element: 'nature',
        animType: 'cast',
        projectileColor: '#cc8833',
        chargeTime: 40,
        applyStatus: 'stun',
        statusDuration: 1,
        desc: 'A primal howl that rattles everything nearby. Damages every enemy in a wide area and stuns them for {turns}.',
    },

    feral_counter: {
        extends: 'counter',
        name: 'Feral Counter',
        counterWith: 'wild_surge',
        desc: 'When struck in melee, you may lash back with a Wild Surge.',
    },

    bloodlust: {
        extends: 'support',
        name: 'Bloodlust',
        passiveMpCost: 0, dmgDealt: null,
        lowHpDmgDealt: { physical: 1.3 },
        desc: 'Wounds only make the beast angrier. +30% physical damage while below 50% HP.',
    },

    call_wolf: {
        name: 'Call Wolf',
        type: 'magic',
        range: 2,
        aoe: 0,
        mpCost: 24,
        summonLimit: 1,   // one wolf at a time
        // Slower than a wild wolf (SPD 13 → 7): its quick, slowing bites were what made
        // Beastcallers so strong (balance study, 2026-11-17). Its other stats are a wolf's.
        summonMods: { spd: -6 },
        actionCost: 50,
        targetType: 'tile',
        isSummon: true,
        summonJob: 'summoned_wolf',
        summonName: 'Wolf',
        element: 'nature',
        animType: 'cast',
        projectileColor: '#aaaacc',
        chargeTime: 0,
        requiresLos: false,
        desc: 'Calls a wolf spirit to fight beside you. Hard to hit, and its bite slows. Only one answers at a time.',
    },
};
