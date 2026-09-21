import { computeMoveRange, computeMovePath, computeAoeArea, ABILITIES } from './abilities.js';
import { isDead, isConscious, isUnconscious, faceToward } from './units.js';
import { moveEntity, moveEntityAlongPath } from '../systems/movement-lerp.js';
import { hasLineOfSight, getTile } from './battle-map.js';

// ─── Internal helpers ────────────────────────────────────────────────────────

function getEffectiveStat(unit, stat) {
    let val = unit[stat];
    for (const b of (unit.buffs || [])) {
        if (b.stat === stat) val += b.value;
    }
    return val;
}

// Deterministic damage estimate used only for scoring (no RNG, no full buff chain).
function estimateDamage(attacker, target, abilityKey) {
    const ab = ABILITIES[abilityKey];
    if (!ab || !ab.basePower || ab.isHeal || ab.isCure || ab.passive) return 0;
    const atk = ab.type === 'physical'
        ? getEffectiveStat(attacker, 'atk')
        : getEffectiveStat(attacker, 'mat');
    const def = ab.type === 'physical'
        ? getEffectiveStat(target, 'def')
        : getEffectiveStat(target, 'mdf');
    return Math.max(1, atk * 2 - def) * ab.basePower;
}

// True if a unit has any heal/cure ability (makes them high-value targets / supporters).
function isHealer(unit) {
    return unit.abilities.some(k => {
        const ab = ABILITIES[k];
        return ab && (ab.isHeal || ab.isCure) && !ab.passive;
    });
}

// Dot product of the attack vector with the target's facing vector.
// < -0.5 = rear attack (no evasion), > 0.5 = frontal (full evasion) — mirrors directionEvasionMod.
function attackAngleDot(fx, fy, target) {
    const dx = fx - target.x;
    const dy = fy - target.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const vecs = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] };
    const [fvx, fvy] = vecs[target.facing] || [0, 1];
    return (dx / len) * fvx + (dy / len) * fvy;
}

// Score bonus for firing from elevated tiles, penalty from low ground.
function elevationBonus(fx, fy, tx, ty, map) {
    const from = getTile(map, fx, fy);
    const to   = getTile(map, tx, ty);
    if (!from || !to) return 0;
    const diff = (from.elevation ?? 0) - (to.elevation ?? 0);
    return diff > 0 ? 0.25 : (diff < 0 ? -0.10 : 0);
}

// Score penalty for positioning a ranged/fragile unit where enemies can reach it.
function safetyPenalty(fx, fy, unit, living) {
    const opponentTeam = unit.team === 'enemy' ? 'player' : 'enemy';
    const adjacentFoes = living.filter(u =>
        u.team === opponentTeam && isConscious(u) &&
        Math.abs(u.x - fx) + Math.abs(u.y - fy) <= 1
    ).length;
    if (adjacentFoes === 0) return 0;
    const maxRange = Math.max(...unit.abilities.map(k => ABILITIES[k]?.range ?? 0).filter(r => r > 0), 1);
    const isRanged = maxRange >= 3;
    return isRanged ? 0.25 * adjacentFoes : 0.05 * adjacentFoes;
}

// Count how many opponents are inside the AoE centered on the target tile.
function countAoeHits(ab, targetX, targetY, opponents) {
    if (!ab.aoe) return 1;
    const area = computeAoeArea(targetX, targetY, ab.aoe);
    return Math.max(1, opponents.filter(o => isConscious(o) && area.has(`${o.x},${o.y}`)).length);
}

// ─── Fire-tile enumeration ────────────────────────────────────────────────────

