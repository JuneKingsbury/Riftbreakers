// The game's vocabulary: every stat, status, element, slot and field that content may use,
// with a description of what it does. This is the one place to look up "what can I put
// here?" when adding content.
//
// - Game code imports the lists it needs from here (e.g. NEGATIVE_STATUSES, EQUIP_FIELDS).
// - js/content/validate.js checks every class, ability, enemy, item, relic, event, realm and
//   encounter against SCHEMAS below, so a typo in a field name or value fails `npm test`.
// - `npm run content-docs` writes CONTENT.md from this file and the content itself.
//
// Adding a new kind of value (a new status, element, stat...) means adding it here and
// teaching the engine what it does. Adding content that uses existing values needs only
// the content file.

// ---- Stats ----
// Every stat a unit has. `short` labels stat lines (the gear screen), `long` reads in a
// sentence ("+2 max HP").
export const STATS = {
    maxHp: { short: 'HP',   long: 'max HP', desc: 'Hit points. A unit at 0 HP is knocked out.' },
    maxMp: { short: 'MP',   long: 'max MP', desc: 'Mana for spells. Classes with no MP (Alchemist, Warlord lines) use skills that cost none.' },
    atk:   { short: 'ATK',  long: 'ATK',    desc: 'Physical attack: the damage of physical skills.' },
    def:   { short: 'DEF',  long: 'DEF',    desc: 'Physical defense.' },
    mat:   { short: 'MAT',  long: 'MAT',    desc: 'Magic attack: the damage and healing of magic skills.' },
    mdf:   { short: 'MDF',  long: 'MDF',    desc: 'Magic defense.' },
    spd:   { short: 'SPD',  long: 'SPD',    desc: 'Speed: how fast the unit\'s turn gauge (CT) fills.' },
    move:  { short: 'Move', long: 'Move',   desc: 'Tiles the unit can move in a turn.' },
    eva:   { short: 'EVA',  long: 'EVA',    desc: 'Evasion: the chance, in percent, to dodge physical attacks (modified by facing).' },
    crit:  { short: 'CRIT', long: 'CRIT',   desc: 'Critical hit chance in percent, on top of the base 5%. Only gear raises it.' },
    mpRegen: { short: 'MP/turn', long: 'MP per turn', desc: 'MP recovered at the start of each of the unit\'s turns: 3, plus gear. Units without MP recover none.' },
};

// Stats an item can raise or lower (positive or negative numbers), in display order.
export const ITEM_STATS = ['atk', 'def', 'mat', 'mdf', 'spd', 'move', 'eva', 'crit', 'maxHp', 'maxMp', 'mpRegen'];
// Stats a relic, an event reward or an enemy's statMods may change.
export const MOD_STATS = ['maxHp', 'maxMp', 'atk', 'def', 'mat', 'mdf', 'spd', 'move', 'eva', 'crit'];
// Stats a timed buff or debuff (an ability's buffs / selfBuff) may change: the ones combat reads
// through getEffectiveStat (tactical/abilities.js). SPD and Move aren't, so speed changes use
// Haste / Slow or ctGain, and HP / MP aren't buffable.
export const BUFF_STATS = ['atk', 'def', 'mat', 'mdf', 'eva', 'crit'];

// ---- Status effects ----
// Statuses an ability can put on a unit (applyStatus, selfStatus, attackerStatus, battleStart
// on relics...). `harmful` statuses are what cures remove and what statusImmune guards
// against. The order is the order of NEGATIVE_STATUSES / POSITIVE_STATUSES.
export const STATUSES = {
    // Harmful
    poison:    { name: 'Poison',   harmful: true,  desc: 'Loses about 6% of max HP at the start of each turn.' },
    slow:      { name: 'Slow',     harmful: true,  desc: 'The turn gauge fills at half speed.' },
    silence:   { name: 'Silence',  harmful: true,  desc: 'Cannot use magic skills or magic reactions.' },
    sleep:     { name: 'Sleep',    harmful: true,  desc: 'Skips turns and cannot react. Any damage wakes the unit.' },
    stun:      { name: 'Stun',     harmful: true,  desc: 'Loses its next turn and cannot react.' },
    berserk:   { name: 'Berserk',  harmful: true,  desc: 'Can only attack the nearest enemy.' },
    charm:     { name: 'Charm',    harmful: true,  desc: 'Fights for the other side and cannot react.' },
    frog:      { name: 'Frog',     harmful: true,  desc: 'Turned into a frog: ATK and MAT drop by 60% and DEF by 50%.' },
    enfeebled: { name: 'Enfeeble', harmful: true,  desc: 'ATK is lowered by 5.' },
    doom:      { name: 'Doom',     harmful: true,  desc: 'Falls when the countdown runs out, unless cured first. A boss loses a quarter of its max HP instead.' },
    taunted:   { name: 'Taunt',    harmful: true,  desc: 'Must attack the unit that taunted it if it can.' },
    // Helpful
    haste:     { name: 'Haste',    harmful: false, desc: 'The turn gauge fills 50% faster.' },
    protect:   { name: 'Protect',  harmful: false, desc: 'Takes 25% less physical damage.' },
    shell:     { name: 'Shell',    harmful: false, desc: 'Takes 25% less magic damage.' },
    regen:     { name: 'Regen',    harmful: false, desc: 'Heals about 8% of max HP at the start of each turn.' },
    reflect:   { name: 'Reflect',  harmful: false, desc: 'Enemy spells bounce back at their caster (unless the spell ignores Reflect).' },
    reraise:   { name: 'Reraise',  harmful: false, desc: 'The first knockout leaves the unit standing at 1 HP instead.' },
    slipped:   { name: 'Slipped',    harmful: false, desc: 'The next physical attack against the unit misses.' },
    hidden:    { name: 'Hidden',   harmful: false, desc: 'Enemies cannot see or target the unit until it acts.' },
};

