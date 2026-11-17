// Pure battlefield queries for the scripted-AI layer. Nothing here mutates a
// unit or the battle, and nothing animates. `units` is always the list of
// non-dead units (battle.livingUnits), `map` is the battle map.
import { computeMoveRange, computeAttackRange, computeAoeArea, abilityAffects } from '../abilities.js';
import { ABILITIES, baseKey, ownKey } from '../data-registry.js';
import { hasLineOfSight, unitCell, stepNeighbors, posKey, parseKey, cellKey } from '../battle-map.js';
import { isConscious, isAlive } from '../units.js';

export function distance(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

// Conscious opposing units: the ones worth attacking.
export function enemiesOf(unit, units) {
    return units.filter(u => u.team !== unit.team && isConscious(u));
}

// Living teammates other than `unit`. Unconscious allies are included because
// heals revive them.
export function alliesOf(unit, units) {
    return units.filter(u => u.team === unit.team && u !== unit && isAlive(u));
}

export function hpPct(unit) {
    return unit.maxHp > 0 ? (unit.hp / unit.maxHp) * 100 : 0;
}

export function mpPct(unit) {
    return unit.maxMp > 0 ? (unit.mp / unit.maxMp) * 100 : 0;
}

export function hasStatus(unit, status) {
    return unit.status.includes(status);
}

// Whether a timed buff or debuff from this ability is currently on the unit.
// Buffs are keyed by the ability that applied them, at any rank.
export function hasBuff(unit, abilityKey) {
    const base = baseKey(abilityKey);
    return (unit.buffs || []).some(b => baseKey(b.key) === base);
}

export { ownKey };

// Lowest score wins. Ties keep the earlier candidate so results are deterministic.
export function pickMin(candidates, score) {
    let best = null;
    let bestScore = Infinity;
    for (const c of candidates) {
        const s = score(c);
        if (s < bestScore) { best = c; bestScore = s; }
    }
    return best;
}

export function nearest(from, candidates) {
    return pickMin(candidates, c => distance(from, c));
}

export function farthest(from, candidates) {
    return pickMin(candidates, c => -distance(from, c));
}

export function lowestHp(candidates) {
    return pickMin(candidates, c => c.hp);
}

export function lowestHpPct(candidates) {
    return pickMin(candidates, hpPct);
}

// True when the unit may select this ability right now: it exists, is not a
// passive, the unit can pay its MP cost, and nothing stops it casting (a
// silenced unit cannot use magic). Range is checked separately.
export function canUse(unit, abilityKey) {
    const ab = ABILITIES[abilityKey];
    if (!ab || ab.passive) return false;
    if (unit.mp < ab.mpCost) return false;
    if (ab.type === 'magic' && hasStatus(unit, 'silence')) return false;
    return !hasStatus(unit, 'charging');
}

// Abilities of the unit that it can use now, optionally filtered by a predicate on the definition.
export function usableAbilities(unit, filter = () => true) {
    return unit.abilities.filter(k => canUse(unit, k) && filter(ABILITIES[k], k));
}

// Whether `from` can use the ability on `target`, using the same rules as the
// AI and the manual game. Self-targeted abilities need no range. Ally-targeted
// ones may also hit the caster's own tile (a heal on oneself), anything else
// needs 1..range tiles. Pass the map to also require line of sight, which every
// ability needs unless it sets requiresLos: false.
export function inAbilityRange(from, target, abilityKey, map = null) {
    const ab = ABILITIES[abilityKey];
    if (!ab) return false;
    if (ab.targetType === 'self') return from.x === target.x && from.y === target.y && from.z === target.z;
    const d = distance(from, target);
    if (d > ab.range) return false;
    // Ally abilities may be used on oneself, and a splash may land at one's own feet.
    if (d === 0) return ab.targetType === 'ally' || ab.targetType === 'all';
    if (map && ab.requiresLos !== false && !hasLineOfSight(map, from, target)) return false;
    return true;
}

// Cells ("x,y,z" keys) the unit can stand on this turn, including where it already is.
export function reachableTiles(unit, map, units) {
    const range = computeMoveRange(unit, map, units);   // settles unit.z first
    return new Set([posKey(unit), ...range]);
}

// Reachable tiles from which `target` is inside the ability's range.
export function tilesToUseFrom(unit, target, abilityKey, map, units) {
    const ab = ABILITIES[abilityKey];
    const result = new Set();
    if (!ab) return result;
    for (const key of reachableTiles(unit, map, units)) {
        if (inAbilityRange(parseKey(key), target, abilityKey, map)) result.add(key);
    }
    return result;
}

// Units an AoE ability centred on `center` ({x,y,z}) would affect, using the same team
// filter as TacticalBattle.applyEnemyAbility.
export function unitsAffected(caster, abilityKey, center, units, map) {
    const ab = ABILITIES[abilityKey];
    if (!ab) return [];
    const tiles = ab.aoe > 0 ? computeAoeArea(map, center, ab.aoe) : new Set([posKey(center)]);
    return units.filter(u => tiles.has(posKey(u)) && abilityAffects(caster, ab, u));
}

// Longest range among the unit's offensive abilities (it can pay for), min 1 for a basic strike.
function threatRange(unit) {
    let range = 1;
    for (const key of unit.abilities) {
        const ab = ABILITIES[key];
        if (ab && !ab.passive && ab.targetType === 'enemy' && unit.mp >= ab.mpCost) {
            range = Math.max(range, ab.range);
        }
    }
    return range;
}

// Walking cost from every cell to `goal` ({x,y,z}) over passable terrain, honouring each
// cell's moveCost and the climb limit but ignoring units (they move). Straight-line
// distance gets units stuck behind ponds and cliffs, since the way round starts by
// moving away. Returns Map<"x,y,z", cost>, and cells with no route are absent.
export function walkCostField(map, goal) {
    const start = unitCell(map, goal);
    if (!start) return new Map();
    const cost = new Map([[posKey(start), 0]]);
    let open = [{ cell: start, c: 0 }];
    while (open.length > 0) {
        open.sort((a, b) => a.c - b.c);
        const cur = open.shift();
        if (cur.c > cost.get(posKey(cur.cell))) continue;
        for (const n of stepNeighbors(map, cur.cell)) {
            // Walking from n to the goal next steps onto cur, so cur's move cost applies.
            const c = cur.c + (cur.cell.moveCost ?? 1);
            const key = posKey(n);
            if (c < (cost.get(key) ?? Infinity)) {
                cost.set(key, c);
                open.push({ cell: n, c });
            }
        }
    }
    return cost;
}

// Tiles `enemy` could hit on its next turn: everywhere it can walk, widened by
// its attack reach. Movement is computed with the current unit positions.
export function threatTiles(enemy, map, units) {
    return computeAttackRange(reachableTiles(enemy, map, units), threatRange(enemy), true, false, map);
}

// Whether any conscious enemy of `unit` could hit cell (x, y, z) next turn.
export function isThreatenedAt(unit, x, y, z, map, units) {
    const key = cellKey(x, y, z);
    return enemiesOf(unit, units).some(e => threatTiles(e, map, units).has(key));
}

// Expected damage and healing of an ability use (a ranking heuristic, see estimate.js).
export { estimateAbilityEffect as estimateEffect } from './estimate.js';
