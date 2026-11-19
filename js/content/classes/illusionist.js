// Illusionist: a starting class (Illusion). Promotes into the Dreamweaver or the Mirage Oracle.
//
// File format: js/content/README.md.

export const key = 'illusionist';

export const job = {
    maxHp: 40, maxMp: 48,
    spd: 9, atk: 5, def: 4, mat: 14, mdf: 10,
    move: 4, eva: 18,
    skillsetName: 'Illusion',
    tier: 1,
    promotions: ['dreamweaver', 'mirage_oracle'],
    learnable: {
        phantasm: { sp: 1 },
        mirror_image: { sp: 1, requires: 'phantasm' },
        blur: { sp: 1, requires: 'phantasm' },
        vanish: { sp: 2, requires: 'blur' },
        displacement: { sp: 1, requires: 'phantasm' },
        glamour: { sp: 2, requires: 'mirror_image' },
        mirage_step: { sp: 1 },
    },
    builds: [
        {
            key: 'decoys', name: 'Decoys',
            desc: 'Make the enemy hit the wrong target: Mirror Image puts a copy of you on the field that enemies would rather attack, and Glamour makes it far tougher. Phantasm is your damage.',
            steps: ['mirror_image', 'glamour', 'displacement', 'phantasm+', 'mirror_image+', 'phantasm+', 'displacement+'],
        },
        {
            key: 'evasion', name: 'Evasion Support',
            desc: 'Keep allies from being hit at all: Blur makes one hard to hit and Vanish hides one from enemies for 2 turns. Mirage Step and Displacement keep you out of reach too.',
            steps: ['blur', 'mirage_step', 'vanish', 'blur+', 'displacement', 'vanish+', 'blur+', 'vanish+'],
        },
    ],
    spriteKey: 'mirror_shade',
    char: 'I', color: '#e0a0ff',
    schools: ['illusion'],
    desc: 'A mage who bends what enemies see. The Illusionist wins by misdirection: copies that enemies would rather strike, allies blurred or hidden from view, and phantasms only the target can see. Fast and slippery, but frail.',
    allowedEquipment: { armor: ['cloth'], helmet: ['cloth'], weapon: ['magic'], tool: ['implement'] },
    role: 'Evasive trickster',
    unlock: { type: 'renown', order: 6 },
    startingGear: { armor: 'cotton_tunic', helmet: 'cotton_cap', weapon: 'wooden_wand' },
    ai: { ranged: true, keep: 3 },
};

export const abilities = {
    phantasm: {
        name: 'Phantasm', type: 'magic', range: 4, aoe: 0, mpCost: 8, actionCost: 42,
        targetType: 'enemy', basePower: 1.05, element: 'illusion', animType: 'cast',
        projectileColor: '#e0a0ff', chargeTime: 0,
        desc: 'A terror only the target can see. Cheap magic damage from a distance.',
    },

    mirror_image: {
        extends: 'call_wisp', name: 'Mirror Image', range: 3, mpCost: 12, actionCost: 32,
        summonJob: 'decoy', summonName: 'Mirror Image', element: 'illusion', projectileColor: '#e0c0ff',
        desc: 'Conjures a copy of yourself up to 3 tiles away. Enemies would rather strike the copy, which breaks after a few hits.',
    },

    blur: {
        name: 'Blur', type: 'magic', range: 3, aoe: 0, mpCost: 10, actionCost: 38,
        targetType: 'ally', basePower: 0, element: 'illusion', animType: 'cast',
        projectileColor: '#ccbbff', chargeTime: 0,
        buffs: [{ stat: 'eva', value: 20, duration: 3 }], floatText: 'Blurred!',
        desc: 'Smears an ally\'s outline in the air. EVA +{buff:eva} for 3 turns.',
    },

    vanish: {
        name: 'Vanish', type: 'magic', range: 3, aoe: 0, mpCost: 14, actionCost: 42,
        targetType: 'ally', basePower: 0, element: 'illusion', animType: 'cast',
        projectileColor: '#9988cc', chargeTime: 0, applyStatus: 'hidden', statusDuration: 2,
        desc: 'Hides an ally from enemy eyes. Enemies can\'t target them until they act or {duration} turns pass.',
    },

    displacement: {
        extends: 'phase_shift', name: 'Displacement', chance: 0.3, phaseAway: 2,
        desc: 'You were never quite where they struck. When hit, you may reappear up to 2 tiles away.',
    },

    glamour: {
        extends: 'support', name: 'Glamour', passiveMpCost: 0, dmgDealt: null, summonBoost: 0.6,
        desc: 'More convincing illusions. Copies and creatures you summon get +60% HP, ATK and MAT.',
    },

    mirage_step: {
        extends: 'move_plus_1', name: 'Mirage Step', moveBonus: 0,
        onMove: { selfBuff: { stat: 'eva', value: 15, duration: 1 } },
        desc: 'You leave an afterimage behind. After moving, EVA +15 for 1 turn.',
    },
};