// States the engine sets on its own. Content does not inflict these (except `defend`, which
// a reaction may grant with selfStatus), but tactics scripts can check for them.
export const ENGINE_STATES = {
    defend:      { name: 'Defend',      desc: 'Braced: takes less damage and dodges more until its next turn.' },
    charging:    { name: 'Charging',    desc: 'Channeling a spell with a charge time.' },
    unconscious: { name: 'Unconscious', desc: 'At 0 HP. Can be revived until its timer runs out.' },
    dead:        { name: 'Dead',        desc: 'Out of the battle for good.' },
};

export const NEGATIVE_STATUSES = Object.keys(STATUSES).filter(s => STATUSES[s].harmful);
export const POSITIVE_STATUSES = Object.keys(STATUSES).filter(s => !STATUSES[s].harmful);

// ---- Elements and schools ----
// Elements are flavour plus visuals (projectile and area effects pick by element). They have
// no resistances.
export const ELEMENTS = {
    fire: 'Fire', ice: 'Ice', thunder: 'Lightning', earth: 'Earth', nature: 'Nature', holy: 'Holy',
    shadow: 'Shadow', void: 'Void', arcane: 'Arcane', spirit: 'Spirit', necrotic: 'Necrotic',
    illusion: 'Illusion', alchemy: 'Alchemy', command: 'Command',
};

// Schools of magic a class draws from (flavour, shown in class selection).
export const SCHOOLS = {
    evocation: 'Evocation', enchantment: 'Enchantment', abjuration: 'Abjuration', conjuration: 'Conjuration',
    transmutation: 'Transmutation', divination: 'Divination', illusion: 'Illusion', necromancy: 'Necromancy',
};

// ---- Equipment ----
// The six equipment slots, in the order a character's equipment is listed. `field` is the
// key a party member's appearance stores the item under.
export const EQUIP_SLOTS = {
    armor:   { field: 'armorKey',   label: 'Armor' },
    helmet:  { field: 'helmetKey',  label: 'Helmet' },
    weapon:  { field: 'weaponKey',  label: 'Weapon' },
    tool:    { field: 'toolKey',    label: 'Tool' },
    boots:   { field: 'bootsKey',   label: 'Boots' },
    trinket: { field: 'trinketKey', label: 'Trinket' },
};
export const EQUIP_FIELDS = Object.values(EQUIP_SLOTS).map(s => s.field);

// Equipment types: what a class's allowedEquipment lists, and the slots each type goes in.
export const EQUIP_TYPES = {
    cloth:          { slots: ['armor', 'helmet'], desc: 'Robes and caps for mages.' },
    light:          { slots: ['armor', 'helmet'], desc: 'Leather, for skirmishers.' },
    medium:         { slots: ['armor', 'helmet'], desc: 'Mail and brigandine.' },
    heavy:          { slots: ['armor', 'helmet'], desc: 'Plate, for the front line.' },
    blade:          { slots: ['weapon'],          desc: 'Swords and daggers.' },
    heavy_weapon:   { slots: ['weapon'],          desc: 'Clubs, axes and hammers.' },
    magic:          { slots: ['weapon'],          desc: 'Wands and staves.' },
    bow:            { slots: ['weapon'],          desc: 'Bows.' },
    crossbow:       { slots: ['weapon'],          desc: 'Crossbows.' },
    shield:         { slots: ['tool'],            desc: 'Shields.' },
    implement:      { slots: ['tool'],            desc: 'Lanterns, orbs, quivers, banners and other focuses. Every class can use them.' },
    offhand_weapon: { slots: ['tool'],            desc: 'A second, smaller weapon.' },
    boots:          { slots: ['boots'],           desc: 'Boots. Every class can wear them.' },
    trinket:        { slots: ['trinket'],         desc: 'Rings, charms and amulets. Every class can wear them.' },
};

