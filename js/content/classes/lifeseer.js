// Lifeseer: a Tier 2 class (Abjuration + Divination), promoted from the Seer.
//
// File format: js/content/README.md.

export const key = 'lifeseer';

export const job = {
    maxHp: 42, maxMp: 52,
    spd: 7, atk: 6, def: 6, mat: 12, mdf: 12,
    move: 3, eva: 14,
    skillsetName: 'Providence',
    tier: 2,
    learnable: {
        foresight_heal: { sp: 1 },
        renewing_light: { sp: 1, requires: 'foresight_heal' },
        mass_foresight: { sp: 2, requires: 'renewing_light' },
        second_sight: { sp: 1, requires: 'foresight_heal' },
        providence: { sp: 2, requires: 'foresight_heal' },
    },
    spriteKey: 'npc_ally',
    char: 'L', color: '#aaddff',
    schools: ['abjuration', 'divination'],
    desc: 'A prophetic healer who sees wounds coming and undoes them before they land. Foresight Heal is the strongest single-target heal of any class, Mass Foresight mends a cluster of allies at once, and Providence cheats death once per battle. Pure support, with no offensive spells.',
    ai: { script: 'healer', keep: 3, healer: true },
};

export const abilities = {
    foresight_heal: {
        extends: 'heal',
        name: 'Foresight Heal',
        mpCost: 18,
        basePower: 1.3,
        projectileColor: '#aaddff',
        desc: 'Mends a wound before it fully lands, guided by a glimpse of the target\'s near future. A powerful single-target heal.',
    },

    // REGEN — status-based HP regen each turn (ally buff)
    renewing_light: {
        name: 'Renewing Light',
        type: 'magic',
        range: 3,
        aoe: 0,
        mpCost: 10,
        actionCost: 40,
        targetType: 'ally',
        basePower: 0,
        element: 'holy',
        animType: 'cast',
        projectileColor: '#aaffcc',
        chargeTime: 0,
        applyStatus: 'regen',
        statusDuration: 4,
        desc: 'Bathes an ally in gentle holy light. Regen restores 8% of their max HP each turn for {turns}.',
    },

    second_sight: {
        extends: 'brace',
        name: 'Second Sight',
        trigger: 'lowHp', chance: 1, oncePerBattle: true,
        selfStatus: null,
        selfCast: 'renewing_light',
        desc: 'Once per battle, when a blow leaves you below 30% HP, you see it coming and cast Renewing Light on yourself.',
    },

    mass_foresight: {
        extends: 'heal',
        name: 'Mass Foresight',
        aoe: 1,
        mpCost: 24, actionCost: 50,
        basePower: 0.8,
        chargeTime: 30,
        projectileColor: '#bbddff',
        desc: 'Foresees the wounds of everyone nearby and mends them together. Heals the target ally and everyone beside them.',
    },

    providence: {
        extends: 'support',
        name: 'Providence',
        passiveMpCost: 0, dmgDealt: null,
        surviveLethal: true,
        desc: 'You have already seen this ending and refused it. Once per battle, a killing blow leaves you at 1 HP.',
    },
};
