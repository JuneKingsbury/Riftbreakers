import { hasLineOfSight, MAX_CLIMB, settleZ, unitCell, stepNeighbors, columnCells, cellsNear, posKey, parseKey } from './battle-map.js';
import { faceToward, isUnconscious, isDead } from './units.js';
import { ABILITIES, JOB_STATS, BASE_CRIT } from './data-registry.js';
import { moveEntity } from '../systems/movement-lerp.js';
import { NEGATIVE_STATUSES, POSITIVE_STATUSES } from '../content/vocab.js';

// Re-export so callers that import ABILITIES from this module keep working.
export { ABILITIES };

// Returns the effective value of a stat after applying active buffs/debuffs.
export function getEffectiveStat(unit, stat) {
    let val = unit[stat];
    for (const b of (unit.buffs || [])) {
        if (b.stat === stat) val += b.value;
    }
    return val;
}

// A unit's passive abilities of one slot kind ('reaction' | 'support' | 'movement'): the
// one chosen for the slot, then any its equipment grants on top (unit.bonusPassives).
// The same skill from both counts once, at the chosen (possibly upgraded) rank.
export function passivesOf(unit, slot) {
    const out = [];
    const chosen = unit?.[slot];
    if (chosen && ABILITIES[chosen]) out.push(chosen);
    for (const k of unit?.bonusPassives || []) {
        const base = k.split('@')[0];
        if (ABILITIES[k]?.slot === slot && !out.some(o => o.split('@')[0] === base)) out.push(k);
    }
    return out;
}

// Supports with an MP upkeep switch off while the unit is out of MP.
export function activeSupports(unit) {
    return passivesOf(unit, 'support').filter(k => !(ABILITIES[k].passiveMpCost > 0 && unit.mp <= 0));
}

const MULT_FIELDS = ['xpMult', 'chargeMult', 'highGroundMult', 'aoeDmgMult', 'healMult', 'drainMult'];
const ADD_FIELDS = ['evaBonus', 'statusDurationBonus', 'turnRegenHp', 'passiveMpCost', 'matToPhysical', 'summonBoost', 'mpOnFall', 'lifestealFrac'];
const MAP_FIELDS = ['dmgDealt', 'dmgTaken', 'lowHpDmgDealt'];

// Several supports combined into one profile: multipliers multiply, bonuses add,
// immunities pool, and flags hold if any support sets them.
function mergeSupports(abs) {
    const out = { name: abs.map(a => a.name).join(' + '), slot: 'support' };
    for (const ab of abs) {
        for (const f of MULT_FIELDS) if (ab[f] != null) out[f] = (out[f] ?? 1) * ab[f];
        for (const f of ADD_FIELDS) if (ab[f] != null) out[f] = (out[f] ?? 0) + ab[f];
        for (const f of MAP_FIELDS) {
            if (!ab[f]) continue;
            out[f] = { ...(out[f] || {}) };
            for (const [k, v] of Object.entries(ab[f])) out[f][k] = (out[f][k] ?? 1) * v;
        }
        if (ab.mdfPierce != null) out.mdfPierce = Math.max(out.mdfPierce ?? 0, ab.mdfPierce);
        if (ab.statusImmune) out.statusImmune = [...new Set([...(out.statusImmune || []), ...ab.statusImmune])];
        if (ab.ignoreEvasion) out.ignoreEvasion = true;
        if (ab.evasionPierce != null) out.evasionPierce = Math.max(out.evasionPierce ?? 0, ab.evasionPierce);
        if (ab.surviveLethal) out.surviveLethal = true;
        if (ab.attackProc && !out.attackProc) out.attackProc = ab.attackProc;
        if (ab.precise) out.precise = true;
        if (ab.partyStartCt != null) out.partyStartCt = Math.max(out.partyStartCt ?? 0, ab.partyStartCt);
        if (ab.turnAlliesBuff) out.turnAlliesBuff = [...(out.turnAlliesBuff || []), ...ab.turnAlliesBuff];
    }
    return out;
}