// Rarities of items and relics, from most to least common. They decide loot and shop pools.
export const RARITIES = ['common', 'uncommon', 'rare'];
// Items have one rarer tier than relics: legendary, the best gear in the game. It only drops
// from elites and bosses in later acts, and shops never stock it.
export const ITEM_RARITIES = [...RARITIES, 'legendary'];

// Which abilities an item may grant:
//   grants         action abilities (slot 'action'): added to the wearer's skill list
//   grantsPassive  reaction, support or movement abilities: always on while worn, on top of
//                  the wearer's chosen ones
// Any ability of the right slot works, including another class's. CONTENT.md lists them.
export const ITEM_GRANT_SLOTS = { grants: ['action'], grantsPassive: ['reaction', 'support', 'movement'] };

// ---- Abilities ----
export const ABILITY_TYPES = {
    physical: 'Uses ATK against DEF; can be dodged.',
    magic: 'Uses MAT against MDF; blocked by Silence, bounced by Reflect.',
    passive: 'Always on (reactions, supports, movement).',
};
// Loadout slot an ability is equipped into. Absent means 'action'.
export const ABILITY_SLOTS = {
    action: 'Part of the class\'s skill list, used on the unit\'s turn.',
    reaction: 'Fires on its own when its trigger happens.',
    support: 'Always-on modifiers.',
    movement: 'Changes how the unit moves.',
};
export const TARGET_TYPES = {
    enemy: 'Opponents of the user.',
    ally: 'The user\'s side.',
    self: 'Only the user.',
    all: 'Everyone in the area, friend and foe (an Alchemist\'s splash).',
    tile: 'An empty tile (summons, terrain).',
    corpse: 'A knocked-out unit (Gravecaller rites).',
};
export const ANIM_TYPES = { slash: 'Lunge and swing.', cast: 'Rise and glow.', shot: 'Pull back and fire.' };
export const REACTION_TRIGGERS = {
    physicalHit: 'The owner took physical damage.',
    magicHit: 'The owner took magic damage.',
    anyHit: 'The owner took any damage.',
    rangedHit: 'The owner was hit from more than one tile away.',
    lowHp: 'The owner was hit and is below half HP.',
    statusHit: 'The owner was afflicted with a harmful status.',
    allyHit: 'An adjacent ally of the owner was damaged.',
    onDown: 'The owner was knocked out.',
    decoyDown: 'One of the owner\'s copies (an inert summon) was broken.',
    enemyCharge: 'An enemy within chargeRange started charging a spell.',
};
// Terrain an ability's terrainEffect can affect.
export const TERRAIN_TARGETS = ['all', 'passable', 'impassable'];
// What a corpse-targeting ability does to the body.
export const CORPSE_EFFECTS = {
    raise: 'Up to corpseCount bodies rise as summons (summonJob) for the caster.',
    burst: 'The body bursts, hurting the enemies around it.',
    ward: 'The body\'s last strength shields nearby allies (applyStatus).',
};

// Starter scripts a class can name in ai.script (js/tactical/ai/default-scripts.js).
export const AI_SCRIPTS = {
    melee: 'Brace when badly hurt, else attack the nearest enemy.',
    melee_healer: 'Brace, heal allies below 45%, else attack the nearest enemy.',
    melee_summoner: 'Call a creature while not ahead, brace, else attack the nearest enemy.',
    ranged: 'Back off to attack range when enemies close in, else hit the weakest enemy.',
    ranged_summoner: 'Call a creature, keep 3 tiles away, else hit the weakest enemy.',
    healer: 'Revive the fallen, heal allies below 60%, else attack the nearest enemy.',
};

// ---- Runs ----
export const ENCOUNTER_KINDS = { normal: 'A battle node.', elite: 'A tougher fight with a relic.', boss: 'The act\'s final fight.' };

// ============================================================================================
// Schemas: the fields each kind of content may have. validate.js checks content against these.
//
// A field spec is { type, desc, ...}:
//   'number' | 'string' | 'bool' | 'color'         plain values
//   'enum'    values: [...] or an object whose keys are the values
//   'ref'     of: 'ability' | 'abilityOrTemplate' | 'job' | 'item' | 'relic' | 'status' | 'realm' | 'chain' | 'map'
//             | 'encounter' | 'material' | 'sprite'   a key of that kind of content
//   'list'    of: <spec>     an array
//   'object'  fields: {...}  a nested object with its own fields
//   'map'     keys: <enum values>, of: <spec>   an object from known keys to values
// `required: true` marks fields that must be present.
// ============================================================================================

