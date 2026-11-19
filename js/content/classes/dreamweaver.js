// Dreamweaver: a Tier 2 class (Illusion + Enchantment), promoted from the Illusionist.
//
// File format: js/content/README.md.

export const key = 'dreamweaver';

export const job = {
    maxHp: 36, maxMp: 54,
    spd: 8, atk: 5, def: 4, mat: 14, mdf: 11,
    move: 4, eva: 16,
    skillsetName: 'Dreamcraft',
    tier: 2,
    learnable: {
        mass_sleep: { sp: 1 },
        bewilder: { sp: 1, requires: 'mass_sleep' },
        nightmare: { sp: 2, requires: 'mass_sleep' },
        lull: { sp: 1, requires: 'mass_sleep' },
        deep_dreams: { sp: 2, requires: 'bewilder' },
    },
    builds: [
        {
            key: 'sleep', name: 'Sleep & Nightmare',
            desc: 'Put a group to sleep with Mass Sleep, then hit the sleepers one at a time with Nightmare for double damage. Hitting a sleeper only wakes that one.',
            steps: ['nightmare', 'nightmare+', 'bewilder', 'deep_dreams', 'mass_sleep+', 'nightmare+', 'mass_sleep+'],
        },
        {
            key: 'charm', name: 'Charm Control',
            desc: 'Turn enemies against each other: Bewilder charms a target into fighting for you, and Deep Dreams makes it last a turn longer. Lull puts attackers to sleep.',
            steps: ['bewilder', 'deep_dreams', 'lull', 'bewilder+', 'mass_sleep+', 'bewilder+', 'lull+'],
        },
    ],
    spriteKey: 'mirror_shade',
    char: 'D', color: '#cc88ff',
    schools: ['illusion', 'enchantment'],
    desc: 'An illusionist who weaves dreams into weapons. The Dreamweaver puts whole groups to sleep, turns enemies against each other with Bewilder, and makes sleepers pay with Nightmare. Controls a fight rather than ending it.',
    ai: { ranged: true, keep: 3 },
};

export const abilities = {
    mass_sleep: {
        extends: 'dream_veil', name: 'Mass Sleep', aoe: 1, mpCost: 20, actionCost: 50, chargeTime: 25,
        statusDuration: 2, requiresLos: false, element: 'illusion',
        desc: 'A lullaby that settles over an area. Every enemy caught falls asleep for up to {turns}, or until struck.',
    },

    bewilder: {
        name: 'Bewilder', type: 'magic', range: 3, aoe: 0, mpCost: 16, actionCost: 45,
        targetType: 'enemy', basePower: 0, element: 'illusion', animType: 'cast',
        projectileColor: '#ff99dd', chargeTime: 0, applyStatus: 'charm', statusDuration: 2,
        desc: 'Convinces an enemy that their friends are the foe. Charms them for {duration} turns.',
    },

    nightmare: {
        name: 'Nightmare', type: 'magic', range: 4, aoe: 0, mpCost: 14, actionCost: 46,
        targetType: 'enemy', basePower: 1.2, element: 'illusion', animType: 'cast',
        projectileColor: '#8844aa', chargeTime: 0, bonusVsStatus: { sleep: 2 },
        desc: 'Turns a dream against the dreamer: deals double damage to a sleeping target.',
    },

    lull: {
        extends: 'brace', name: 'Lull', trigger: 'anyHit', chance: 0.3, selfStatus: null,
        attackerStatus: { status: 'sleep', duration: 2 },
        desc: 'When hit, you may whisper the attacker to sleep for 2 turns.',
    },

    deep_dreams: {
        extends: 'support', name: 'Deep Dreams', passiveMpCost: 1, dmgDealt: null, statusDurationBonus: 1,
        desc: 'Your enchantments sink deeper. Statuses you inflict last 1 turn longer (except Doom). Costs 1 MP per turn.',
    },
};