// The unit's support effects (its chosen support plus any from equipment), or null.
export function supportOf(unit) {
    if (!unit) return null;
    const keys = activeSupports(unit);
    if (keys.length === 0) return null;
    if (keys.length === 1) return ABILITIES[keys[0]];
    return mergeSupports(keys.map(k => ABILITIES[k]));
}

// Returns true if this support ability is equipped (chosen or from gear) and active on the unit.
export function passiveActive(unit, key) {
    return activeSupports(unit).some(k => k.split('@')[0] === key.split('@')[0]);
}

// taunted: must attack the unit that taunted it (unit._tauntedBy). hidden: enemies can't pick
// the unit as a target until it acts.
// Harmful and helpful statuses are listed, with what each does, in content/vocab.js.
export { NEGATIVE_STATUSES, POSITIVE_STATUSES };

// Highest a speed gauge can be pushed by an order (Rally and the like).
const CT_GAIN_CAP = 150;

/**
 * Whether an ability resolving for `source` reaches `unit` (inside its area). 'ally' and
 * 'enemy' abilities only touch that side; 'all' touches both (an Alchemist's splash), unless
 * the source has a precise support (Steady Hands): then helpful splashes skip enemies and
 * harmful ones skip allies. Shared by the battle and the AI's estimates.
 */
export function abilityAffects(source, ab, unit) {
    const same = unit.team === source.team;
    if (ab.targetType === 'ally') return same;
    if (ab.targetType === 'enemy') return !same;
    if (ab.targetType === 'all' && supportOf(source)?.precise) return isHelpful(ab) ? same : !same;
    return true;
}

/**
 * Whether `ab` used by `source` actually lands on `unit`: abilityAffects' team rule, and a
 * harmful ability passes over knocked-out units (finishing a body is for corpse rites).
 * Helpful ones still reach them, so a heal can revive.
 */
export function abilityStrikes(source, ab, unit) {
    if (!abilityAffects(source, ab, unit)) return false;
    return !isUnconscious(unit) || isHelpful(ab);
}

/** True for abilities that help whoever they reach: heals, cures, boons, a faster gauge. */
export function isHelpful(ab) {
    if (ab.isHeal || ab.isCure) return true;
    if (ab.basePower > 0) return false;
    if (ab.applyStatus) return POSITIVE_STATUSES.includes(ab.applyStatus);
    if (ab.ctGain != null) return ab.ctGain > 0;
    return !!ab.buffs?.every(b => b.value > 0);
}

// Trades two units' places (Reposition), sliding both.
function swapPlaces(a, b) {
    const pa = { x: a.x, y: a.y, z: a.z }, pb = { x: b.x, y: b.y, z: b.z };
    moveEntity(a, pb.x, pb.y, 220, pb.z);
    moveEntity(b, pa.x, pa.y, 220, pa.z);
}

// Inflict a timed status, honouring the target's immunities and the source's
// duration bonus, and apply its stat side effects. If already present, the
// longer duration wins. Returns true if the status was applied or refreshed.
export function inflictStatus(target, status, duration, source = null) {
    if (supportOf(target)?.statusImmune?.includes(status)) return false;
    const dur = duration + (supportOf(source)?.statusDurationBonus ?? 0);
    target.statusTimers = target.statusTimers || {};
    const fresh = !target.status.includes(status);
    if (!fresh && dur <= (target.statusTimers[status] ?? 0)) return false;
    if (fresh) target.status.push(status);
    target.statusTimers[status] = dur;
    if (status === 'taunted' && source) target._tauntedBy = source.id;
    // Who applied it, so damage over time (poison, doom) is credited in the battle's stats.
    if (source) (target._statusBy ??= {})[status] = source.id;
    if (fresh && status === 'enfeebled') {
        target.buffs = target.buffs || [];
        target.buffs.push({ key: 'enfeebled', stat: 'atk', value: -5, duration: dur });
    }
    if (fresh && status === 'frog') {
        target.buffs = target.buffs || [];
        target.buffs.push({ key: 'frog_atk', stat: 'atk', value: -Math.round(target.atk * 0.6), duration: null });
        target.buffs.push({ key: 'frog_mat', stat: 'mat', value: -Math.round(target.mat * 0.6), duration: null });
        target.buffs.push({ key: 'frog_def', stat: 'def', value: -Math.round(target.def * 0.5), duration: null });
    }
    return true;
}