const num = (desc, extra) => ({ type: 'number', desc, ...extra });
const str = (desc, extra) => ({ type: 'string', desc, ...extra });
const bool = (desc) => ({ type: 'bool', desc });
const oneOf = (values, desc, extra) => ({ type: 'enum', values: Array.isArray(values) ? values : Object.keys(values), desc, ...extra });
const ref = (of, desc, extra) => ({ type: 'ref', of, desc, ...extra });
const list = (of, desc, extra) => ({ type: 'list', of, desc, ...extra });
const obj = (fields, desc, extra) => ({ type: 'object', fields, desc, ...extra });
const map = (keys, of, desc) => ({ type: 'map', keys, of, desc });

const statMods = (keys, desc) => map(keys, num(''), desc);
const buff = obj({ stat: oneOf(BUFF_STATS, 'The stat changed.', { required: true }), value: num('Amount (negative: a debuff).', { required: true }), duration: num('Turns it lasts.') }, 'A timed stat change.');
const statusFor = obj({ status: ref('status', 'The status.', { required: true }), duration: num('Turns it lasts.'), chance: num('0-1 chance.') }, 'A status with a duration.');
const dmgMult = map(['physical', 'magic'], num(''), 'Damage multipliers by type: { physical?, magic? }.');

const ABILITY = {
    extends: ref('abilityOrTemplate', 'Inherit every field from this ability (or template, abilities/templates.js) and override only what differs. Set a field to null to drop an inherited value.'),
    name: str('Display name.'),
    desc: str('Tooltip text. May use {duration}, {turns} and {buff:stat}, filled in per rank.'),
    type: oneOf(ABILITY_TYPES, 'Damage type.'),
    slot: oneOf(ABILITY_SLOTS, 'Loadout slot. Absent: action.'),
    // Actions
    range: num('Tile range (Manhattan distance).'),
    aoe: num('Area radius around the target (0: single target).'),
    aoePattern: list(list(num(''), ''), 'Area as [dx, dy] offsets from the target instead of a radius; the player can rotate it.'),
    mpCost: num('MP spent on use.'),
    actionCost: num('CT the turn costs.'),
    targetType: oneOf(TARGET_TYPES, 'Who it can target.'),
    basePower: num('Damage or healing multiplier.'),
    animType: oneOf(ANIM_TYPES, 'Attack animation.'),
    chargeTime: num('CT ticks spent charging before it goes off (0: instant).'),
    element: oneOf(ELEMENTS, 'Element (visuals).'),
    projectileColor: { type: 'color', desc: 'CSS color of the projectile.' },
    requiresLos: bool('Needs line of sight to the target. Default true; false for lobbed spells.'),
    applyStatus: ref('status', 'Status inflicted on each target hit.'),
    statusDuration: num('Turns applyStatus lasts.'),
    isHeal: bool('Restores HP instead of dealing damage.'),
    isCure: bool('Removes harmful statuses (helpful ones stay).'),
    alsoCure: bool('A heal that also removes harmful statuses.'),
    isDispel: bool('Strips helpful statuses and buffs from the target.'),
    buffs: list(buff, 'Timed stat changes put on each target.'),
    floatText: str('Floating text shown when a buff-only ability lands.'),
    drainFrac: num('The user heals this fraction of the damage dealt.'),
    bonusVsStatus: map(Object.keys(STATUSES), num(''), 'Damage multiplier against targets with a status, e.g. { sleep: 1.5 }.'),
    ignoreEvasion: bool('Cannot be dodged (a true strike).'),
    noEvade: bool('Cannot be dodged (an order, not an attack).'),
    ignoreReflect: bool('Magic that Reflect does not bounce.'),
    ctGain: num('Adds this much to the target\'s turn gauge (negative: delays it).'),
    selfCtGain: num('Adds this much to the user\'s own turn gauge after use.'),
    swapPlaces: bool('The user and the target trade places.'),
    terrainEffect: obj({
        setType: ref('material', 'Material the tiles become.'),
        raise: num('Blocks stacked on top.'),
        affectTiles: oneOf(TERRAIN_TARGETS, 'Which tiles are changed. Default all.'),
    }, 'Reshapes the tiles in the area.'),
    corpseEffect: oneOf(CORPSE_EFFECTS, 'What a corpse-targeting ability does.'),
    corpseCount: num('Bodies raised at once (corpseEffect raise).'),
    isSummon: bool('Targets an empty tile and places a new allied unit there.'),
    summonJob: ref('job', 'The creature summoned.'),
    summonName: str('Its name.'),
    summonCount: num('How many appear at once.'),
    summonLimit: num('Cannot be cast while the user has this many of its creatures standing.'),
    summonMods: statMods(MOD_STATS, 'Flat stat changes for the summoned creature.'),
    summonScale: num('The summoned creature\'s HP, ATK and MAT times this (only summons, not wild ones of its kind).'),
    summonLure: num('How much enemies want to attack the summon: -0.5 halves it, +1 doubles it.'),
    // Passives
    passive: bool('Always on.'),
    passiveMpCost: num('MP drained per turn; a support with an upkeep switches off at 0 MP.'),
    // Reactions
    trigger: oneOf(REACTION_TRIGGERS, 'What sets the reaction off.'),
    chance: num('0-1 chance it fires.'),
    adjacentOnly: bool('Only when the attacker is adjacent.'),
    oncePerBattle: bool('Fires at most once per battle.'),
    counterWith: ref('ability', 'Ability used against the attacker (needs MP and range).'),
    counterReach: num('Range for counterWith, when it differs from the ability\'s own.'),
    selfCast: ref('ability', 'Ability cast on the owner (needs MP).'),
    selfStatus: { type: 'enum', values: [...Object.keys(STATUSES), 'defend'], desc: 'Status applied to the owner.' },
    selfBuff: buff,
    mpRestoreFrac: num('Restores this fraction of the damage taken as MP.'),
    allyCast: ref('ability', 'Ability cast on the ally that was hit (allyHit).'),
    shareDamageFrac: num('The owner takes this share of the ally\'s damage instead (allyHit).'),
    whenAllyBelow: num('Only when the ally is below this fraction of max HP (allyHit).'),
    saveFromDown: bool('Fires when the ally is knocked out, saving them.'),
    reviveFrac: num('The owner gets back up with this fraction of max HP (onDown).'),
    downBurst: ref('ability', 'Ability that bursts from the owner onto nearby enemies (onDown).'),
    splitInto: obj({
        count: num('How many copies.', { required: true }),
        hpFrac: num('Each copy\'s max HP, as a fraction of the owner\'s.', { required: true }),
        statFrac: num('Each copy\'s ATK, DEF, MAT and MDF, as a fraction of the owner\'s.', { required: true }),
    }, 'The owner breaks into weaker copies of itself, which fight on as full units of its side (onDown). Copies do not split again.'),
    attackerStatus: statusFor,
    thornsFrac: num('The attacker takes this fraction of the damage dealt.'),
    phaseAway: num('The owner teleports up to this many tiles away from the attacker.'),
    summon: obj({ job: ref('job', 'Creature summoned.', { required: true }), name: str('Its name.', { required: true }) }, 'Creature summoned next to the owner.'),
    cleanseSelf: bool('Removes the owner\'s harmful statuses.'),
    chargeRange: num('How close the charging enemy must be (enemyCharge). Default 4.'),
    delayCharge: num('Extra CT the enemy\'s spell needs to go off (enemyCharge). Default 30.'),
    // Supports
    dmgDealt: dmgMult,
    dmgTaken: dmgMult,
    lowHpDmgDealt: { ...dmgMult, desc: 'Damage multipliers while below half HP.' },
    evaBonus: num('Added evasion against physical attacks.'),
    evasionPierce: num('Physical attacks are dodged this much less often (0.75: a quarter as often).'),
    highGroundMult: num('Replaces the 1.25 high-ground bonus; also negates it against you.'),
    matToPhysical: num('Fraction of MAT added to ATK for physical damage.'),
    mdfPierce: num('Fraction of the target\'s MDF your magic ignores.'),
    aoeDmgMult: num('Damage multiplier for area abilities.'),
    healMult: num('Healing multiplier.'),
    drainMult: num('Multiplier for drainFrac healing.'),
    lifestealFrac: num('Your damaging hits heal you this fraction of the damage they deal (on top of any drainFrac).'),
    attackProc: statusFor,
    statusImmune: list(ref('status', ''), 'Statuses that cannot be inflicted on you.'),
    statusDurationBonus: num('Extra turns on statuses you inflict.'),
    surviveLethal: bool('Once per battle, a killing blow leaves you at 1 HP.'),
    chargeMult: num('Charge time multiplier.'),
    xpMult: num('XP multiplier after a won battle.'),
    turnRegenHp: num('HP healed at the start of each turn.'),
    turnAlliesBuff: list(buff, 'Buffs for the owner and adjacent allies at the start of each of the owner\'s turns.'),
    summonBoost: num('Your summons gain this fraction to HP, ATK and MAT.'),
    mpOnFall: num('MP gained whenever another unit falls.'),
    partyStartCt: num('The whole party starts battles with this much CT.'),
    precise: bool('Your splashes (targetType all) only touch the side they help or hurt.'),
    // Movement
    moveBonus: num('Extra Move.'),
    climbBonus: num('Extra climbable height.'),
    ignoreClimb: bool('No height limit.'),
    ignoreTerrainCost: bool('Every step costs 1.'),
    passThroughUnits: bool('Can walk through (but not stop on) occupied tiles.'),
    onMove: obj({
        hpPct: num('Heal this fraction of max HP.'),
        mpPct: num('Restore this fraction of max MP.'),
        cleanse: bool('Remove harmful statuses.'),
        alliesHealPct: num('Heal adjacent allies (and self) by this fraction.'),
        alliesBuff: buff,
        selfBuff: buff,
        enemiesStatus: statusFor,
        enemiesCt: num('Change adjacent enemies\' CT by this much.'),
    }, 'Effects after the unit moves.'),
    momentumPct: num('Extra damage per tile moved this turn (up to 5).'),
    rootedHealPct: num('Heal this fraction of max HP when ending a turn without moving.'),
};

