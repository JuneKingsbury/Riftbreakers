// Real-time battles: everyone opens at once, gauges fill with speed, units act while
// others are still moving, and a move-then-attack lands when the walker arrives.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { gridMap } from '../map-fixtures.mjs';
import { createUnit } from '../../js/tactical/units.js';
import { TacticalBattle, STATES } from '../../js/tactical/battle.js';
import { RealtimeBattle, runRealtimeBattle, CT_READY, TURN_GAP_MS, STEP_MS } from '../../js/tactical/realtime.js';
import { inflictStatus } from '../../js/tactical/abilities.js';

const field = (w = 14, h = 7) => gridMap(Array.from({ length: h }, () => '.'.repeat(w)));

function withRandom(value, fn) {
    const orig = Math.random;
    Math.random = () => value;
    try { return fn(); } finally { Math.random = orig; }
}

// Units that never die, so turn counting isn't cut short.
const dummy = (name, team, x, y, spd = 8) => Object.assign(createUnit(name, 'goblin', team, x, y), {
    spd, maxHp: 100000, hp: 100000, abilities: ['attack'],
});

function countTurns(units, ms, map = field()) {
    const battle = new TacticalBattle(map, units);
    const turns = {};
    const rt = new RealtimeBattle(battle, { onTurn: (u) => { turns[u.name] = (turns[u.name] || 0) + 1; } });
    for (let t = 0; t < ms; t += 50) rt.update(50);
    return { turns, rt, battle };
}

test('every unit acts right at the start, fastest first', () => {
    const order = [];
    const units = [dummy('Slow', 'player', 0, 0, 6), dummy('Fast', 'enemy', 13, 6, 12), dummy('Mid', 'player', 0, 6, 9)];
    const battle = new TacticalBattle(field(), units);
    const rt = new RealtimeBattle(battle, { onTurn: (u) => order.push(u.name) });
    assert.ok(units.every(u => u.ct === CT_READY), 'gauges start full');
    for (let t = 0; t < TURN_GAP_MS * 3 + 1; t += 10) rt.update(10);
    assert.deepEqual(order.slice(0, 3), ['Fast', 'Mid', 'Slow']);
});

test('faster units take proportionally more turns, and haste/slow scale that', () => {
    const fast = dummy('Fast', 'player', 0, 0, 12);
    const slow = dummy('Slow', 'enemy', 13, 0, 8);
    const { turns } = countTurns([fast, slow], 30000);
    const ratio = turns.Fast / turns.Slow;
    assert.ok(ratio > 1.3 && ratio < 1.7, `ratio ${ratio}`);

    const hasted = dummy('Hasted', 'player', 0, 0, 8);
    const plain = dummy('Plain', 'enemy', 13, 6, 8);
    inflictStatus(hasted, 'haste', 999);
    const r2 = countTurns([hasted, plain], 30000).turns;
    assert.ok(r2.Hasted > r2.Plain * 1.3, `${r2.Hasted} vs ${r2.Plain}`);
});

test('units act while others are still walking, but never while busy themselves', () => {
    const a = createUnit('A', 'goblin', 'player', 0, 3);
    const b = createUnit('B', 'goblin', 'enemy', 13, 3);
    const battle = new TacticalBattle(field(), [a, b]);
    const starts = [];
    const rt = new RealtimeBattle(battle, { onTurn: (u) => starts.push({ name: u.name, t: rt.time, busy: rt.isBusy(u) }) });
    let overlap = false;
    for (let t = 0; t < 3000; t += 20) {
        rt.update(20);
        if (rt.isBusy(a) && rt.isBusy(b)) overlap = true;
    }
    assert.ok(overlap, 'both units were mid-action at the same time');
    assert.ok(starts.every(s => !s.busy), 'no turn started while that unit was busy');
});

test('a move-then-attack lands only once the walk has had time to finish', () => {
    const map = field();
    const attacker = Object.assign(createUnit('Att', 'goblin', 'player', 0, 3), { spd: 50, eva: 0, move: 6 });
    const target = Object.assign(createUnit('Tgt', 'goblin', 'enemy', 5, 3), { spd: 1, eva: 0, maxHp: 1000, hp: 1000 });
    const battle = new TacticalBattle(map, [attacker, target]);
    const rt = new RealtimeBattle(battle);
    target.ct = 0;   // only the attacker moves first
    withRandom(0.1, () => {
        rt.update(1);
        assert.notEqual(attacker.x, 0, 'the walk has started (rules position updated)');
        assert.equal(target.hp, 1000, 'no damage yet');
        const arrive = rt._pending[0].at;
        assert.equal(arrive - rt.time, (Math.abs(attacker.x) + Math.abs(attacker.y - 3)) * STEP_MS, 'one step per tile');
        rt.update(arrive - rt.time - 10);
        assert.equal(target.hp, 1000, 'still walking');
        rt.update(20);
        assert.ok(target.hp < 1000, 'hit on arrival');
    });
});