// Returns all tiles the unit could stand on (current + reachable) and still fire
// the given ability at targetUnit.
function getFireTiles(unit, abilityKey, moveRange, battle, targetUnit) {
    const ab = ABILITIES[abilityKey];
    if (!ab) return [];

    // Self-targeted abilities are always cast from current position.
    if (ab.targetType === 'self') return [{ x: unit.x, y: unit.y }];

    const requiresLos   = ab.requiresLos !== false;
    const range         = ab.range;
    const isAllyTarget  = ab.targetType === 'ally';
    const allFromTiles  = [`${unit.x},${unit.y}`, ...moveRange];
    const fireTiles     = [];

    for (const key of allFromTiles) {
        const [fx, fy] = key.split(',').map(Number);
        const dist = Math.abs(fx - targetUnit.x) + Math.abs(fy - targetUnit.y);
        if (dist > range) continue;
        // Enemy-targeting abilities can't fire from the target's own tile.
        if (!isAllyTarget && dist === 0) continue;
        if (requiresLos && !hasLineOfSight(battle.map, fx, fy, targetUnit.x, targetUnit.y)) continue;
        fireTiles.push({ x: fx, y: fy });
    }
    return fireTiles;
}

// ─── Action scoring ───────────────────────────────────────────────────────────

// Returns a numeric score for executing abilityKey on targetUnit from fire tile (fx, fy).
// Higher is better. Returns -Infinity for illegal/useless actions.
function scoreAction(unit, abilityKey, targetUnit, fx, fy, battle, opponents) {
    const ab = ABILITIES[abilityKey];
    if (!ab) return -Infinity;

    // ── Heal ──
    if (ab.isHeal) {
        const deficit = targetUnit.maxHp - targetUnit.hp;
        if (deficit <= 0 && !isUnconscious(targetUnit)) return -Infinity;
        if (isUnconscious(targetUnit)) {
            // Reviving a fallen ally is very high value.
            return 150 + targetUnit.maxHp * 0.5;
        }
        let score = deficit;
        const hpRatio = targetUnit.hp / targetUnit.maxHp;
        if (hpRatio < 0.25) score *= 2.5;
        else if (hpRatio < 0.50) score *= 1.5;
        if (targetUnit === unit) score *= 0.8; // slight preference to heal others first
        return score;
    }

    // ── Cure ──
    if (ab.isCure) {
        const debuffs = targetUnit.status.filter(s => s !== 'dead' && s !== 'unconscious' && s !== 'defend');
        if (debuffs.length === 0) return -Infinity;
        let score = 60 + debuffs.length * 20;
        // Curing a stun is urgent since the unit would lose their next turn.
        if (debuffs.includes('stun')) score += 40;
        if (targetUnit === unit) score *= 0.8;
        return score;
    }

    // ── Self-buff ──
    if (ab.targetType === 'self') {
        const alreadyBuffed = (unit.buffs || []).some(b => b.key === abilityKey);
        if (alreadyBuffed) return -Infinity;
        const hpRatio    = unit.hp / unit.maxHp;
        const nearbyFoes = opponents.filter(o =>
            isConscious(o) && Math.abs(o.x - unit.x) + Math.abs(o.y - unit.y) <= 3
        ).length;
        return 30 + (1 - hpRatio) * 30 + nearbyFoes * 8;
    }

    // ── Offensive ──
    const estDmg = estimateDamage(unit, targetUnit, abilityKey);
    if (estDmg <= 0 && !ab.applyStatus) return 0;

    let score = estDmg;

    // Kill opportunity: biggest tactical priority.
    if (estDmg >= targetUnit.hp) score *= 3.0;

    // Prefer finishing off near-dead targets even without a kill (finish-off pressure).
    const hpRatio = targetUnit.hp / targetUnit.maxHp;
    if (hpRatio < 0.35) score *= 1.4;

    // AoE clustering: score scales with number of opponents hit.
    const hits = countAoeHits(ab, targetUnit.x, targetUnit.y, opponents);
    if (hits > 1) score *= (0.7 + 0.3 * hits); // 2 = ×1.3, 3 = ×1.6, 4 = ×1.9

    // Healer / support priority: eliminating the enemy healer is critical.
    if (isHealer(targetUnit)) score *= 1.5;

    // Status value (don't stack the same status that already applies).
    if (ab.applyStatus && !targetUnit.status.includes(ab.applyStatus)) {
        if      (ab.applyStatus === 'stun')    score *= 1.8;
        else if (ab.applyStatus === 'charm')   score *= 1.7;
        else if (ab.applyStatus === 'sleep')   score *= 1.6;
        else if (ab.applyStatus === 'berserk') score *= 1.4;
        else if (ab.applyStatus === 'silence') score *= 1.3;
        else if (ab.applyStatus === 'frog')    score *= 1.3;
        else if (ab.applyStatus === 'slow')    score *= 1.3;
        else if (ab.applyStatus === 'poison')  score *= 1.2;
        else if (ab.applyStatus === 'enfeebled') score *= 1.2;
        else                                   score *= 1.1;
    }
    // Silence is especially valuable against mages.
    if (ab.applyStatus === 'silence' && !targetUnit.status.includes('silence')) {
        const hasMagic = targetUnit.abilities.some(k => ABILITIES[k]?.type === 'magic' && !ABILITIES[k]?.passive);
        if (hasMagic) score *= 1.3;
    }

    // Charge-time penalty: a charging unit is vulnerable to stuns and may not fire.
    if (ab.chargeTime > 0) score *= Math.max(0.55, 1.0 - ab.chargeTime / 180);

    // MP conservation: avoid burning the last MP on a weak shot.
    if (ab.mpCost > 0 && unit.mp <= ab.mpCost * 1.5 && estDmg < targetUnit.hp * 0.35) {
        score *= 0.65;
    }

    // ── Positional modifiers ──

    // Flanking / rear bonus (more meaningful for physical attacks where evasion applies).
    const dot         = attackAngleDot(fx, fy, targetUnit);
    // dot in [-1, 1]: -1 = pure rear, +1 = pure front.
    const angleBonus  = -dot * (ab.type === 'physical' ? 0.20 : 0.08);
    score *= (1 + Math.max(-0.15, angleBonus));

    // High-ground bonus / low-ground penalty.
    score *= (1 + elevationBonus(fx, fy, targetUnit.x, targetUnit.y, battle.map));

    // Safety: penalise exposing a ranged unit to melee.
    score *= (1 - Math.min(0.5, safetyPenalty(fx, fy, unit, battle.livingUnits)));

    return score;
}

