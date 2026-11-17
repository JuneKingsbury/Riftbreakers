// Real-time battles. Every unit's CT gauge fills continuously with its speed, and a
// unit acts as soon as its gauge is full, while others are still walking or casting.
// Everyone starts full, so the whole field acts at the opening.
//
// A turn has two halves:
//   1. Decide and move (instant): turn-start effects (status timers, poison, stun...),
//      plan the turn, start the walk (the rules position updates at once, so later
//      deciders see where the unit is going) and pay its CT cost.
//   2. Act on arrival: once the walk has had time to finish, carry out the action. If
//      the plan no longer works (the target moved or fell), the unit re-plans from where
//      it stands, taking only an action that needs no further move.
// A unit is busy until its walk and its action's animation are done, and can't start a
// new turn until then.
//
// All times are battle time in ms: the scene scales real time by the playback speed and
// passes 0 while paused, and headless runs pass a fixed step.
import { STATES } from './battle.js';
import { isConscious, isAlive } from './units.js';
import { planTurn, beginIntent, finishIntent, actionStillValid, intentCost } from './ai/executor.js';

// CT gained per point of speed per second of battle time. A speed-8 unit refills a full
// turn (100 CT) in about 2.5 seconds.
export const CT_PER_SEC = 5;
export const CT_READY = 100;
// CT banked while busy is capped, so a long animation can't store up several turns.
const CT_CAP = 150;
// Minimum gap between two turn starts, so the opening (everyone at once) stays readable.
export const TURN_GAP_MS = 120;
// Battle-time walking pace per tile (the visual walk matches it at 1x).
export const STEP_MS = 180;
// Pause after an action before the unit may act again.
const RECOVERY_MS = 150;

function speedMult(unit) {
    return unit.status.includes('haste') ? 1.5 : unit.status.includes('slow') ? 0.5 : 1;
}

export class RealtimeBattle {
    // hooks.onAbility(unit, x, y, key) plays an ability animation and returns its length (ms at 1x).
    // hooks.onCharge(fired) is told about charged abilities that went off (see checkAndFireCharges).
    // hooks.onTurn(unit) is told whenever a unit starts a turn.
    constructor(battle, hooks = {}) {
        this.battle = battle;
        this.hooks = hooks;
        this.time = 0;
        this._nextTurnAt = 0;
        this._busyUntil = new Map();     // unit id → battle time
        this._pending = [];              // { unit, intent, at }: actions waiting for the walk
        this.turnsTaken = 0;
        for (const u of battle.units) u.ct = CT_READY;
    }

    isBusy(unit) {
        return (this._busyUntil.get(unit.id) ?? 0) > this.time;
    }

    get over() {
        return this.battle.state === STATES.BATTLE_OVER;
    }

    update(dtMs) {
        if (this.over || dtMs <= 0) return;
        this.time += dtMs;
        const sec = dtMs / 1000;
        const battle = this.battle;

        for (const u of battle.livingUnits) {
            const gain = u.spd * CT_PER_SEC * sec * speedMult(u);
            u.ct = Math.min(CT_CAP, u.ct + gain);
            if (u._charging) u._charging.ct += gain;
        }

        const fired = battle.checkAndFireCharges();
        if (fired.length) this.hooks.onCharge?.(fired);
        if (this.over) return;

        // Actions whose walk has finished.
        const due = this._pending.filter(p => p.at <= this.time);
        this._pending = this._pending.filter(p => p.at > this.time);
        for (const p of due) {
            this._act(p.unit, p.intent);
            if (this.over) return;
        }

        if (this.time < this._nextTurnAt) return;
        const ready = battle.livingUnits
            .filter(u => u.ct >= CT_READY && !this.isBusy(u))
            .sort((a, b) => b.ct - a.ct || b.spd - a.spd);
        if (ready.length) {
            this._startTurn(ready[0]);
            this._nextTurnAt = this.time + TURN_GAP_MS;
        }
    }

    // First half: turn-start effects, the plan, the walk and the CT cost.
    _startTurn(unit) {
        const battle = this.battle;
        this.turnsTaken += 1;
        this.hooks.onTurn?.(unit);
        battle.startTurn(unit);
        // Stunned, asleep, knocked out or the battle ended: startTurn already closed the turn.
        if (battle.state !== STATES.PLAYER_TURN && battle.state !== STATES.ENEMY_TURN) return;

        const intent = planTurn(unit, battle);
        const steps = beginIntent(unit, intent, battle);
        battle.endTurn(intentCost(unit, intent));
        const walkMs = steps * STEP_MS;
        this._busyUntil.set(unit.id, this.time + walkMs);
        if (walkMs > 0) this._pending.push({ unit, intent, at: this.time + walkMs });
        else this._act(unit, intent);
    }

    // Second half: the action, re-planned if the original plan no longer works.
    _act(unit, intent) {
        const battle = this.battle;
        if (!isAlive(unit) || !isConscious(unit) || unit.status.includes('sleep')) return;
        if (!actionStillValid(unit, intent, battle)) {
            const again = planTurn(unit, battle);
            intent = again.move ? { ...intent, act: { kind: 'wait' } } : again;
        }
        const animMs = finishIntent(unit, intent, battle, this.hooks.onAbility) || 0;
        this._busyUntil.set(unit.id, this.time + animMs + RECOVERY_MS);
    }
}

// Plays a battle to the end in fixed steps (headless tests and the balance bot).
// Returns the runner.
export function runRealtimeBattle(battle, { dtMs = 50, maxMs = 15 * 60 * 1000, hooks } = {}) {
    const rt = new RealtimeBattle(battle, hooks);
    while (!rt.over && rt.time < maxMs) rt.update(dtMs);
    return rt;
}
