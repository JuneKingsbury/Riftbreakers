// Human enemies: bandits, raiders, void cultists and kingdom soldiers.
//
// File format: js/content/README.md.

export const jobs = {
    raider: {
        maxHp: 40, maxMp: 0,
        spd: 9, atk: 11, def: 6, mat: 2, mdf: 4,
        move: 4, eva: 13,
        abilities: ['attack'],
        spriteKey: 'raider',
        char: 'r', color: '#cc6633',
    },

    raider_archer: {
        maxHp: 34, maxMp: 0,
        spd: 10, atk: 10, def: 4, mat: 2, mdf: 4,
        move: 4, eva: 16,
        abilities: ['attack', 'long_shot'],
        spriteKey: 'raider_archer',
        char: 'a', color: '#cc8833',
    },

    raider_hexer: {
        maxHp: 30, maxMp: 36,
        spd: 8, atk: 5, def: 3, mat: 11, mdf: 7,
        move: 3, eva: 13,
        abilities: ['attack', 'hex'],
        spriteKey: 'raider_hexer',
        char: 'h', color: '#aa66cc',
    },

    void_walker: {
        maxHp: 44, maxMp: 28,
        spd: 8, atk: 9, def: 5, mat: 11, mdf: 8,
        move: 3, eva: 13,
        abilities: ['attack', 'shadow_bolt'],
        spriteKey: 'void_walker',
        char: 'v', color: '#6644aa',
    },

    kingdom_guard: {
        maxHp: 58, maxMp: 0,
        spd: 7, atk: 13, def: 11, mat: 2, mdf: 8,
        move: 3, eva: 9,
        abilities: ['attack', 'shield_bash'],
        spriteKey: 'kingdom_guard',
        char: 'G', color: '#8888cc',
    },
};

export const abilities = {
};
