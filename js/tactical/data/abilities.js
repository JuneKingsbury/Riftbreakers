// Raw ability definitions. Use `extends` to inherit all fields from another ability
// and override only what differs. The registry in data-registry.js resolves inheritance
// before exporting the final ABILITIES table.
//
// Fields:
//   name          string   Display name
//   type          'physical'|'magic'|'passive'
//
// Inheritance note: to suppress an inherited field (e.g. applyStatus from a parent),
// set it explicitly to null in the child. Omitting the field leaves the parent's value.
//   range         number   Tile range (Manhattan distance)
//   aoe           number   AoE radius (0 = single target)
//   mpCost        number   MP consumed on use
//   actionCost    number   CT deducted at end of turn
//   targetType    'enemy'|'ally'|'self'
//   basePower     number   Damage/heal multiplier
//   animType      'slash'|'shot'|'cast'
//   chargeTime    number   CT ticks to charge (0 = instant)
//   element       string   'fire'|'ice'|'thunder'|'shadow'|...
//   applyStatus   string   Status effect to inflict on hit
//   statusDuration number  Turns the applied status lasts
//   isHeal        bool     True for HP-restoring abilities
//   isCure        bool     True for status-clearing abilities
//   passive       bool     True for always-on abilities
//   passiveMpCost number   MP drained per turn (passive only)
//   projectileColor string CSS color for the projectile
//   requiresLos   bool     Whether the ability needs line of sight to the target tile.
//                          Defaults to true when absent. Set to false for lobbed/indirect
//                          spells (e.g. AoE fire dropped from the sky).
//   desc          string   Tooltip description

