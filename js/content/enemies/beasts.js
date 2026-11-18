// Beast and creature enemies. Player summons that look like them have their own jobs in
// enemies/summons.js, so these can be tuned as enemies alone.
//
// File format: js/content/README.md.

export const jobs = {
    wolf: {
        maxHp: 30, maxMp: 0,
        spd: 13, atk: 10, def: 3, mat: 1, mdf: 3,
        move: 5, eva: 22,
        abilities: ['wolf_bite'],
        spriteKey: 'wolf',
        char: 'w', color: '#aaaacc',
    },

    boar: {
        maxHp: 48, maxMp: 0,
        spd: 9, atk: 13, def: 6, mat: 1, mdf: 4,
        move: 4, eva: 10,
        abilities: ['attack', 'boar_charge'],
        spriteKey: 'boar',
        char: 'b', color: '#996644',
    },

    thorn_beast: {
        maxHp: 42, maxMp: 28,
        spd: 7, atk: 7, def: 5, mat: 10, mdf: 7,
        move: 3, eva: 12,
        abilities: ['attack', 'thorn_volley'],
        spriteKey: 'thorn_beast',
        char: 't', color: '#449922',
    },

    spore_walker: {
        maxHp: 38, maxMp: 32,
        spd: 6, atk: 6, def: 4, mat: 9, mdf: 6,
        move: 3, eva: 10,
        abilities: ['attack', 'spore_burst', 'toxic_spores'],
        spriteKey: 'spore_walker',
        char: 's', color: '#88bb33',
    },

    shard_spider: {
        maxHp: 26, maxMp: 0,
        spd: 12, atk: 8, def: 3, mat: 1, mdf: 4,
        move: 5, eva: 20,
        abilities: ['spider_bite', 'venom_strike'],
        spriteKey: 'shard_spider',
        char: 'x', color: '#aaccff',
    },

    canopy_stalker: {
        maxHp: 44, maxMp: 0,
        spd: 10, atk: 15, def: 5, mat: 1, mdf: 4,
        move: 5, eva: 16,
        abilities: ['attack', 'pounce'],
        spriteKey: 'canopy_stalker',
        char: 'C', color: '#cc8833',
    },

    spectral_wisp: {
        maxHp: 22, maxMp: 40,
        spd: 9, atk: 3, def: 2, mat: 12, mdf: 12,
        move: 4, eva: 24,
        abilities: ['soul_drain', 'dream_veil'],
        spriteKey: 'spectral_wisp',
        char: 'W', color: '#8888ff',
    },

    void_stalker: {
        maxHp: 52, maxMp: 0,
        spd: 8, atk: 14, def: 7, mat: 2, mdf: 8,
        move: 4, eva: 14,
        abilities: ['attack', 'void_strike'],
        spriteKey: 'void_stalker',
        char: 'V', color: '#6644cc',
    },
};

export const abilities = {
    // POISON — single-target melee venom
    venom_strike: {
        extends: 'attack',
        name: 'Venom Strike',
        actionCost: 40,
        basePower: 0.9,
        applyStatus: 'poison',
        statusDuration: 3,
        desc: 'A strike laced with venom. Deals damage and poisons the target for {turns}.',
    },

    // Wolf: fast lunge — melee, applies slow (hamstring)
    wolf_bite: {
        extends: 'attack',
        name: 'Bite',
        actionCost: 30,
        basePower: 0.95,
        applyStatus: 'slow',
        statusDuration: 1,
        desc: 'A snapping bite at the legs. Deals damage and slows the target for {turns}.',
    },

    // Boar: charge — melee stun, slightly weaker hit
    boar_charge: {
        extends: 'attack',
        name: 'Charge',
        actionCost: 40,
        basePower: 0.85,
        applyStatus: 'stun',
        statusDuration: 1,
        desc: 'A headlong charge with lowered tusks. Deals damage and stuns the target for {turns}.',
    },

    // Thorn beast: ranged thorn volley — nature magic, AoE
    thorn_volley: {
        extends: 'fire',
        name: 'Thorn Volley',
        range: 3,
        aoe: 1,
        requiresLos: true,
        mpCost: 10,
        basePower: 0.9,
        element: 'nature',
        projectileColor: '#66aa22',
        chargeTime: 20,
        applyStatus: 'slow',
        statusDuration: 1,
        desc: 'A spray of thorns that hits the target and everyone beside them, slowing them for {turns}.',
    },

    // Spore walker: spore burst — AoE nature, no LOS (drifting cloud)
    spore_burst: {
        extends: 'fire',
        name: 'Spore Burst',
        range: 2,
        aoe: 2,
        requiresLos: false,
        mpCost: 12,
        basePower: 0.75,
        element: 'nature',
        projectileColor: '#88cc44',
        chargeTime: 30,
        applyStatus: 'slow',
        statusDuration: 2,
        desc: 'A cloud of spores that drifts over a wide area, damaging everyone caught and slowing them for {turns}.',
    },

    // Shard spider: venom bite — physical, inflicts slow
    spider_bite: {
        extends: 'attack',
        name: 'Venom Bite',
        actionCost: 35,
        basePower: 0.8,
        applyStatus: 'slow',
        statusDuration: 2,
        desc: 'A venomous bite that numbs the limbs. Deals damage and slows the target for {turns}.',
    },

    // Canopy stalker: pounce — high-damage physical
    pounce: {
        extends: 'attack',
        name: 'Pounce',
        actionCost: 40,
        basePower: 1.3,
    },

    // Spectral wisp: soul drain — magic, drains from distance
    soul_drain: {
        extends: 'fire',
        name: 'Soul Drain',
        range: 3,
        aoe: 0,
        requiresLos: true,
        mpCost: 8,
        basePower: 1.0,
        element: 'shadow',
        projectileColor: '#8866ff',
        chargeTime: 0,
        applyStatus: 'slow',
        statusDuration: 1,
        desc: 'A chill that pulls at the target\'s soul. Deals damage and slows them for {turns}.',
    },

    // Void stalker: void strike — high-damage physical melee
    void_strike: {
        extends: 'attack',
        name: 'Void Strike',
        actionCost: 38,
        basePower: 1.2,
    },
};
