// Mirage Oracle: a Tier 2 class (Illusion + Divination), promoted from the Illusionist.
//
// File format: js/content/README.md.

export const key = 'mirage_oracle';

export const job = {
    maxHp: 38, maxMp: 50,
    spd: 9, atk: 5, def: 4, mat: 13, mdf: 12,
    move: 4, eva: 20,
    skillsetName: 'Mirrors',
    tier: 2,
    learnable: {
        hall_of_mirrors: { sp: 1 },
        mass_blur: { sp: 1, requires: 'hall_of_mirrors' },
        true_strike: { sp: 2, requires: 'hall_of_mirrors' },
        shattered_image: { sp: 1, requires: 'hall_of_mirrors' },
        lasting_images: { sp: 2, requires: 'mass_blur' },
    },
    builds: [
        {
            key: 'decoys', name: 'Decoys',
            desc: 'Fill the field with copies of yourself that enemies would rather attack: Hall of Mirrors makes two at once and Lasting Images makes them much tougher. Shattered Image slows whoever breaks one.',
            steps: ['mass_blur', 'lasting_images', 'shattered_image', 'hall_of_mirrors+', 'mirror_image+', 'hall_of_mirrors+', 'mass_blur+'],
        },
        {
            key: 'magic', name: 'Magic Damage',
            desc: 'Deal steady magic damage: True Strike ignores half the target\'s MDF and can\'t be reflected, and Mass Blur keeps nearby allies hard to hit.',
            steps: ['true_strike', 'true_strike+', 'mass_blur', 'true_strike+', 'phantasm+', 'shattered_image', 'mass_blur+'],
        },
    ],
    spriteKey: 'mirror_twin',
    char: 'M', color: '#ddddff',
    schools: ['illusion', 'divination'],
    desc: 'An illusionist who foresees where blows will fall and puts a copy there first. The Mirage Oracle fills the field with mirrors, blurs the whole line, and pierces wards and resistance with True Strike.',
    ai: { ranged: true, keep: 3 },
};

export const abilities = {
    hall_of_mirrors: {
        extends: 'mirror_image', name: 'Hall of Mirrors', range: 3, mpCost: 20, summonCount: 2,
        desc: 'Conjures two copies of yourself at once. Enemies would rather strike them than you.',
    },

    mass_blur: {
        extends: 'blur', name: 'Mass Blur', aoe: 1, mpCost: 18, actionCost: 45,
        buffs: [{ stat: 'eva', value: 15, duration: 3 }],
        desc: 'Blurs the target ally and everyone beside them. EVA +{buff:eva} for 3 turns.',
    },

    true_strike: {
        name: 'True Strike', type: 'magic', range: 4, aoe: 0, mpCost: 12, actionCost: 44,
        targetType: 'enemy', basePower: 1.1, element: 'illusion', animType: 'cast',
        projectileColor: '#ffffff', chargeTime: 0, mdfPierce: 0.5, ignoreReflect: true,
        desc: 'Strikes where the target truly is. Ignores half their MDF and can\'t be reflected.',
    },

    shattered_image: {
        extends: 'brace', name: 'Shattered Image', trigger: 'decoyDown', chance: 1, selfStatus: null,
        attackerStatus: { status: 'slow', duration: 2 },
        desc: 'Shards fly when one of your copies breaks. Whoever broke it is slowed for 2 turns.',
    },

    lasting_images: {
        extends: 'support', name: 'Lasting Images', passiveMpCost: 0, dmgDealt: null, summonBoost: 0.6,
        desc: 'Your copies and creatures get +60% HP, ATK and MAT.',
    },
};
