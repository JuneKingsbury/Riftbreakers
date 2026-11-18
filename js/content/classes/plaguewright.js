// Plaguewright: a Tier 2 class (Transmutation), promoted from the Alchemist.
//
// File format: js/content/README.md.

export const key = 'plaguewright';

export const job = {
    maxHp: 46, maxMp: 0,
    spd: 8, atk: 8, def: 6, mat: 13, mdf: 7,
    move: 4, eva: 12,
    skillsetName: 'Plaguecraft',
    tier: 2,
    learnable: {
        plague_flask: { sp: 1 },
        miasma: { sp: 1, requires: 'plague_flask' },
        catalyst: { sp: 2, requires: 'plague_flask' },
        toxic_blood: { sp: 1, requires: 'plague_flask' },
        virulence: { sp: 2, requires: 'miasma' },
    },
    spriteKey: 'raider_poisoner',
    char: 'Q', color: '#99dd33',
    schools: ['transmutation'],
    desc: "An alchemist who brews disease. The Plaguewright poisons wide areas, keeps the poison lingering, then sets it burning with Catalyst. Poison doesn't care whose side you are on, so mind your allies.",
    ai: { ranged: true, keep: 3 },
};

export const abilities = {
    plague_flask: {
        extends: 'acid_flask', name: 'Plague Flask', aoe: 2, basePower: 0.35, actionCost: 60, buffs: null,
        applyStatus: 'poison', statusDuration: 3, projectileColor: '#99dd33',
        desc: 'A wide splash of plague. Everyone caught, on both sides, takes light damage and is poisoned for {turns}.',
    },

    miasma: {
        extends: 'acid_flask', name: 'Miasma', basePower: 0.2, buffs: null,
        applyStatus: 'poison', statusDuration: 5, projectileColor: '#77aa55',
        desc: 'A thin, lingering poison. Everyone in the splash, on both sides, is poisoned for {duration} turns.',
    },

    catalyst: {
        name: 'Catalyst', type: 'magic', range: 4, aoe: 1, mpCost: 0, actionCost: 55,
        targetType: 'enemy', basePower: 0.8, element: 'alchemy', animType: 'cast',
        projectileColor: '#ffee55', chargeTime: 0, requiresLos: false, bonusVsStatus: { poison: 2 },
        desc: 'A reagent that sets poison burning. Hits every enemy in the area, with double damage to the poisoned. Spares your allies.',
    },

    toxic_blood: {
        extends: 'brace', name: 'Toxic Blood', trigger: 'physicalHit', chance: 0.5, adjacentOnly: true,
        selfStatus: null, attackerStatus: { status: 'poison', duration: 3 },
        desc: 'Your blood is poison. When struck in melee, you may poison the attacker for 3 turns.',
    },

    virulence: {
        extends: 'support', name: 'Virulence', passiveMpCost: 0, dmgDealt: null, statusDurationBonus: 1,
        desc: 'Your poisons and other statuses last 1 turn longer.',
    },
};