// Remove every harmful status (and frog's stat penalties). Returns the removed statuses.
export function cleanseStatuses(unit) {
    const removed = unit.status.filter(s => NEGATIVE_STATUSES.includes(s));
    unit.status = unit.status.filter(s => !NEGATIVE_STATUSES.includes(s));
    for (const s of removed) delete (unit.statusTimers || {})[s];
    if (removed.includes('frog')) unit.buffs = (unit.buffs || []).filter(b => !b.key.startsWith('frog_'));
    if (removed.includes('enfeebled')) unit.buffs = (unit.buffs || []).filter(b => b.key !== 'enfeebled');
    return removed;
}

function applyBuffs(target, ab, abKey) {
    target.buffs = target.buffs || [];
    for (const b of ab.buffs) target.buffs.push({ key: abKey, ...b });
}

// Movement effects for pathfinding, from every movement passive the unit has. moveBonus is
// already folded into unit.move.
export function moveProfile(unit) {
    const abs = passivesOf(unit, 'movement').map(k => ABILITIES[k]);
    return {
        climb:            abs.some(a => a.ignoreClimb) ? Infinity : MAX_CLIMB + abs.reduce((s, a) => s + (a.climbBonus || 0), 0),
        ignoreTerrainCost: abs.some(a => a.ignoreTerrainCost),
        passThroughUnits:  abs.some(a => a.passThroughUnits),
    };
}

// ---- Dodging and critical hits ----
// Dodging: physical attacks only. EVA is a percent chance, halved from the side and lost
// entirely from behind; Defend and evasion passives add to it. However it is stacked, it
// never goes past MAX_DODGE, so nobody is unhittable.
export const MAX_DODGE = 0.6;
// Critical hits: any damaging skill, physical or magic. Every unit has CRIT (a percent chance,
// 5 to start, raised by some gear); a critical hit deals CRIT_MULT damage. The chance never
// goes past MAX_CRIT.
export { BASE_CRIT };
export const CRIT_MULT = 1.5;
export const MAX_CRIT = 0.4;

/** The chance a physical attack from `source` misses `target` (0 for a spell or an undodgeable skill). */
export function dodgeChance(source, target, ab) {
    if (!ab || ab.type !== 'physical') return 0;
    if (supportOf(source)?.ignoreEvasion || ab.ignoreEvasion || ab.noEvade) return 0;
    const eva = ((getEffectiveStat(target, 'eva') || 0) / 100) * directionEvasionMod(source, target)
        + (supportOf(target)?.evaBonus ?? 0)
        + (target.status.includes('defend') ? 0.2 : 0);
    // Concentrate and the like: much harder to dodge, but never certain to land.
    const pierce = Math.min(1, supportOf(source)?.evasionPierce ?? 0);
    return Math.max(0, Math.min(MAX_DODGE, eva) * (1 - pierce));
}

/** The chance a damaging skill from `source` lands as a critical hit. */
export function critChance(source, ab) {
    if (!ab?.basePower || ab.isHeal || ab.isCure) return 0;
    return Math.max(0, Math.min(MAX_CRIT, (getEffectiveStat(source, 'crit') ?? BASE_CRIT) / 100));
}

// ---- Summon limits ----
// A summon with summonLimit can't be cast while the caster already has that many of its
// creatures standing (e.g. one wolf at a time). Summoners keep their creatures in
// unit.summoned[summonJob]; battle.js adds to it when a summon appears.
export function standingSummons(unit, summonJob) {
    return (unit.summoned?.[summonJob] ?? []).filter(u => !isDead(u) && !isUnconscious(u) && u.hp > 0);
}

export function summonCapped(unit, key) {
    const ab = ABILITIES[key];
    return !!ab?.isSummon && ab.summonLimit != null && standingSummons(unit, ab.summonJob).length >= ab.summonLimit;
}

