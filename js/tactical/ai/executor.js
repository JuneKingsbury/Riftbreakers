// Plans and carries out automatic turns. planTurn() decides a turn (the unit's script,
// or the scoring AI in enemy-ai.js) as an intent; beginIntent() moves, finishIntent()
// acts. Real-time battles (realtime.js) run the two halves apart, with the walk in
// between; executeIntent() runs both at once for the turn-by-turn flow. Either way the
// turn economy matches a player commanding the unit by hand in BattleScene.
import { computeMovePath } from '../abilities.js';
import { JOB_STATS } from '../data-registry.js';
import { ABILITIES } from '../data-registry.js';
import { faceToward, setFacing } from '../units.js';
import { moveEntity, moveEntityAlongPath } from '../../systems/movement-lerp.js';
import { planEnemyTurn } from '../enemy-ai.js';
import { runScript } from './script-runtime.js';
import * as Q from './queries.js';

// CT cost of a turn, matching the manual game and the enemy AI:
// moving costs 20, an action costs at least 80 (more if the ability's own
// actionCost is higher), defending costs 80, and doing nothing costs 60.
// Orders (Rally, Delay, Taunt, swaps: no damage, they move gauges or draw attacks) are
// shouted, not swung: they cost their own actionCost, at least COST_ORDER_MIN. At the full 80,
// giving an ally +45 CT cost the commander more turn than it gave.
export const COST_MOVE = 20;
export const COST_ACTION_MIN = 80;
export const COST_ORDER_MIN = 40;
export const COST_DEFEND = 80;
export const COST_IDLE = 60;
export const COST_ACTION_DEFAULT = 60;

// Default walk speed. The battle's moveMsPerStep overrides it (the scene scales that with playback speed).
const MS_PER_STEP = 180;

// Starts the walk to `dest`. Returns the number of tiles walked.
function doMove(unit, dest, battle) {
    const stepMs = battle.moveMsPerStep ?? MS_PER_STEP;
    faceToward(unit, dest.x, dest.y);
    const path = computeMovePath(unit, battle.map, battle.livingUnits, dest.x, dest.y, dest.z);
    if (path && path.length > 0) {
        moveEntityAlongPath(unit, path, stepMs);
    } else {
        moveEntity(unit, dest.x, dest.y, stepMs, dest.z ?? unit.z);
    }
    battle.logMsg(`${unit.name} moves to (${unit.x}, ${unit.y}).`);
    battle.afterMove?.(unit, path);
    return path?.length || 1;
}

// CT cost of an intent: moving costs 20, an action at least 80 (more if the ability's
// own actionCost is higher; orders, see isQuickOrder, at least 40), defending 80, and
// doing nothing 60.
export function isQuickOrder(ab) {
    return !!ab && !ab.basePower && !ab.isHeal && !ab.isSummon && ab.targetType !== 'all'
        && (ab.ctGain != null || !!ab.swapPlaces || ab.applyStatus === 'taunted');
}

export function intentCost(unit, intent) {
    let cost = COST_IDLE;
    const act = intent.act;
    if (act?.kind === 'ability' && ABILITIES[act.ability]) {
        const ab = ABILITIES[act.ability];
        cost = Math.max(isQuickOrder(ab) ? COST_ORDER_MIN : COST_ACTION_MIN, ab.actionCost ?? COST_ACTION_DEFAULT);
    } else if (act?.kind === 'defend') {
        cost = COST_DEFEND;
    }
    return cost + (intent.move ? COST_MOVE : 0);
}

// Whether the intent's action can still be carried out from where the unit stands now.
export function actionStillValid(unit, intent, battle) {
    const act = intent.act;
    if (act?.kind !== 'ability') return true;
    const ab = ABILITIES[act.ability];
    if (!ab || !Q.canUse(unit, act.ability)) return false;
    if (ab.isSummon) return true;
    // The planned target may have moved or fallen since the turn began.
    if (act.targetId != null) {
        const target = battle.units.find(u => u.id === act.targetId);
        if (!target || target.status.includes('dead')) return false;
        if (ab.targetType !== 'self' && (target.x !== act.x || target.y !== act.y)) return false;
    }
    return Q.inAbilityRange(unit, act, act.ability, battle.map);
}

