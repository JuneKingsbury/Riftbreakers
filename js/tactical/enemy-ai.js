import { computeMoveRange, computeMovePath, ABILITIES } from './abilities.js';
import { isDead, isConscious, faceToward } from './units.js';
import { moveEntity, moveEntityAlongPath } from '../systems/movement-lerp.js';
import { hasLineOfSight } from './battle-map.js';

// onAbility(source, targetX, targetY, abilityKey) is an optional callback so
// the demo can play attack animations for enemy actions.
export function runEnemyTurn(unit, battle, onAbility) {
    const living  = battle.livingUnits;
    const players = living.filter(u => u.team === 'player' && isConscious(u));
    if (players.length === 0) { battle.endTurn(100); return; }

    // Sort by HP ascending to prefer weakest target
    const target = [...players].sort((a, b) => a.hp - b.hp)[0];

    // Choose best ability (prefer magic if MP available)
    const magicAbs = unit.abilities.filter(k => {
        const ab = ABILITIES[k];
        return ab && ab.type === 'magic' && ab.targetType === 'enemy' && unit.mp >= ab.mpCost;
    });
    const physAbs = unit.abilities.filter(k => {
        const ab = ABILITIES[k];
        return ab && ab.targetType === 'enemy' && !ab.passive;
    });

    const chosenAbKey = magicAbs.length > 0 ? magicAbs[0] : (physAbs.length > 0 ? physAbs[0] : null);
    const chosenAb = chosenAbKey ? ABILITIES[chosenAbKey] : null;
    const attackRange = chosenAb ? chosenAb.range : 1;

    // Find best move position to be within attack range of target
    const moveRange = computeMoveRange(unit, battle.map, living);
    const allFromTiles = new Set([`${unit.x},${unit.y}`, ...moveRange]);

    // Tile sets within attack range of target (and with LoS if required)
    const abRequiresLos = chosenAb ? chosenAb.requiresLos !== false : true;
    const canAttackFrom = new Set();
    for (const key of allFromTiles) {
        const [fx, fy] = key.split(',').map(Number);
        const dist = Math.abs(fx - target.x) + Math.abs(fy - target.y);
        if (dist > attackRange || dist === 0) continue;
        if (abRequiresLos && !hasLineOfSight(battle.map, fx, fy, target.x, target.y)) continue;
        canAttackFrom.add(key);
    }

    // Pick move destination: prefer staying in place if already in range, else closest reachable
    let moveDest = null;
    const selfKey = `${unit.x},${unit.y}`;
    if (canAttackFrom.has(selfKey)) {
        moveDest = { x: unit.x, y: unit.y };
    } else {
        let best = Infinity;
        for (const key of moveRange) {
            const [mx, my] = key.split(',').map(Number);
            const d = Math.abs(mx - target.x) + Math.abs(my - target.y);
            if (d < best) { best = d; moveDest = { x: mx, y: my }; }
        }
        if (!moveDest) moveDest = { x: unit.x, y: unit.y };
    }

    // Face toward destination before moving — faceToward uses unit.x/y as origin,
    // and moveEntity* immediately updates unit.x/y to the destination, so we must
    // call setFacing first while the unit is still at its current position.
    const originX = unit.x, originY = unit.y;
    faceToward(unit, moveDest.x, moveDest.y);
    const path = computeMovePath(unit, battle.map, battle.livingUnits, moveDest.x, moveDest.y);
    if (path && path.length > 0) {
        moveEntityAlongPath(unit, path, 180);
    } else {
        moveEntity(unit, moveDest.x, moveDest.y, 180);
    }
    battle.logMsg(`${unit.name} moves to (${unit.x}, ${unit.y}).`);

    // Check if we can now attack (respecting LoS unless the ability bypasses it)
    const dist = Math.abs(unit.x - target.x) + Math.abs(unit.y - target.y);
    const losOk = !abRequiresLos || hasLineOfSight(battle.map, unit.x, unit.y, target.x, target.y);
    const didMove = moveDest.x !== originX || moveDest.y !== originY;
    let animMs = 0;
    let didAct = false;
    if (chosenAbKey && dist <= attackRange && dist > 0 && losOk) {
        if (onAbility) animMs = onAbility(unit, target.x, target.y, chosenAbKey) || 0;
        battle.applyEnemyAbility(unit, chosenAbKey, target.x, target.y);
        didAct = true;
    } else {
        battle.logMsg(`${unit.name} waits.`);
    }

    let ctCost;
    if (didMove && didAct)       ctCost = 100;
    else if (didMove || didAct)  ctCost = 80;
    else                         ctCost = 60;
    battle.endTurn(ctCost);
    return animMs;
}