export function directionEvasionMod(attacker, target) {
    const dx = attacker.x - target.x;
    const dy = attacker.y - target.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const ax = dx / len, ay = dy / len;
    const vecs = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] };
    const [fx, fy] = vecs[target.facing] || [0, 1];
    const dot = ax * fx + ay * fy;
    if (dot > 0.5) return 1.0;
    if (dot > -0.5) return 0.5;
    return 0.0;
}

// Movement works on cells (battle-map.js): keys are "x,y,z" and steps carry z, so a unit
// under a bridge and one on top of it are in different places.
// Cells a unit may walk through but not stop on: its own side's copies (Mirror Image). A copy
// stands still forever, and must not wall its allies into a corridor.
function passableCells(unit, allUnits) {
    return new Set(allUnits.filter(u => u !== unit && !isDead(u) && u.team === unit.team && JOB_STATS[u.job]?.inert).map(posKey));
}

export function computeMoveRange(unit, map, allUnits) {
    settleZ(map, [unit, ...allUnits]);
    // Block cells occupied by living units (including unconscious ones, who still occupy space).
    const blocked = new Set(allUnits.filter(u => u !== unit && !isDead(u)).map(posKey));
    const through = passableCells(unit, allUnits);
    const prof = moveProfile(unit);
    const reachable = new Set();
    const start = unitCell(map, unit);
    if (!start) return reachable;
    const startKey = posKey(start);
    const queue = [{ cell: start, budget: unit.move }];
    const visited = new Map([[startKey, unit.move]]);

    while (queue.length > 0) {
        const { cell, budget } = queue.shift();
        const here = posKey(cell);
        // Pass-through movers can cross occupied tiles but never stop on them.
        if (here !== startKey && !blocked.has(here)) reachable.add(here);

        for (const n of stepNeighbors(map, cell, prof.climb)) {
            const key = posKey(n);
            if (!prof.passThroughUnits && blocked.has(key) && !through.has(key)) continue;
            const remaining = budget - (prof.ignoreTerrainCost ? 1 : n.moveCost);
            if (remaining < 0) continue;
            if ((visited.get(key) ?? -1) >= remaining) continue;
            visited.set(key, remaining);
            queue.push({ cell: n, budget: remaining });
        }
    }
    return reachable;
}

// Returns an ordered array of {x,y,z} steps from unit's current position to the destination,
// not including the start tile. Uses BFS with parent pointers to reconstruct the path.
// destZ picks the level in that column; left out, the first level reached is used.
// Returns null if the destination is not reachable within move budget.
export function computeMovePath(unit, map, allUnits, destX, destY, destZ = null) {
    settleZ(map, [unit, ...allUnits]);
    const blocked = new Set(allUnits.filter(u => u !== unit && !isDead(u)).map(posKey));
    const through = passableCells(unit, allUnits);
    const prof    = moveProfile(unit);
    const start   = unitCell(map, unit);
    if (!start) return null;
    const startKey = posKey(start);
    const parent  = new Map([[startKey, null]]);
    const cellOf  = new Map([[startKey, start]]);
    const queue   = [{ cell: start, budget: unit.move }];
    const visited = new Map([[startKey, unit.move]]);

    const isDest = c => c.x === destX && c.y === destY && (destZ === null || destZ === undefined || c.z === destZ);
    let found = null;

    outer: while (queue.length > 0) {
        const { cell, budget } = queue.shift();
        const here = posKey(cell);
        for (const n of stepNeighbors(map, cell, prof.climb)) {
            const key = posKey(n);
            if (blocked.has(key) && (isDest(n) || (!prof.passThroughUnits && !through.has(key)))) continue;
            const remaining = budget - (prof.ignoreTerrainCost ? 1 : n.moveCost);
            if (remaining < 0) continue;
            if ((visited.get(key) ?? -1) >= remaining) continue;
            visited.set(key, remaining);
            parent.set(key, here);
            cellOf.set(key, n);
            if (isDest(n)) { found = key; break outer; }
            queue.push({ cell: n, budget: remaining });
        }
    }

    if (!found) return null;

    // Trace back from dest to start.
    const steps = [];
    let cur = found;
    while (cur && cur !== startKey) {
        const c = cellOf.get(cur);
        steps.unshift({ x: c.x, y: c.y, z: c.z });
        cur = parent.get(cur);
    }
    return steps;
}

