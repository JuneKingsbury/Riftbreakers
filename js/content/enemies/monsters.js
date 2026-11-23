// Monster enemies: goblins, orcs and their casters.
//
// File format: js/content/README.md.

export const jobs = {
    goblin: {
        maxHp: 28, maxMp: 0,
        spd: 11, atk: 9, def: 4, mat: 2, mdf: 3,
        move: 4, eva: 18,
        abilities: ['goblin_slash'],
        spriteKey: 'shadow_imp',
        char: 'g', color: '#c84',
    },

    orc_captain: {
        maxHp: 70, maxMp: 0,
        spd: 7, atk: 16, def: 12, mat: 2, mdf: 6,
        move: 3, eva: 8,
        abilities: ['attack', 'shield_bash'],
        spriteKey: 'void_brute',
        char: 'O', color: '#d64',
    },

    shadow_mage: {
        maxHp: 36, maxMp: 50,
        spd: 8, atk: 5, def: 3, mat: 14, mdf: 9,
        move: 3, eva: 12,
        abilities: ['attack', 'shadow_bolt', 'mute'],
        spriteKey: 'spell_wraith',
        char: 'S', color: '#84f',
    },
};

export const abilities = {
    shield_bash: {
        extends: 'attack',
        name: 'Shield Bash',
        actionCost: 45,
        basePower: 0.7,
        applyStatus: 'stun',
        statusDuration: 1,
        desc: 'A blow with the face of your shield. Deals damage and stuns the target for {turns}.',
    },

    goblin_slash: {
        extends: 'attack',
        name: 'Slash',
        actionCost: 30,
        basePower: 0.9,
        desc: 'A quick, careless slash. A little weaker than a plain attack.',
    },

    shadow_bolt: {
        extends: 'fire',
        name: 'Shadow Bolt',
        range: 4,
        aoe: 1,
        mpCost: 14,
        basePower: 1.15,
        element: 'shadow',
        projectileColor: '#aa44ff',
        chargeTime: 40,
        desc: 'A bolt of shadow that bursts on the target and everyone beside them.',
    },
};