test('if the target falls during the walk, the attacker re-plans instead of hitting nothing', () => {
    const map = field();
    const attacker = Object.assign(createUnit('Att', 'goblin', 'player', 0, 3), { spd: 50, eva: 0, move: 6 });
    const doomed = Object.assign(createUnit('Doomed', 'goblin', 'enemy', 5, 3), { spd: 1 });
    const other = Object.assign(createUnit('Other', 'goblin', 'enemy', 5, 5), { spd: 1, eva: 0, maxHp: 1000, hp: 1000 });
    const battle = new TacticalBattle(map, [attacker, doomed, other]);
    const rt = new RealtimeBattle(battle);
    doomed.ct = 0; other.ct = 0;
    withRandom(0.1, () => {
        rt.update(1);
        doomed.hp = 0;
        doomed.status.push('dead');
        rt.update(2000);
    });
    assert.ok(battle.log.some(l => /Att/.test(l)), 'the attacker still finished its turn');
    assert.ok(!battle.log.some(l => /hits Doomed/.test(l)));
});

test('pausing (no battle time) stops gauges and actions', () => {
    const a = dummy('A', 'player', 0, 0);
    const b = dummy('B', 'enemy', 13, 0);
    const battle = new TacticalBattle(field(), [a, b]);
    const rt = new RealtimeBattle(battle);
    rt.update(500);
    const snapshot = JSON.stringify([a.ct, b.ct, a.x, b.x, battle.log.length]);
    for (let i = 0; i < 20; i++) rt.update(0);
    assert.equal(JSON.stringify([a.ct, b.ct, a.x, b.x, battle.log.length]), snapshot);
});

test('charged spells go off after their charge time, without stopping anyone', () => {
    const caster = Object.assign(createUnit('Caster', 'evoker', 'player', 0, 3, { level: 9 }), { eva: 0 });
    const foe = Object.assign(createUnit('Foe', 'goblin', 'enemy', 3, 3), { spd: 1, maxHp: 1000, hp: 1000, eva: 0 });
    const battle = new TacticalBattle(field(), [caster, foe]);
    const rt = new RealtimeBattle(battle);
    foe.ct = 0;
    battle.applyEnemyAbility(caster, 'flare', foe.x, foe.y, foe.z);
    assert.ok(caster._charging, 'flare channels');
    withRandom(0.1, () => { for (let t = 0; t < 20000 && caster._charging; t += 50) rt.update(50); });
    assert.ok(!caster._charging, 'it fired');
    assert.ok(foe.hp < 1000);
});

test('a real-time battle plays to a winner', () => {
    const units = [
        createUnit('P1', 'raider', 'player', 1, 1), createUnit('P2', 'raider_archer', 'player', 1, 3),
        createUnit('E1', 'goblin', 'enemy', 12, 1), createUnit('E2', 'goblin', 'enemy', 12, 5),
    ];
    const battle = new TacticalBattle(field(), units);
    const rt = runRealtimeBattle(battle);
    assert.equal(battle.state, STATES.BATTLE_OVER);
    assert.ok(battle.winner === 'player' || battle.winner === 'enemy');
    assert.ok(rt.turnsTaken > 4);
});

test('the charge check is bracketed by hooks on every step, fired or not', () => {
    const calls = [];
    const map = field();
    const a = createUnit('A', 'novice', 'player', 0, 0);
    const b = createUnit('B', 'goblin', 'enemy', 5, 0);
    const rt = new RealtimeBattle(new TacticalBattle(map, [a, b]), {
        beforeCharges: () => calls.push('before'), afterCharges: () => calls.push('after'),
        onCharge: () => calls.push('charge'),
    });
    rt.update(50);
    rt.update(50);
    assert.deepEqual(calls.filter(c => c !== 'charge').slice(0, 4), ['before', 'after', 'before', 'after']);
});
