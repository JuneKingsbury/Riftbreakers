import { JOB_STATS, masteryStatBonus } from './data-registry.js';

let _nextId = 1;

// Re-export for callers that import JOB_STATS from this module.
export { JOB_STATS };

export function createUnit(name, job, team, x, y, { statMods = {}, extraAbilities = [], ct = 0, appearance = null, xpMap = null } = {}) {
    const base    = JOB_STATS[job];
    const mastery = xpMap ? masteryStatBonus(xpMap) : {};
    const mod = (key) => (statMods[key] ?? 0) + (mastery[key] ?? 0);
    const maxHp = base.maxHp + mod('maxHp');
    const maxMp = base.maxMp + mod('maxMp');
    return {
        id: _nextId++,
        name,
        job,
        team,
        x, y,
        hp: maxHp,
        maxHp,
        mp: maxMp,
        maxMp,
        spd:  base.spd  + mod('spd'),
        atk:  base.atk  + mod('atk'),
        def:  base.def  + mod('def'),
        mat:  base.mat  + mod('mat'),
        mdf:  base.mdf  + mod('mdf'),
        move: base.move + mod('move'),
        eva:  base.eva  + mod('eva'),
        ct,
        char: base.char,
        color: base.color,
        spriteKey: base.spriteKey,
        abilities: [...base.abilities, ...extraAbilities],
        status: [],
        statusTimers: {},
        buffs: [],
        facing: 'south',
        _floats: [],
        appearance,
    };
}

// Build a unit directly from a CHARACTER_DATA entry.
export function createUnitFromCharData(charData) {
    const extra = [...(charData.extraAbilities ?? [])];
    if (charData.supportSkill)   extra.push(charData.supportSkill);
    if (charData.supportPassive) extra.push(charData.supportPassive);
    return createUnit(charData.name, charData.job, charData.team, charData.x, charData.y, {
        statMods:       charData.statMods   ?? {},
        extraAbilities: extra,
        ct:             charData.ct         ?? 0,
        appearance:     charData.appearance ?? null,
        xpMap:          charData.xp         ?? null,
    });
}

export function isDead(unit) { return unit.status.includes('dead'); }
export function isUnconscious(unit) { return unit.status.includes('unconscious'); }
export function isAlive(unit) { return !unit.status.includes('dead'); }
export function isConscious(unit) { return !unit.status.includes('dead') && !unit.status.includes('unconscious'); }
export function isStunned(unit) { return unit.status.includes('stun'); }

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
    unit._prevFacing     = unit.facing || newFacing;
    unit._facingChangeAt = performance.now();
    unit.facing          = newFacing;
}
