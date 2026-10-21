// Pure battlefield queries for the scripted-AI layer. Nothing here mutates a
// unit or the battle, and nothing animates. `units` is always the list of
// non-dead units (battle.livingUnits), `map` is the battle map.
import { computeMoveRange, computeAttackRange, computeAoeArea } from '../abilities.js';
import { ABILITIES } from '../data-registry.js';
import { hasLineOfSight, getTile, MAX_CLIMB } from '../battle-map.js';
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
export function hasBuff(unit, abilityKey) {
    return (unit.buffs || []).some(b => b.key === abilityKey);
}

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
    if (ab.targetType === 'self') return from.x === target.x && from.y === target.y;
    const d = distance(from, target);
    if (d > ab.range) return false;
    if (d === 0) return ab.targetType === 'ally';
    if (map && ab.requiresLos !== false && !hasLineOfSight(map, from.x, from.y, target.x, target.y)) return false;
    return true;
}

// Tiles the unit can stand on this turn, including where it already is.
export function reachableTiles(unit, map, units) {
    return new Set([`${unit.x},${unit.y}`, ...computeMoveRange(unit, map, units)]);
}

// Reachable tiles from which `target` is inside the ability's range.
export function tilesToUseFrom(unit, target, abilityKey, map, units) {
    const ab = ABILITIES[abilityKey];
    const result = new Set();
    if (!ab) return result;
    for (const key of reachableTiles(unit, map, units)) {
        const [x, y] = key.split(',').map(Number);
        if (inAbilityRange({ x, y }, target, abilityKey, map)) result.add(key);
    }
    return result;
}

// Units an AoE ability centred on (cx, cy) would affect, using the same team
// filter as TacticalBattle.applyEnemyAbility.
export function unitsAffected(caster, abilityKey, cx, cy, units) {
    const ab = ABILITIES[abilityKey];
    if (!ab) return [];
    const tiles = ab.aoe > 0 ? computeAoeArea(cx, cy, ab.aoe) : new Set([`${cx},${cy}`]);
    return units.filter(u => {
        const sameTeam = u.team === caster.team;
        if (ab.targetType === 'ally' && !sameTeam) return false;
        if (ab.targetType === 'enemy' && sameTeam) return false;
        return tiles.has(`${u.x},${u.y}`);
    });
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

// Walking cost from every tile to (gx, gy) over passable terrain, honouring each
// tile's moveCost and the climb limit but ignoring units (they move). Straight-line
// distance gets units stuck behind ponds and cliffs, since the way round starts by
// moving away. Returns Map<"x,y", cost>, and tiles with no route are absent.
export function walkCostField(map, gx, gy) {
    const cost = new Map([[`${gx},${gy}`, 0]]);
    let open = [{ x: gx, y: gy, c: 0 }];
    while (open.length > 0) {
        open.sort((a, b) => a.c - b.c);
        const cur = open.shift();
        if (cur.c > cost.get(`${cur.x},${cur.y}`)) continue;
        const curTile = getTile(map, cur.x, cur.y);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = cur.x + dx;
            const ny = cur.y + dy;
            const tile = getTile(map, nx, ny);
            if (!tile || !tile.passable) continue;
            if (Math.abs((tile.elevation ?? 0) - (curTile?.elevation ?? 0)) > MAX_CLIMB) continue;
            // Walking from (nx, ny) to the goal next steps onto cur, so cur's move cost applies.
            const c = cur.c + (curTile?.moveCost ?? 1);
            const key = `${nx},${ny}`;
            if (c < (cost.get(key) ?? Infinity)) {
                cost.set(key, c);
                open.push({ x: nx, y: ny, c });
            }
        }
    }
    return cost;
}

// Tiles `enemy` could hit on its next turn: everywhere it can walk, widened by
// its attack reach. Movement is computed with the current unit positions.
export function threatTiles(enemy, map, units) {
    return computeAttackRange(reachableTiles(enemy, map, units), threatRange(enemy), true);
}

// Whether any conscious enemy of `unit` could hit tile (x, y) next turn.
export function isThreatenedAt(unit, x, y, map, units) {
    const key = `${x},${y}`;
    return enemiesOf(unit, units).some(e => threatTiles(e, map, units).has(key));
}

// Expected damage and healing of an ability use (a ranking heuristic, see estimate.js).
export { estimateAbilityEffect as estimateEffect } from './estimate.js';
