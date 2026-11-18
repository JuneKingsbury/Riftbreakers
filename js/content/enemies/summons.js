// Creatures that only exist as summons: Mirror Image's copies, raised skeletons, and the
// called beasts and spirits. Every summon has its own job here, so tuning the enemies they
// look like (the wild wolf, wisp, thorn beast and boar in enemies/beasts.js) doesn't change
// them, and changing a summon doesn't change those enemies.
//
// File format: js/content/README.md.

export const jobs = {
    // Mirror Image: a copy that enemies would rather strike (lure). It doesn't act (inert).
    decoy: {
        maxHp: 40, maxMp: 0,
        spd: 1, atk: 0, def: 2, mat: 0, mdf: 2,
        move: 0, eva: 25,
        abilities: ['attack'],
        inert: true, lure: 2,
        spriteKey: 'decoy',
        char: 'i', color: '#e0c0ff',
    },

    // Raised by the Gravecaller from a knocked-out enemy.
    skeleton: {
        maxHp: 34, maxMp: 0,
        spd: 8, atk: 11, def: 6, mat: 2, mdf: 4,
        move: 4, eva: 8,
        abilities: ['attack'],
        spriteKey: 'bone_sentinel',
        char: 'k', color: '#ddddcc',
    },

    // Called by the Beastcaller (Call Wolf, which also slows it with summonMods) and by
    // Call of the Pack. Starts out with a wild wolf's stats.
    summoned_wolf: {
        maxHp: 30, maxMp: 0,
        spd: 13, atk: 10, def: 3, mat: 1, mdf: 3,
        move: 5, eva: 22,
        abilities: ['wolf_bite'],
        spriteKey: 'wolf',
        char: 'w', color: '#aaaacc',
    },

    // Called by the Spiritbinder (Call Wisp). Starts out with a wild wisp's stats.
    summoned_wisp: {
        maxHp: 22, maxMp: 40,
        spd: 9, atk: 3, def: 2, mat: 12, mdf: 12,
        move: 4, eva: 24,
        abilities: ['soul_drain', 'dream_veil'],
        spriteKey: 'spectral_wisp',
        char: 'W', color: '#8888ff',
    },

    // Called by the Worldsinger (Call Thorn Beast). Starts out with a wild thorn beast's stats.
    summoned_thorn_beast: {
        maxHp: 42, maxMp: 28,
        spd: 7, atk: 7, def: 5, mat: 10, mdf: 7,
        move: 3, eva: 12,
        abilities: ['attack', 'thorn_volley'],
        spriteKey: 'thorn_beast',
        char: 't', color: '#449922',
    },

    // Called by Call Boar (abilities/unused.js: no class has it yet). Starts out with a wild
    // boar's stats.
    summoned_boar: {
        maxHp: 48, maxMp: 0,
        spd: 9, atk: 13, def: 6, mat: 1, mdf: 4,
        move: 4, eva: 10,
        abilities: ['attack', 'boar_charge'],
        spriteKey: 'boar',
        char: 'b', color: '#996644',
    },
};

export const abilities = {
};