const LEARNABLE = obj({ sp: num('Skill points it costs.', { required: true }), requires: ref('ability', 'Skill that must be learned first.') }, '');

const JOB = {
    maxHp: num('Base HP.', { required: true }), maxMp: num('Base MP.', { required: true }),
    spd: num('Speed.', { required: true }), atk: num('Physical attack.', { required: true }), def: num('Physical defense.', { required: true }),
    mat: num('Magic attack.', { required: true }), mdf: num('Magic defense.', { required: true }),
    move: num('Move range in tiles.', { required: true }), eva: num('Evasion.', { required: true }),
    spriteKey: ref('sprite', 'Skin sprite of the class.'),
    char: str('Fallback character when sprites are off.'), color: { type: 'color', desc: 'Fallback color.' },
    schools: list(oneOf(SCHOOLS, ''), 'Schools of magic.'),
    // Player classes (the display name is the key, title-cased: field_surgeon → Field Surgeon)
    tier: oneOf([1, 2], '1: a starting role. 2: a promotion.'),
    skillsetName: str('Name of the class\'s action command.'),
    desc: str('Class description in selection screens. Only player classes have one.'),
    role: str('Short role line on the new-run screen (Tier 1).'),
    learnable: map(null, LEARNABLE, 'The skill tree: ability key → { sp, requires? }. The first entry is known from the start.'),
    promotions: list(ref('job', ''), 'Tier 1: the two Tier 2 classes it can promote into.'),
    builds: list(obj({
        key: str('Id of the build, unique in the class. Saved in runs, so don\'t rename it.', { required: true }),
        name: str('Display name, e.g. Retaliation.', { required: true }),
        desc: str('One line on how the build plays.', { required: true }),
        steps: list(str(''), 'The order to spend skill points in: \'skill\' learns it, \'skill+\' upgrades it one rank. A Tier 2 build may use its Tier 1 class\'s skills. Skills a build leaves out are bought after it, in skill-tree order.', { required: true }),
    }, ''), 'Player classes: the two suggested builds a player can follow (run/builds.js). A Tier 1 build runs until promotion, a Tier 2 build after it.'),
    allowedEquipment: map(Object.keys(EQUIP_SLOTS), list(oneOf(EQUIP_TYPES, '')), 'Equipment types per slot. Tier 2 classes inherit their Tier 1 class\'s.'),
    equipmentExpansions: map(Object.keys(EQUIP_SLOTS), list(oneOf(EQUIP_TYPES, '')), 'Types a Tier 2 class adds to the inherited list.'),
    startingGear: map(Object.keys(EQUIP_SLOTS), ref('item', ''), 'Tier 1: what a new member carries.'),
    unlock: obj({
        type: oneOf(['base', 'renown'], 'base: open from the start. renown: bought in Unlocks (each class bought makes the next dearer).', { required: true }),
        order: num('Base: place in the default starting party. Renown: place in the Unlocks list.', { required: true }),
    }, 'Tier 1: how the class becomes a starting pick.'),
    ai: obj({
        script: oneOf(AI_SCRIPTS, 'The simple starter script for the class (defaultScriptFor). Absent: attack the weakest enemy.'),
        scriptRange: num('ranged script: the attack range it backs off to (default 3).'),
        ranged: bool('Fights from range: automatic positioning is careful, and it regroups when cut off.'),
        keep: num('Tiles automatic behavior keeps from enemies when they get close.'),
        melee: bool('A front-liner: braces when nearly dead, and never backs off.'),
        healer: bool('Heals early (allies below 60% HP rather than 40%).'),
    }, 'How automatic battles play the class (js/tactical/ai/default-scripts.js).'),
    // Enemies and summons
    abilities: list(ref('ability', ''), 'Enemies: the fixed ability list it fights with.'),
    passives: list(ref('ability', ''), 'Enemies: reaction, support or movement abilities it always has.'),
    battleStart: list(statusFor, 'Enemies: statuses it starts every battle with (only ones without side effects, e.g. reflect, protect, shell, regen).'),
    inert: bool('Summons: never acts (Mirror Image\'s copies).'),
    lure: num('Summons: how strongly enemies prefer to attack it.'),
};