// Cells within Manhattan range of any of the origin cells (keys), every level of each column.
export function computeAttackRange(fromTiles, range, includeStart = false, requiresLos = false, map) {
    const result = new Set();
    for (const key of fromTiles) {
        const origin = parseKey(key);
        if (includeStart) result.add(key);
        for (let dx = -range; dx <= range; dx++) {
            for (let dy = -range; dy <= range; dy++) {
                if (dx === 0 && dy === 0) continue;
                if (Math.abs(dx) + Math.abs(dy) > range) continue;
                for (const c of columnCells(map, origin.x + dx, origin.y + dy)) {
                    if (requiresLos && !hasLineOfSight(map, origin, c)) continue;
                    result.add(posKey(c));
                }
            }
        }
    }
    return result;
}

// Cells hit by a shaped pattern around a centre cell ({x,y,z}), rotated in quarter turns.
export function computePatternArea(map, center, pattern, rotation) {
    const columns = [];
    for (const [dx, dy] of pattern) {
        let rx, ry;
        switch (rotation % 4) {
            case 1:  rx =  dy; ry = -dx; break;
            case 2:  rx = -dx; ry = -dy; break;
            case 3:  rx = -dy; ry =  dx; break;
            default: rx =  dx; ry =  dy; break;
        }
        columns.push([center.x + rx, center.y + ry]);
    }
    return cellsNear(map, columns, center.z);
}

// Cells within a Manhattan radius of a centre cell ({x,y,z}) and near its height.
export function computeAoeArea(map, center, aoe) {
    const columns = [];
    for (let dx = -aoe; dx <= aoe; dx++) {
        for (let dy = -aoe; dy <= aoe; dy++) {
            if (Math.abs(dx) + Math.abs(dy) <= aoe) columns.push([center.x + dx, center.y + dy]);
        }
    }
    return cellsNear(map, columns, center.z);
}

/**
 * Resolves `ability` from `source` on `target`, changing their HP and statuses, and returns
 * what happened. Besides the result's own fields (damage and healing as rolled, before
 * clamping to HP), it reports the HP each side actually lost or gained, for the battle's
 * stats: targetHpChange and sourceHpChange (negative is HP lost). A reflected spell shows
 * up as a change to the source, a drain as a gain for it.
 */
export function resolveAbility(source, target, ability, map) {
    const targetBefore = target.hp, sourceBefore = source.hp;
    const result = resolveAbilityCore(source, target, ability, map);
    result.targetHpChange = target.hp - targetBefore;
    result.sourceHpChange = source === target ? 0 : source.hp - sourceBefore;
    return result;
}

