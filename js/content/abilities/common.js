// Abilities every unit shares (Attack), and the plain reaction and movement skills that
// other abilities extend.
//
// File format: js/content/README.md.

export const abilities = {
    attack: {
        name: 'Attack',
        type: 'physical',
        range: 1,
        aoe: 0,
        mpCost: 0,
        actionCost: 35,
        targetType: 'enemy',
        basePower: 1.0,
        animType: 'slash',
        chargeTime: 0,
    },

    brace: {
        name: 'Brace',
        type: 'passive', slot: 'reaction',
        range: 0, aoe: 0, mpCost: 0, actionCost: 0, targetType: 'self', chargeTime: 0,
        trigger: 'anyHit', chance: 0.4,
        selfStatus: 'defend',
        desc: 'When struck, you may set your feet. Until your next turn, DEF and MDF are 50% higher and you have +20% evasion against physical attacks.',
    },

    move_plus_1: {
        name: 'Move +1',
        type: 'passive', slot: 'movement',
        range: 0, aoe: 0, mpCost: 0, actionCost: 0, targetType: 'self', chargeTime: 0,
        moveBonus: 1,
        desc: 'Increases movement range by 1.',
    },
};