const ITEM = {
    name: str('Display name.', { required: true }),
    slot: oneOf(EQUIP_SLOTS, 'Slot it goes in.', { required: true }),
    type: oneOf(EQUIP_TYPES, 'Equipment type; classes restrict which types they wear.', { required: true }),
    rarity: oneOf(ITEM_RARITIES, 'Loot and shop pool. Default common. Legendary never sells in shops.'),
    featOnly: bool('Only drops once earned in Feats.'),
    grants: list(ref('ability', ''), 'Action abilities usable while worn.'),
    grantsPassive: list(ref('ability', ''), 'Reaction, support or movement abilities always on while worn.'),
    acts: list(oneOf([1, 2, 3, 4], ''), 'Acts it can drop in or be sold in. Default: all.'),
    realms: list(ref('realm', ''), 'Realms it can drop in or be sold in. Default: all.'),
    ...Object.fromEntries(ITEM_STATS.map(s => [s, num(`${STATS[s].long} bonus.`)])),
};

// A unit trigger (tactical/triggers.js): when something happens, an effect on the holder.
export const TRIGGER_EVENTS = {
    allyDown: 'Another unit of its side (not a summon or copy) is knocked out.',
    enemyDown: 'A unit of the other side (not a summon or copy) is knocked out.',
    kill: 'The holder knocked out a foe (not a summon or copy).',
    hpBelow: 'The holder\'s HP falls below pct of its max (once per battle).',
};
const TRIGGER = obj({
    on: oneOf(Object.keys(TRIGGER_EVENTS), 'What sets it off (TRIGGER_EVENTS).', { required: true }),
    pct: num('For hpBelow: the HP threshold, 0-1.'),
    once: bool('At most once per battle (hpBelow always is).'),
    status: statusFor,
    healPct: num('Heals the holder this fraction of its max HP.'),
    mp: num('MP restored to the holder.'),
    buffs: list(buff, 'Buffs for the holder, refreshed rather than stacked.'),
    text: str('Floating text when it fires (default: the relic\'s name).'),
}, 'When something happens in battle, an effect on the holder.');

