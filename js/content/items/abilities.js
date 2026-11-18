// Abilities only equipment grants (see `grants` / `grantsPassive` in the item files).
//
// File format: js/content/README.md.

export const abilities = {
    // Seer basic: passive divinatory trance that slowly drains MP
    farsight: {
        extends: 'support',
        name: 'Farsight',
        passiveMpCost: 1,
        dmgDealt: null,
        evaBonus: 0.2,
        desc: 'A light trance that reads the next few heartbeats. +20% evasion against physical attacks. Costs 1 MP per turn.',
    },

    spore_cloud: {
        extends: 'verdant_lash',
        name: 'Spore Cloud',
        range: 2,
        aoe: 2,
        requiresLos: false,
        mpCost: 14,
        actionCost: 50,
        basePower: 0.7,
        projectileColor: '#88cc44',
        chargeTime: 25,
        applyStatus: 'slow',
        statusDuration: 2,
        desc: 'Sings up a drifting cloud of narcotic spores. Damages every enemy in a wide area and slows them for {turns}.',
    },

    aegis_ward: {
        name: 'Aegis Ward',
        type: 'magic',
        range: 3,
        aoe: 0,
        mpCost: 12,
        actionCost: 40,
        targetType: 'ally',
        isCure: true,
        animType: 'cast',
        projectileColor: '#ccddff',
        chargeTime: 0,
        desc: 'A flash of warding light. Clears every harmful status from one ally.',
    },

    // CHARM — target fights for the other side for 1 turn
    bind_will: {
        name: 'Bind Will',
        type: 'magic',
        range: 3,
        aoe: 0,
        mpCost: 18,
        actionCost: 50,
        targetType: 'enemy',
        basePower: 0,
        element: 'spirit',
        animType: 'cast',
        projectileColor: '#ff88cc',
        chargeTime: 30,
        applyStatus: 'charm',
        statusDuration: 1,
        desc: 'Binds the target\'s will to yours. Charmed, they fight for your side for {turns}.',
    },

    // RERAISE — auto-revive on KO
    last_rites: {
        name: 'Last Rites',
        type: 'magic',
        range: 3,
        aoe: 0,
        mpCost: 20,
        actionCost: 50,
        targetType: 'ally',
        basePower: 0,
        element: 'holy',
        animType: 'cast',
        projectileColor: '#ffffcc',
        chargeTime: 0,
        applyStatus: 'reraise',
        statusDuration: 6,
        desc: 'Blesses an ally against death. For {turns}, the next blow that would knock them out leaves them at 1 HP instead.',
    },

    // FROG — cripple target stats
    hexform: {
        name: 'Hexform',
        type: 'magic',
        range: 3,
        aoe: 0,
        mpCost: 14,
        actionCost: 48,
        targetType: 'enemy',
        basePower: 0,
        element: 'nature',
        animType: 'cast',
        projectileColor: '#55cc33',
        chargeTime: 0,
        applyStatus: 'frog',
        statusDuration: 2,
        desc: 'Twists the target into a frog for {turns}. Their ATK and MAT drop by 60% and their DEF by half.',
    },

    // REFLECT — bounce incoming magic back at the caster
    mirror_ward: {
        name: 'Mirror Ward',
        type: 'magic',
        range: 3,
        aoe: 0,
        mpCost: 16,
        actionCost: 45,
        targetType: 'ally',
        basePower: 0,
        element: 'arcane',
        animType: 'cast',
        projectileColor: '#ccddff',
        chargeTime: 0,
        applyStatus: 'reflect',
        statusDuration: 2,
        desc: 'Raises a mirror of force around an ally. For {turns}, enemy spells bounce back at their caster.',
    },

    void_siphon: {
        extends: 'brace',
        name: 'Void Siphon',
        trigger: 'magicHit', chance: 0.6,
        selfStatus: null,
        mpRestoreFrac: 0.5,
        desc: 'When hit by magic, you may pull part of the spell into the void and restore MP equal to half the damage taken.',
    },

    move_plus_2: {
        extends: 'move_plus_1',
        name: 'Beast Lope',
        moveBonus: 2,
        desc: 'Run on all fours like the beasts you call. Move +2.',
    },

    blink: {
        extends: 'move_plus_1',
        name: 'Blink',
        moveBonus: 1, ignoreClimb: true, passThroughUnits: true, ignoreTerrainCost: true,
        desc: 'Fold space with every step. Move +1, ignore elevation and terrain, and pass through other units.',
    },

    rallying_beat: {
        name: 'Rallying Beat',
        type: 'physical',
        range: 3, aoe: 1, mpCost: 0, actionCost: 35,
        targetType: 'ally', animType: 'cast', projectileColor: '#ffcc66', chargeTime: 0,
        buffs: [{ stat: 'atk', value: 2, duration: 3 }, { stat: 'mat', value: 2, duration: 3 }],
        floatText: 'Rallied!',
        desc: 'Pound out a war beat. The target ally and everyone beside them get ATK and MAT +{buff:atk} for 3 turns.',
    },

    draining_edge: {
        extends: 'attack',
        name: 'Draining Edge',
        actionCost: 45,
        basePower: 0.9,
        drainFrac: 0.5,
        desc: 'The rune on your blade drinks deep. Heals you for half the damage dealt.',
    },

    spellbreaker: {
        extends: 'attack',
        name: 'Spellbreaker',
        actionCost: 42,
        basePower: 0.9,
        applyStatus: 'silence', statusDuration: 2,
        desc: 'A strike to the throat wrapped in anti-magic. Deals damage and silences the target for {duration} turns.',
    },

    purify: {
        extends: 'cure',
        name: 'Purify',
        range: 3, aoe: 1,
        mpCost: 16, actionCost: 45,
        projectileColor: '#ffffdd',
        desc: 'A cleansing prayer. Clears every harmful status from each ally in the area.',
    },

    unravel: {
        name: 'Unravel',
        type: 'magic',
        range: 3, aoe: 0, mpCost: 12, actionCost: 42,
        targetType: 'enemy', basePower: 0, element: 'shadow',
        animType: 'cast', projectileColor: '#dd66bb', chargeTime: 0,
        isDispel: true,
        desc: 'Pulls loose every thread of good fortune on the target. Strips their positive statuses and stat boosts.',
    },

    martyr: {
        extends: 'brace',
        name: 'Martyr',
        trigger: 'allyHit', chance: 0.5,
        selfStatus: null,
        shareDamageFrac: 0.5,
        desc: 'When an adjacent ally is hurt, you may take half the wound onto yourself. It never drops you below 1 HP.',
    },

    call_of_the_pack: {
        extends: 'brace',
        name: 'Call of the Pack',
        trigger: 'lowHp', chance: 1, oncePerBattle: true,
        selfStatus: null,
        summon: { job: 'summoned_wolf', name: 'Wolf' },
        desc: 'Once per battle, when a blow leaves you below 30% HP, a wolf answers your howl and appears beside you.',
    },

    jp_boost: {
        extends: 'support',
        name: 'Quick Study',
        passiveMpCost: 0, dmgDealt: null,
        xpMult: 1.5,
        desc: 'Learn from every swing. Earn 50% more XP from battles.',
    },

    quake_step: {
        extends: 'move_plus_1',
        name: 'Quake Step',
        moveBonus: 0,
        onMove: { enemiesStatus: { status: 'slow', duration: 1 } },
        desc: 'Stamp the earth as you arrive. Adjacent enemies are slowed for 1 turn.',
    },

    pilgrim_step: {
        extends: 'move_plus_1',
        name: 'Pilgrim\'s Step',
        moveBonus: 0,
        onMove: { cleanse: true },
        desc: 'Walking the path purifies the walker: moving removes your harmful statuses.',
    },

    ghost_step: {
        extends: 'move_plus_1',
        name: 'Ghost Step',
        moveBonus: 1, passThroughUnits: true,
        desc: 'Walk half in the spirit world. Move +1, and you pass through other units.',
    },

    take_root: {
        extends: 'move_plus_1',
        name: 'Take Root',
        moveBonus: 0,
        rootedHealPct: 0.1,
        desc: 'Stand your ground and draw strength from the soil: heal 10% of max HP at the end of any turn you don\'t move.',
    },

    omen_step: {
        extends: 'move_plus_1',
        name: 'Omen Step',
        moveBonus: 0,
        onMove: { enemiesCt: -15 },
        desc: 'Your arrival is an ill omen. Adjacent enemies lose 15 CT from their speed gauge, delaying their next turn.',
    },

    restorative_step: {
        extends: 'move_plus_1',
        name: 'Restorative Step',
        moveBonus: 0,
        onMove: { hpPct: 0.08 },
        desc: 'Each step takes you where the blow will not land. Heal 8% of max HP after moving.',
    },
};
