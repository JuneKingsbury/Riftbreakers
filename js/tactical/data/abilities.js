// Raw ability definitions. Use `extends` to inherit all fields from another ability
// and override only what differs. The registry in data-registry.js resolves inheritance
// before exporting the final ABILITIES table.
//
// Fields:
//   name          string   Display name
//   type          'physical'|'magic'|'passive'
//   slot          'action'|'reaction'|'support'|'movement'  Loadout slot the ability
//                 is equipped into. Absent = 'action' (part of a job's skillset).
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
//
// Reaction fields (slot: 'reaction'). Fired by reactions.js after the owner is hit:
//   trigger       'physicalHit'|'magicHit'|'anyHit'|'rangedHit'|'lowHp'
//   chance        number   0-1 proc chance
//   adjacentOnly  bool     Only when the attacker is adjacent
//   oncePerBattle bool     Fires at most once per battle
//   counterWith   string   Ability used against the attacker (needs MP and range)
//   selfCast      string   Ability cast on the owner (needs MP)
//   selfStatus    string   Status applied to the owner
//   selfBuff      object   { stat, value, duration } buff applied to the owner
//   mpRestoreFrac number   Restore this fraction of the damage taken as MP
//
// More action fields:
//   buffs         Array<{stat,value,duration}>  Stat buffs/debuffs put on each target
//   floatText     string   Floating text shown when a buff-only ability lands
//   drainFrac     number   Source heals this fraction of the damage dealt
//   isDispel      bool     Strips positive statuses and buffs from the target
//
// More reaction fields:
//   trigger 'allyHit'      An adjacent ally of the owner was damaged
//   trigger 'statusHit'    The owner was afflicted with a negative status
//   allyCast      string   Ability cast on the ally that was hit (allyHit)
//   shareDamageFrac number Owner takes this share of the ally's damage instead (allyHit)
//   attackerStatus { status, duration }  Status inflicted on the attacker
//   thornsFrac    number   Attacker takes this fraction of the damage dealt
//   phaseAway     number   Owner teleports up to this many tiles away from the attacker
//   summon        { job, name }  Creature summoned next to the owner
//   cleanseSelf   bool     Removes the owner's negative statuses
//
// Support fields (slot: 'support'), read through abilities.js supportOf():
//   dmgDealt / dmgTaken    { physical?, magic? }  Damage multipliers
//   lowHpDmgDealt          { physical?, magic? }  Multiplier while below 50% HP
//   evaBonus      number   Added evasion vs physical attacks
//   ignoreEvasion bool     Physical attacks ignore target evasion
//   highGroundMult number  Replaces the 1.25 high-ground damage bonus; also negates it against you
//   matToPhysical number   Fraction of MAT added to ATK for physical damage
//   mdfPierce     number   Fraction of target MDF ignored by your magic
//   aoeDmgMult    number   Damage multiplier for area abilities
//   healMult      number   Healing multiplier
//   attackProc    { status, chance, duration }  Physical hits may inflict a status
//   statusImmune  string[] Statuses that cannot be inflicted on you
//   statusDurationBonus number  Extra turns on statuses you inflict
//   surviveLethal bool     Once per battle, a killing blow leaves you at 1 HP
//   chargeMult    number   Charge time multiplier (battle.js)
//   xpMult        number   XP multiplier for the member after a won battle (run-state.js)
//   turnRegenHp   number   HP healed at the start of each turn (battle.js)
//   summonBoost   number   Summons gain this fraction to HP, ATK and MAT (battle.js)
//
// Movement fields (slot: 'movement'), read by abilities.js moveProfile():
//   moveBonus, climbBonus  number  Extra move range / climbable elevation
//   ignoreClimb       bool  No elevation limit
//   ignoreTerrainCost bool  Every step costs 1
//   passThroughUnits  bool  Can walk through (but not stop on) occupied tiles
// Movement effects applied by battle.js afterMove() / endTurn():
//   onMove        { hpPct?, mpPct?, cleanse?, alliesHealPct?, alliesBuff?, enemiesStatus?, enemiesCt? }
//                 After moving: heal/restore self, cleanse self, heal or buff adjacent
//                 allies (and self), inflict a status on / delay adjacent enemies.
//   momentumPct   number  +damage per tile moved this turn (max 5 tiles)
//   rootedHealPct number  Heal this fraction of max HP when ending a turn without moving

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
        slot: 'support',
        passive: true,
        passiveMpCost: 2,
        range: 0,
        aoe: 0,
        mpCost: 0,
        actionCost: 0,
        targetType: 'self',
        dmgDealt: { magic: 1.15 },
        desc: 'Channels a constant trickle of MP into your spells: +15% magic damage dealt. Drains 2 MP per turn.',
        chargeTime: 0,
    },

    regen_aura: {
        extends: 'mana_surge',
        name: 'Regen Aura',
        passiveMpCost: 1,
        dmgDealt: null,
        turnRegenHp: 5,
        desc: 'Living growth knits your wounds: heal 5 HP at the start of each turn. Drains 1 MP per turn.',
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
        dmgDealt: null,
        evaBonus: 0.2,
        desc: 'A light divinatory trance reads the next few heartbeats: +20% evasion against physical attacks. Drains 1 MP per turn.',
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
        dmgDealt: null,
        dmgTaken: { physical: 0.8 },
        desc: 'A constant barrier of holy force: -20% physical damage taken. Drains 1 MP per turn.',
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
        dmgDealt: null,
        statusDurationBonus: 1,
        desc: 'Tightens the threads of fate around your victims: every status you inflict lasts 1 extra turn. Drains 2 MP per turn.',
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
        terrainEffect: { setType: 'wall', raise: 2, affectTiles: 'passable' },
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

    // =====================================================================
    // --- Tier 1 additions ---
    // =====================================================================

    // Transmuter: self-buff, raises DEF for 2 turns
    earth_skin: {
        name: 'Earth Skin',
        type: 'magic',
        range: 0,
        aoe: 0,
        mpCost: 10,
        actionCost: 35,
        targetType: 'self',
        animType: 'cast',
        projectileColor: '#886644',
        chargeTime: 0,
        buffs: [{ stat: 'def', value: 8, duration: 2 }],
        floatText: 'DEF UP!',
        desc: 'Transmutes your own skin to stone, raising DEF by 8 for 2 turns.',
    },

    // Enchanter: ranged ATK debuff
    enfeeble: {
        name: 'Enfeeble',
        type: 'magic',
        range: 3,
        aoe: 0,
        mpCost: 10,
        actionCost: 42,
        targetType: 'enemy',
        basePower: 0.4,
        element: 'shadow',
        animType: 'cast',
        projectileColor: '#aa44cc',
        chargeTime: 0,
        applyStatus: 'enfeebled',
        desc: 'Saps the target\'s fighting spirit, dealing minor damage and reducing their ATK for 2 turns.',
    },

    // Seer: causes the next physical attack against target to miss
    temporal_slip: {
        name: 'Temporal Slip',
        type: 'magic',
        range: 3,
        aoe: 0,
        mpCost: 14,
        actionCost: 42,
        targetType: 'ally',
        basePower: 0,
        element: 'arcane',
        animType: 'cast',
        projectileColor: '#aaddff',
        chargeTime: 0,
        applyStatus: 'slipped',
        desc: 'Nudges fate so the next physical attack against this target misses entirely.',
    },

    // =====================================================================
    // --- New status-effect abilities ---
    // =====================================================================

    // HASTE — cast on ally, CT advance rate ×1.5 for 3 turns
    swift_grace: {
        name: 'Swift Grace',
        type: 'magic',
        range: 3,
        aoe: 0,
        mpCost: 14,
        actionCost: 45,
        targetType: 'ally',
        basePower: 0,
        element: 'arcane',
        animType: 'cast',
        projectileColor: '#ffee88',
        chargeTime: 0,
        applyStatus: 'haste',
        statusDuration: 3,
        desc: 'Accelerates an ally\'s flow of time, letting them act far more often.',
    },

    // SILENCE — prevent target from casting magic
    mute: {
        name: 'Mute',
        type: 'magic',
        range: 3,
        aoe: 0,
        mpCost: 10,
        actionCost: 42,
        targetType: 'enemy',
        basePower: 0,
        element: 'shadow',
        animType: 'cast',
        projectileColor: '#cc44cc',
        chargeTime: 0,
        applyStatus: 'silence',
        statusDuration: 2,
        desc: 'Seals the target\'s voice and will, preventing them from casting any magic.',
    },

    // SLEEP — skip turns until woken by damage
    dream_veil: {
        name: 'Dream Veil',
        type: 'magic',
        range: 4,
        aoe: 0,
        mpCost: 12,
        actionCost: 45,
        targetType: 'enemy',
        basePower: 0,
        element: 'spirit',
        animType: 'cast',
        projectileColor: '#aabbff',
        chargeTime: 0,
        applyStatus: 'sleep',
        statusDuration: 3,
        desc: 'Draws the target into a deep slumber. They skip turns until struck.',
    },

    // BERSERK — forces target into uncontrolled auto-attacks each turn
    primal_rage: {
        name: 'Primal Rage',
        type: 'magic',
        range: 3,
        aoe: 0,
        mpCost: 12,
        actionCost: 45,
        targetType: 'enemy',
        basePower: 0,
        element: 'nature',
        animType: 'cast',
        projectileColor: '#ff6600',
        chargeTime: 0,
        applyStatus: 'berserk',
        statusDuration: 2,
        desc: 'Floods the target\'s mind with primal fury, forcing them into mindless attacks.',
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
        desc: 'Binds the target\'s will to yours, turning them against their own side for a turn.',
    },

    // POISON — AoE poison cloud
    toxic_spores: {
        name: 'Toxic Spores',
        type: 'magic',
        range: 3,
        aoe: 1,
        requiresLos: false,
        mpCost: 12,
        actionCost: 48,
        targetType: 'enemy',
        basePower: 0.4,
        element: 'nature',
        animType: 'cast',
        projectileColor: '#88ff22',
        chargeTime: 20,
        applyStatus: 'poison',
        statusDuration: 3,
        desc: 'Releases a cloud of toxic spores that deal damage and poison all caught within.',
    },

    // POISON — single-target melee venom
    venom_strike: {
        extends: 'attack',
        name: 'Venom Strike',
        actionCost: 40,
        basePower: 0.9,
        applyStatus: 'poison',
        statusDuration: 3,
        desc: 'A bite or strike laced with natural venom, poisoning the target.',
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
        desc: 'Blesses an ally so that the next killing blow instead leaves them at 1 HP.',
    },

    // PROTECT — reduce incoming physical damage by 25%
    stone_aegis: {
        name: 'Stone Aegis',
        type: 'magic',
        range: 3,
        aoe: 0,
        mpCost: 12,
        actionCost: 42,
        targetType: 'ally',
        basePower: 0,
        element: 'earth',
        animType: 'cast',
        projectileColor: '#aa8855',
        chargeTime: 0,
        applyStatus: 'protect',
        statusDuration: 3,
        desc: 'Wraps an ally in transmuted stone, absorbing 25% of all incoming physical strikes.',
    },

    // SHELL — reduce incoming magic damage by 25%
    arcane_veil: {
        name: 'Arcane Veil',
        type: 'magic',
        range: 3,
        aoe: 0,
        mpCost: 12,
        actionCost: 42,
        targetType: 'ally',
        basePower: 0,
        element: 'arcane',
        animType: 'cast',
        projectileColor: '#88aaff',
        chargeTime: 0,
        applyStatus: 'shell',
        statusDuration: 3,
        desc: 'Wraps an ally in an arcane ward that absorbs 25% of all incoming magic damage.',
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
        desc: 'Transmutes the target\'s form into something diminished, cutting their combat stats by half.',
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
        desc: 'Erects a divination mirror around an ally, reflecting magic spells back at their caster.',
    },

    // REGEN — status-based HP regen each turn (ally buff)
    renewing_light: {
        name: 'Renewing Light',
        type: 'magic',
        range: 3,
        aoe: 0,
        mpCost: 10,
        actionCost: 40,
        targetType: 'ally',
        basePower: 0,
        element: 'holy',
        animType: 'cast',
        projectileColor: '#aaffcc',
        chargeTime: 0,
        applyStatus: 'regen',
        statusDuration: 4,
        desc: 'Blesses an ally with divine healing energy that restores HP each turn.',
    },

    // =====================================================================
    // --- Reaction abilities (slot: 'reaction') ---
    // =====================================================================

    brace: {
        name: 'Brace',
        type: 'passive', slot: 'reaction',
        range: 0, aoe: 0, mpCost: 0, actionCost: 0, targetType: 'self', chargeTime: 0,
        trigger: 'anyHit', chance: 0.4,
        selfStatus: 'defend',
        desc: 'When struck, may set your feet and take a defensive stance until your next turn.',
    },

    flame_retort: {
        extends: 'brace',
        name: 'Flame Retort',
        trigger: 'magicHit', chance: 0.3,
        selfStatus: null,
        counterWith: 'fire',
        desc: 'When hit by magic, may answer with a Fire spell at the caster if they are in range.',
    },

    counter: {
        extends: 'brace',
        name: 'Counter',
        trigger: 'physicalHit', chance: 0.5, adjacentOnly: true,
        selfStatus: null,
        counterWith: 'attack',
        desc: 'When struck in melee, may strike the attacker back.',
    },


    return_fire: {
        extends: 'brace',
        name: 'Return Fire',
        trigger: 'rangedHit', chance: 0.4,
        selfStatus: null,
        counterWith: 'long_shot',
        desc: 'When hit from range, may loose a Long Shot back at the attacker.',
    },

    stone_reflex: {
        extends: 'brace',
        name: 'Stone Reflex',
        trigger: 'physicalHit', chance: 0.5,
        selfStatus: null,
        selfBuff: { stat: 'def', value: 6, duration: 2 },
        desc: 'When struck physically, may harden your skin, raising DEF by 6 for 2 turns.',
    },

    void_siphon: {
        extends: 'brace',
        name: 'Void Siphon',
        trigger: 'magicHit', chance: 0.6,
        selfStatus: null,
        mpRestoreFrac: 0.5,
        desc: 'When hit by magic, may pull the spell into the void, restoring MP equal to half the damage taken.',
    },

    retribution: {
        extends: 'brace',
        name: 'Retribution',
        trigger: 'anyHit', chance: 0.3,
        selfStatus: null,
        counterWith: 'smite',
        desc: 'When struck, may answer with an instant Smite against an adjacent attacker.',
    },

    feral_counter: {
        extends: 'counter',
        name: 'Feral Counter',
        counterWith: 'wild_surge',
        desc: 'When struck in melee, may lash back with a Wild Surge.',
    },

    second_sight: {
        extends: 'brace',
        name: 'Second Sight',
        trigger: 'lowHp', chance: 1, oncePerBattle: true,
        selfStatus: null,
        selfCast: 'renewing_light',
        desc: 'The first time a blow drops you below 30% HP, you foresee it and cast Renewing Light on yourself.',
    },

    // =====================================================================
    // --- Movement abilities (slot: 'movement') ---
    // =====================================================================

    move_plus_1: {
        name: 'Move +1',
        type: 'passive', slot: 'movement',
        range: 0, aoe: 0, mpCost: 0, actionCost: 0, targetType: 'self', chargeTime: 0,
        moveBonus: 1,
        desc: 'Increases movement range by 1.',
    },

    move_plus_2: {
        extends: 'move_plus_1',
        name: 'Beast Lope',
        moveBonus: 2,
        desc: 'Run on all fours like the beasts you call: movement range +2.',
    },

    fleet_step: {
        extends: 'move_plus_1',
        name: 'Fleet Step',
        moveBonus: 1, climbBonus: 1,
        desc: 'Increases movement range by 1 and lets you climb 1 extra level of elevation.',
    },

    stone_stride: {
        extends: 'move_plus_1',
        name: 'Stone Stride',
        moveBonus: 0, ignoreTerrainCost: true,
        desc: 'Earth parts beneath your feet: every tile costs only 1 movement.',
    },

    featherstep: {
        extends: 'move_plus_1',
        name: 'Levitate',
        moveBonus: 0, climbBonus: 2,
        desc: 'Drift a hand\'s breadth above the ground, rising over ledges: climb 2 extra levels of elevation.',
    },

    blink: {
        extends: 'move_plus_1',
        name: 'Blink',
        moveBonus: 1, ignoreClimb: true, passThroughUnits: true, ignoreTerrainCost: true,
        desc: 'Fold space with every step: +1 movement, ignores elevation and terrain, and passes through other units.',
    },

    // =====================================================================
    // --- Job ability expansion: actions ---
    // =====================================================================

    // Novice (Fundamentals)
    focus: {
        name: 'Focus',
        type: 'physical',
        range: 0, aoe: 0, mpCost: 0, actionCost: 30,
        targetType: 'self', animType: 'cast', projectileColor: '#ffeeaa', chargeTime: 0,
        buffs: [{ stat: 'atk', value: 3, duration: 3 }, { stat: 'mat', value: 3, duration: 3 }],
        floatText: 'Focus!',
        desc: 'Steady your breath and remember your training: ATK and MAT +3 for 3 turns.',
    },
    rallying_beat: {
        name: 'Rallying Beat',
        type: 'physical',
        range: 3, aoe: 1, mpCost: 0, actionCost: 35,
        targetType: 'ally', animType: 'cast', projectileColor: '#ffcc66', chargeTime: 0,
        buffs: [{ stat: 'atk', value: 2, duration: 3 }, { stat: 'mat', value: 2, duration: 3 }],
        floatText: 'Rallied!',
        desc: 'Pound out a war beat that steadies everyone near an ally: ATK and MAT +2 for 3 turns.',
    },
    rush: {
        extends: 'attack',
        name: 'Rush',
        actionCost: 40,
        basePower: 1.15,
        desc: 'A headlong shoulder-charge that hits a little harder than a normal attack.',
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
        desc: 'Bind a wound with field dressings. Heals an adjacent ally (or yourself) without MP.',
    },

    // Evoker (Evocation)
    flare: {
        extends: 'fire',
        name: 'Flare',
        range: 4, aoe: 0,
        requiresLos: true,
        mpCost: 26, actionCost: 60,
        basePower: 1.9,
        element: 'arcane',
        projectileColor: '#ffffff',
        chargeTime: 55,
        desc: 'The pinnacle of evocation: a single point of white-hot force that annihilates one target.',
    },

    // Spellblade (Runeblade)
    sunder: {
        extends: 'attack',
        name: 'Sunder',
        actionCost: 40,
        basePower: 0.8,
        buffs: [{ stat: 'def', value: -5, duration: 2 }],
        desc: 'A rune-etched cut that splits armour: deals damage and lowers the target\'s DEF by 5 for 2 turns.',
    },
    draining_edge: {
        extends: 'attack',
        name: 'Draining Edge',
        actionCost: 45,
        basePower: 0.9,
        drainFrac: 0.5,
        desc: 'The rune on your blade drinks deep: heal yourself for half the damage dealt.',
    },

    // Runebow (Runecraft)
    pinning_shot: {
        extends: 'long_shot',
        name: 'Pinning Shot',
        range: 4,
        basePower: 0.7,
        applyStatus: 'slow', statusDuration: 2,
        desc: 'An arrow aimed at the legs, pinning the target and slowing them for 2 turns.',
    },
    rune_arrow: {
        name: 'Rune Arrow',
        type: 'magic',
        range: 5, aoe: 0, mpCost: 10, actionCost: 45,
        targetType: 'enemy', basePower: 1.0, element: 'arcane',
        animType: 'shot', projectileColor: '#aaccff', chargeTime: 0,
        desc: 'A conjured arrow inscribed with a rune of force. Magic damage at long range.',
    },
    arrow_rain: {
        extends: 'long_shot',
        name: 'Arrow Rain',
        range: 4, aoe: 1,
        requiresLos: false,
        actionCost: 50,
        basePower: 0.65,
        chargeTime: 25,
        desc: 'Loose a volley high into the air that falls across an area.',
    },

    // Stoneshaper (Transmutation)
    stone_fist: {
        extends: 'attack',
        name: 'Stone Fist',
        actionCost: 45,
        basePower: 1.35,
        desc: 'Transmute your fist to granite mid-swing for a crushing blow.',
    },
    calcify: {
        name: 'Calcify',
        type: 'magic',
        range: 2, aoe: 0, mpCost: 12, actionCost: 45,
        targetType: 'enemy', basePower: 0.3, element: 'earth',
        animType: 'cast', projectileColor: '#bbaa88', chargeTime: 0,
        applyStatus: 'stun', statusDuration: 1,
        desc: 'Turns the target\'s joints briefly to stone, stunning them.',
    },

    // Seer (Divination)
    time_lapse: {
        name: 'Time Lapse',
        type: 'magic',
        range: 4, aoe: 0, mpCost: 10, actionCost: 42,
        targetType: 'enemy', basePower: 0, element: 'arcane',
        animType: 'cast', projectileColor: '#ccddff', chargeTime: 0,
        applyStatus: 'slow', statusDuration: 3,
        desc: 'Thickens the flow of time around the target, slowing them for 3 turns.',
    },

    // Battlemage (Battle Arts)
    spellbreaker: {
        extends: 'attack',
        name: 'Spellbreaker',
        actionCost: 42,
        basePower: 0.9,
        applyStatus: 'silence', statusDuration: 2,
        desc: 'A strike to the throat wrapped in anti-magic, silencing the target for 2 turns.',
    },
    blade_storm: {
        extends: 'attack',
        name: 'Blade Storm',
        aoe: 1,
        actionCost: 55,
        basePower: 0.75,
        desc: 'A whirling, spell-driven sweep that strikes the target and everything beside it.',
    },

    // Paladin (Holy Arts)
    consecrate: {
        name: 'Consecrate',
        type: 'magic',
        range: 2, aoe: 1, requiresLos: false, mpCost: 18, actionCost: 50,
        targetType: 'enemy', basePower: 0.8, element: 'holy',
        animType: 'cast', projectileColor: '#fff4bb', chargeTime: 30,
        desc: 'Hallows the ground in a burst of light that sears every foe standing on it.',
    },

    // Riftcaller (Riftcraft)
    gravity_well: {
        extends: 'rift_bolt',
        name: 'Gravity Well',
        range: 4, aoe: 1,
        requiresLos: false,
        mpCost: 18, actionCost: 50,
        basePower: 0.6,
        projectileColor: '#3344aa',
        chargeTime: 30,
        applyStatus: 'slow', statusDuration: 2,
        desc: 'Collapses a pocket of space into crushing weight, damaging and slowing everything inside.',
    },

    // Earthshaker (Geomancy)
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

    // Sanctifier (Sanctity)
    purify: {
        extends: 'cure',
        name: 'Purify',
        range: 3, aoe: 1,
        mpCost: 16, actionCost: 45,
        projectileColor: '#ffffdd',
        desc: 'A cleansing prayer that removes all afflictions from every ally in the area.',
    },
    holy_chains: {
        extends: 'holy_bind',
        name: 'Holy Chains',
        aoe: 1,
        mpCost: 22, actionCost: 50,
        chargeTime: 40,
        desc: 'Chains of light lash out across an area, binding every foe caught in them.',
    },

    // Spiritbinder (Spiritbinding)
    soul_siphon: {
        extends: 'spirit_lash',
        name: 'Soul Siphon',
        mpCost: 12,
        basePower: 0.9,
        applyStatus: null,
        drainFrac: 0.5,
        projectileColor: '#99aaee',
        desc: 'A bound spirit tears a sliver of life from the target and carries it back to you.',
    },

    // Fatebinder (Fateweaving)
    unravel: {
        name: 'Unravel',
        type: 'magic',
        range: 3, aoe: 0, mpCost: 12, actionCost: 42,
        targetType: 'enemy', basePower: 0, element: 'shadow',
        animType: 'cast', projectileColor: '#dd66bb', chargeTime: 0,
        isDispel: true,
        desc: 'Pulls loose every thread of good fortune on the target, stripping its buffs and protective statuses.',
    },
    death_sentence: {
        name: 'Death Sentence',
        type: 'magic',
        range: 3, aoe: 0, mpCost: 24, actionCost: 50,
        targetType: 'enemy', basePower: 0, element: 'shadow',
        animType: 'cast', projectileColor: '#660033', chargeTime: 30,
        applyStatus: 'doom', statusDuration: 3,
        desc: 'Seals the target\'s fate. When the count of 3 turns runs out they fall, unless the doom is cured first.',
    },

    // Lifeseer (Providence)
    mass_foresight: {
        extends: 'heal',
        name: 'Mass Foresight',
        aoe: 1,
        mpCost: 24, actionCost: 50,
        basePower: 0.8,
        chargeTime: 30,
        projectileColor: '#bbddff',
        desc: 'Foresees the wounds of everyone nearby and mends them together.',
    },

    // =====================================================================
    // --- Job ability expansion: reactions ---
    // =====================================================================

    premonition: {
        extends: 'brace',
        name: 'Premonition',
        trigger: 'anyHit', chance: 0.5,
        selfStatus: 'slipped',
        desc: 'After being hit, may glimpse the next blow coming: the next physical attack against you misses.',
    },
    guardian_ward: {
        extends: 'brace',
        name: 'Guardian Ward',
        trigger: 'allyHit', chance: 0.4,
        selfStatus: null,
        allyCast: 'ward',
        desc: 'When an adjacent ally is hurt, may cast Ward on them (uses your MP).',
    },
    martyr: {
        extends: 'brace',
        name: 'Martyr',
        trigger: 'allyHit', chance: 0.5,
        selfStatus: null,
        shareDamageFrac: 0.5,
        desc: 'When an adjacent ally is hurt, may take half of that wound onto yourself (never below 1 HP).',
    },
    arcane_rebuke: {
        extends: 'counter',
        name: 'Arcane Rebuke',
        chance: 0.45,
        counterWith: 'arcane_strike',
        desc: 'When struck in melee, may answer with an Arcane Strike that slows the attacker.',
    },
    phase_shift: {
        extends: 'brace',
        name: 'Phase Shift',
        trigger: 'anyHit', chance: 0.4,
        selfStatus: null,
        phaseAway: 3,
        desc: 'When hit, may slip through a rift and reappear up to 3 tiles away from the attacker.',
    },
    aftershock: {
        extends: 'counter',
        name: 'Aftershock',
        counterWith: null,
        attackerStatus: { status: 'slow', duration: 2 },
        desc: 'When struck in melee, may send a tremor back through the attacker\'s feet, slowing them.',
    },
    purifying_light: {
        extends: 'brace',
        name: 'Purifying Light',
        trigger: 'statusHit', chance: 0.6,
        selfStatus: null,
        cleanseSelf: true,
        desc: 'When afflicted with a harmful status, may burn it away with holy light.',
    },
    spirit_hush: {
        extends: 'brace',
        name: 'Spirit Hush',
        trigger: 'magicHit', chance: 0.4,
        selfStatus: null,
        attackerStatus: { status: 'silence', duration: 2 },
        desc: 'When hit by magic, a guardian spirit may clamp a hand over the caster\'s mouth, silencing them.',
    },
    thorn_hide: {
        extends: 'counter',
        name: 'Thorn Hide',
        chance: 1,
        counterWith: null,
        thornsFrac: 0.3,
        desc: 'Bark and thorn cover your skin: melee attackers take 30% of the damage they deal.',
    },
    karmic_rebound: {
        extends: 'brace',
        name: 'Karmic Rebound',
        trigger: 'anyHit', chance: 0.4,
        selfStatus: null,
        attackerStatus: { status: 'enfeebled', duration: 2 },
        desc: 'Harm done to you may come back around: the attacker is enfeebled (ATK -5) for 2 turns.',
    },
    call_of_the_pack: {
        extends: 'brace',
        name: 'Call of the Pack',
        trigger: 'lowHp', chance: 1, oncePerBattle: true,
        selfStatus: null,
        summon: { job: 'wolf', name: 'Wolf' },
        desc: 'The first time you drop below 30% HP, a wolf answers your howl and appears beside you.',
    },

    // =====================================================================
    // --- Job ability expansion: supports ---
    // =====================================================================

    jp_boost: {
        extends: 'mana_surge',
        name: 'Quick Study',
        passiveMpCost: 0, dmgDealt: null,
        xpMult: 1.5,
        desc: 'Learn from every swing: earn 50% more XP from battles.',
    },
    rune_edge: {
        extends: 'mana_surge',
        name: 'Rune Edge',
        passiveMpCost: 0, dmgDealt: null,
        attackProc: { status: 'slow', chance: 0.35, duration: 1 },
        desc: 'A binding rune on your weapon: physical hits have a 35% chance to slow the target.',
    },
    iron_will: {
        extends: 'mana_surge',
        name: 'Iron Will',
        passiveMpCost: 0, dmgDealt: null,
        statusImmune: ['stun', 'sleep', 'charm', 'berserk'],
        desc: 'An unbreakable mind: immune to stun, sleep, charm and berserk.',
    },
    concentrate: {
        extends: 'mana_surge',
        name: 'Concentrate',
        passiveMpCost: 0, dmgDealt: null,
        ignoreEvasion: true,
        desc: 'Breathe, aim, release: your physical attacks ignore the target\'s evasion.',
    },
    earthen_footing: {
        extends: 'mana_surge',
        name: 'Earthen Footing',
        passiveMpCost: 0, dmgDealt: null,
        highGroundMult: 1.5,
        desc: 'The earth answers you: attacking from higher ground deals +50% (instead of +25%), and enemies above you get no height bonus.',
    },
    swiftcast: {
        extends: 'mana_surge',
        name: 'Swiftcast',
        passiveMpCost: 0, dmgDealt: null,
        chargeMult: 0.5,
        desc: 'Skip ahead to the moment the spell completes: charge times are halved.',
    },
    arcane_weapon: {
        extends: 'mana_surge',
        name: 'Arcane Weapon',
        passiveMpCost: 1, dmgDealt: null,
        matToPhysical: 0.5,
        desc: 'Sheathe your weapon in magic: half your MAT is added to ATK for physical damage. Drains 1 MP per turn.',
    },
    spell_pierce: {
        extends: 'mana_surge',
        name: 'Spell Pierce',
        passiveMpCost: 1, dmgDealt: null,
        mdfPierce: 0.5,
        desc: 'Your spells arrive from just outside reality: they ignore half the target\'s MDF. Drains 1 MP per turn.',
    },
    seismic_power: {
        extends: 'mana_surge',
        name: 'Seismic Power',
        passiveMpCost: 0, dmgDealt: null,
        aoeDmgMult: 1.25,
        desc: 'Every blow shakes the ground: area abilities deal +25% damage.',
    },
    benediction: {
        extends: 'mana_surge',
        name: 'Benediction',
        passiveMpCost: 0, dmgDealt: null,
        healMult: 1.3,
        desc: 'Your prayers carry further grace: healing is 30% stronger.',
    },
    spirit_pact: {
        extends: 'mana_surge',
        name: 'Spirit Pact',
        passiveMpCost: 0, dmgDealt: null,
        summonBoost: 0.3,
        desc: 'Creatures you summon are bound with your own strength: +30% HP, ATK and MAT.',
    },
    providence: {
        extends: 'mana_surge',
        name: 'Providence',
        passiveMpCost: 0, dmgDealt: null,
        surviveLethal: true,
        desc: 'You have already seen this ending and refused it: once per battle, a killing blow leaves you at 1 HP.',
    },
    bloodlust: {
        extends: 'mana_surge',
        name: 'Bloodlust',
        passiveMpCost: 0, dmgDealt: null,
        lowHpDmgDealt: { physical: 1.3 },
        desc: 'Wounds only make the beast angrier: +30% physical damage while below 50% HP.',
    },

    // =====================================================================
    // --- Job ability expansion: movement ---
    // =====================================================================

    mana_stride: {
        extends: 'move_plus_1',
        name: 'Mana Stride',
        moveBonus: 0,
        onMove: { mpPct: 0.1 },
        desc: 'Draw ambient mana from the ground you cross: restore 10% MP after moving.',
    },
    momentum: {
        extends: 'move_plus_1',
        name: 'Momentum',
        moveBonus: 0,
        momentumPct: 0.06,
        desc: 'Every step builds power: +6% damage per tile moved this turn (up to +30%).',
    },
    sentinel_step: {
        extends: 'move_plus_1',
        name: 'Sentinel Step',
        moveBonus: 0,
        onMove: { alliesBuff: { stat: 'def', value: 4, duration: 1 } },
        desc: 'Take up a guarding position: after moving, you and adjacent allies gain DEF +4 until your next turn.',
    },
    force_leap: {
        extends: 'move_plus_1',
        name: 'Force Leap',
        moveBonus: 0, climbBonus: 3,
        desc: 'A spell-propelled jump: climb 3 extra levels of elevation.',
    },
    hallowed_step: {
        extends: 'move_plus_1',
        name: 'Hallowed Step',
        moveBonus: 0,
        onMove: { alliesHealPct: 0.08 },
        desc: 'Where you walk the ground is blessed: after moving, you and adjacent allies heal 8% of max HP.',
    },
    quake_step: {
        extends: 'move_plus_1',
        name: 'Quake Step',
        moveBonus: 0,
        onMove: { enemiesStatus: { status: 'slow', duration: 1 } },
        desc: 'Stamp the earth as you arrive: adjacent enemies are slowed for a turn.',
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
        desc: 'Walk half in the spirit world: +1 movement and pass through other units.',
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
        desc: 'Your arrival is an ill omen: adjacent enemies lose 15 CT, delaying their next turn.',
    },
    restorative_step: {
        extends: 'move_plus_1',
        name: 'Restorative Step',
        moveBonus: 0,
        onMove: { hpPct: 0.08 },
        desc: 'You walk where the wound will not be: heal 8% of max HP after moving.',
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

    // =====================================================================
    // --- Beast / creature enemy abilities ---
    // =====================================================================

    // Wolf: fast lunge — melee, applies slow (hamstring)
    wolf_bite: {
        extends: 'attack',
        name: 'Bite',
        actionCost: 30,
        basePower: 0.95,
        applyStatus: 'slow',
        statusDuration: 1,
    },

    // Boar: charge — melee stun, slightly weaker hit
    boar_charge: {
        extends: 'attack',
        name: 'Charge',
        actionCost: 40,
        basePower: 0.85,
        applyStatus: 'stun',
        statusDuration: 1,
    },

    // Thorn beast: ranged thorn volley — nature magic, AoE
    thorn_volley: {
        extends: 'fire',
        name: 'Thorn Volley',
        range: 3,
        aoe: 1,
        requiresLos: true,
        mpCost: 10,
        basePower: 0.9,
        element: 'nature',
        projectileColor: '#66aa22',
        chargeTime: 20,
        applyStatus: 'slow',
        statusDuration: 1,
    },

    // Spore walker: spore burst — AoE nature, no LOS (drifting cloud)
    spore_burst: {
        extends: 'fire',
        name: 'Spore Burst',
        range: 2,
        aoe: 2,
        requiresLos: false,
        mpCost: 12,
        basePower: 0.75,
        element: 'nature',
        projectileColor: '#88cc44',
        chargeTime: 30,
        applyStatus: 'slow',
        statusDuration: 2,
    },

    // Shard spider: venom bite — physical, inflicts slow
    spider_bite: {
        extends: 'attack',
        name: 'Venom Bite',
        actionCost: 35,
        basePower: 0.8,
        applyStatus: 'slow',
        statusDuration: 2,
    },

    // Canopy stalker: pounce — high-damage physical
    pounce: {
        extends: 'attack',
        name: 'Pounce',
        actionCost: 40,
        basePower: 1.3,
    },

    // Spectral wisp: soul drain — magic, drains from distance
    soul_drain: {
        extends: 'fire',
        name: 'Soul Drain',
        range: 3,
        aoe: 0,
        requiresLos: true,
        mpCost: 8,
        basePower: 1.0,
        element: 'shadow',
        projectileColor: '#8866ff',
        chargeTime: 0,
        applyStatus: 'slow',
        statusDuration: 1,
    },

    // Void stalker: void strike — high-damage physical melee
    void_strike: {
        extends: 'attack',
        name: 'Void Strike',
        actionCost: 38,
        basePower: 1.2,
    },

    // =====================================================================
    // --- Summon abilities ---
    // isSummon: true  — targets an empty tile; places a new allied unit there.
    // summonJob / summonName define what creature appears.
    // =====================================================================

    call_wolf: {
        name: 'Call Wolf',
        type: 'magic',
        range: 2,
        aoe: 0,
        mpCost: 16,
        actionCost: 50,
        targetType: 'tile',
        isSummon: true,
        summonJob: 'wolf',
        summonName: 'Wolf',
        element: 'nature',
        animType: 'cast',
        projectileColor: '#aaaacc',
        chargeTime: 0,
        requiresLos: false,
        desc: 'Calls a wolf spirit to fight alongside you. Fast and hard to hit.',
    },

    call_boar: {
        name: 'Call Boar',
        type: 'magic',
        range: 2,
        aoe: 0,
        mpCost: 22,
        actionCost: 55,
        targetType: 'tile',
        isSummon: true,
        summonJob: 'boar',
        summonName: 'Boar',
        element: 'nature',
        animType: 'cast',
        projectileColor: '#996644',
        chargeTime: 20,
        requiresLos: false,
        desc: 'Conjures a charging boar — tougher and hits harder than the wolf, but slower.',
    },

    call_thorn_beast: {
        name: 'Call Thorn Beast',
        type: 'magic',
        range: 2,
        aoe: 0,
        mpCost: 20,
        actionCost: 50,
        targetType: 'tile',
        isSummon: true,
        summonJob: 'thorn_beast',
        summonName: 'Thorn Beast',
        element: 'nature',
        animType: 'cast',
        projectileColor: '#449922',
        chargeTime: 0,
        requiresLos: false,
        desc: 'Calls a thorn beast to pelt enemies with volleys from range.',
    },

    call_wisp: {
        name: 'Call Wisp',
        type: 'magic',
        range: 2,
        aoe: 0,
        mpCost: 18,
        actionCost: 50,
        targetType: 'tile',
        isSummon: true,
        summonJob: 'spectral_wisp',
        summonName: 'Wisp',
        element: 'spirit',
        animType: 'cast',
        projectileColor: '#8888ff',
        chargeTime: 0,
        requiresLos: false,
        desc: 'Binds a spectral wisp and directs it to drain life from enemies.',
    },

    // ============================================================
    // ---- Illusionist line (Illusion) ----
    // ============================================================
    phantasm: {
        name: 'Phantasm', type: 'magic', range: 4, aoe: 0, mpCost: 8, actionCost: 42,
        targetType: 'enemy', basePower: 1.05, element: 'illusion', animType: 'cast',
        projectileColor: '#e0a0ff', chargeTime: 0,
        desc: 'A terror only the target can see. Cheap magic damage from a distance.',
    },
    mirror_image: {
        extends: 'call_wisp', name: 'Mirror Image', range: 3, mpCost: 12, actionCost: 32,
        summonJob: 'decoy', summonName: 'Mirror Image', element: 'illusion', projectileColor: '#e0c0ff',
        desc: 'Conjures a copy of yourself up to 3 tiles away, out toward the enemy. Enemies would rather strike the copy, which breaks after a few hits.',
    },
    blur: {
        name: 'Blur', type: 'magic', range: 3, aoe: 0, mpCost: 10, actionCost: 38,
        targetType: 'ally', basePower: 0, element: 'illusion', animType: 'cast',
        projectileColor: '#ccbbff', chargeTime: 0,
        buffs: [{ stat: 'eva', value: 20, duration: 3 }], floatText: 'Blurred!',
        desc: 'Smears an ally\'s outline in the air: evasion +20 for 3 turns.',
    },
    vanish: {
        name: 'Vanish', type: 'magic', range: 3, aoe: 0, mpCost: 14, actionCost: 42,
        targetType: 'ally', basePower: 0, element: 'illusion', animType: 'cast',
        projectileColor: '#9988cc', chargeTime: 0, applyStatus: 'hidden', statusDuration: 2,
        desc: 'Hides an ally from enemy eyes. Enemies can\'t pick them as a target until they act or 2 turns pass.',
    },
    displacement: {
        extends: 'phase_shift', name: 'Displacement', chance: 0.3, phaseAway: 2,
        desc: 'You were never quite where they struck: when hit, may reappear up to 2 tiles away.',
    },
    glamour: {
        extends: 'mana_surge', name: 'Glamour', passiveMpCost: 0, dmgDealt: null, summonBoost: 0.6,
        desc: 'More convincing illusions: the copies and creatures you summon have 60% more HP and power.',
    },
    mirage_step: {
        extends: 'move_plus_1', name: 'Mirage Step', moveBonus: 0,
        onMove: { selfBuff: { stat: 'eva', value: 15, duration: 1 } },
        desc: 'Leave an afterimage behind: after moving, evasion +15 until your next turn.',
    },

    // Dreamweaver (Illusion + Enchantment)
    mass_sleep: {
        extends: 'dream_veil', name: 'Mass Sleep', aoe: 1, mpCost: 20, actionCost: 50, chargeTime: 25,
        statusDuration: 2, requiresLos: false, element: 'illusion',
        desc: 'A lullaby that settles over an area: everyone caught falls asleep until struck.',
    },
    bewilder: {
        name: 'Bewilder', type: 'magic', range: 3, aoe: 0, mpCost: 16, actionCost: 45,
        targetType: 'enemy', basePower: 0, element: 'illusion', animType: 'cast',
        projectileColor: '#ff99dd', chargeTime: 0, applyStatus: 'charm', statusDuration: 2,
        desc: 'Convinces an enemy that their friends are the foe. Charms them for 2 turns.',
    },
    nightmare: {
        name: 'Nightmare', type: 'magic', range: 4, aoe: 0, mpCost: 14, actionCost: 46,
        targetType: 'enemy', basePower: 1.2, element: 'illusion', animType: 'cast',
        projectileColor: '#8844aa', chargeTime: 0, bonusVsStatus: { sleep: 2 },
        desc: 'Turns a dream against the dreamer: deals double damage to a sleeping target.',
    },
    lull: {
        extends: 'brace', name: 'Lull', trigger: 'anyHit', chance: 0.3, selfStatus: null,
        attackerStatus: { status: 'sleep', duration: 2 },
        desc: 'When hit, may whisper the attacker to sleep.',
    },
    deep_dreams: {
        extends: 'mana_surge', name: 'Deep Dreams', passiveMpCost: 1, dmgDealt: null, statusDurationBonus: 1,
        desc: 'The afflictions you inflict last a turn longer. Drains 1 MP per turn.',
    },

    // Mirage Oracle (Illusion + Divination)
    hall_of_mirrors: {
        extends: 'mirror_image', name: 'Hall of Mirrors', range: 3, mpCost: 20, summonCount: 2,
        desc: 'Conjures two copies at once, which enemies would rather strike.',
    },
    mass_blur: {
        extends: 'blur', name: 'Mass Blur', aoe: 1, mpCost: 18, actionCost: 45,
        buffs: [{ stat: 'eva', value: 15, duration: 3 }],
        desc: 'Blurs everyone around an ally: evasion +15 for 3 turns.',
    },
    true_strike: {
        name: 'True Strike', type: 'magic', range: 4, aoe: 0, mpCost: 12, actionCost: 44,
        targetType: 'enemy', basePower: 1.1, element: 'illusion', animType: 'cast',
        projectileColor: '#ffffff', chargeTime: 0, mdfPierce: 0.5, ignoreReflect: true,
        desc: 'Strikes where the target truly is: ignores half of its MDF, and can\'t be reflected.',
    },
    shattered_image: {
        extends: 'brace', name: 'Shattered Image', trigger: 'decoyDown', chance: 1, selfStatus: null,
        attackerStatus: { status: 'slow', duration: 2 },
        desc: 'Shards fly when your copies break: whoever destroys one of your copies is slowed.',
    },
    lasting_images: {
        extends: 'mana_surge', name: 'Lasting Images', passiveMpCost: 0, dmgDealt: null, summonBoost: 1,
        desc: 'Your copies and creatures have twice their usual HP and power.',
    },

    // ============================================================
    // ---- Gravecaller line (Necromancy) ----
    // ============================================================
    life_drain: {
        name: 'Life Drain', type: 'magic', range: 3, aoe: 0, mpCost: 9, actionCost: 44,
        targetType: 'enemy', basePower: 0.85, element: 'necrotic', animType: 'cast',
        projectileColor: '#7acc7a', chargeTime: 0, drainFrac: 0.5,
        desc: 'Draws the life out of a target: deals damage and heals you for half of it.',
    },
    grave_chill: {
        name: 'Grave Chill', type: 'magic', range: 4, aoe: 0, mpCost: 10, actionCost: 44,
        targetType: 'enemy', basePower: 0.6, element: 'necrotic', animType: 'cast',
        projectileColor: '#99bbcc', chargeTime: 0, applyStatus: 'slow', statusDuration: 2,
        desc: 'The cold of the grave seeps into the target: light damage, and slowed for 2 turns.',
    },
    raise_dead: {
        name: 'Raise Dead', type: 'magic', range: 3, aoe: 0, mpCost: 16, actionCost: 50,
        targetType: 'corpse', corpseEffect: 'raise', summonJob: 'skeleton', summonName: 'Skeleton',
        element: 'necrotic', animType: 'cast', projectileColor: '#ccddcc', chargeTime: 20, requiresLos: false,
        desc: 'A knocked-out enemy rises as a skeleton that fights for you. The body is used up.',
    },
    corpse_burst: {
        name: 'Corpse Burst', type: 'magic', range: 4, aoe: 1, mpCost: 14, actionCost: 46,
        targetType: 'corpse', corpseEffect: 'burst', basePower: 1.2, element: 'necrotic', animType: 'cast',
        projectileColor: '#aa66aa', chargeTime: 0, requiresLos: false,
        desc: 'Detonates a knocked-out enemy, damaging every enemy next to it. The body is used up.',
    },
    lingering_spite: {
        extends: 'brace', name: 'Lingering Spite', trigger: 'onDown', chance: 1, selfStatus: null,
        downBurst: 'spite_burst',
        desc: 'When you are knocked out, your spite bursts out and hurts every adjacent enemy.',
    },
    spite_burst: {
        name: 'Spite Burst', type: 'magic', range: 1, aoe: 0, mpCost: 0, actionCost: 0,
        targetType: 'enemy', basePower: 0.9, element: 'necrotic', animType: 'cast',
        projectileColor: '#aa66aa', chargeTime: 0,
        desc: 'The burst of Lingering Spite.',
    },
    soul_harvest: {
        extends: 'mana_surge', name: 'Soul Harvest', passiveMpCost: 0, dmgDealt: null, mpOnFall: 8,
        desc: 'Whenever anyone on the field falls, friend or foe, you regain 8 MP.',
    },
    wraithwalk: {
        extends: 'move_plus_1', name: 'Wraithwalk', moveBonus: 0, passThroughUnits: true,
        desc: 'Walk half in the world of the dead: pass through other units.',
    },

    // Lich (Necromancy + Evocation)
    soul_nova: {
        extends: 'life_drain', name: 'Soul Nova', aoe: 1, mpCost: 20, actionCost: 50, basePower: 0.7,
        drainFrac: 0.3, chargeTime: 25, requiresLos: false,
        desc: 'Tears the life from everyone in an area, healing you for part of it.',
    },
    wither: {
        extends: 'life_drain', name: 'Wither', mpCost: 22, basePower: 1.6, chargeTime: 35,
        desc: 'A long, terrible draining: heavy damage after a charge, half of it returned to you as HP.',
    },
    bone_spear: {
        name: 'Bone Spear', type: 'magic', range: 5, aoe: 0, mpCost: 14, actionCost: 46,
        targetType: 'enemy', basePower: 1.15, element: 'necrotic', animType: 'cast',
        projectileColor: '#eeeedd', chargeTime: 0,
        desc: 'Hurls a lance of sharpened bone a long way.',
    },
    phylactery: {
        extends: 'brace', name: 'Phylactery', trigger: 'onDown', chance: 1, oncePerBattle: true,
        selfStatus: null, reviveFrac: 0.3,
        desc: 'Your soul is kept elsewhere: the first time you are knocked out, you rise again with 30% HP.',
    },
    necrotic_power: {
        extends: 'mana_surge', name: 'Necrotic Power', passiveMpCost: 1, dmgDealt: null, drainMult: 1.2,
        desc: 'Your drains heal you 20% more. Drains 1 MP per turn.',
    },

    // Gravewarden (Necromancy + Abjuration)
    bone_ward: {
        name: 'Bone Ward', type: 'magic', range: 3, aoe: 1, mpCost: 14, actionCost: 44,
        targetType: 'corpse', corpseEffect: 'ward', applyStatus: 'protect', statusDuration: 3,
        element: 'necrotic', animType: 'cast', projectileColor: '#ddddcc', chargeTime: 0, requiresLos: false,
        desc: 'Builds a barricade of bone from a knocked-out enemy: allies next to it gain Protect. The body is used up.',
    },
    mass_raise: {
        extends: 'raise_dead', name: 'Mass Raise', aoe: 1, mpCost: 26, corpseCount: 2, chargeTime: 30,
        desc: 'Up to two knocked-out enemies in an area rise as skeletons that fight for you.',
    },
    soul_tether: {
        name: 'Soul Tether', type: 'magic', range: 3, aoe: 0, mpCost: 18, actionCost: 45,
        targetType: 'ally', basePower: 0, element: 'necrotic', animType: 'cast',
        projectileColor: '#bbffcc', chargeTime: 0, applyStatus: 'reraise', statusDuration: 4,
        desc: 'Ties an ally\'s soul to their body: the next blow that would knock them out leaves them at 1 HP.',
    },
    death_ward: {
        extends: 'brace', name: 'Death Ward', trigger: 'allyHit', chance: 0.35, selfStatus: null, saveFromDown: true,
        desc: 'When an adjacent ally is knocked out, may hold their soul in place: they stay standing at 1 HP.',
    },
    grave_legion: {
        extends: 'mana_surge', name: 'Grave Legion', passiveMpCost: 0, dmgDealt: null, summonBoost: 0.8,
        desc: 'The dead you raise are tougher: 80% more HP and power.',
    },

    // ============================================================
    // ---- Alchemist line (no school) ----
    // Flasks cost no MP (alchemists have none) but take longer to throw. Most splash
    // everyone in the area, friend and foe alike (targetType 'all').
    // ============================================================
    healing_draught: {
        name: 'Healing Draught', type: 'magic', range: 4, aoe: 1, mpCost: 0, actionCost: 62,
        targetType: 'all', basePower: 0.6, isHeal: true, element: 'alchemy', animType: 'cast',
        projectileColor: '#66ff99', chargeTime: 0, requiresLos: false,
        desc: 'A splash of healing that heals everyone it reaches, enemies included.',
    },
    acid_flask: {
        name: 'Acid Flask', type: 'magic', range: 4, aoe: 1, mpCost: 0, actionCost: 58,
        targetType: 'all', basePower: 0.7, element: 'alchemy', animType: 'cast',
        projectileColor: '#ccff44', chargeTime: 0, requiresLos: false,
        buffs: [{ stat: 'def', value: -4, duration: 3 }],
        desc: 'Burns everyone in the splash, allies included, and lowers their DEF by 4 for 3 turns.',
    },
    smoke_bomb: {
        name: 'Smoke Bomb', type: 'magic', range: 4, aoe: 1, mpCost: 0, actionCost: 50,
        targetType: 'all', basePower: 0, element: 'alchemy', animType: 'cast',
        projectileColor: '#aaaaaa', chargeTime: 0, requiresLos: false,
        applyStatus: 'slipped', statusDuration: 3,
        desc: 'A cloud of smoke: everyone inside, on both sides, dodges the next physical attack against them.',
    },
    quicksilver: {
        name: 'Quicksilver', type: 'magic', range: 4, aoe: 1, mpCost: 0, actionCost: 58,
        targetType: 'all', basePower: 0, element: 'alchemy', animType: 'cast',
        projectileColor: '#ddeeff', chargeTime: 0, requiresLos: false,
        applyStatus: 'haste', statusDuration: 2,
        desc: 'A shimmering splash that hastes everyone it reaches, on both sides.',
    },
    reflex_tonic: {
        extends: 'brace', name: 'Reflex Tonic', trigger: 'lowHp', chance: 1, oncePerBattle: true,
        selfStatus: null, selfCast: 'tonic_draught',
        desc: 'The first time you drop below 30% HP, you gulp down a tonic and heal.',
    },
    tonic_draught: {
        name: 'Tonic', type: 'magic', range: 0, aoe: 0, mpCost: 0, actionCost: 0,
        targetType: 'ally', basePower: 1, isHeal: true, element: 'alchemy', animType: 'cast',
        projectileColor: '#66ff99', chargeTime: 0,
        desc: 'The tonic of Reflex Tonic.',
    },
    potent_brews: {
        extends: 'mana_surge', name: 'Potent Brews', passiveMpCost: 0,
        dmgDealt: { magic: 1.25, physical: 1.25 }, healMult: 1.25,
        desc: 'Stronger mixtures: your flasks heal and hurt 25% more.',
    },
    light_pack: {
        extends: 'move_plus_1', name: 'Light Pack', moveBonus: 1, climbBonus: 1,
        desc: 'Travel light: +1 movement, and climb 1 extra level.',
    },

    // Plaguewright (Alchemy + Transmutation)
    plague_flask: {
        extends: 'acid_flask', name: 'Plague Flask', aoe: 2, basePower: 0.35, actionCost: 60, buffs: null,
        applyStatus: 'poison', statusDuration: 3, projectileColor: '#99dd33',
        desc: 'A wide splash of plague: everyone caught, on both sides, is poisoned.',
    },
    miasma: {
        extends: 'acid_flask', name: 'Miasma', basePower: 0.2, buffs: null,
        applyStatus: 'poison', statusDuration: 5, projectileColor: '#77aa55',
        desc: 'A slow, lingering poison that lasts 5 turns on everyone in the splash.',
    },
    catalyst: {
        name: 'Catalyst', type: 'magic', range: 4, aoe: 1, mpCost: 0, actionCost: 55,
        targetType: 'enemy', basePower: 0.8, element: 'alchemy', animType: 'cast',
        projectileColor: '#ffee55', chargeTime: 0, requiresLos: false, bonusVsStatus: { poison: 2 },
        desc: 'A reagent that sets poison burning: hits enemies in an area, double damage to the poisoned. Spares your allies.',
    },
    toxic_blood: {
        extends: 'brace', name: 'Toxic Blood', trigger: 'physicalHit', chance: 0.5, adjacentOnly: true,
        selfStatus: null, attackerStatus: { status: 'poison', duration: 3 },
        desc: 'Your blood is poison: when struck in melee, may poison the attacker.',
    },
    virulence: {
        extends: 'mana_surge', name: 'Virulence', passiveMpCost: 0, dmgDealt: null, statusDurationBonus: 1,
        desc: 'Your poisons and other afflictions last a turn longer.',
    },

    // Field Surgeon (Alchemy + Abjuration)
    elixir: {
        name: 'Elixir', type: 'magic', range: 4, aoe: 0, mpCost: 0, actionCost: 55,
        targetType: 'ally', basePower: 1.0, isHeal: true, alsoCure: true, element: 'alchemy', animType: 'cast',
        projectileColor: '#88ffcc', chargeTime: 0,
        desc: 'A carefully measured dose for one ally: a strong heal that also cures their afflictions.',
    },
    panacea_mist: {
        name: 'Panacea Mist', type: 'magic', range: 4, aoe: 1, mpCost: 0, actionCost: 52,
        targetType: 'all', basePower: 0, isCure: true, element: 'alchemy', animType: 'cast',
        projectileColor: '#ccffee', chargeTime: 0, requiresLos: false,
        desc: 'Cures the afflictions of everyone in the splash, on both sides.',
    },
    stimulant: {
        name: 'Stimulant', type: 'magic', range: 4, aoe: 1, mpCost: 0, actionCost: 55,
        targetType: 'all', basePower: 0, element: 'alchemy', animType: 'cast',
        projectileColor: '#ffcc88', chargeTime: 0, requiresLos: false,
        ctGain: 15, applyStatus: 'regen', statusDuration: 3,
        desc: 'A bracing splash: everyone caught acts a little sooner and regenerates HP for 3 turns.',
    },
    triage: {
        extends: 'brace', name: 'Triage', trigger: 'allyHit', chance: 0.4, selfStatus: null,
        allyCast: 'triage_draught', whenAllyBelow: 0.35,
        desc: 'When an adjacent ally is hit and left below 35% HP, may patch them up at once.',
    },
    triage_draught: {
        extends: 'elixir', name: 'Triage Draught', range: 1, basePower: 0.8, alsoCure: false,
        desc: 'The quick patch of Triage.',
    },
    steady_hands: {
        extends: 'mana_surge', name: 'Steady Hands', passiveMpCost: 0, dmgDealt: null, precise: true,
        desc: 'Perfect aim: your splashes only reach the side you meant them for. Heals and boons skip enemies, and harm skips allies.',
    },

    // ============================================================
    // ---- Warlord line (no school) ----
    // Commands are orders, not spells: they can't be dodged (noEvade).
    // ============================================================
    cleave: {
        extends: 'attack', name: 'Cleave', aoe: 1, basePower: 0.8, actionCost: 42,
        desc: 'A wide swing that hits the target and every enemy next to it.',
    },
    rally: {
        name: 'Rally', type: 'physical', range: 3, aoe: 0, mpCost: 6, actionCost: 35,
        targetType: 'ally', basePower: 0, element: 'command', animType: 'cast',
        projectileColor: '#ffcc66', chargeTime: 0, ctGain: 30, floatText: 'Rallied!',
        desc: 'Calls an ally to action: their speed gauge jumps forward, so they act sooner.',
    },
    taunt: {
        name: 'Taunt', type: 'physical', range: 2, aoe: 1, mpCost: 6, actionCost: 38,
        targetType: 'enemy', basePower: 0, element: 'command', animType: 'cast',
        projectileColor: '#ff8844', chargeTime: 0, noEvade: true, applyStatus: 'taunted', statusDuration: 2,
        desc: 'A challenge no one can ignore: enemies in the area must attack you for 2 turns.',
    },
    reposition: {
        name: 'Reposition', type: 'physical', range: 3, aoe: 0, mpCost: 8, actionCost: 40,
        targetType: 'ally', basePower: 0, element: 'command', animType: 'cast',
        projectileColor: '#ffdd88', chargeTime: 0, swapPlaces: true,
        desc: 'Swap places with an ally up to 3 tiles away, pulling them out of danger or into the fight.',
    },
    hold_the_line: {
        extends: 'brace', name: 'Hold the Line', trigger: 'allyHit', chance: 0.35, selfStatus: null,
        counterWith: 'attack', counterReach: 2,
        desc: 'When an adjacent ally is hit, may lunge in and strike back at an attacker up to 2 tiles away.',
    },
    field_command: {
        extends: 'mana_surge', name: 'Field Command', passiveMpCost: 0, dmgDealt: null, partyStartCt: 15,
        desc: 'Your orders are ready before the battle starts: the whole party opens with a head start on its speed gauges.',
    },
    vanguard_step: {
        extends: 'move_plus_1', name: 'Vanguard Step', moveBonus: 0,
        onMove: { selfBuff: { stat: 'def', value: 2, duration: 1 } },
        desc: 'Advance with your guard up: after moving, DEF +2 until your next turn.',
    },

    // Marshal (Command + Abjuration)
    shield_wall: {
        name: 'Shield Wall', type: 'physical', range: 0, aoe: 1, mpCost: 8, actionCost: 45,
        targetType: 'ally', basePower: 0, element: 'command', animType: 'cast',
        projectileColor: '#ccccff', chargeTime: 0, noEvade: true, applyStatus: 'protect', statusDuration: 2,
        desc: 'Lock shields: you and every adjacent ally gain Protect for 2 turns.',
    },
    challenge: {
        name: 'Challenge', type: 'physical', range: 3, aoe: 0, mpCost: 8, actionCost: 40,
        targetType: 'enemy', basePower: 0, element: 'command', animType: 'cast',
        projectileColor: '#ff6644', chargeTime: 0, noEvade: true, applyStatus: 'taunted', statusDuration: 3,
        buffs: [{ stat: 'def', value: -4, duration: 3 }],
        desc: 'Calls out one enemy: it must attack you for 3 turns, and its DEF falls by 4.',
    },
    bulwark_bash: {
        extends: 'attack', name: 'Bulwark Bash', basePower: 0.9, mpCost: 8, actionCost: 45,
        applyStatus: 'stun', statusDuration: 1,
        desc: 'A blow with the shield\'s rim that stuns the target.',
    },
    interpose: {
        extends: 'brace', name: 'Interpose', trigger: 'allyHit', chance: 0.35, selfStatus: null, shareDamageFrac: 1,
        desc: 'When an adjacent ally is hit, may step in and take the whole blow yourself (never below 1 HP).',
    },
    iron_discipline: {
        extends: 'mana_surge', name: 'Iron Discipline', passiveMpCost: 0, dmgDealt: null,
        turnAlliesBuff: [{ stat: 'def', value: 3, duration: 1 }, { stat: 'mdf', value: 3, duration: 1 }],
        desc: 'At the start of each of your turns, you and adjacent allies gain DEF and MDF +3 until your next turn.',
    },

    // Tactician (Command + Divination)
    seize_the_moment: {
        extends: 'rally', name: 'Seize the Moment', range: 4, mpCost: 12, ctGain: 55,
        desc: 'Spots the perfect moment for an ally: their speed gauge jumps far forward.',
    },
    delay: {
        name: 'Delay', type: 'physical', range: 4, aoe: 0, mpCost: 10, actionCost: 40,
        targetType: 'enemy', basePower: 0, element: 'command', animType: 'cast',
        projectileColor: '#aa88ff', chargeTime: 0, ctGain: -40, floatText: 'Delayed!',
        desc: 'Feints the enemy into hesitation: their speed gauge falls back, so they act later.',
    },
    exploit_opening: {
        extends: 'attack', name: 'Exploit Opening', basePower: 0.9, mpCost: 6, actionCost: 38, selfCtGain: 25,
        desc: 'A strike into a gap in the enemy\'s guard that puts you back in action sooner.',
    },
    read_the_battle: {
        extends: 'brace', name: 'Read the Battle', trigger: 'enemyCharge', chance: 0.4, selfStatus: null,
        delayCharge: 30, chargeRange: 4,
        desc: 'When an enemy within 4 tiles starts charging a spell, may disrupt it and set the charge back.',
    },
    initiative: {
        extends: 'mana_surge', name: 'Initiative', passiveMpCost: 0, dmgDealt: null, partyStartCt: 30,
        desc: 'Every battle is planned in advance: the whole party opens with a big head start on its speed gauges.',
    },
};