const RELIC = {
    name: str('Display name.', { required: true }),
    desc: str('What it does.', { required: true }),
    rarity: oneOf(RARITIES, 'Pool. Rare relics come from bosses.', { required: true }),
    statMods: statMods(MOD_STATS, 'Stat bonuses for every party member in battle.'),
    battleStart: statusFor,
    xpMult: num('Multiplies XP from battles.'),
    goldMult: num('Multiplies gold from battles.'),
    shopDiscount: num('Fraction off shop prices (negative: dearer).'),
    extraItemChoice: bool('Battle rewards offer one more item to choose from.'),
    passives: list(ref('ability', ''), 'Reaction, support or movement abilities every member has on top of their own.'),
    triggers: list(TRIGGER, 'Battle triggers every member has (each fires for that member).'),
    acts: list(oneOf([1, 2, 3, 4], ''), 'Acts it can be found in. Default: all.'),
    realms: list(ref('realm', ''), 'Realms it can be found in. Default: all.'),
};

// Elite affixes (affixes.js): a twist on an elite fight's leader, named before it.
const AFFIX = {
    name: str('The word put before the leader\'s name, e.g. Thorned.', { required: true }),
    desc: str('What it does, shown before the fight.', { required: true }),
    statMods: statMods(MOD_STATS, 'Stat changes for the leader.'),
    maxHpPct: num('Raises the leader\'s max HP by this fraction (after statMods).'),
    battleStart: list(statusFor, 'Statuses the leader starts the battle with.'),
    passives: list(ref('ability', ''), 'Reaction, support or movement abilities the leader has on top of its own.'),
    extraAbilities: list(ref('ability', ''), 'Actions the leader can use on top of its own.'),
    acts: list(oneOf([1, 2, 3, 4], ''), 'Acts it can appear in. Default: all.'),
};

const EFFECT = obj({
    gold: num('Gold gained (negative: spent).'),
    healPct: num('Every member heals this fraction of max HP (negative: damage, never below 1 HP).'),
    xp: num('XP for every member.'),
    item: oneOf(ITEM_RARITIES, 'Rarity of a random item gained.'),
    relic: oneOf(RARITIES, 'Rarity of a random relic gained.'),
    loseItem: bool('Lose a random unequipped item.'),
    memberStatMods: statMods(MOD_STATS, 'Permanent stat bonus for one random member ({name} in resultText).'),
    battle: oneOf(['normal', 'elite'], 'Fight before moving on.'),
}, 'What a choice does.');