export const ABILITY_DATA = {
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

    shield_bash: {
        extends: 'attack',
        name: 'Shield Bash',
        actionCost: 45,
        basePower: 0.7,
        applyStatus: 'stun',
        statusDuration: 1,
    },

    // --- Mage spells ---
    fire: {
        name: 'Fire',
        type: 'magic',
        range: 3,
        aoe: 1,
        mpCost: 12,
        actionCost: 50,
        targetType: 'enemy',
        basePower: 1.1,
        element: 'fire',
        animType: 'cast',
        projectileColor: '#ff6622',
        chargeTime: 30,
        requiresLos: false,
    },

    ice: {
        extends: 'fire',
        name: 'Ice',
        aoe: 0,
        requiresLos: true,
        mpCost: 10,
        basePower: 1.0,
        element: 'ice',
        applyStatus: 'slow',
        statusDuration: 2,
        projectileColor: '#88ddff',
        chargeTime: 25,
    },

    thunder: {
        extends: 'fire',
        name: 'Thunder',
        range: 4,
        aoe: 1,
        requiresLos: true,
        mpCost: 14,
        basePower: 1.2,
        element: 'thunder',
        projectileColor: '#ffee44',
        chargeTime: 45,
    },

    // --- Archer ---
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
    },

    // --- Healer ---
    heal: {
        name: 'Heal',
        type: 'magic',
        range: 3,
        aoe: 0,
        mpCost: 15,
        actionCost: 45,
        targetType: 'ally',
        basePower: 1.0,
        isHeal: true,
        animType: 'cast',
        projectileColor: '#66ff99',
        chargeTime: 0,
    },

    cure: {
        name: 'Cure',
        type: 'magic',
        range: 2,
        aoe: 0,
        mpCost: 8,
        actionCost: 40,
        targetType: 'ally',
        isCure: true,
        animType: 'cast',
        projectileColor: '#aaffcc',
        chargeTime: 0,
    },

    // --- Passive abilities ---
    mana_surge: {
        name: 'Mana Surge',
        type: 'passive',
        passive: true,
        passiveMpCost: 2,
        range: 0,
        aoe: 0,
        mpCost: 0,
        actionCost: 0,
        targetType: 'self',
        desc: 'Passively drains MP each turn, enhancing magic.',
        chargeTime: 0,
    },

    regen_aura: {
        extends: 'mana_surge',
        name: 'Regen Aura',
        passiveMpCost: 1,
        desc: 'Passively drains MP each turn to maintain a healing aura.',
    },

    // =====================================================================
    // --- Tier 1 school basics ---
    // =====================================================================

    // Evoker already uses 'fire' and 'thunder' from the existing set above.

    // Enchanter basic: a cheap single-target hex with a short slow
    hex: {
        name: 'Hex',
        type: 'magic',
        range: 3,
        aoe: 0,
        mpCost: 8,
        actionCost: 40,
        targetType: 'enemy',
        basePower: 0.5,
        element: 'shadow',
        animType: 'cast',
        projectileColor: '#cc88dd',
        chargeTime: 0,
        applyStatus: 'slow',
        statusDuration: 1,
        desc: 'A rudimentary enchantment that scratches at the target\'s will, dealing minor damage and leaving them sluggish.',
    },

    // Warden basic: a modest single-target heal, weaker than full Heal
    ward: {
        name: 'Ward',
        type: 'magic',
        range: 3,
        aoe: 0,
        mpCost: 8,
        actionCost: 38,
        targetType: 'ally',
        basePower: 0.7,
        isHeal: true,
        animType: 'cast',
        projectileColor: '#88ccaa',
        chargeTime: 0,
        desc: 'A basic protective charm that restores a modest amount of HP to an ally.',
    },

    // Transmuter basic: hurls a conjured stone at range, purely physical
    rock_toss: {
        name: 'Rock Toss',
        type: 'physical',
        range: 3,
        aoe: 0,
        mpCost: 0,
        actionCost: 38,
        targetType: 'enemy',
        basePower: 0.85,
        animType: 'shot',
        projectileColor: '#886644',
        chargeTime: 0,
        desc: 'Transmutes loose stone underfoot into a hurled projectile, dealing ranged physical damage.',
    },

    // Seer basic: passive divinatory trance that slowly drains MP
    farsight: {
        extends: 'mana_surge',
        name: 'Farsight',
        passiveMpCost: 1,
        desc: 'Maintains a light divinatory trance, reading the immediate future to improve reaction to incoming attacks.',
    },

    // =====================================================================
    // --- Battlemage (Evocation + Enchantment) ---
    // =====================================================================

    arcane_strike: {
        extends: 'attack',
        name: 'Arcane Strike',
        actionCost: 40,
        basePower: 1.15,
        applyStatus: 'slow',
        statusDuration: 1,
        desc: 'Channels arcane energy through the blade, hitting harder and leaving the target sluggish.',
    },

    force_pulse: {
        name: 'Force Pulse',
        type: 'magic',
        range: 2,
        aoe: 1,
        requiresLos: false,
        mpCost: 14,
        actionCost: 55,
        targetType: 'enemy',
        basePower: 0.9,
        element: 'arcane',
        animType: 'cast',
        projectileColor: '#cc88ff',
        chargeTime: 25,
        applyStatus: 'stun',
        statusDuration: 1,
        desc: 'Releases a concussive burst of raw magical force, staggering all nearby foes.',
    },

    // =====================================================================
    // --- Paladin (Evocation + Abjuration) ---
    // =====================================================================

    smite: {
        name: 'Smite',
        type: 'magic',
        range: 1,
        aoe: 1,
        mpCost: 16,
        actionCost: 50,
        targetType: 'enemy',
        basePower: 1.3,
        element: 'holy',
        animType: 'slash',
        projectileColor: '#fff8aa',
        chargeTime: 35,
        desc: 'Channels divine fire through the weapon for a devastating, consecrated blow.',
    },

    divine_ward: {
        extends: 'mana_surge',
        name: 'Divine Ward',
        passiveMpCost: 1,
        desc: 'Maintains a constant abjuration barrier, absorbing a portion of each incoming blow.',
    },

    // =====================================================================
    // --- Riftcaller (Evocation + Conjuration) ---
    // =====================================================================

    rift_bolt: {
        name: 'Rift Bolt',
        type: 'magic',
        range: 5,
        aoe: 1,
        mpCost: 16,
        actionCost: 50,
        targetType: 'enemy',
        basePower: 1.25,
        element: 'void',
        animType: 'cast',
        projectileColor: '#55aaff',
        chargeTime: 40,
        desc: 'Tears a pinhole rift in space, blasting the target with raw dimensional energy.',
    },

    void_burst: {
        extends: 'rift_bolt',
        name: 'Void Burst',
        range: 3,
        aoe: 2,
        requiresLos: false,
        mpCost: 20,
        actionCost: 55,
        basePower: 0.8,
        projectileColor: '#3355ff',
        chargeTime: 50,
        desc: 'Rips open a rift that collapses violently outward, damaging everything nearby.',
    },

    // =====================================================================
    // --- Earthshaker (Evocation + Transmutation) ---
    // =====================================================================

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
        chargeTime: 30,
        applyStatus: 'slow',
        statusDuration: 2,
        desc: 'Slams the earth with seismic force, cracking the ground and slowing all caught within.',
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
        chargeTime: 55,
        applyStatus: null,
        desc: 'Erupts a massive spike of stone beneath the target, dealing concentrated crushing damage.',
    },

    // =====================================================================
    // --- Sanctifier (Enchantment + Abjuration) ---
    // =====================================================================

    holy_bind: {
        name: 'Holy Bind',
        type: 'magic',
        range: 3,
        aoe: 0,
        mpCost: 10,
        actionCost: 45,
        targetType: 'enemy',
        basePower: 0.4,
        element: 'holy',
        animType: 'cast',
        projectileColor: '#ffffaa',
        chargeTime: 0,
        applyStatus: 'stun',
        statusDuration: 1,
        desc: 'Binds the target in chains of holy light, dealing minor damage and rooting them in place.',
    },

    radiant_heal: {
        extends: 'heal',
        name: 'Radiant Heal',
        range: 4,
        mpCost: 18,
        basePower: 1.1,
        projectileColor: '#ffeeaa',
        desc: 'A more powerful prayer with extended reach, drawing on both Enchantment and Abjuration.',
    },

    // =====================================================================
    // --- Spiritbinder (Enchantment + Conjuration) ---
    // =====================================================================

    spirit_lash: {
        name: 'Spirit Lash',
        type: 'magic',
        range: 3,
        aoe: 0,
        mpCost: 10,
        actionCost: 45,
        targetType: 'enemy',
        basePower: 1.0,
        element: 'spirit',
        animType: 'cast',
        projectileColor: '#aaccff',
        chargeTime: 0,
        applyStatus: 'slow',
        statusDuration: 2,
        desc: 'Unleashes a bound spirit against a target, leaving them slowed by its ethereal chill.',
    },

    haunting: {
        extends: 'spirit_lash',
        name: 'Haunting',
        range: 4,
        aoe: 1,
        mpCost: 16,
        actionCost: 50,
        basePower: 0.85,
        projectileColor: '#8899ff',
        chargeTime: 40,
        applyStatus: 'stun',
        statusDuration: 1,
        desc: 'Sends a spirit to possess the target momentarily, stunning them as it tears free.',
    },

    // =====================================================================
    // --- Worldsinger (Enchantment + Transmutation) ---
    // =====================================================================

    verdant_lash: {
        name: 'Verdant Lash',
        type: 'magic',
        range: 3,
        aoe: 0,
        mpCost: 10,
        actionCost: 45,
        targetType: 'enemy',
        basePower: 1.0,
        element: 'nature',
        animType: 'cast',
        projectileColor: '#66dd22',
        chargeTime: 0,
        applyStatus: 'slow',
        statusDuration: 1,
        desc: 'Snaps a whip of enchanted vines at the target, dealing damage and briefly entangling them.',
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
        desc: 'Sings up a cloud of narcotic spores that drifts across the battlefield, slowing all caught within.',
    },

    // =====================================================================
    // --- Fatebinder (Enchantment + Divination) ---
    // =====================================================================

    doom_hex: {
        name: 'Doom Hex',
        type: 'magic',
        range: 4,
        aoe: 0,
        mpCost: 10,
        actionCost: 45,
        targetType: 'enemy',
        basePower: 0.95,
        element: 'shadow',
        animType: 'cast',
        projectileColor: '#cc44aa',
        chargeTime: 0,
        applyStatus: 'slow',
        statusDuration: 3,
        desc: 'Weaves a thread of doomed fate around the target, dragging their destiny toward an inevitable end.',
    },

    fate_seal: {
        extends: 'doom_hex',
        name: 'Fate Seal',
        range: 3,
        aoe: 1,
        mpCost: 16,
        actionCost: 50,
        basePower: 0.7,
        projectileColor: '#aa00cc',
        chargeTime: 40,
        applyStatus: 'stun',
        statusDuration: 1,
        desc: 'Seals a moment in time around the target, briefly locking them out of the flow of causality.',
    },

    wyrd_drain: {
        extends: 'mana_surge',
        name: 'Wyrd Drain',
        passiveMpCost: 2,
        desc: 'Continuously reads the threads of fate, draining magical energy to fuel curses and hexes.',
    },

    // =====================================================================
    // --- Lifeseer (Abjuration + Divination) ---
    // =====================================================================

    foresight_heal: {
        extends: 'heal',
        name: 'Foresight Heal',
        mpCost: 18,
        basePower: 1.3,
        projectileColor: '#aaddff',
        desc: 'Heals a wound before it fully manifests, guided by prophetic sight into the target\'s near future.',
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
        desc: 'Purges all afflictions and seals the target in a brief protective ward, seen moments in advance.',
    },

    seers_vigil: {
        extends: 'mana_surge',
        name: 'Seer\'s Vigil',
        passiveMpCost: 1,
        desc: 'Maintains a constant prescient awareness, sensing threats a fraction of a second before they land.',
    },

    // =====================================================================
    // --- Beastcaller (Conjuration + Transmutation) ---
    // =====================================================================

    wild_surge: {
        extends: 'attack',
        name: 'Wild Surge',
        actionCost: 40,
        basePower: 1.2,
        applyStatus: 'slow',
        statusDuration: 1,
        desc: 'Channels bestial rage into a savage strike, the raw force leaving the target staggered.',
    },

    savage_howl: {
        name: 'Savage Howl',
        type: 'magic',
        range: 2,
        aoe: 2,
        requiresLos: false,
        mpCost: 14,
        actionCost: 55,
        targetType: 'enemy',
        basePower: 0.75,
        element: 'nature',
        animType: 'cast',
        projectileColor: '#cc8833',
        chargeTime: 40,
        applyStatus: 'stun',
        statusDuration: 1,
        desc: 'Lets out a primal howl resonating with transmutation magic, briefly stunning all nearby foes.',
    },

    // =====================================================================
    // --- Terrain manipulation ---
    // =====================================================================

    stone_wall: {
        name: 'Stone Wall',
        type: 'magic',
        range: 3,
        aoePattern: [[-1, 0], [0, 0], [1, 0]],
        requiresLos: false,
        mpCost: 20,
        actionCost: 55,
        targetType: 'tile',
        terrainEffect: { setType: 'wall', setElevation: 2, affectTiles: 'passable' },
        animType: 'cast',
        projectileColor: '#886644',
        chargeTime: 45,
        desc: 'Erupts a wall of stone from the earth, sealing passage for the rest of the battle.',
    },

    root_field: {
        name: 'Root Field',
        type: 'magic',
        range: 3,
        aoePattern: [[0, -1], [-1, 0], [0, 0], [1, 0], [0, 1]],
        requiresLos: false,
        mpCost: 16,
        actionCost: 50,
        targetType: 'tile',
        terrainEffect: { setType: 'rubble', affectTiles: 'passable' },
        animType: 'cast',
        projectileColor: '#66aa22',
        chargeTime: 30,
        desc: 'Chokes an area with tangling roots, turning open ground into difficult terrain.',
    },

    // --- Enemy abilities ---
    goblin_slash: {
        extends: 'attack',
        name: 'Slash',
        actionCost: 30,
        basePower: 0.9,
    },

    shadow_bolt: {
        extends: 'fire',
        name: 'Shadow Bolt',
        range: 4,
        aoe: 1,
        mpCost: 14,
        basePower: 1.15,
        element: 'shadow',
        projectileColor: '#aa44ff',
        chargeTime: 40,
    },
};