// First half of a turn: the move and any pivot. Returns the tiles walked (0 if none).
export function beginIntent(unit, intent, battle) {
    const steps = intent.move ? doMove(unit, intent.move, battle) : 0;
    if (intent.pivot) {
        setFacing(unit, intent.pivot);
        battle.logMsg(`${unit.name} turns to face ${intent.pivot}.`);
    }
    return steps;
}

// Second half: the action. onAbility(source, tx, ty, key) may play an animation and
// return its duration in ms. Returns that duration.
export function finishIntent(unit, intent, battle, onAbility) {
    let animMs = 0;
    const act = intent.act;
    let acted = false;
    if (act.kind === 'ability') {
        const ab = ABILITIES[act.ability];
        // Re-check after moving: applyEnemyAbility trusts its caller on range, LOS and MP.
        const valid = ab && Q.canUse(unit, act.ability)
            && (ab.isSummon || Q.inAbilityRange(unit, act, act.ability, battle.map));
        if (valid) {
            faceToward(unit, act.x, act.y);
            if (onAbility && !(ab.chargeTime > 0)) animMs = onAbility(unit, act.x, act.y, act.ability) || 0;
            battle.applyEnemyAbility(unit, act.ability, act.x, act.y, act.z);
            unit._lastTargetId = act.targetId;
            acted = true;
        } else {
            battle.logMsg(`${unit.name} waits.`);
        }
    } else if (act.kind === 'defend') {
        if (!unit.status.includes('defend')) unit.status.push('defend');
        battle.logMsg(`${unit.name} takes a defensive stance.`);
        acted = true;
    } else {
        battle.logMsg(`${unit.name} waits.`);
    }
    if (!acted) intent.onIdle?.();
    unit._turnsTaken = (unit._turnsTaken || 0) + 1;
    return animMs;
}

// Executes an intent in one go: move, act, pay CT. Returns the animation ms.
export function executeIntent(unit, intent, battle, onAbility) {
    beginIntent(unit, intent, battle);
    const act = intent.act;
    const ab = act.kind === 'ability' ? ABILITIES[act.ability] : null;
    const willAct = !ab || (Q.canUse(unit, act.ability) && (ab.isSummon || Q.inAbilityRange(unit, act, act.ability, battle.map)));
    const cost = willAct ? intentCost(unit, intent) : COST_IDLE + (intent.move ? COST_MOVE : 0);
    const animMs = finishIntent(unit, intent, battle, onAbility);
    battle.endTurn(cost);
    return animMs;
}

// Decides a unit's turn. Scripted player characters follow their battle script.
// Everyone else, and any unit acting against its own side (charm), uses the scoring
// AI in enemy-ai.js.
export function planTurn(unit, battle) {
    // Mirror Image's copies never act.
    if (JOB_STATS[unit.job]?.inert) return { move: null, pivot: null, trace: [], act: { kind: 'wait' } };
    const useScript = unit.script && !unit.status.includes('charm');
    if (!useScript) return planEnemyTurn(unit, battle);
    const intent = runScript(unit.script, unit, battle.livingUnits, battle.map);
    const fired = intent.trace.map(t => t.label).join(' > ');
    battle.lastDecision = { unitId: unit.id, name: unit.name, trace: intent.trace };
    if (fired && battle.logTactics) battle.logMsg(`${unit.name} follows: ${fired}`);
    return intent;
}

// Runs one auto-controlled unit's whole turn at once (the turn-by-turn flow).
export function runAutoTurn(unit, battle, onAbility) {
    return executeIntent(unit, planTurn(unit, battle), battle, onAbility);
}
