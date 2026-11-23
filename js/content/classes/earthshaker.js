// Earthshaker: a Tier 2 class (Evocation + Transmutation), promoted from the Stoneshaper.
//
// File format: js/content/README.md.

export const key = 'earthshaker';

export const job = {
    equipmentExpansions: { weapon: ['magic'] },
    maxHp: 56, maxMp: 32,
    spd: 7, atk: 10, def: 9, mat: 13, mdf: 8,
    move: 3, eva: 10,
    skillsetName: 'Geomancy',
    tier: 2,
    learnable: {
        tremor: { sp: 1 },
        stone_spike: { sp: 1, requires: 'tremor' },
        landslide: { sp: 2, requires: 'stone_spike' },
        aftershock: { sp: 1, requires: 'tremor' },
        seismic_power: { sp: 2, requires: 'tremor' },
    },
    builds: [
        {
            key: 'area', name: 'Area Damage',
            desc: 'Shake whole formations: Tremor damages and slows every enemy in a wide area, and Seismic Power makes all your area skills 25% stronger. Landslide is a huge, slow finisher.',
            steps: ['seismic_power', 'tremor+', 'stone_spike', 'tremor+', 'landslide', 'stone_spike+', 'landslide+'],
        },
        {
            key: 'tank', name: 'Tanking',
            desc: 'Hold the front line: Aftershock slows anyone who hits you in melee, and Earth Skin (from the Stoneshaper) raises your DEF. Stone Spike is your heavy hit.',
            steps: ['aftershock', 'earth_skin+', 'stone_spike', 'aftershock+', 'stone_spike+', 'earth_skin+', 'aftershock+'],
        },
    ],
    spriteKey: 'void_brute',
    char: 'E', color: '#aa7744',
    schools: ['evocation', 'transmutation'],
    desc: 'A geomancer who reshapes the battlefield with seismic force. Tremor slows whole enemy formations, and Stone Spike crushes isolated targets. Slow and deliberate, but every cast counts.',
    ai: { script: 'melee', melee: true },
};

export const abilities = {
    tremor: {
        name: 'Tremor',
        type: 'magic',
        range: 2,
        aoe: 2,
        requiresLos: false,
        mpCost: 14,
        actionCost: 50,
        targetType: 'enemy',
        basePower: 0.85,
        element: 'earth',
        animType: 'cast',
        projectileColor: '#aa7744',
        chargeTime: 20,
        applyStatus: 'slow',
        statusDuration: 2,
        desc: 'Seismic force cracks the ground open. Damages every enemy in a wide area and slows them for {turns}.',
    },

    stone_spike: {
        extends: 'tremor',
        name: 'Stone Spike',
        range: 3,
        aoe: 1,
        requiresLos: true,
        mpCost: 18,
        actionCost: 55,
        basePower: 1.5,
        projectileColor: '#886644',
        chargeTime: 35,
        applyStatus: null,
        desc: 'A great spike of stone bursts up beneath the target. Heavy damage, and it clips enemies right beside them.',
    },

    landslide: {
        extends: 'tremor',
        name: 'Landslide',
        range: 3, aoe: 2,
        mpCost: 26, actionCost: 60,
        basePower: 1.0,
        chargeTime: 60,
        applyStatus: null,
        desc: 'Brings a hillside down on a wide area. Slow to call, devastating when it lands.',
    },

    aftershock: {
        extends: 'counter',
        name: 'Aftershock',
        counterWith: null,
        attackerStatus: { status: 'slow', duration: 2 },
        desc: 'When struck in melee, you may send a tremor back through the attacker\'s feet. They are slowed for 2 turns.',
    },

    seismic_power: {
        extends: 'support',
        name: 'Seismic Power',
        passiveMpCost: 0, dmgDealt: null,
        aoeDmgMult: 1.25,
        desc: 'Every blow shakes the ground. Area skills deal +25% damage.',
    },
};
