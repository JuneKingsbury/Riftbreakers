// Field Surgeon: a Tier 2 class (Abjuration), promoted from the Alchemist.
//
// File format: js/content/README.md.

export const key = 'field_surgeon';

export const job = {
    maxHp: 48, maxMp: 0,
    spd: 8, atk: 8, def: 7, mat: 12, mdf: 10,
    move: 4, eva: 12,
    skillsetName: 'Field Medicine',
    tier: 2,
    learnable: {
        elixir: { sp: 1 },
        panacea_mist: { sp: 1, requires: 'elixir' },
        stimulant: { sp: 2, requires: 'elixir' },
        triage: { sp: 1, requires: 'elixir' },
        steady_hands: { sp: 2, requires: 'panacea_mist' },
    },
    builds: [
        {
            key: 'healer', name: 'Healing',
            desc: 'Keep single allies alive: Elixir heals and cures one ally, and Triage patches up allies next to you when a hit leaves them low. Steady Hands stops your splashes from helping enemies.',
            steps: ['triage', 'elixir+', 'panacea_mist', 'steady_hands', 'elixir+', 'triage+', 'triage+'],
        },
        {
            key: 'buffs', name: 'Party Buffs',
            desc: 'Buff your whole side: with Steady Hands your splashes only touch allies, so Stimulant and Quicksilver (from the Alchemist) speed up your party alone, and Panacea Mist cleanses them.',
            steps: ['panacea_mist', 'steady_hands', 'stimulant', 'quicksilver', 'healing_draught+', 'healing_draught+', 'elixir+'],
        },
    ],
    spriteKey: 'npc_wandering_druid',
    char: 'F', color: '#88ffcc',
    schools: ['abjuration'],
    desc: 'An alchemist who has learned precision. The Field Surgeon doses single allies with Elixir, cures whole groups and hurries them along, and patches up a falling friend on the spot. Steady Hands finally keeps every splash on the right side.',
    ai: { keep: 3, healer: true },
};

export const abilities = {
    elixir: {
        name: 'Elixir', type: 'magic', range: 4, aoe: 0, mpCost: 0, actionCost: 55,
        targetType: 'ally', basePower: 1.0, isHeal: true, alsoCure: true, element: 'alchemy', animType: 'cast',
        projectileColor: '#88ffcc', chargeTime: 0,
        desc: 'A carefully measured dose for one ally. A strong heal that also cures their harmful statuses.',
    },

    panacea_mist: {
        name: 'Panacea Mist', type: 'magic', range: 4, aoe: 1, mpCost: 0, actionCost: 52,
        targetType: 'all', basePower: 0, isCure: true, element: 'alchemy', animType: 'cast',
        projectileColor: '#ccffee', chargeTime: 0, requiresLos: false,
        desc: 'A cleansing mist. Clears every harmful status from everyone in the splash, enemies included.',
    },

    stimulant: {
        name: 'Stimulant', type: 'magic', range: 4, aoe: 1, mpCost: 0, actionCost: 55,
        targetType: 'all', basePower: 0, element: 'alchemy', animType: 'cast',
        projectileColor: '#ffcc88', chargeTime: 0, requiresLos: false,
        ctGain: 15, applyStatus: 'regen', statusDuration: 3,
        desc: 'A bracing splash. Everyone caught, on both sides, acts a little sooner and gains Regen for {duration} turns.',
    },

    triage: {
        extends: 'brace', name: 'Triage', trigger: 'allyHit', chance: 0.4, selfStatus: null,
        allyCast: 'triage_draught', whenAllyBelow: 0.35,
        desc: 'When an adjacent ally is hit and left below 35% HP, you may patch them up on the spot.',
    },

    triage_draught: {
        extends: 'elixir', name: 'Triage Draught', range: 1, basePower: 0.8, alsoCure: false,
        desc: 'The quick patch of Triage.',
    },

    steady_hands: {
        extends: 'support', name: 'Steady Hands', passiveMpCost: 0, dmgDealt: null, precise: true,
        desc: 'Perfect aim. Your splashes only reach the side you meant them for: heals and boons skip enemies, and harm skips allies.',
    },
};