function resolveAbilityCore(source, target, ability, map) {
    const ab = ABILITIES[ability];
    if (!ab) return { damage: 0, healing: 0, statusApplied: null };

    // silence: magic abilities cannot be cast by silenced units
    if (ab.type === 'magic' && source.status.includes('silence')) {
        faceToward(source, target.x, target.y);
        return { damage: 0, healing: 0, statusApplied: null, missed: true, silenced: true };
    }

    const srcSup = supportOf(source);
    const tgtSup = supportOf(target);

    // Orders (Rally, Delay, Reposition, Stimulant): move speed gauges or swap places, plus any
    // status or buffs they carry. They always land.
    if (!ab.basePower && !ab.isHeal && !ab.isCure && (ab.ctGain != null || ab.swapPlaces)) {
        if (ab.ctGain) target.ct = Math.max(0, Math.min(CT_GAIN_CAP, (target.ct ?? 0) + ab.ctGain));
        if (ab.swapPlaces && target !== source) swapPlaces(source, target);
        let statusApplied = null;
        if (ab.applyStatus && inflictStatus(target, ab.applyStatus, ab.statusDuration ?? 2, source)) statusApplied = ab.applyStatus;
        if (ab.buffs) applyBuffs(target, ab, ability);
        faceToward(source, target.x, target.y);
        const ctText = ab.ctGain ? `${ab.ctGain > 0 ? '+' : ''}${ab.ctGain} CT` : null;
        return { damage: 0, healing: 0, statusApplied, floatingText: ab.floatText ?? ctText, swapped: !!ab.swapPlaces };
    }

    // Buff-only abilities (Focus, Earth Skin): apply the stat changes and stop.
    if (ab.buffs && !ab.basePower && !ab.isHeal && !ab.applyStatus) {
        applyBuffs(target, ab, ability);
        faceToward(source, target.x, target.y);
        return { damage: 0, healing: 0, statusApplied: null, floatingText: ab.floatText ?? null };
    }

    // High ground: +25% normally; Earthen Footing raises its own bonus and
    // denies the bonus to anyone attacking it from above.
    let highGroundBonus = 1.0;
    if ((source.z ?? 0) > (target.z ?? 0) && !tgtSup?.highGroundMult) highGroundBonus = srcSup?.highGroundMult ?? 1.25;

    // Cures clear harmful statuses only: Haste, Protect and other boons stay.
    if (ab.isCure) {
        cleanseStatuses(target);
        faceToward(source, target.x, target.y);
        return { damage: 0, healing: 0, statusApplied: null, floatingText: 'Cured!' };
    }

    if (ab.isHeal) {
        const healing = Math.round((getEffectiveStat(source, 'mat') * 2 + 8) * ab.basePower * (srcSup?.healMult ?? 1));
        target.hp = Math.min(target.maxHp, target.hp + healing);
        // wake sleeping unit on heal
        if (target.status.includes('sleep')) {
            target.status = target.status.filter(s => s !== 'sleep');
            delete (target.statusTimers || {})[' sleep'];
        }
        let revived = false;
        if (isUnconscious(target) && target.hp > 0) {
            target.status = target.status.filter(s => s !== 'unconscious');
            revived = true;
        }
        // Elixir: the same dose cures afflictions.
        const cured = ab.alsoCure ? cleanseStatuses(target).length > 0 : false;
        faceToward(source, target.x, target.y);
        return { damage: 0, healing, statusApplied: null, revived, floatingText: cured ? 'Cured!' : null };
    }

    if (ab.isDispel) {
        target.status = target.status.filter(s => !POSITIVE_STATUSES.includes(s));
        for (const s of POSITIVE_STATUSES) delete (target.statusTimers || {})[s];
        target.buffs = (target.buffs || []).filter(b => b.value < 0);
        faceToward(source, target.x, target.y);
        return { damage: 0, healing: 0, statusApplied: null, floatingText: 'Dispelled!' };
    }

    if (ab.type === 'physical') {
        // temporal_slip: next physical attack auto-misses
        if (target.status.includes('slipped')) {
            target.status = target.status.filter(s => s !== 'slipped');
            faceToward(source, target.x, target.y);
            return { damage: 0, healing: 0, statusApplied: null, missed: true };
        }

        // Orders (noEvade) and true strikes (ignoreEvasion) can't be dodged; see dodgeChance.
        if (Math.random() < dodgeChance(source, target, ab)) {
            faceToward(source, target.x, target.y);
            return { damage: 0, healing: 0, statusApplied: null, missed: true };
        }
    }

    // reflect: magic spells bounce back to the caster
    if (ab.type === 'magic' && !ab.ignoreReflect && target.status.includes('reflect') && target.team !== source.team) {
        faceToward(source, target.x, target.y);
        return resolveAbilityCore(target, source, ability, map);
    }

    let defMult = target.status.includes('defend') ? 1.5 : 1.0;

    let raw;
    const kind = ab.type === 'physical' ? 'physical' : 'magic';
    if (kind === 'physical') {
        const atk = getEffectiveStat(source, 'atk') + (srcSup?.matToPhysical ?? 0) * getEffectiveStat(source, 'mat');
        raw = Math.max(1, atk * 2 - getEffectiveStat(target, 'def') * defMult) * ab.basePower * highGroundBonus;
        // protect status: -25% physical damage
        if (target.status.includes('protect')) raw *= 0.75;
    } else {
        const pierce = Math.min(1, (srcSup?.mdfPierce ?? 0) + (ab.mdfPierce ?? 0));
        const mdf = getEffectiveStat(target, 'mdf') * (1 - pierce);
        raw = Math.max(1, getEffectiveStat(source, 'mat') * 2 - mdf * defMult) * ab.basePower * highGroundBonus;
        // shell status: -25% magic damage
        if (target.status.includes('shell')) raw *= 0.75;
    }
    raw *= srcSup?.dmgDealt?.[kind] ?? 1;
    if (source.hp < source.maxHp * 0.5) raw *= srcSup?.lowHpDmgDealt?.[kind] ?? 1;
    if (ab.aoe > 0 || ab.aoePattern) raw *= srcSup?.aoeDmgMult ?? 1;
    raw *= tgtSup?.dmgTaken?.[kind] ?? 1;
    // Nightmare, Catalyst: extra damage against a target with the named status.
    for (const [status, mult] of Object.entries(ab.bonusVsStatus ?? {})) if (target.status.includes(status)) raw *= mult;
    raw *= source._momentumMult ?? 1;
    const crit = Math.random() < critChance(source, ab);
    if (crit) raw *= CRIT_MULT;
    const variance = 0.9 + Math.random() * 0.2;
    const damage = Math.round(raw * variance);

    // sleep: woken by any damage
    if (damage > 0 && target.status.includes('sleep')) {
        target.status = target.status.filter(s => s !== 'sleep');
        delete (target.statusTimers || {})['sleep'];
    }

    let killedInstantly = false;
    let newHp = target.hp - damage;
    if (newHp <= 0) {
        target.hp = 0;
        if (isUnconscious(target)) {
            target.status = target.status.filter(s => s !== 'unconscious');
            if (!target.status.includes('dead')) target.status.push('dead');
            killedInstantly = true;
        } else if (!isDead(target) && tgtSup?.surviveLethal && !target._providenceUsed) {
            // Providence: once per battle, a killing blow leaves the unit at 1 HP.
            target.hp = 1;
            target._providenceUsed = true;
            return { damage, crit, healing: 0, statusApplied: null, killedInstantly: false, providence: true };
        } else if (!isDead(target)) {
            // reraise: auto-revive at 1 HP when KO'd
            if (target.status.includes('reraise')) {
                target.hp = 1;
                target.status = target.status.filter(s => s !== 'reraise');
                delete (target.statusTimers || {})['reraise'];
                return { damage, crit, healing: 0, statusApplied: null, killedInstantly: false, reraise: true };
            }
            if (!target.status.includes('unconscious')) target.status.push('unconscious');
            target.deathTimer = 3;
        }
    } else {
        target.hp = newHp;
    }

    const standing = target.hp > 0 && !isDead(target) && !isUnconscious(target);
    let statusApplied = null;
    if (ab.applyStatus && standing && inflictStatus(target, ab.applyStatus, ab.statusDuration ?? 2, source)) {
        statusApplied = ab.applyStatus;
    }
    // Rune Edge and similar: physical hits may carry a status.
    const proc = srcSup?.attackProc;
    if (proc && kind === 'physical' && damage > 0 && standing && !statusApplied && Math.random() < proc.chance
        && inflictStatus(target, proc.status, proc.duration, source)) {
        statusApplied = proc.status;
    }
    if (ab.buffs && standing) applyBuffs(target, ab, ability);

    let drained = 0;
    // Lifesteal (a Vampiric leader): every damaging hit drains, on top of the ability's own drainFrac.
    const drainFrac = (ab.drainFrac ?? 0) + (srcSup?.lifestealFrac ?? 0);
    if (drainFrac > 0 && damage > 0 && source.hp > 0) {
        drained = Math.min(source.maxHp - source.hp, Math.round(damage * drainFrac * (srcSup?.drainMult ?? 1)));
        source.hp += drained;
    }

    // Exploit Opening: the attacker is back in action sooner.
    if (ab.selfCtGain) source.ct = Math.max(0, Math.min(CT_GAIN_CAP, (source.ct ?? 0) + ab.selfCtGain));

    faceToward(source, target.x, target.y);
    return { damage, crit, healing: 0, statusApplied, killedInstantly, drained };
}
