// Skyhunter: a Tier 2 class (Conjuration + Divination), promoted from the Runebow.
//
// File format: js/content/README.md.

export const key = 'skyhunter';

export const job = {
    maxHp: 42, maxMp: 40,
    spd: 9, atk: 12, def: 5, mat: 9, mdf: 7,
    move: 4, eva: 15,
    skillsetName: 'Huntcraft',
    tier: 2,
    learnable: {
        hunters_mark: { sp: 1 },
        piercing_shot: { sp: 1, requires: 'hunters_mark' },
        starfall: { sp: 2, requires: 'piercing_shot' },
        overwatch: { sp: 1, requires: 'hunters_mark' },
        eagle_eye: { sp: 2, requires: 'piercing_shot' },
    },
    builds: [
        {
            key: 'single', name: 'Single Target',
            desc: 'Focus fire: Hunter\'s Mark lowers a target\'s DEF and MDF so the whole party hits it harder, Piercing Shot can\'t be dodged, and Eagle Eye adds 20% to your physical damage.',
            steps: ['piercing_shot', 'eagle_eye', 'hunters_mark+', 'piercing_shot+', 'piercing_shot+', 'hunters_mark+'],
        },
        {
            key: 'cover', name: 'Covering Fire',
            desc: 'Guard your allies: stand next to one, and Overwatch shoots whoever hits them from up to 5 tiles away. Starfall hits groups of enemies over any cover.',
            steps: ['overwatch', 'piercing_shot', 'overwatch+', 'eagle_eye', 'starfall', 'overwatch+', 'starfall+'],
        },
    ],
    spriteKey: 'crusader_archer',
    char: 'H', color: '#ddcc77',
    schools: ['conjuration', 'divination'],
    desc: 'An archer who sees where the quarry will be before it moves. The Skyhunter marks a target so the whole party hits it harder, lands arrows that cannot be dodged, and covers allies with Overwatch. The best pure marksman in the roster, but thin-skinned.',
    ai: { script: 'ranged', scriptRange: 4, ranged: true, keep: 4 },
};

export const abilities = {
    hunters_mark: {
        name: "Hunter's Mark", type: 'physical', range: 5, aoe: 0, mpCost: 8, actionCost: 40,
        targetType: 'enemy', basePower: 0.8, animType: 'shot',
        projectileColor: '#ffdd77', chargeTime: 0, noEvade: true,
        buffs: [{ stat: 'def', value: -4, duration: 3 }, { stat: 'mdf', value: -4, duration: 3 }],
        desc: 'A glowing rune-arrow pins your quarry in plain sight. It can\'t be dodged, deals damage, and the target\'s DEF and MDF fall by {buff:def} for 3 turns.',
    },

    piercing_shot: {
        extends: 'long_shot', name: 'Piercing Shot', range: 6, basePower: 1.1, mpCost: 6, actionCost: 42,
        ignoreEvasion: true, projectileColor: '#ffeeaa',
        desc: 'You loose the arrow where the target is about to be. Long range, solid damage, and it can\'t be dodged.',
    },

    starfall: {
        name: 'Starfall', type: 'magic', range: 6, aoe: 1, requiresLos: false, mpCost: 20, actionCost: 55,
        targetType: 'enemy', basePower: 0.9, element: 'holy', animType: 'shot',
        projectileColor: '#ffffcc', chargeTime: 40,
        desc: 'A volley of conjured arrows arcs into the sky and falls like stars. Hits the target and every enemy next to them, over any cover.',
    },

    // Overwatch's shot: not learned on its own.
    overwatch_shot: {
        extends: 'long_shot', name: 'Overwatch', mpCost: 0,
        desc: 'A covering shot at an enemy who just struck an ally.',
    },

    overwatch: {
        extends: 'brace', name: 'Overwatch', trigger: 'allyHit', chance: 0.4, selfStatus: null,
        counterWith: 'overwatch_shot', counterReach: 5,
        desc: 'When an adjacent ally is hit, you may shoot back at the attacker, if they are within 5 tiles.',
    },

    eagle_eye: {
        extends: 'support', name: 'Eagle Eye', passiveMpCost: 0, dmgDealt: { physical: 1.2 },
        desc: 'Nothing escapes your sight, so every arrow finds a weak spot. Physical damage +20%.',
    },
};
