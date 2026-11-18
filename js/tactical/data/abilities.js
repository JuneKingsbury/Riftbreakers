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
//   isCure        bool     True for abilities that clear harmful statuses (helpful ones stay)
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
//   evasionPierce number   Physical attacks are dodged this much less often (0.75: a quarter as often)
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
        desc: 'A blow with the face of your shield. Deals damage and stuns the target for {turns}.',
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
        desc: 'A burst of flame dropped onto the target. It burns every enemy beside them too.',
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
        desc: 'A shard of ice that chills the target to the bone. Deals damage and slows them for {turns}.',
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
        desc: 'A bolt of lightning that strikes the target and arcs into every enemy beside them.',
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
        desc: 'A carefully aimed arrow, loosed from far away.',
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
        desc: 'Closes an ally\'s wounds with gentle magic. Restores a solid amount of HP.',
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
        desc: 'Washes an ally clean of poison, sleep, curses and every other harmful status.',
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
        desc: 'A steady trickle of MP feeds every spell you cast. Magic damage +15%. Costs 2 MP per turn.',
        chargeTime: 0,
    },

    regen_aura: {
        extends: 'mana_surge',
        name: 'Regen Aura',
        passiveMpCost: 1,
        dmgDealt: null,
        turnRegenHp: 5,
        desc: 'Living growth knits your wounds closed. Heal 5 HP at the start of each turn. Costs 1 MP per turn.',
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
        desc: 'A crude curse that scratches at the target\'s will. Deals light damage and slows them for {turns}.',
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
        desc: 'A simple protective charm. Restores a modest amount of HP to one ally.',
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
        desc: 'Turns loose stone underfoot into a thrown missile. Physical damage at range.',
    },

    // Seer basic: passive divinatory trance that slowly drains MP
    farsight: {
        extends: 'mana_surge',
        name: 'Farsight',
        passiveMpCost: 1,
        dmgDealt: null,
        evaBonus: 0.2,
        desc: 'A light trance that reads the next few heartbeats. +20% evasion against physical attacks. Costs 1 MP per turn.',
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
        desc: 'Arcane force runs down the blade. Hits harder than a normal attack and slows the target for {turns}.',
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
        desc: 'A concussive burst of raw force. Damages every enemy in the area and stuns them for {turns}.',
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
        desc: 'Holy fire poured through your weapon into a foe within reach. A heavy blow that also scorches enemies beside them.',
    },

    divine_ward: {
        extends: 'mana_surge',
        name: 'Divine Ward',
        passiveMpCost: 1,
        dmgDealt: null,
        dmgTaken: { physical: 0.8 },
        desc: 'A constant barrier of holy force. Physical damage taken -20%. Costs 1 MP per turn.',
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
        desc: 'Tears a pinhole rift in space and blasts the target with whatever pours through. Enemies right beside them are caught too.',
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
        desc: 'Opens a rift that collapses violently outward, hitting every enemy in a wide area.',
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
        chargeTime: 55,
        applyStatus: null,
        desc: 'A great spike of stone bursts up beneath the target. Heavy damage, and it clips enemies right beside them.',
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
        desc: 'Chains of holy light hold the target fast. Light damage, and a stun that lasts {turns}.',
    },

    radiant_heal: {
        extends: 'heal',
        name: 'Radiant Heal',
        range: 4,
        mpCost: 18,
        basePower: 1.1,
        projectileColor: '#ffeeaa',
        desc: 'A stronger prayer that reaches farther. Restores a large amount of HP to one ally.',
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
        desc: 'Sets a bound spirit on the target. Its ghostly chill deals damage and slows them for {turns}.',
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
        desc: 'A spirit seizes the target and everyone beside them, then tears free. Damages them all and stuns them for {turns}.',
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
        desc: 'A whip of enchanted vine. Deals damage and tangles the target\'s legs, slowing them for {turns}.',
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
        desc: 'Wraps the target in a thread of ill fate. Deals damage and slows them for {duration} turns.',
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
        desc: 'Freezes a moment in time around the target. Damages them and every enemy beside them, and stuns them all for {turns}.',
    },

    wyrd_drain: {
        extends: 'mana_surge',
        name: 'Wyrd Drain',
        passiveMpCost: 2,
        dmgDealt: null,
        statusDurationBonus: 1,
        desc: 'Pulls the threads of fate tight around your victims. Statuses you inflict last 1 turn longer. Costs 2 MP per turn.',
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
        desc: 'Mends a wound before it fully lands, guided by a glimpse of the target\'s near future. A powerful single-target heal.',
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
        desc: 'A savage strike fueled by bestial rage. Hits harder than a normal attack and slows the target for {turns}.',
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
        desc: 'A primal howl that rattles everything nearby. Damages every enemy in a wide area and stuns them for {turns}.',
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
        desc: 'Raises a three-tile wall of stone from the earth. It blocks the way for the rest of the battle.',
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
        desc: 'Tangling roots choke a cross-shaped patch of ground, turning it into difficult terrain.',
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
        desc: 'Your skin hardens into stone. DEF +{buff:def} for 2 turns.',
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
        desc: 'Saps the target\'s fighting spirit. Light damage, and ATK -5 for 2 turns.',
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
        desc: 'Nudges fate around an ally. The next physical attack against them misses, if it comes within 2 turns.',
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
        desc: 'Quickens an ally\'s flow of time. Haste lets them act 50% more often for {turns}.',
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
        desc: 'Seals the target\'s voice. They can\'t cast any magic for {turns}.',
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
        desc: 'Draws the target into a deep sleep. They skip their turns for up to {turns}, or until something hits them.',
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
        desc: 'Floods the target\'s mind with primal fury. For {turns}, they can only attack the nearest foe.',
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
        desc: 'A burst of toxic spores. Light damage, and every enemy in the area is poisoned for {turns}.',
    },

    // POISON — single-target melee venom
    venom_strike: {
        extends: 'attack',
        name: 'Venom Strike',
        actionCost: 40,
        basePower: 0.9,
        applyStatus: 'poison',
        statusDuration: 3,
        desc: 'A strike laced with venom. Deals damage and poisons the target for {turns}.',
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
        desc: 'Wraps an ally in transmuted stone. Protect cuts the physical damage they take by 25% for {turns}.',
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
        desc: 'Wraps an ally in an arcane ward. Shell cuts the magic damage they take by 25% for {turns}.',
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
        desc: 'Bathes an ally in gentle holy light. Regen restores 8% of their max HP each turn for {turns}.',
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
        desc: 'When struck, you may set your feet. Until your next turn, DEF and MDF are 50% higher and you have +20% evasion against physical attacks.',
    },

    flame_retort: {
        extends: 'brace',
        name: 'Flame Retort',
        trigger: 'magicHit', chance: 0.3,
        selfStatus: null,
        counterWith: 'fire',
        desc: 'When hit by magic, you may answer with a Fire spell at the caster, if they are in range. It costs MP as usual.',
    },

    counter: {
        extends: 'brace',
        name: 'Counter',
        trigger: 'physicalHit', chance: 0.5, adjacentOnly: true,
        selfStatus: null,
        counterWith: 'attack',
        desc: 'When struck in melee, you may hit the attacker back.',
    },


    return_fire: {
        extends: 'brace',
        name: 'Return Fire',
        trigger: 'rangedHit', chance: 0.4,
        selfStatus: null,
        counterWith: 'long_shot',
        desc: 'When hit from range, you may answer with a Long Shot, if the shooter is in range.',
    },

    stone_reflex: {
        extends: 'brace',
        name: 'Stone Reflex',
        trigger: 'physicalHit', chance: 0.5,
        selfStatus: null,
        selfBuff: { stat: 'def', value: 6, duration: 2 },
        desc: 'When struck by a physical attack, your skin may harden. DEF +6 for 2 turns.',
    },

    void_siphon: {
        extends: 'brace',
        name: 'Void Siphon',
        trigger: 'magicHit', chance: 0.6,
        selfStatus: null,
        mpRestoreFrac: 0.5,
        desc: 'When hit by magic, you may pull part of the spell into the void and restore MP equal to half the damage taken.',
    },

    retribution: {
        extends: 'brace',
        name: 'Retribution',
        trigger: 'anyHit', chance: 0.3,
        selfStatus: null,
        counterWith: 'smite',
        desc: 'When struck by an adjacent attacker, you may answer with an instant Smite. It costs MP as usual.',
    },

    feral_counter: {
        extends: 'counter',
        name: 'Feral Counter',
        counterWith: 'wild_surge',
        desc: 'When struck in melee, you may lash back with a Wild Surge.',
    },

    second_sight: {
        extends: 'brace',
        name: 'Second Sight',
        trigger: 'lowHp', chance: 1, oncePerBattle: true,
        selfStatus: null,
        selfCast: 'renewing_light',
        desc: 'Once per battle, when a blow leaves you below 30% HP, you see it coming and cast Renewing Light on yourself.',
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
        desc: 'Run on all fours like the beasts you call. Move +2.',
    },

    fleet_step: {
        extends: 'move_plus_1',
        name: 'Fleet Step',
        moveBonus: 1, climbBonus: 1,
        desc: 'Move +1, and you can climb 1 extra level of elevation.',
    },

    stone_stride: {
        extends: 'move_plus_1',
        name: 'Stone Stride',
        moveBonus: 0, ignoreTerrainCost: true,
        desc: 'The earth parts beneath your feet. Every tile costs only 1 Move, whatever the terrain.',
    },

    featherstep: {
        extends: 'move_plus_1',
        name: 'Levitate',
        moveBonus: 0, climbBonus: 2,
        desc: 'Drift a hand\'s breadth above the ground and rise over ledges. Climb 2 extra levels of elevation.',
    },

    blink: {
        extends: 'move_plus_1',
        name: 'Blink',
        moveBonus: 1, ignoreClimb: true, passThroughUnits: true, ignoreTerrainCost: true,
        desc: 'Fold space with every step. Move +1, ignore elevation and terrain, and pass through other units.',
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
        desc: 'Steady your breath and remember your training. ATK and MAT +{buff:atk} for 3 turns.',
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
    rush: {
        extends: 'attack',
        name: 'Rush',
        actionCost: 40,
        basePower: 1.15,
        desc: 'A headlong shoulder charge. Hits a little harder than a normal attack.',
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
        desc: 'Bind a wound with field dressings. Heals an adjacent ally or yourself, and needs no MP.',
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
        desc: 'The pinnacle of evocation. A single point of white-hot force that devastates one target.',
    },

    // Spellblade (Runeblade)
    sunder: {
        extends: 'attack',
        name: 'Sunder',
        actionCost: 40,
        basePower: 0.8,
        buffs: [{ stat: 'def', value: -5, duration: 2 }],
        desc: 'A rune-etched cut that splits armor. Deals damage and lowers the target\'s DEF by {buff:def} for 2 turns.',
    },
    draining_edge: {
        extends: 'attack',
        name: 'Draining Edge',
        actionCost: 45,
        basePower: 0.9,
        drainFrac: 0.5,
        desc: 'The rune on your blade drinks deep. Heals you for half the damage dealt.',
    },

    // Runebow (Runecraft)
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

    // Stoneshaper (Transmutation)
    stone_fist: {
        extends: 'attack',
        name: 'Stone Fist',
        actionCost: 45,
        basePower: 1.35,
        desc: 'Your fist turns to granite mid-swing. A crushing blow.',
    },
    calcify: {
        name: 'Calcify',
        type: 'magic',
        range: 2, aoe: 0, mpCost: 12, actionCost: 45,
        targetType: 'enemy', basePower: 0.3, element: 'earth',
        animType: 'cast', projectileColor: '#bbaa88', chargeTime: 0,
        applyStatus: 'stun', statusDuration: 1,
        desc: 'Turns the target\'s joints briefly to stone. Light damage, and a stun that lasts {turns}.',
    },

    // Seer (Divination)
    time_lapse: {
        name: 'Time Lapse',
        type: 'magic',
        range: 4, aoe: 0, mpCost: 10, actionCost: 42,
        targetType: 'enemy', basePower: 0, element: 'arcane',
        animType: 'cast', projectileColor: '#ccddff', chargeTime: 0,
        applyStatus: 'slow', statusDuration: 3,
        desc: 'Thickens the flow of time around the target, slowing them for {duration} turns.',
    },

    // Battlemage (Battle Arts)
    spellbreaker: {
        extends: 'attack',
        name: 'Spellbreaker',
        actionCost: 42,
        basePower: 0.9,
        applyStatus: 'silence', statusDuration: 2,
        desc: 'A strike to the throat wrapped in anti-magic. Deals damage and silences the target for {duration} turns.',
    },
    blade_storm: {
        extends: 'attack',
        name: 'Blade Storm',
        aoe: 1,
        actionCost: 55,
        basePower: 0.75,
        desc: 'A whirling, spell-driven sweep. Hits the target and every enemy beside them.',
    },

    // Paladin (Holy Arts)
    consecrate: {
        name: 'Consecrate',
        type: 'magic',
        range: 2, aoe: 1, requiresLos: false, mpCost: 18, actionCost: 50,
        targetType: 'enemy', basePower: 0.8, element: 'holy',
        animType: 'cast', projectileColor: '#fff4bb', chargeTime: 30,
        desc: 'Hallows the ground in a burst of light that sears every enemy standing on it.',
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
        desc: 'Collapses a pocket of space into crushing weight. Damages every enemy inside and slows them for {turns}.',
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
        desc: 'A cleansing prayer. Clears every harmful status from each ally in the area.',
    },
    holy_chains: {
        extends: 'holy_bind',
        name: 'Holy Chains',
        aoe: 1,
        mpCost: 22, actionCost: 50,
        chargeTime: 40,
        desc: 'Chains of light lash out across an area. Every enemy caught takes light damage and is stunned for {turns}.',
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
        desc: 'A bound spirit tears a sliver of life from the target and carries it back to you. Heals you for half the damage dealt.',
    },

    // Fatebinder (Fateweaving)
    unravel: {
        name: 'Unravel',
        type: 'magic',
        range: 3, aoe: 0, mpCost: 12, actionCost: 42,
        targetType: 'enemy', basePower: 0, element: 'shadow',
        animType: 'cast', projectileColor: '#dd66bb', chargeTime: 0,
        isDispel: true,
        desc: 'Pulls loose every thread of good fortune on the target. Strips their positive statuses and stat boosts.',
    },
    death_sentence: {
        name: 'Death Sentence',
        type: 'magic',
        range: 3, aoe: 0, mpCost: 24, actionCost: 50,
        targetType: 'enemy', basePower: 0, element: 'shadow',
        animType: 'cast', projectileColor: '#660033', chargeTime: 30,
        applyStatus: 'doom', statusDuration: 3,
        desc: 'Pronounces Doom on the target. When its {duration} turns run out they fall, unless someone cures it first.',
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
        desc: 'Foresees the wounds of everyone nearby and mends them together. Heals the target ally and everyone beside them.',
    },

    // =====================================================================
    // --- Job ability expansion: reactions ---
    // =====================================================================

    premonition: {
        extends: 'brace',
        name: 'Premonition',
        trigger: 'anyHit', chance: 0.5,
        selfStatus: 'slipped',
        desc: 'After a hit, you may glimpse the next blow coming. The next physical attack against you misses.',
    },
    guardian_ward: {
        extends: 'brace',
        name: 'Guardian Ward',
        trigger: 'allyHit', chance: 0.4,
        selfStatus: null,
        allyCast: 'ward',
        desc: 'When an adjacent ally is hurt, you may cast Ward on them. It costs your MP as usual.',
    },
    martyr: {
        extends: 'brace',
        name: 'Martyr',
        trigger: 'allyHit', chance: 0.5,
        selfStatus: null,
        shareDamageFrac: 0.5,
        desc: 'When an adjacent ally is hurt, you may take half the wound onto yourself. It never drops you below 1 HP.',
    },
    arcane_rebuke: {
        extends: 'counter',
        name: 'Arcane Rebuke',
        chance: 0.45,
        counterWith: 'arcane_strike',
        desc: 'When struck in melee, may answer with an Arcane Strike that slows the attacker for 1 turn.',
    },
    phase_shift: {
        extends: 'brace',
        name: 'Phase Shift',
        trigger: 'anyHit', chance: 0.4,
        selfStatus: null,
        phaseAway: 3,
        desc: 'When hit, you may slip through a rift and reappear up to 3 tiles away, as far from the attacker as you can get.',
    },
    aftershock: {
        extends: 'counter',
        name: 'Aftershock',
        counterWith: null,
        attackerStatus: { status: 'slow', duration: 2 },
        desc: 'When struck in melee, you may send a tremor back through the attacker\'s feet. They are slowed for 2 turns.',
    },
    purifying_light: {
        extends: 'brace',
        name: 'Purifying Light',
        trigger: 'statusHit', chance: 0.6,
        selfStatus: null,
        cleanseSelf: true,
        desc: 'When hit with a harmful status, holy light may burn it away.',
    },
    spirit_hush: {
        extends: 'brace',
        name: 'Spirit Hush',
        trigger: 'magicHit', chance: 0.4,
        selfStatus: null,
        attackerStatus: { status: 'silence', duration: 2 },
        desc: 'When hit by magic, a guardian spirit may clamp a hand over the caster\'s mouth. They are silenced for 2 turns.',
    },
    thorn_hide: {
        extends: 'counter',
        name: 'Thorn Hide',
        chance: 1,
        counterWith: null,
        thornsFrac: 0.3,
        desc: 'Bark and thorn cover your skin. Whoever hits you in melee takes back 30% of the damage they dealt.',
    },
    karmic_rebound: {
        extends: 'brace',
        name: 'Karmic Rebound',
        trigger: 'anyHit', chance: 0.4,
        selfStatus: null,
        attackerStatus: { status: 'enfeebled', duration: 2 },
        desc: 'Harm done to you may come back around. The attacker is enfeebled, ATK -5 for 2 turns.',
    },
    call_of_the_pack: {
        extends: 'brace',
        name: 'Call of the Pack',
        trigger: 'lowHp', chance: 1, oncePerBattle: true,
        selfStatus: null,
        summon: { job: 'wolf', name: 'Wolf' },
        desc: 'Once per battle, when a blow leaves you below 30% HP, a wolf answers your howl and appears beside you.',
    },

    // =====================================================================
    // --- Job ability expansion: supports ---
    // =====================================================================

    jp_boost: {
        extends: 'mana_surge',
        name: 'Quick Study',
        passiveMpCost: 0, dmgDealt: null,
        xpMult: 1.5,
        desc: 'Learn from every swing. Earn 50% more XP from battles.',
    },
    rune_edge: {
        extends: 'mana_surge',
        name: 'Rune Edge',
        passiveMpCost: 0, dmgDealt: null,
        attackProc: { status: 'slow', chance: 0.35, duration: 1 },
        desc: 'A binding rune on your weapon. Physical hits have a 35% chance to slow the target for 1 turn.',
    },
    iron_will: {
        extends: 'mana_surge',
        name: 'Iron Will',
        passiveMpCost: 0, dmgDealt: null,
        statusImmune: ['stun', 'sleep', 'charm', 'berserk'],
        desc: 'An unbreakable mind. You are immune to Stun, Sleep, Charm and Berserk.',
    },
    concentrate: {
        extends: 'mana_surge',
        name: 'Concentrate',
        passiveMpCost: 0, dmgDealt: null,
        evasionPierce: 0.75,
        desc: 'Breathe, aim, release. Your physical attacks are much harder to dodge: targets dodge them only a quarter as often.',
    },
    earthen_footing: {
        extends: 'mana_surge',
        name: 'Earthen Footing',
        passiveMpCost: 0, dmgDealt: null,
        highGroundMult: 1.5,
        desc: 'The earth answers you. Attacking from higher ground deals +50% damage instead of +25%, and enemies above you get no height bonus.',
    },
    swiftcast: {
        extends: 'mana_surge',
        name: 'Swiftcast',
        passiveMpCost: 0, dmgDealt: null,
        chargeMult: 0.5,
        desc: 'Skip ahead to the moment the spell completes. Charge times are halved.',
    },
    arcane_weapon: {
        extends: 'mana_surge',
        name: 'Arcane Weapon',
        passiveMpCost: 1, dmgDealt: null,
        matToPhysical: 0.5,
        desc: 'Your weapon is sheathed in magic. Half your MAT is added to ATK for physical damage. Costs 1 MP per turn.',
    },
    spell_pierce: {
        extends: 'mana_surge',
        name: 'Spell Pierce',
        passiveMpCost: 1, dmgDealt: null,
        mdfPierce: 0.5,
        desc: 'Your spells arrive from just outside reality. They ignore half the target\'s MDF. Costs 1 MP per turn.',
    },
    seismic_power: {
        extends: 'mana_surge',
        name: 'Seismic Power',
        passiveMpCost: 0, dmgDealt: null,
        aoeDmgMult: 1.25,
        desc: 'Every blow shakes the ground. Area skills deal +25% damage.',
    },
    benediction: {
        extends: 'mana_surge',
        name: 'Benediction',
        passiveMpCost: 0, dmgDealt: null,
        healMult: 1.3,
        desc: 'Your prayers carry extra grace. Healing is 30% stronger.',
    },
    spirit_pact: {
        extends: 'mana_surge',
        name: 'Spirit Pact',
        passiveMpCost: 0, dmgDealt: null,
        summonBoost: 0.3,
        desc: 'Creatures you summon share your strength. They get +30% HP, ATK and MAT.',
    },
    providence: {
        extends: 'mana_surge',
        name: 'Providence',
        passiveMpCost: 0, dmgDealt: null,
        surviveLethal: true,
        desc: 'You have already seen this ending and refused it. Once per battle, a killing blow leaves you at 1 HP.',
    },
    bloodlust: {
        extends: 'mana_surge',
        name: 'Bloodlust',
        passiveMpCost: 0, dmgDealt: null,
        lowHpDmgDealt: { physical: 1.3 },
        desc: 'Wounds only make the beast angrier. +30% physical damage while below 50% HP.',
    },

    // =====================================================================
    // --- Job ability expansion: movement ---
    // =====================================================================

    mana_stride: {
        extends: 'move_plus_1',
        name: 'Mana Stride',
        moveBonus: 0,
        onMove: { mpPct: 0.1 },
        desc: 'Draw ambient mana from the ground you cross. Restore 10% of your max MP after moving.',
    },
    momentum: {
        extends: 'move_plus_1',
        name: 'Momentum',
        moveBonus: 0,
        momentumPct: 0.06,
        desc: 'Every step builds power. +6% damage per tile moved this turn, up to +30%.',
    },
    sentinel_step: {
        extends: 'move_plus_1',
        name: 'Sentinel Step',
        moveBonus: 0,
        onMove: { alliesBuff: { stat: 'def', value: 4, duration: 1 } },
        desc: 'Take up a guarding position. After moving, you and adjacent allies gain DEF +4 for 1 turn.',
    },
    force_leap: {
        extends: 'move_plus_1',
        name: 'Force Leap',
        moveBonus: 0, climbBonus: 3,
        desc: 'A spell-propelled jump. Climb 3 extra levels of elevation.',
    },
    hallowed_step: {
        extends: 'move_plus_1',
        name: 'Hallowed Step',
        moveBonus: 0,
        onMove: { alliesHealPct: 0.08 },
        desc: 'The ground you walk is blessed. After moving, you and adjacent allies heal 8% of max HP.',
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
        desc: 'A bolt of shadow that bursts on the target and everyone beside them.',
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
        desc: 'A snapping bite at the legs. Deals damage and slows the target for {turns}.',
    },

    // Boar: charge — melee stun, slightly weaker hit
    boar_charge: {
        extends: 'attack',
        name: 'Charge',
        actionCost: 40,
        basePower: 0.85,
        applyStatus: 'stun',
        statusDuration: 1,
        desc: 'A headlong charge with lowered tusks. Deals damage and stuns the target for {turns}.',
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
        desc: 'A spray of thorns that hits the target and everyone beside them, slowing them for {turns}.',
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
        desc: 'A cloud of spores that drifts over a wide area, damaging everyone caught and slowing them for {turns}.',
    },

    // Shard spider: venom bite — physical, inflicts slow
    spider_bite: {
        extends: 'attack',
        name: 'Venom Bite',
        actionCost: 35,
        basePower: 0.8,
        applyStatus: 'slow',
        statusDuration: 2,
        desc: 'A venomous bite that numbs the limbs. Deals damage and slows the target for {turns}.',
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
        desc: 'A chill that pulls at the target\'s soul. Deals damage and slows them for {turns}.',
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
    // summonLimit: n  — can't be cast while the caster has n of its creatures standing.
    // summonScale: x  — the creature's HP, ATK and MAT times x (only summons, not wild ones).
    // summonMods: {}  — flat stat changes for the creature, e.g. { spd: -3 }.
    // summonLure: x   — enemy attack priority on it: -0.5 halves it, +1 doubles it.
    // summonJob / summonName define what creature appears.
    // =====================================================================

    call_wolf: {
        name: 'Call Wolf',
        type: 'magic',
        range: 2,
        aoe: 0,
        mpCost: 24,
        summonLimit: 1,   // one wolf at a time
        // Slower than a wild wolf (SPD 13 → 7): its quick, slowing bites were what made
        // Beastcallers so strong (balance study, 2026-11-17). Its other stats are a wolf's.
        summonMods: { spd: -6 },
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
        desc: 'Calls a wolf spirit to fight beside you. Hard to hit, and its bite slows. Only one answers at a time.',
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
        desc: 'Conjures a charging boar. Tougher and harder-hitting than the wolf, but slower.',
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
        desc: 'Calls a thorn beast that pelts enemies with thorns from range.',
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
        desc: 'Binds a spectral wisp to fight for you. It chills enemies from range and can put them to sleep.',
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
        extends: 'mana_surge', name: 'Glamour', passiveMpCost: 0, dmgDealt: null, summonBoost: 0.6,
        desc: 'More convincing illusions. Copies and creatures you summon get +60% HP, ATK and MAT.',
    },
    mirage_step: {
        extends: 'move_plus_1', name: 'Mirage Step', moveBonus: 0,
        onMove: { selfBuff: { stat: 'eva', value: 15, duration: 1 } },
        desc: 'You leave an afterimage behind. After moving, EVA +15 for 1 turn.',
    },

    // Dreamweaver (Illusion + Enchantment)
    mass_sleep: {
        extends: 'dream_veil', name: 'Mass Sleep', aoe: 1, mpCost: 20, actionCost: 50, chargeTime: 25,
        statusDuration: 2, requiresLos: false, element: 'illusion',
        desc: 'A lullaby that settles over an area. Every enemy caught falls asleep for up to {turns}, or until struck.',
    },
    bewilder: {
        name: 'Bewilder', type: 'magic', range: 3, aoe: 0, mpCost: 16, actionCost: 45,
        targetType: 'enemy', basePower: 0, element: 'illusion', animType: 'cast',
        projectileColor: '#ff99dd', chargeTime: 0, applyStatus: 'charm', statusDuration: 2,
        desc: 'Convinces an enemy that their friends are the foe. Charms them for {duration} turns.',
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
        desc: 'When hit, you may whisper the attacker to sleep for 2 turns.',
    },
    deep_dreams: {
        extends: 'mana_surge', name: 'Deep Dreams', passiveMpCost: 1, dmgDealt: null, statusDurationBonus: 1,
        desc: 'Your enchantments sink deeper. Statuses you inflict last 1 turn longer. Costs 1 MP per turn.',
    },

    // Mirage Oracle (Illusion + Divination)
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
        extends: 'mana_surge', name: 'Lasting Images', passiveMpCost: 0, dmgDealt: null, summonBoost: 1,
        desc: 'Your copies and creatures have twice their usual HP, ATK and MAT.',
    },

    // ============================================================
    // ---- Gravecaller line (Necromancy) ----
    // ============================================================
    life_drain: {
        name: 'Life Drain', type: 'magic', range: 3, aoe: 0, mpCost: 9, actionCost: 44,
        targetType: 'enemy', basePower: 0.85, element: 'necrotic', animType: 'cast',
        projectileColor: '#7acc7a', chargeTime: 0, drainFrac: 0.5,
        desc: 'Draws the life out of the target. Deals damage and heals you for half of it.',
    },
    grave_chill: {
        name: 'Grave Chill', type: 'magic', range: 4, aoe: 0, mpCost: 10, actionCost: 44,
        targetType: 'enemy', basePower: 0.6, element: 'necrotic', animType: 'cast',
        projectileColor: '#99bbcc', chargeTime: 0, applyStatus: 'slow', statusDuration: 2,
        desc: 'The cold of the grave seeps into the target. Light damage, and they are slowed for {duration} turns.',
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
        desc: 'Walk half in the world of the dead. You pass through other units.',
    },

    // Lich (Necromancy + Evocation)
    soul_nova: {
        extends: 'life_drain', name: 'Soul Nova', aoe: 1, mpCost: 20, actionCost: 50, basePower: 0.7,
        drainFrac: 0.3, chargeTime: 25, requiresLos: false,
        desc: 'Tears the life from every enemy in an area and heals you for 30% of the damage.',
    },
    wither: {
        extends: 'life_drain', name: 'Wither', mpCost: 22, basePower: 1.6, chargeTime: 35,
        desc: 'A long, terrible draining. Heavy damage after a charge, and half of it returns to you as HP.',
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
        desc: 'Your soul is kept elsewhere. The first time you are knocked out, you rise again with 30% HP.',
    },
    necrotic_power: {
        extends: 'mana_surge', name: 'Necrotic Power', passiveMpCost: 1, dmgDealt: null, drainMult: 1.2,
        desc: 'Your drains heal you 20% more. Costs 1 MP per turn.',
    },

    // Gravewarden (Necromancy + Abjuration)
    bone_ward: {
        name: 'Bone Ward', type: 'magic', range: 3, aoe: 1, mpCost: 14, actionCost: 44,
        targetType: 'corpse', corpseEffect: 'ward', applyStatus: 'protect', statusDuration: 3,
        element: 'necrotic', animType: 'cast', projectileColor: '#ddddcc', chargeTime: 0, requiresLos: false,
        desc: 'Builds a barricade of bone from a knocked-out enemy. Allies next to it gain Protect for {turns}. The body is used up.',
    },
    mass_raise: {
        extends: 'raise_dead', name: 'Mass Raise', aoe: 1, mpCost: 26, corpseCount: 2, chargeTime: 30,
        desc: 'Up to two knocked-out enemies in an area rise as skeletons that fight for you.',
    },
    soul_tether: {
        name: 'Soul Tether', type: 'magic', range: 3, aoe: 0, mpCost: 18, actionCost: 45,
        targetType: 'ally', basePower: 0, element: 'necrotic', animType: 'cast',
        projectileColor: '#bbffcc', chargeTime: 0, applyStatus: 'reraise', statusDuration: 4,
        desc: 'Ties an ally\'s soul to their body. For {turns}, the next blow that would knock them out leaves them at 1 HP.',
    },
    death_ward: {
        extends: 'brace', name: 'Death Ward', trigger: 'allyHit', chance: 0.35, selfStatus: null, saveFromDown: true,
        desc: 'When an adjacent ally is knocked out, you may hold their soul in place. They stay standing at 1 HP.',
    },
    grave_legion: {
        extends: 'mana_surge', name: 'Grave Legion', passiveMpCost: 0, dmgDealt: null, summonBoost: 0.8,
        desc: 'The dead you raise grow tougher. They, and anything else you summon, get +80% HP, ATK and MAT.',
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
        desc: 'A splash of healing tonic. Heals everyone it reaches, enemies included.',
    },
    acid_flask: {
        name: 'Acid Flask', type: 'magic', range: 4, aoe: 1, mpCost: 0, actionCost: 58,
        targetType: 'all', basePower: 0.7, element: 'alchemy', animType: 'cast',
        projectileColor: '#ccff44', chargeTime: 0, requiresLos: false,
        buffs: [{ stat: 'def', value: -4, duration: 3 }],
        desc: 'Burns everyone in the splash, allies included, and lowers their DEF by {buff:def} for 3 turns.',
    },
    smoke_bomb: {
        name: 'Smoke Bomb', type: 'magic', range: 4, aoe: 1, mpCost: 0, actionCost: 50,
        targetType: 'all', basePower: 0, element: 'alchemy', animType: 'cast',
        projectileColor: '#aaaaaa', chargeTime: 0, requiresLos: false,
        applyStatus: 'slipped', statusDuration: 3,
        desc: 'A cloud of smoke. For {turns}, everyone inside, on both sides, dodges the next physical attack against them.',
    },
    quicksilver: {
        name: 'Quicksilver', type: 'magic', range: 4, aoe: 1, mpCost: 0, actionCost: 58,
        targetType: 'all', basePower: 0, element: 'alchemy', animType: 'cast',
        projectileColor: '#ddeeff', chargeTime: 0, requiresLos: false,
        applyStatus: 'haste', statusDuration: 2,
        desc: 'A shimmering splash that hastes everyone it reaches, on both sides, for {turns}.',
    },
    reflex_tonic: {
        extends: 'brace', name: 'Reflex Tonic', trigger: 'lowHp', chance: 1, oncePerBattle: true,
        selfStatus: null, selfCast: 'tonic_draught',
        desc: 'Once per battle, when a blow leaves you below 30% HP, you gulp down a tonic and heal.',
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
        desc: 'Stronger mixtures. All your damage and healing is 25% stronger.',
    },
    light_pack: {
        extends: 'move_plus_1', name: 'Light Pack', moveBonus: 1, climbBonus: 1,
        desc: 'Travel light. Move +1, and climb 1 extra level of elevation.',
    },

    // Plaguewright (Alchemy + Transmutation)
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
        extends: 'mana_surge', name: 'Virulence', passiveMpCost: 0, dmgDealt: null, statusDurationBonus: 1,
        desc: 'Your poisons and other statuses last 1 turn longer.',
    },

    // Field Surgeon (Alchemy + Abjuration)
    elixir: {
        name: 'Elixir', type: 'magic', range: 4, aoe: 0, mpCost: 0, actionCost: 55,
        targetType: 'ally', basePower: 1.0, isHeal: true, alsoCure: true, element: 'alchemy', animType: 'cast',
        projectileColor: '#88ffcc', chargeTime: 0,
        desc: 'A carefully measured dose for one ally. A strong heal that also cures their harmful statuses.',
    },
    panacea_mist: {
        name: 'Panacea Mist', type: 'magic', range: 4, aoe: 1, mpCost: 0, actionCost: 52,
        targetType: 'all', basePower: 0, isCure: true, element: 'alchemy', animType: 'cast',
        projectileColor: '#ccffee', chargeTime: 0, requiresLos: false,
        desc: 'A cleansing mist. Clears every harmful status from everyone in the splash, enemies included.',
    },
    stimulant: {
        name: 'Stimulant', type: 'magic', range: 4, aoe: 1, mpCost: 0, actionCost: 55,
        targetType: 'all', basePower: 0, element: 'alchemy', animType: 'cast',
        projectileColor: '#ffcc88', chargeTime: 0, requiresLos: false,
        ctGain: 15, applyStatus: 'regen', statusDuration: 3,
        desc: 'A bracing splash. Everyone caught, on both sides, acts a little sooner and gains Regen for {duration} turns.',
    },
    triage: {
        extends: 'brace', name: 'Triage', trigger: 'allyHit', chance: 0.4, selfStatus: null,
        allyCast: 'triage_draught', whenAllyBelow: 0.35,
        desc: 'When an adjacent ally is hit and left below 35% HP, you may patch them up on the spot.',
    },
    triage_draught: {
        extends: 'elixir', name: 'Triage Draught', range: 1, basePower: 0.8, alsoCure: false,
        desc: 'The quick patch of Triage.',
    },
    steady_hands: {
        extends: 'mana_surge', name: 'Steady Hands', passiveMpCost: 0, dmgDealt: null, precise: true,
        desc: 'Perfect aim. Your splashes only reach the side you meant them for: heals and boons skip enemies, and harm skips allies.',
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
        desc: 'Calls an ally to action. Their speed gauge jumps forward, so they act sooner.',
    },
    taunt: {
        name: 'Taunt', type: 'physical', range: 2, aoe: 1, mpCost: 6, actionCost: 38,
        targetType: 'enemy', basePower: 0, element: 'command', animType: 'cast',
        projectileColor: '#ff8844', chargeTime: 0, noEvade: true, applyStatus: 'taunted', statusDuration: 2,
        desc: 'A challenge no one can ignore. Enemies in the area must attack you for {duration} turns.',
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
        desc: 'When an adjacent ally is hit, you may lunge in and strike back at an attacker up to 2 tiles away.',
    },
    field_command: {
        extends: 'mana_surge', name: 'Field Command', passiveMpCost: 0, dmgDealt: null, partyStartCt: 15,
        desc: 'Your orders are given before the battle starts. The whole party opens with a head start on its speed gauges.',
    },
    vanguard_step: {
        extends: 'move_plus_1', name: 'Vanguard Step', moveBonus: 0,
        onMove: { selfBuff: { stat: 'def', value: 2, duration: 1 } },
        desc: 'Advance with your guard up. After moving, DEF +2 for 1 turn.',
    },

    // Marshal (Command + Abjuration)
    shield_wall: {
        name: 'Shield Wall', type: 'physical', range: 0, aoe: 1, mpCost: 8, actionCost: 45,
        targetType: 'ally', basePower: 0, element: 'command', animType: 'cast',
        projectileColor: '#ccccff', chargeTime: 0, noEvade: true, applyStatus: 'protect', statusDuration: 2,
        desc: 'Lock shields. You and every adjacent ally gain Protect for {duration} turns.',
    },
    challenge: {
        name: 'Challenge', type: 'physical', range: 3, aoe: 0, mpCost: 8, actionCost: 40,
        targetType: 'enemy', basePower: 0, element: 'command', animType: 'cast',
        projectileColor: '#ff6644', chargeTime: 0, noEvade: true, applyStatus: 'taunted', statusDuration: 3,
        buffs: [{ stat: 'def', value: -4, duration: 3 }],
        desc: 'Calls out one enemy. They must attack you for {turns}, and their DEF falls by {buff:def} for 3 turns.',
    },
    bulwark_bash: {
        extends: 'attack', name: 'Bulwark Bash', basePower: 0.9, mpCost: 8, actionCost: 45,
        applyStatus: 'stun', statusDuration: 1,
        desc: 'A blow with the shield\'s rim. Deals damage and stuns the target for {turns}.',
    },
    interpose: {
        extends: 'brace', name: 'Interpose', trigger: 'allyHit', chance: 0.35, selfStatus: null, shareDamageFrac: 1,
        desc: 'When an adjacent ally is hit, you may step in and take the whole blow yourself. It never drops you below 1 HP.',
    },
    iron_discipline: {
        extends: 'mana_surge', name: 'Iron Discipline', passiveMpCost: 0, dmgDealt: null,
        turnAlliesBuff: [{ stat: 'def', value: 3, duration: 1 }, { stat: 'mdf', value: 3, duration: 1 }],
        desc: 'At the start of each of your turns, you and adjacent allies gain DEF and MDF +3 for 1 turn.',
    },

    // Tactician (Command + Divination)
    seize_the_moment: {
        extends: 'rally', name: 'Seize the Moment', range: 4, mpCost: 12, ctGain: 55,
        desc: 'You spot the perfect moment for an ally. Their speed gauge jumps far forward.',
    },
    delay: {
        name: 'Delay', type: 'physical', range: 4, aoe: 0, mpCost: 10, actionCost: 40,
        targetType: 'enemy', basePower: 0, element: 'command', animType: 'cast',
        projectileColor: '#aa88ff', chargeTime: 0, ctGain: -40, floatText: 'Delayed!',
        desc: 'A feint that makes the enemy hesitate. Their speed gauge falls back, so they act later.',
    },
    exploit_opening: {
        extends: 'attack', name: 'Exploit Opening', basePower: 0.9, mpCost: 6, actionCost: 38, selfCtGain: 25,
        desc: 'A strike into a gap in the enemy\'s guard. Your own next turn comes sooner.',
    },
    read_the_battle: {
        extends: 'brace', name: 'Read the Battle', trigger: 'enemyCharge', chance: 0.4, selfStatus: null,
        delayCharge: 30, chargeRange: 4,
        desc: 'When an enemy within 4 tiles starts charging a spell, may disrupt it and set the charge back.',
    },
    initiative: {
        extends: 'mana_surge', name: 'Initiative', passiveMpCost: 0, dmgDealt: null, partyStartCt: 30,
        desc: 'Every battle is planned in advance. The whole party opens with a big head start on its speed gauges.',
    },

    // ============================================================
    // ---- Skyhunter (Runebow promotion: Conjuration + Divination) ----
    // ============================================================
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
        extends: 'mana_surge', name: 'Eagle Eye', passiveMpCost: 0, dmgDealt: { physical: 1.2 },
        desc: 'Nothing escapes your sight, so every arrow finds a weak spot. Physical damage +20%.',
    },

    // ============================================================
    // ---- Bastion (Warden promotion: Abjuration + Transmutation) ----
    // ============================================================
    bulwark: {
        name: 'Bulwark', type: 'magic', range: 3, aoe: 0, mpCost: 12, actionCost: 42,
        targetType: 'ally', basePower: 0, element: 'earth', animType: 'cast',
        projectileColor: '#bbaa88', chargeTime: 0,
        applyStatus: 'protect', statusDuration: 3,
        buffs: [{ stat: 'mdf', value: 3, duration: 3 }],
        desc: 'Turns an ally\'s skin to living stone. They gain Protect for {turns} and MDF +{buff:mdf} for 3 turns.',
    },
    ward_circle: {
        name: 'Ward Circle', type: 'magic', range: 0, aoe: 1, mpCost: 16, actionCost: 45,
        targetType: 'ally', basePower: 0, element: 'arcane', animType: 'cast',
        projectileColor: '#aaccdd', chargeTime: 0,
        applyStatus: 'shell', statusDuration: 3,
        desc: 'Draws a ring of runes around your feet. You and every adjacent ally gain Shell for {turns}.',
    },
    grasping_stone: {
        name: 'Grasping Stone', type: 'magic', range: 3, aoe: 1, requiresLos: false, mpCost: 18, actionCost: 50,
        targetType: 'enemy', basePower: 0.6, element: 'earth', animType: 'cast',
        projectileColor: '#998866', chargeTime: 35,
        applyStatus: 'slow', statusDuration: 2,
        desc: 'Stone hands rise from the ground and seize everyone in the area. Damages each enemy and slows them for {turns}.',
    },
    mana_shell: {
        extends: 'brace', name: 'Mana Shell', trigger: 'magicHit', chance: 0.5, selfStatus: 'shell',
        desc: 'When a spell hits you, you may harden your wards against the next. You gain Shell.',
    },
    unbreakable: {
        extends: 'mana_surge', name: 'Unbreakable', passiveMpCost: 0, dmgDealt: null,
        dmgTaken: { physical: 0.85, magic: 0.85 },
        desc: 'Stone in body and will. All damage you take is 15% lower.',
    },
};
