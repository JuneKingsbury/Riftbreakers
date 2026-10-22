// Applies a script intent to a live battle. This is the single place where a
// scripted unit moves, animates, spends MP and pays CT, so it follows the same
// turn economy as a player commanding that unit by hand in BattleScene.
import { computeMovePath } from '../abilities.js';
import { ABILITIES } from '../data-registry.js';
import { faceToward, setFacing } from '../units.js';
import { moveEntity, moveEntityAlongPath } from '../../systems/movement-lerp.js';
import { runEnemyTurn } from '../enemy-ai.js';
import { runScript } from './script-runtime.js';
import { defaultScriptFor } from './default-scripts.js';
import * as Q from './queries.js';

// CT cost of a turn, matching the manual game and the enemy AI:
// moving costs 20, an action costs at least 80 (more if the ability's own
// actionCost is higher), defending costs 80, and doing nothing costs 60.
export const COST_MOVE = 20;
export const COST_ACTION_MIN = 80;
export const COST_DEFEND = 80;
export const COST_IDLE = 60;
export const COST_ACTION_DEFAULT = 60;

// Default walk speed. The battle's moveMsPerStep overrides it (the scene scales that with playback speed).
const MS_PER_STEP = 180;

function doMove(unit, dest, battle) {
    const stepMs = battle.moveMsPerStep ?? MS_PER_STEP;
    faceToward(unit, dest.x, dest.y);
    const path = computeMovePath(unit, battle.map, battle.livingUnits, dest.x, dest.y);
    if (path && path.length > 0) {
        moveEntityAlongPath(unit, path, stepMs);
    } else {
        moveEntity(unit, dest.x, dest.y, stepMs);
    }
    battle.logMsg(`${unit.name} moves to (${unit.x}, ${unit.y}).`);
}

// Executes an intent from runScript. onAbility(source, tx, ty, key) may play an
// animation and return its duration in ms. Returns the total animation ms.
export function executeIntent(unit, intent, battle, onAbility) {
    let animMs = 0;
    const moved = !!intent.move;
    let cost = COST_IDLE;

    if (moved) doMove(unit, intent.move, battle);
    if (intent.pivot) {
        setFacing(unit, intent.pivot);
        battle.logMsg(`${unit.name} turns to face ${intent.pivot}.`);
    }

    const act = intent.act;
    if (act.kind === 'ability') {
        const ab = ABILITIES[act.ability];
        // Re-check after moving: applyEnemyAbility trusts its caller on range, LOS and MP.
        const valid = ab && Q.canUse(unit, act.ability)
            && (ab.isSummon || Q.inAbilityRange(unit, act, act.ability, battle.map));
        if (valid) {
            faceToward(unit, act.x, act.y);
            if (onAbility && !(ab.chargeTime > 0)) animMs = onAbility(unit, act.x, act.y, act.ability) || 0;
            battle.applyEnemyAbility(unit, act.ability, act.x, act.y);
            unit._lastTargetId = act.targetId;
            cost = Math.max(COST_ACTION_MIN, ab.actionCost ?? COST_ACTION_DEFAULT);
        } else {
            battle.logMsg(`${unit.name} waits.`);
        }
    } else if (act.kind === 'defend') {
        if (!unit.status.includes('defend')) unit.status.push('defend');
        battle.logMsg(`${unit.name} takes a defensive stance.`);
        cost = COST_DEFEND;
    } else {
        battle.logMsg(`${unit.name} waits.`);
    }

    unit._turnsTaken = (unit._turnsTaken || 0) + 1;
    battle.endTurn(cost + (moved ? COST_MOVE : 0));
    return animMs;
}

// Decides and performs the whole turn for a scripted unit. Units without their
// own script fall back to the default for their job.
export function runScriptedTurn(unit, battle, onAbility) {
    const script = unit.script ?? defaultScriptFor(unit.job);
    const intent = runScript(script, unit, battle.livingUnits, battle.map);
    const fired = intent.trace.map(t => t.label).join(' > ');
    battle.lastDecision = { unitId: unit.id, name: unit.name, trace: intent.trace };
    if (fired) battle.logMsg(`${unit.name} [${fired}]`);
    return executeIntent(unit, intent, battle, onAbility);
}

// Runs one auto-controlled unit's turn. Scripted player characters follow their
// battle script. Everyone else, and any unit acting against its own side
// (charm), uses the scoring AI in enemy-ai.js.
export function runAutoTurn(unit, battle, onAbility) {
    const useScript = unit.script && !unit.status.includes('charm');
    return (useScript ? runScriptedTurn : runEnemyTurn)(unit, battle, onAbility);
}
