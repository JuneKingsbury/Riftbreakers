import { JOB_STATS, ABILITIES, masteryStatBonus, jobLevel } from './data-registry.js';
import { buildLoadout, scaledLoadout } from './loadout.js';
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
export function createUnit(name, job, team, x, y, { statMods = {}, extraAbilities = [], ct = 0, appearance = null, jpMap = null, loadout = null, level = 1, z = null } = {}) {
    const base    = JOB_STATS[job];
    if (!loadout && !base.abilities) loadout = scaledLoadout(job, level);
    const mastery = jpMap ? masteryStatBonus(jpMap) : {};
    const moveBonus = ABILITIES[loadout?.movement]?.moveBonus ?? 0;
    const mod = (key) => (statMods[key] ?? 0) + (mastery[key] ?? 0);
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
        ct,
        char: base.char,
        color: base.color,
        spriteKey: base.spriteKey,
        abilities: [...(loadout ? loadout.abilities : base.abilities), ...extraAbilities],
        skillsets: loadout?.skillsets ?? null,
        reaction:  loadout?.reaction ?? null,
        support:   loadout?.support  ?? null,
        movement:  loadout?.movement ?? null,
        status: [],
        statusTimers: {},
        buffs: [],
        facing: 'south',
        appearance,
    };
}

// Build a unit directly from a CHARACTER_DATA / party entry. Entries with JP
// data are party members and fight with their equipped loadout.
export function createUnitFromCharData(charData) {
    const loadout = charData.jp ? buildLoadout(charData) : null;
    const unit = createUnit(charData.name, charData.job, charData.team, charData.x, charData.y, {
        statMods:       charData.statMods   ?? {},
        extraAbilities: loadout ? [] : (charData.extraAbilities ?? []),
        ct:             charData.ct         ?? 0,
        appearance:     charData.appearance ?? null,
        jpMap:          charData.jp         ?? null,
        loadout,
        level:          charData.level      ?? 1,
    });
    if (loadout) {
        unit.jpEligible = true;
        unit.jobLv = jobLevel(charData.jp, charData.job);
    }
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
