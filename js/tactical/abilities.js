import { getTile, hasLineOfSight, MAX_CLIMB } from './battle-map.js';
import { faceToward, isUnconscious, isDead } from './units.js';
import { ABILITIES } from './data-registry.js';

// Re-export so callers that import ABILITIES from this module keep working.
export { ABILITIES };

// Returns the effective value of a stat after applying active buffs/debuffs.
function getEffectiveStat(unit, stat) {
    let val = unit[stat];
    for (const b of (unit.buffs || [])) {
        if (b.stat === stat) val += b.value;
    }
    return val;
}

// Returns true if a passive ability is active on the unit (in abilities list and has MP).
function passiveActive(unit, key) {
    return unit.abilities.includes(key) && unit.mp > 0;
}

function directionEvasionMod(attacker, target) {
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

export function computeMoveRange(unit, map, allUnits) {
    // Block tiles occupied by living units (including unconscious ones, who still occupy space).
    const blocked = new Set(allUnits.filter(u => u !== unit && !isDead(u)).map(u => `${u.x},${u.y}`));
    const reachable = new Set();
    const queue = [{ x: unit.x, y: unit.y, budget: unit.move }];
    const visited = new Map();
    visited.set(`${unit.x},${unit.y}`, unit.move);

    while (queue.length > 0) {
        const { x, y, budget } = queue.shift();
        if (!(x === unit.x && y === unit.y)) reachable.add(`${x},${y}`);

        const neighbors = [
            { x: x - 1, y },
            { x: x + 1, y },
            { x, y: y - 1 },
            { x, y: y + 1 },
        ];
        const curTile = getTile(map, x, y);
        for (const n of neighbors) {
            const tile = getTile(map, n.x, n.y);
            if (!tile || !tile.passable) continue;
            if (blocked.has(`${n.x},${n.y}`)) continue;
            if (Math.abs((tile.elevation ?? 0) - (curTile?.elevation ?? 0)) > MAX_CLIMB) continue;
            const remaining = budget - tile.moveCost;
            if (remaining < 0) continue;
            const key = `${n.x},${n.y}`;
            if ((visited.get(key) ?? -1) >= remaining) continue;
            visited.set(key, remaining);
            queue.push({ x: n.x, y: n.y, budget: remaining });
        }
    }
    return reachable;
}

// Returns an ordered array of {x,y} steps from unit's current position to (destX,destY),
// not including the start tile. Uses BFS with parent pointers to reconstruct the path.
// Returns null if the destination is not reachable within move budget.
export function computeMovePath(unit, map, allUnits, destX, destY) {
    const blocked = new Set(allUnits.filter(u => u !== unit && !isDead(u)).map(u => `${u.x},${u.y}`));
    const parent  = new Map();
    const queue   = [{ x: unit.x, y: unit.y, budget: unit.move }];
    const visited = new Map();
    const startKey = `${unit.x},${unit.y}`;
    visited.set(startKey, unit.move);
    parent.set(startKey, null);

    const destKey = `${destX},${destY}`;
    let found = false;

    outer: while (queue.length > 0) {
        const { x, y, budget } = queue.shift();
        const curTile = getTile(map, x, y);
        const neighbors = [
            { x: x - 1, y },
            { x: x + 1, y },
            { x, y: y - 1 },
            { x, y: y + 1 },
        ];
        for (const n of neighbors) {
            const tile = getTile(map, n.x, n.y);
            if (!tile || !tile.passable) continue;
            if (blocked.has(`${n.x},${n.y}`)) continue;
            if (Math.abs((tile.elevation ?? 0) - (curTile?.elevation ?? 0)) > MAX_CLIMB) continue;
            const remaining = budget - tile.moveCost;
            if (remaining < 0) continue;
            const key = `${n.x},${n.y}`;
            if ((visited.get(key) ?? -1) >= remaining) continue;
            visited.set(key, remaining);
            parent.set(key, `${x},${y}`);
            if (key === destKey) { found = true; break outer; }
            queue.push({ x: n.x, y: n.y, budget: remaining });
        }
    }

    if (!found) return null;

    // Trace back from dest to start.
    const steps = [];
    let cur = destKey;
    while (cur && cur !== startKey) {
        const [cx, cy] = cur.split(',').map(Number);
        steps.unshift({ x: cx, y: cy });
        cur = parent.get(cur);
    }
    return steps;
}

export function computeAttackRange(fromTiles, range, includeStart = false, requiresLos = false, map = null) {
    const result = new Set();
    for (const key of fromTiles) {
        const [ox, oy] = key.split(',').map(Number);
        for (let dx = -range; dx <= range; dx++) {
            for (let dy = -range; dy <= range; dy++) {
                if (!includeStart && dx === 0 && dy === 0) continue;
                if (Math.abs(dx) + Math.abs(dy) > range) continue;
                if (requiresLos && map && !hasLineOfSight(map, ox, oy, ox + dx, oy + dy)) continue;
                result.add(`${ox + dx},${oy + dy}`);
            }
        }
    }
    return result;
}

export function computePatternArea(cx, cy, pattern, rotation) {
    const result = new Set();
    for (const [dx, dy] of pattern) {
        let rx, ry;
        switch (rotation % 4) {
            case 1:  rx =  dy; ry = -dx; break;
            case 2:  rx = -dx; ry = -dy; break;
            case 3:  rx = -dy; ry =  dx; break;
            default: rx =  dx; ry =  dy; break;
        }
        result.add(`${cx + rx},${cy + ry}`);
    }
    return result;
}

export function computeAoeArea(cx, cy, aoe) {
    const result = new Set();
    for (let dx = -aoe; dx <= aoe; dx++) {
        for (let dy = -aoe; dy <= aoe; dy++) {
            if (Math.abs(dx) + Math.abs(dy) <= aoe) result.add(`${cx + dx},${cy + dy}`);
        }
    }
    return result;
}

export function resolveAbility(source, target, ability, map) {
    const ab = ABILITIES[ability];
    if (!ab) return { damage: 0, healing: 0, statusApplied: null };

    // --- earth_skin: self DEF buff ---
    if (ability === 'earth_skin') {
        source.buffs = source.buffs || [];
        source.buffs.push({ key: 'earth_skin', stat: 'def', value: 8, duration: 2 });
        faceToward(source, source.x, source.y);
        return { damage: 0, healing: 0, statusApplied: null, floatingText: 'DEF UP!' };
    }

    const srcTile = getTile(map, source.x, source.y);
    const tgtTile = getTile(map, target.x, target.y);
    const highGroundBonus = (srcTile && tgtTile && srcTile.elevation > tgtTile.elevation) ? 1.25 : 1.0;

    if (ab.isCure) {
        target.status = [];
        faceToward(source, target.x, target.y);
        return { damage: 0, healing: 0, statusApplied: null, floatingText: 'Cured!' };
    }

    if (ab.isHeal) {
        const healing = Math.round((getEffectiveStat(source, 'mat') * 2 + 8) * ab.basePower);
        target.hp = Math.min(target.maxHp, target.hp + healing);
        let revived = false;
        if (isUnconscious(target) && target.hp > 0) {
            target.status = target.status.filter(s => s !== 'unconscious');
            revived = true;
        }
        faceToward(source, target.x, target.y);
        return { damage: 0, healing, statusApplied: null, revived };
    }

    if (ab.type === 'physical') {
        // temporal_slip: next physical attack auto-misses
        if (target.status.includes('slipped')) {
            target.status = target.status.filter(s => s !== 'slipped');
            faceToward(source, target.x, target.y);
            return { damage: 0, healing: 0, statusApplied: null, missed: true };
        }

        const evaMod = directionEvasionMod(source, target);
        let effectiveEva = ((getEffectiveStat(target, 'eva') || 0) / 100) * evaMod;
        const defBonus = target.status.includes('defend') ? 0.2 : 0;
        // farsight: +20% evasion while passive active
        if (passiveActive(target, 'farsight')) effectiveEva += 0.20;
        // seers_vigil: +15% evasion while passive active
        if (passiveActive(target, 'seers_vigil')) effectiveEva += 0.15;
        const finalEva = Math.min(0.9, effectiveEva + defBonus);
        if (Math.random() < finalEva) {
            faceToward(source, target.x, target.y);
            return { damage: 0, healing: 0, statusApplied: null, missed: true };
        }
    }

    let defMult = target.status.includes('defend') ? 1.5 : 1.0;

    let raw;
    if (ab.type === 'physical') {
        raw = Math.max(1, getEffectiveStat(source, 'atk') * 2 - getEffectiveStat(target, 'def') * defMult) * ab.basePower * highGroundBonus;
        // divine_ward: incoming physical damage reduced 20%
        if (passiveActive(target, 'divine_ward')) raw *= 0.80;
    } else {
        raw = Math.max(1, getEffectiveStat(source, 'mat') * 2 - getEffectiveStat(target, 'mdf') * defMult) * ab.basePower * highGroundBonus;
        // mana_surge: outgoing magic damage +15%
        if (passiveActive(source, 'mana_surge')) raw *= 1.15;
        // seers_vigil: incoming magic damage -10%
        if (passiveActive(target, 'seers_vigil')) raw *= 0.90;
    }
    const variance = 0.9 + Math.random() * 0.2;
    const damage = Math.round(raw * variance);

    let killedInstantly = false;
    let newHp = target.hp - damage;
    if (newHp <= 0) {
        target.hp = 0;
        if (isUnconscious(target)) {
            target.status = target.status.filter(s => s !== 'unconscious');
            if (!target.status.includes('dead')) target.status.push('dead');
            killedInstantly = true;
        } else if (!isDead(target)) {
            if (!target.status.includes('unconscious')) target.status.push('unconscious');
            target.deathTimer = 3;
        }
    } else {
        target.hp = newHp;
    }

    let statusApplied = null;
    if (ab.applyStatus && target.hp > 0 && !isDead(target) && !isUnconscious(target)) {
        if (!target.status.includes(ab.applyStatus)) {
            target.status.push(ab.applyStatus);
            statusApplied = ab.applyStatus;
        }
    }

    // Post-status effects
    if (statusApplied === 'enfeebled') {
        target.buffs = target.buffs || [];
        target.buffs.push({ key: 'enfeebled', stat: 'atk', value: -5, duration: 2 });
    }
    // wyrd_drain: slow duration +1 via SPD debuff on target
    if (ab.applyStatus === 'slow' && statusApplied === 'slow' && passiveActive(source, 'wyrd_drain')) {
        target.buffs = target.buffs || [];
        target.buffs.push({ key: 'wyrd_slow', stat: 'spd', value: -2, duration: 1 });
    }

    faceToward(source, target.x, target.y);
    return { damage, healing: 0, statusApplied, killedInstantly };
}
