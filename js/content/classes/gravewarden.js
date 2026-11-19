// Gravewarden: a Tier 2 class (Necromancy + Abjuration), promoted from the Gravecaller.
//
// File format: js/content/README.md.

export const key = 'gravewarden';

export const job = {
    equipmentExpansions: { armor: ['medium'], helmet: ['medium'] },
    maxHp: 50, maxMp: 46,
    spd: 7, atk: 7, def: 9, mat: 12, mdf: 12,
    move: 3, eva: 10,
    skillsetName: 'Bone Rites',
    tier: 2,
    learnable: {
        bone_ward: { sp: 1 },
        mass_raise: { sp: 1, requires: 'bone_ward' },
        soul_tether: { sp: 2, requires: 'bone_ward' },
        death_ward: { sp: 1, requires: 'bone_ward' },
        grave_legion: { sp: 2, requires: 'mass_raise' },
    },
    builds: [
        {
            key: 'army', name: 'Summoning',
            desc: 'Build an army of the dead: Mass Raise brings back two fallen enemies as skeletons, and Grave Legion makes everything you summon 80% stronger. It needs fallen enemies, so it gets going mid-fight.',
            steps: ['mass_raise', 'grave_legion', 'mass_raise+', 'raise_dead+', 'mass_raise+', 'death_ward'],
        },
        {
            key: 'protect', name: 'Ally Protection',
            desc: 'Keep allies from falling: Soul Tether makes the next killing blow on an ally leave them at 1 HP, and Death Ward can do the same for allies next to you. Bone Ward turns a corpse into a barricade that protects allies.',
            steps: ['death_ward', 'soul_tether', 'bone_ward+', 'death_ward+', 'soul_tether+', 'death_ward+'],
        },
    ],
    spriteKey: 'crypt_warden',
    char: 'G', color: '#ccddcc',
    schools: ['necromancy', 'abjuration'],
    desc: "A gravecaller who guards the living with the dead. The Gravewarden builds barricades of bone, raises skeletons in pairs, and holds allies' souls in their bodies when they should have fallen.",
    ai: { keep: 3 },
};

export const abilities = {
    bone_ward: {
        name: 'Bone Ward', type: 'magic', range: 3, aoe: 1, mpCost: 14, actionCost: 44,
        targetType: 'corpse', corpseEffect: 'ward', applyStatus: 'protect', statusDuration: 3,
        element: 'necrotic', animType: 'cast', projectileColor: '#ddddcc', chargeTime: 0, requiresLos: false,
        desc: 'Builds a barricade of bone from a knocked-out enemy. Allies next to it gain Protect for {turns}. The body is used up.',
    },

    mass_raise: {
        extends: 'raise_dead', name: 'Mass Raise', aoe: 1, mpCost: 26, corpseCount: 2, chargeTime: 30,
        desc: 'Up to two knocked-out enemies in an area rise as skeletons that fight for you.',
    },

    soul_tether: {
        name: 'Soul Tether', type: 'magic', range: 3, aoe: 0, mpCost: 18, actionCost: 45,
        targetType: 'ally', basePower: 0, element: 'necrotic', animType: 'cast',
        projectileColor: '#bbffcc', chargeTime: 0, applyStatus: 'reraise', statusDuration: 4,
        desc: 'Ties an ally\'s soul to their body. For {turns}, the next blow that would knock them out leaves them at 1 HP.',
    },

    death_ward: {
        extends: 'brace', name: 'Death Ward', trigger: 'allyHit', chance: 0.35, selfStatus: null, saveFromDown: true,
        desc: 'When an adjacent ally is knocked out, you may hold their soul in place. They stay standing at 1 HP.',
    },

    grave_legion: {
        extends: 'support', name: 'Grave Legion', passiveMpCost: 0, dmgDealt: null, summonBoost: 0.8,
        desc: 'The dead you raise grow tougher. They, and anything else you summon, get +80% HP, ATK and MAT.',
    },
};
