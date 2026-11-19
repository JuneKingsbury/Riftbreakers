// Runebow: a starting class (Conjuration). Promotes into the Skyhunter or the Beastcaller.
//
// File format: js/content/README.md.

export const key = 'runebow';

export const job = {
    maxHp: 40, maxMp: 42,
    spd: 8, atk: 7, def: 4, mat: 10, mdf: 7,
    move: 4, eva: 13,
    skillsetName: 'Runecraft',
    tier: 1,
    promotions: ['skyhunter', 'beastcaller'],
    learnable: {
        long_shot: { sp: 1 },
        pinning_shot: { sp: 1, requires: 'long_shot' },
        rune_arrow: { sp: 1, requires: 'long_shot' },
        arrow_rain: { sp: 2, requires: 'pinning_shot' },
        return_fire: { sp: 1, requires: 'long_shot' },
        concentrate: { sp: 2, requires: 'rune_arrow' },
        fleet_step: { sp: 1 },
    },
    builds: [
        {
            key: 'retaliation', name: 'Retaliation',
            desc: 'Trade shots from long range: Return Fire answers anyone who hits you from a distance with a Long Shot, and Concentrate makes your arrows hard to dodge. Upgrading Long Shot makes those counters hit harder too.',
            steps: ['return_fire', 'long_shot+', 'rune_arrow', 'concentrate', 'return_fire+', 'long_shot+', 'return_fire+', 'fleet_step', 'rune_arrow+'],
        },
        {
            key: 'area', name: 'Area Damage',
            desc: 'Rain arrows on groups of enemies, even behind cover, and slow anyone who gets close with Pinning Shot. Arrows cost no MP, so you can keep it up all battle.',
            steps: ['pinning_shot', 'arrow_rain', 'arrow_rain+', 'fleet_step', 'pinning_shot+', 'arrow_rain+', 'rune_arrow', 'concentrate', 'long_shot+'],
        },
    ],
    spriteKey: 'crusader_archer',
    char: 'J', color: '#aaccff',
    schools: ['conjuration'],
    desc: 'An archer who inscribes runes onto arrows to strike from afar. The Runebow mixes plain arrows with conjured magic shots and moves faster than most mages, but lacks raw magical punch.',
    allowedEquipment: { armor: ['light'], helmet: ['light'], weapon: ['bow', 'crossbow'], tool: ['implement'] },
    role: 'Long-range archer',
    unlock: { type: 'base', order: 3 },
    startingGear: { armor: 'leather_jacket', helmet: 'leather_cap', weapon: 'short_bow', tool: 'hunters_quiver' },
    ai: { script: 'ranged', scriptRange: 4, ranged: true, keep: 4 },
};

export const abilities = {
    long_shot: {
        name: 'Long Shot',
        type: 'physical',
        range: 5,
        aoe: 0,
        mpCost: 0,
        actionCost: 40,
        targetType: 'enemy',
        basePower: 0.9,
        animType: 'shot',
        projectileColor: '#aaddaa',
        chargeTime: 0,
        desc: 'A carefully aimed arrow, loosed from far away.',
    },

    return_fire: {
        extends: 'brace',
        name: 'Return Fire',
        trigger: 'rangedHit', chance: 0.4,
        selfStatus: null,
        counterWith: 'long_shot',
        desc: 'When hit from range, you may answer with a Long Shot, if the shooter is in range.',
    },

    fleet_step: {
        extends: 'move_plus_1',
        name: 'Fleet Step',
        moveBonus: 1, climbBonus: 1,
        desc: 'Move +1, and you can climb 1 extra level of elevation.',
    },

    pinning_shot: {
        extends: 'long_shot',
        name: 'Pinning Shot',
        range: 4,
        basePower: 0.7,
        applyStatus: 'slow', statusDuration: 2,
        desc: 'An arrow aimed at the legs. Deals damage and slows the target for {duration} turns.',
    },

    rune_arrow: {
        name: 'Rune Arrow',
        type: 'magic',
        range: 5, aoe: 0, mpCost: 10, actionCost: 45,
        targetType: 'enemy', basePower: 1.0, element: 'arcane',
        animType: 'shot', projectileColor: '#aaccff', chargeTime: 0,
        desc: 'A conjured arrow inscribed with a rune of force. It deals magic damage instead of physical.',
    },

    arrow_rain: {
        extends: 'long_shot',
        name: 'Arrow Rain',
        range: 4, aoe: 1,
        requiresLos: false,
        actionCost: 50,
        basePower: 0.65,
        chargeTime: 25,
        desc: 'Loose a volley high into the air. It comes down on every enemy in the area.',
    },

    concentrate: {
        extends: 'support',
        name: 'Concentrate',
        passiveMpCost: 0, dmgDealt: null,
        evasionPierce: 0.75,
        desc: 'Breathe, aim, release. Your physical attacks are much harder to dodge: targets dodge them only a quarter as often.',
    },
};