// ─── Post-action facing ───────────────────────────────────────────────────────

// After acting, face the most dangerous reachable opponent to maximise evasion
// coverage. "Dangerous" = highest estimated incoming damage, weighted down for
// opponents who would need multiple turns to close the gap.
function pivotTowardThreat(unit, opponents) {
    if (opponents.length === 0) return;
    let bestThreat = -Infinity;
    let threatTarget = null;

    for (const opp of opponents) {
        for (const abilityKey of opp.abilities) {
            const ab = ABILITIES[abilityKey];
            if (!ab || ab.passive || ab.isHeal || ab.isCure || ab.targetType === 'self') continue;
            const dist      = Math.abs(opp.x - unit.x) + Math.abs(opp.y - unit.y);
            const maxReach  = ab.range + opp.move;
            // Discount threats that are multiple turns away.
            const proximity = dist <= maxReach ? 1.0 : Math.max(0.1, maxReach / dist);
            const threat    = estimateDamage(opp, unit, abilityKey) * proximity;
            if (threat > bestThreat) {
                bestThreat = threat;
                threatTarget = opp;
            }
        }
    }

    if (threatTarget) faceToward(unit, threatTarget.x, threatTarget.y);
}

// ─── Main entry point ────────────────────────────────────────────────────────

// onAbility(source, targetX, targetY, abilityKey) — optional animation callback.
export function runEnemyTurn(unit, battle, onAbility) {
    const living       = battle.livingUnits;
    // Charmed units attack their own team.
    const charmed      = unit.status.includes('charm');
    const opponentTeam = charmed ? unit.team : (unit.team === 'enemy' ? 'player' : 'enemy');
    const opponents    = living.filter(u => u.team === opponentTeam && isConscious(u) && u !== unit);
    if (opponents.length === 0) { battle.endTurn(100); return; }

    const moveRange = computeMoveRange(unit, battle.map, living);

    // ── Evaluate every (ability × target × fire-tile) combo ──────────────────
    let bestScore    = -Infinity;
    let bestAbKey    = null;
    let bestTarget   = null;
    let bestFireTile = null;

    // Track the tile a summon should be placed on (separate from bestTarget which is a unit).
    let bestSummonTile = null;

    for (const abilityKey of unit.abilities) {
        const ab = ABILITIES[abilityKey];
        if (!ab || ab.passive || unit.mp < ab.mpCost) continue;

        // Summon abilities: find a free tile within range adjacent to the unit.
        if (ab.isSummon) {
            // Only summon when not already heavily outnumbered or at low HP.
            const hpRatio = unit.hp / unit.maxHp;
            if (hpRatio < 0.25) continue; // conserve MP when near death
            const allyCount = living.filter(u => u.team === unit.team && isConscious(u)).length;
            if (allyCount >= opponents.length + 2) continue; // already have enough allies

            const occupied = new Set(living.filter(u => !isDead(u)).map(u => `${u.x},${u.y}`));
            const summonRange = ab.range ?? 2;
            let bestTile = null;
            let bestDist = Infinity;
            // Prefer placing the summon between the caster and the nearest enemy.
            const primary = opponents.reduce((a, b) => {
                const da = Math.abs(a.x - unit.x) + Math.abs(a.y - unit.y);
                const db = Math.abs(b.x - unit.x) + Math.abs(b.y - unit.y);
                return da <= db ? a : b;
            });
            for (let dx = -summonRange; dx <= summonRange; dx++) {
                for (let dy = -summonRange; dy <= summonRange; dy++) {
                    if (Math.abs(dx) + Math.abs(dy) > summonRange) continue;
                    const sx = unit.x + dx, sy = unit.y + dy;
                    if (sx === unit.x && sy === unit.y) continue;
                    if (occupied.has(`${sx},${sy}`)) continue;
                    const tile = getTile(battle.map, sx, sy);
                    if (!tile || !tile.passable) continue;
                    const distToEnemy = Math.abs(sx - primary.x) + Math.abs(sy - primary.y);
                    if (distToEnemy < bestDist) { bestDist = distToEnemy; bestTile = { x: sx, y: sy }; }
                }
            }
            if (!bestTile) continue;
            // Score: comparable to a mid-value offensive ability.
            const score = 35 + (1 - unit.hp / unit.maxHp) * 20;
            if (score > bestScore) {
                bestScore    = score;
                bestAbKey    = abilityKey;
                bestTarget   = null;
                bestFireTile = { x: unit.x, y: unit.y }; // caster doesn't need to move
                bestSummonTile = bestTile;
            }
            continue;
        }

        // Build candidate target list appropriate for this ability.
        let candidateTargets;
        if (ab.isHeal) {
            // Include unconscious allies so the AI considers revival.
            candidateTargets = living.filter(u => u.team === unit.team && !isDead(u));
        } else if (ab.isCure) {
            candidateTargets = living.filter(u => u.team === unit.team && isConscious(u));
        } else if (ab.targetType === 'self') {
            candidateTargets = [unit];
        } else {
            candidateTargets = opponents;
        }

        for (const targetUnit of candidateTargets) {
            const fireTiles = getFireTiles(unit, abilityKey, moveRange, battle, targetUnit);
            for (const fireTile of fireTiles) {
                const score = scoreAction(
                    unit, abilityKey, targetUnit,
                    fireTile.x, fireTile.y,
                    battle, opponents
                );
                if (score > bestScore) {
                    bestScore    = score;
                    bestAbKey    = abilityKey;
                    bestTarget   = targetUnit;
                    bestFireTile = fireTile;
                    bestSummonTile = null;
                }
            }
        }
    }

    // ── Determine movement destination ───────────────────────────────────────
    let moveDest;

    if (bestFireTile) {
        moveDest = bestFireTile;
    } else {
        // No action reachable this turn — advance toward the highest-priority target.
        const priority = (o) => (isHealer(o) ? 2.0 : 1.0) / (o.hp / o.maxHp + 0.1);
        const primary  = opponents.reduce((a, b) => priority(a) >= priority(b) ? a : b);

        let closestDist = Infinity;
        for (const key of moveRange) {
            const [mx, my] = key.split(',').map(Number);
            const d = Math.abs(mx - primary.x) + Math.abs(my - primary.y);
            if (d < closestDist) { closestDist = d; moveDest = { x: mx, y: my }; }
        }
        if (!moveDest) moveDest = { x: unit.x, y: unit.y };
    }

    // ── Execute movement ─────────────────────────────────────────────────────
    const originX = unit.x, originY = unit.y;
    const willMove = moveDest.x !== unit.x || moveDest.y !== unit.y;

    if (willMove) {
        faceToward(unit, moveDest.x, moveDest.y);
        const path = computeMovePath(unit, battle.map, battle.livingUnits, moveDest.x, moveDest.y);
        if (path && path.length > 0) {
            moveEntityAlongPath(unit, path, 180);
        } else {
            moveEntity(unit, moveDest.x, moveDest.y, 180);
        }
        battle.logMsg(`${unit.name} moves to (${unit.x}, ${unit.y}).`);
    }

    // ── Execute action ───────────────────────────────────────────────────────
    const didMove = unit.x !== originX || unit.y !== originY;
    let animMs = 0;
    let didAct = false;

    if (bestAbKey && ABILITIES[bestAbKey]?.isSummon && bestSummonTile) {
        if (onAbility) animMs = onAbility(unit, bestSummonTile.x, bestSummonTile.y, bestAbKey) || 0;
        battle.applyEnemyAbility(unit, bestAbKey, bestSummonTile.x, bestSummonTile.y);
        didAct = true;
    } else if (bestAbKey && bestTarget) {
        const ab          = ABILITIES[bestAbKey];
        const isSelf      = ab.targetType === 'self';
        const isAllyAb    = ab.isHeal || ab.isCure;
        const tgtX        = isSelf ? unit.x : bestTarget.x;
        const tgtY        = isSelf ? unit.y : bestTarget.y;
        const dist        = Math.abs(unit.x - tgtX) + Math.abs(unit.y - tgtY);
        const requiresLos = ab.requiresLos !== false;
        const losOk       = !requiresLos || hasLineOfSight(battle.map, unit.x, unit.y, tgtX, tgtY);

        // Allow dist=0 for ally/self targeting (healing self, earth_skin, etc.).
        const distOk = (isSelf || isAllyAb) ? (dist <= ab.range) : (dist > 0 && dist <= ab.range);
        const canAct = isSelf ? true : (distOk && losOk);

        if (canAct) {
            if (onAbility) animMs = onAbility(unit, tgtX, tgtY, bestAbKey) || 0;
            battle.applyEnemyAbility(unit, bestAbKey, tgtX, tgtY);
            didAct = true;
        } else {
            battle.logMsg(`${unit.name} waits.`);
        }
    } else {
        battle.logMsg(`${unit.name} waits.`);
    }

    if (!didAct) pivotTowardThreat(unit, opponents);

    const ctCost = (didMove && didAct) ? 100 : (didMove || didAct) ? 80 : 60;
    battle.endTurn(ctCost);
    return animMs;
}
