import { JOB_STATS } from './data-registry.js';

let _nextId = 1;

// Re-export for callers that import JOB_STATS from this module.
export { JOB_STATS };

export function createUnit(name, job, team, x, y, { statMods = {}, extraAbilities = [], ct = 0 } = {}) {
    const base = JOB_STATS[job];
    const maxHp = (base.maxHp + (statMods.maxHp ?? 0));
    const maxMp = (base.maxMp + (statMods.maxMp ?? 0));
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
        spd:  base.spd  + (statMods.spd  ?? 0),
        atk:  base.atk  + (statMods.atk  ?? 0),
        def:  base.def  + (statMods.def  ?? 0),
        mat:  base.mat  + (statMods.mat  ?? 0),
        mdf:  base.mdf  + (statMods.mdf  ?? 0),
        move: base.move + (statMods.move ?? 0),
        eva:  base.eva  + (statMods.eva  ?? 0),
        ct,
        char: base.char,
        color: base.color,
        spriteKey: base.spriteKey,
        abilities: [...base.abilities, ...extraAbilities],
        status: [],
        facing: 'south',
        _floats: [],
    };
}

// Build a unit directly from a CHARACTER_DATA entry.
export function createUnitFromCharData(charData) {
    return createUnit(charData.name, charData.job, charData.team, charData.x, charData.y, {
        statMods:       charData.statMods      ?? {},
        extraAbilities: charData.extraAbilities ?? [],
        ct:             charData.ct            ?? 0,
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
    if (ax >= ay) {
        unit.facing = dx >= 0 ? 'east' : 'west';
    } else {
        unit.facing = dy >= 0 ? 'south' : 'north';
    }
}
