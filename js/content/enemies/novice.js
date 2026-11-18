// The Novice: a plain fighter with a fixed kit, for militia enemies and tests. Not a player class.
//
// File format: js/content/README.md.

export const jobs = {
    novice: {
        maxHp: 46, maxMp: 20,
        spd: 8, atk: 9, def: 6, mat: 8, mdf: 6,
        move: 3, eva: 14,
        abilities: ['attack', 'rush', 'throw_stone', 'first_aid'],
        spriteKey: 'npc_ally',
        char: 'N', color: '#cccccc',
        schools: [],
        ai: { script: 'melee', melee: true },
    },
};

export const abilities = {
    rush: {
        extends: 'attack',
        name: 'Rush',
        actionCost: 40,
        basePower: 1.15,
        desc: 'A headlong shoulder charge. Hits a little harder than a normal attack.',
    },

    throw_stone: {
        name: 'Throw Stone',
        type: 'physical',
        range: 3, aoe: 0, mpCost: 0, actionCost: 35,
        targetType: 'enemy', basePower: 0.6, animType: 'shot', projectileColor: '#998877', chargeTime: 0,
        desc: 'Pick up a rock and throw it. Weak, but it reaches.',
    },

    first_aid: {
        name: 'First Aid',
        type: 'physical',
        range: 1, aoe: 0, mpCost: 0, actionCost: 40,
        targetType: 'ally', basePower: 0.6, isHeal: true, animType: 'cast', projectileColor: '#ccffcc', chargeTime: 0,
        desc: 'Bind a wound with field dressings. Heals an adjacent ally or yourself, and needs no MP.',
    },
};
