// Realm enemies: one per act realm, each with a trick of its own that asks the party to play
// around it. They fight in their realm's fights (its file's encounters). Their sprites in
// the game skin started as copies of a realm neighbour's, to be redrawn.
//
// File format: js/content/README.md. `passives` and `battleStart` are enemy-only job fields
// (SCHEMAS.job).

export const jobs = {
    // The Wild Frontiers: quick and slippery, and its knife festers.
    bandit_cutthroat: {
        maxHp: 32, maxMp: 0,
        spd: 12, atk: 12, def: 4, mat: 2, mdf: 4,
        move: 5, eva: 20,
        abilities: ['attack', 'cutthroat_stab'],
        passives: ['enemy_slippery'],
        spriteKey: 'raider',
        char: 'c', color: '#c96',
    },
    // Verdant Depths: keeps its brood alive. Cut it down first.
    spore_mother: {
        maxHp: 50, maxMp: 40,
        spd: 6, atk: 5, def: 6, mat: 10, mdf: 8,
        move: 2, eva: 5,
        abilities: ['attack', 'mending_spores', 'spore_burst'],
        passives: ['enemy_spore_aura'],
        spriteKey: 'vine_creeper',
        char: 'M', color: '#9c6',
    },
    // Crystal Caves: spells bounce off its facets. Bring blades.
    prism_golem: {
        maxHp: 62, maxMp: 0,
        spd: 5, atk: 12, def: 13, mat: 2, mdf: 6,
        move: 3, eva: 4,
        abilities: ['attack', 'shield_bash'],
        battleStart: [{ status: 'reflect', duration: 99 }],
        spriteKey: 'crystal_golem',
        char: 'P', color: '#adf',
    },
    // Arcane Library: hushes casters, and can't be hushed itself.
    living_tome: {
        maxHp: 30, maxMp: 50,
        spd: 9, atk: 3, def: 3, mat: 12, mdf: 13,
        move: 3, eva: 14,
        abilities: ['shadow_bolt', 'mute'],
        passives: ['enemy_unhushed'],
        spriteKey: 'tome_guardian',
        char: 'T', color: '#dc9',
    },
    // Sunken Abyss: every bite feeds it.
    abyssal_leech: {
        maxHp: 46, maxMp: 0,
        spd: 9, atk: 13, def: 6, mat: 2, mdf: 6,
        move: 4, eva: 12,
        abilities: ['attack'],
        passives: ['enemy_leeching'],
        spriteKey: 'void_horror',
        char: 'L', color: '#6a8',
    },
    // Void Sanctum: bursts when it falls. Finish it from range.
    void_martyr: {
        maxHp: 38, maxMp: 30,
        spd: 8, atk: 10, def: 5, mat: 10, mdf: 6,
        move: 4, eva: 10,
        abilities: ['attack', 'shadow_bolt'],
        passives: ['enemy_martyrdom'],
        spriteKey: 'void_acolyte',
        char: 'm', color: '#a6c',
    },
    // Palace Fortress: steps in front of its allies' blows. Break it, or go around it.
    palace_shieldbearer: {
        maxHp: 70, maxMp: 0,
        spd: 6, atk: 11, def: 15, mat: 2, mdf: 10,
        move: 3, eva: 6,
        abilities: ['attack', 'shield_bash'],
        passives: ['enemy_shield_ally'],
        spriteKey: 'kingdom_guard',
        char: 'B', color: '#ccd',
    },
    // Shifting Labyrinth: answers every blow in kind.
    echo_mimic: {
        maxHp: 50, maxMp: 0,
        spd: 10, atk: 14, def: 7, mat: 8, mdf: 8,
        move: 4, eva: 14,
        abilities: ['attack', 'void_strike'],
        passives: ['enemy_mirror_strike'],
        spriteKey: 'mirror_twin',
        char: 'E', color: '#c8f',
    },
};

export const abilities = {
    cutthroat_stab: {
        extends: 'attack', name: 'Cutthroat Stab', actionCost: 40, basePower: 0.8,
        applyStatus: 'poison', statusDuration: 3,
        desc: 'A dirty knife. Deals damage and poisons the target for {turns}.',
    },
    mending_spores: {
        name: 'Mending Spores', type: 'magic', range: 3, aoe: 1, mpCost: 8, actionCost: 50,
        targetType: 'ally', basePower: 0.5, isHeal: true, animType: 'cast', projectileColor: '#bfe58a', chargeTime: 0,
        desc: 'A cloud of healing spores. Heals the target and allies next to it.',
    },
    martyr_burst: {
        extends: 'spite_burst', name: 'Martyr\'s Burst', basePower: 1.1,
        desc: 'The void pours out of a fallen martyr into everyone next to it.',
    },

    // Passives (`passives` above): enemy-only copies of class skills.
    enemy_slippery: {
        extends: 'support', name: 'Slippery', passiveMpCost: 0, dmgDealt: null, evaBonus: 0.1,
        desc: 'Hard to pin down: dodges physical attacks 10% more often.',
    },
    enemy_spore_aura: {
        extends: 'regen_aura', name: 'Spore Aura', turnRegenHp: 4,
        desc: 'Heals 4 HP at the start of each of its turns.',
    },
    enemy_unhushed: {
        extends: 'iron_will', name: 'Unhushed', statusImmune: ['silence', 'sleep', 'charm'],
        desc: 'Immune to Silence, Sleep and Charm.',
    },
    enemy_leeching: {
        extends: 'support', name: 'Leeching', passiveMpCost: 0, dmgDealt: null, lifestealFrac: 0.3,
        desc: 'Heals for 30% of the damage it deals.',
    },
    enemy_martyrdom: {
        extends: 'lingering_spite', name: 'Martyrdom', downBurst: 'martyr_burst',
        desc: 'When it is knocked out, it bursts and hurts everyone of yours next to it.',
    },
    enemy_shield_ally: {
        extends: 'interpose', name: 'Shield Ally', chance: 0.5,
        desc: 'Half the time, it steps in and takes a blow meant for an adjacent ally.',
    },
    enemy_mirror_strike: {
        extends: 'counter', name: 'Mirror Strike', chance: 0.6,
        desc: 'Often strikes back when hit in melee.',
    },
};
