import { JOB_STATS, ABILITIES, BASE_CRIT, BASE_MP_REGEN } from './data-registry.js';
import { buildLoadout, scaledLoadout, isPartyMember, levelStatMods } from './loadout.js';
import { viewState } from './view-state.js';

let _nextId = 1;

// Re-export for callers that import JOB_STATS from this module.
export { JOB_STATS };

// `loadout` (from buildLoadout) replaces the job's fixed ability list for party
// members. Enemy jobs fight with JOB_STATS[job].abilities. A player job with no
// loadout (e.g. an enemy roster entry) gets scaledLoadout(job, level): what a
// player could have learned by that job level, so encounter difficulty decides
// which spells it has.
// z is the elevation of the cell the unit stands on. Left null, the battle settles it from
// the map (the column's standing cell).
// spriteKey replaces the job's sprite (encounter roster entries dress a job as a realm creature),
// and tint (a CSS color) multiplies it, to set a unit apart from others sharing its sprite.
export function createUnit(name, job, team, x, y, { statMods = {}, extraAbilities = [], ct = 0, appearance = null, loadout = null, level = 1, z = null, spriteKey = null, tint = null } = {}) {
    const base    = JOB_STATS[job];
    if (!loadout && !base.abilities) loadout = scaledLoadout(job, level);
    // Movement passives' extra Move adds up: the chosen one plus any from equipment.
    const moveBonus = [loadout?.movement, ...(loadout?.bonusPassives ?? [])]
        .filter((k, i, arr) => k && arr.indexOf(k) === i && ABILITIES[k]?.slot === 'movement')
        .reduce((s, k) => s + (ABILITIES[k].moveBonus ?? 0), 0);
    const mod = (key) => statMods[key] ?? 0;
    const maxHp = base.maxHp + mod('maxHp');
    const maxMp = base.maxMp + mod('maxMp');
    return {
        id: _nextId++,
        name,
        job,
        team,
        x, y, z,
        hp: maxHp,
        maxHp,
        mp: maxMp,
        maxMp,
        spd:  base.spd  + mod('spd'),
        atk:  base.atk  + mod('atk'),
        def:  base.def  + mod('def'),
        mat:  base.mat  + mod('mat'),
        mdf:  base.mdf  + mod('mdf'),
        move: base.move + mod('move') + moveBonus,
        eva:  base.eva  + mod('eva'),
        // Critical hit chance in percent (see critChance in abilities.js).
        crit: (base.crit ?? BASE_CRIT) + mod('crit'),
        // MP recovered at the start of each turn (battle.js startTurn). Gear can raise it.
        mpRegen: maxMp > 0 ? Math.max(0, BASE_MP_REGEN + mod('mpRegen')) : 0,
        ct,
        char: base.char,
        color: base.color,
        spriteKey: spriteKey ?? base.spriteKey,
        tint,
        abilities: [...(loadout ? loadout.abilities : base.abilities), ...extraAbilities],
        skillsets: loadout?.skillsets ?? null,
        reaction:  loadout?.reaction ?? null,
        support:   loadout?.support  ?? null,
        movement:  loadout?.movement ?? null,
        // Passives granted by equipment, active on top of the chosen slots, and an enemy
        // job's own (its `passives`: e.g. a Shieldbearer's Interpose).
        bonusPassives: [...(loadout?.bonusPassives ?? []), ...(base.passives ?? [])],
        // An enemy job's `battleStart` statuses (e.g. a Prism Golem's Reflect).
        status: (base.battleStart ?? []).map(s => s.status),
        statusTimers: Object.fromEntries((base.battleStart ?? []).map(s => [s.status, s.duration ?? 99])),
        buffs: [],
        facing: 'south',
        appearance,
    };
}

// Build a unit directly from a CHARACTER_DATA / party entry. Party members (entries
// with a learned list) fight with their equipped loadout and grow with their level.
export function createUnitFromCharData(charData) {
    const member = isPartyMember(charData);
    const loadout = member ? buildLoadout(charData) : null;
    const statMods = { ...(charData.statMods ?? {}) };
    if (member) for (const [k, v] of Object.entries(levelStatMods(charData.level))) statMods[k] = (statMods[k] || 0) + v;
    const unit = createUnit(charData.name, charData.job, charData.team, charData.x, charData.y, {
        statMods,
        extraAbilities: loadout ? [] : (charData.extraAbilities ?? []),
        ct:             charData.ct         ?? 0,
        appearance:     charData.appearance ?? null,
        loadout,
        level:          charData.level      ?? 1,
        spriteKey:      charData.spriteKey  ?? null,
        tint:           charData.tint       ?? null,
    });
    return unit;
}

export function isDead(unit) { return unit.status.includes('dead'); }
export function isUnconscious(unit) { return unit.status.includes('unconscious'); }
export function isAlive(unit) { return !unit.status.includes('dead'); }
export function isConscious(unit) { return !unit.status.includes('dead') && !unit.status.includes('unconscious'); }
export function isStunned(unit) { return unit.status.includes('stun'); }

// Cardinal facing for a grid offset, or null for no offset.
export function facingForStep(dx, dy) {
    if (dx === 0 && dy === 0) return null;
    return Math.abs(dx) >= Math.abs(dy)
        ? (dx > 0 ? 'east' : 'west')
        : (dy > 0 ? 'south' : 'north');
}

export function faceToward(unit, tx, ty) {
    const dx = tx - unit.x;
    const dy = ty - unit.y;
    const ax = Math.abs(dx);
    const ay = Math.abs(dy);
    const newFacing = ax >= ay
        ? (dx >= 0 ? 'east' : 'west')
        : (dy >= 0 ? 'south' : 'north');
    setFacing(unit, newFacing);
}

export function setFacing(unit, newFacing) {
    if (unit.facing === newFacing) return;
    const vs = viewState(unit);
    vs.prevFacing     = unit.facing || newFacing;
    vs.facingChangeAt = performance.now();
    unit.facing       = newFacing;
}