const CHOICE = obj({
    label: str('Button text.', { required: true }),
    requires: obj({
        gold: num('At least this much gold.'),
        items: num('At least this many unequipped items.'),
        classes: list(ref('job', ''), 'Someone in the party is one of these classes, or promoted from one. They are {name}, and get any memberStatMods.'),
    }, 'The choice is disabled unless met.'),
    effect: EFFECT,
    resultText: str('Text after choosing. May use {name}, {item} and {relic}.'),
    outcomes: list(obj({ weight: num('Relative chance.', { required: true }), effect: EFFECT, resultText: str('Text for this outcome.') }, ''), 'One is rolled instead of effect/resultText.'),
}, '');

const EVENT = {
    id: str('Unique id.', { required: true }),
    title: str('Heading.', { required: true }),
    text: str('What the party finds.', { required: true }),
    choices: list(CHOICE, '1 to 3 choices.', { required: true }),
    acts: list(oneOf([1, 2, 3, 4], ''), 'Acts it can appear in. Default: all.'),
    chains: list(ref('chain', ''), 'General events: realm chains it fits (for road events). Default: all.'),
    realms: list(ref('realm', ''), 'Realm events: the realms it appears in. Set automatically for events in a realm file.'),
};

const ROSTER_ENTRY = obj({
    job: ref('job', 'How the unit fights.', { required: true }),
    name: str('Display name.', { required: true }),
    sprite: ref('sprite', 'Sprite in place of the job\'s (dresses the job as a realm creature).'),
    tint: { type: 'color', desc: 'CSS color multiplied over the sprite.' },
    ct: num('Opening turn gauge.'),
    level: num('Level, for player-class enemies.'),
    statMods: statMods(MOD_STATS, 'Stat changes on top of the job.'),
    extraAbilities: list(ref('ability', ''), 'Abilities on top of the job\'s.'),
}, '');

// A boss phase (tactical/triggers.js): what the boss does the first time its HP falls below `at`.
const PHASE = obj({
    at: num('HP fraction (0-1) that sets it off.', { required: true }),
    name: str('Its name, for the battle breakdown (default: the boss\'s name).'),
    say: str('Announced when it happens.', { required: true }),
    status: statusFor,
    buffs: list(buff, 'Buffs for the boss.'),
    healPct: num('The boss heals this fraction of its max HP.'),
    cleanse: bool('The boss sheds its harmful statuses.'),
    allies: obj({ status: statusFor, buffs: list(buff, ''), healPct: num('') }, 'Effects for the boss\'s conscious allies.'),
    summon: list(ROSTER_ENTRY, 'Reinforcements that appear near the boss, scaled like the roster.'),
}, '');

const ENCOUNTER = {
    id: str('Unique id.', { required: true }),
    name: str('Display name.', { required: true }),
    enemyLevel: num('Level for roster entries on player classes.', { required: true }),
    roster: list(ROSTER_ENTRY, 'Enemies in priority order: a fight takes the first N, N growing with the party. A boss is listed first.', { required: true }),
    map: ref('map', 'A fixed battle map; otherwise one of the realm\'s maps.'),
    easy: bool('Gentle enough for a run\'s opening fights.'),
    scouting: str('Bosses: what the Scout\'s Report says about the fight.'),
    phases: list(PHASE, 'Bosses: what the boss (the first roster entry) does as its HP falls.'),
};

const REALM = {
    id: str('Unique id.', { required: true }),
    name: str('Display name.', { required: true }),
    blurb: str('One or two sentences shown when the act starts.', { required: true }),
    chain: ref('chain', 'Set from the chain the realm is listed in.'),
    tier: num('Set from its place in the chain (1-3).'),
    look: obj({
        sky: { type: 'color', desc: 'Battle view background.' },
        mapBg: { type: 'color', desc: 'Act map background.' },
        blocks: { type: 'any', desc: 'Material swaps: material → material, or [[material, weight], ...].' },
    }, 'How battle maps look in the realm.'),
    maps: list(ref('map', ''), 'Battle maps its fights pick from.', { required: true }),
    bosses: list(ref('encounter', ''), 'The bosses its act can end with.'),
    draws: list(ref('realm', ''), 'Act realms: other realms whose fights and events it also fields, retuned for its act. Order matters for seeded runs.'),
    writtenFor: oneOf([1, 2, 3, 4], 'The act its own fights were written for, when that is earlier than the act it is fought in. They move to the later act\'s levels.'),
    retuneBias: map(Object.keys(ENCOUNTER_KINDS), num(''), 'When folded into another realm, its fights of a kind are retuned to this times the usual power.'),
};

export const SCHEMAS = { ability: ABILITY, job: JOB, item: ITEM, relic: RELIC, affix: AFFIX, event: EVENT, encounter: ENCOUNTER, realm: REALM };
