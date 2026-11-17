import { computeMoveRange, computeAoeArea, ABILITIES } from './abilities.js';
import { isDead, isConscious, isUnconscious, faceToward } from './units.js';
import { hasLineOfSight, columnCells, posKey, parseKey } from './battle-map.js';

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
function elevationBonus(from, to) {
    const diff = (from.z ?? 0) - (to.z ?? 0);
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
function countAoeHits(ab, target, opponents, map) {
    if (!ab.aoe) return 1;
    const area = computeAoeArea(map, target, ab.aoe);
    return Math.max(1, opponents.filter(o => isConscious(o) && area.has(posKey(o))).length);
}

// ─── Fire-tile enumeration ────────────────────────────────────────────────────

// Returns all tiles the unit could stand on (current + reachable) and still fire
// the given ability at targetUnit.
function getFireTiles(unit, abilityKey, moveRange, battle, targetUnit) {
    const ab = ABILITIES[abilityKey];
    if (!ab) return [];

    // Self-targeted abilities are always cast from current position.
    if (ab.targetType === 'self') return [{ x: unit.x, y: unit.y, z: unit.z }];

    const requiresLos   = ab.requiresLos !== false;
    const range         = ab.range;
    const isAllyTarget  = ab.targetType === 'ally';
    const allFromTiles  = [posKey(unit), ...moveRange];
    const fireTiles     = [];

    for (const key of allFromTiles) {
        const from = parseKey(key);
        const dist = Math.abs(from.x - targetUnit.x) + Math.abs(from.y - targetUnit.y);
        if (dist > range) continue;
        // Enemy-targeting abilities can't fire from the target's own tile.
        if (!isAllyTarget && dist === 0) continue;
        if (requiresLos && !hasLineOfSight(battle.map, from, targetUnit)) continue;
        fireTiles.push(from);
    }
    return fireTiles;
}

// ─── Action scoring ───────────────────────────────────────────────────────────

// Returns a numeric score for executing abilityKey on targetUnit from fire tile `from` ({x,y,z}).
// Higher is better. Returns -Infinity for illegal/useless actions.
function scoreAction(unit, abilityKey, targetUnit, from, battle, opponents) {
    const fx = from.x, fy = from.y;
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
    const hits = countAoeHits(ab, targetUnit, opponents, battle.map);
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
    score *= (1 + elevationBonus(from, targetUnit));

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

// Decides a turn for a unit without a script (enemies, charmed units, summons) and
// returns it as an intent, the same shape runScript produces (see ai/executor.js):
//   { move: {x,y,z}|null, act: { kind: 'ability', ability, x, y, z, targetId } | { kind: 'wait' },
//     onIdle: fn }   onIdle turns the unit toward its biggest threat if it ends up not acting.
export function planEnemyTurn(unit, battle) {
    const living       = battle.livingUnits;
    // Charmed units attack their own team.
    const charmed      = unit.status.includes('charm');
    const opponentTeam = charmed ? unit.team : (unit.team === 'enemy' ? 'player' : 'enemy');
    const opponents    = living.filter(u => u.team === opponentTeam && isConscious(u) && u !== unit);
    if (opponents.length === 0) return { move: null, act: { kind: 'wait' }, trace: [] };

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

            const occupied = new Set(living.filter(u => !isDead(u)).map(posKey));
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
                    for (const tile of columnCells(battle.map, sx, sy)) {
                        if (!tile.passable || occupied.has(posKey(tile))) continue;
                        const distToEnemy = Math.abs(sx - primary.x) + Math.abs(sy - primary.y)
                            + Math.abs(tile.z - unit.z) * 0.1;
                        if (distToEnemy < bestDist) { bestDist = distToEnemy; bestTile = { x: sx, y: sy, z: tile.z }; }
                    }
                }
            }
            if (!bestTile) continue;
            // Score: comparable to a mid-value offensive ability.
            const score = 35 + (1 - unit.hp / unit.maxHp) * 20;
            if (score > bestScore) {
                bestScore    = score;
                bestAbKey    = abilityKey;
                bestTarget   = null;
                bestFireTile = { x: unit.x, y: unit.y, z: unit.z }; // caster doesn't need to move
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
                const score = scoreAction(unit, abilityKey, targetUnit, fireTile, battle, opponents);
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
            const m = parseKey(key);
            const d = Math.abs(m.x - primary.x) + Math.abs(m.y - primary.y);
            if (d < closestDist) { closestDist = d; moveDest = m; }
        }
        if (!moveDest) moveDest = { x: unit.x, y: unit.y, z: unit.z };
    }

    // ── The intent ───────────────────────────────────────────────────────────
    const willMove = !!moveDest && posKey(moveDest) !== posKey(unit);
    const intent = {
        move: willMove ? { x: moveDest.x, y: moveDest.y, z: moveDest.z } : null,
        act: { kind: 'wait' },
        trace: [],
        onIdle: () => pivotTowardThreat(unit, battle.livingUnits.filter(u => u.team === opponentTeam && isConscious(u) && u !== unit)),
    };
    if (bestAbKey && ABILITIES[bestAbKey]?.isSummon && bestSummonTile) {
        intent.act = { kind: 'ability', ability: bestAbKey, x: bestSummonTile.x, y: bestSummonTile.y, z: bestSummonTile.z, targetId: null };
    } else if (bestAbKey && bestTarget) {
        // Self-targeted abilities aim at the tile the unit ends its move on.
        const tgt = ABILITIES[bestAbKey].targetType === 'self' ? (intent.move ?? unit) : bestTarget;
        intent.act = { kind: 'ability', ability: bestAbKey, x: tgt.x, y: tgt.y, z: tgt.z, targetId: bestTarget.id ?? null };
    }
    return intent;
}
