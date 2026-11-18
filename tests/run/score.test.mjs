// The run score (run/score.js): points per won battle from survivors, speed and starting party
// size, how a battle counts party turns, and how a run adds the points up.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { battleScore, speedMultiplier, partySizeMultiplier } from '../../js/run/score.js';
import { RunState } from '../../js/run/run-state.js';
import { gridMap } from '../map-fixtures.mjs';
import { createUnit } from '../../js/tactical/units.js';
import { TacticalBattle } from '../../js/tactical/battle.js';

test('a flawless win at par scores the base for its kind', () => {
    assert.equal(battleScore({ kind: 'normal', survivors: 3, partySize: 3, rounds: 6 }).points, 100);
    assert.equal(battleScore({ kind: 'elite', survivors: 3, partySize: 3, rounds: 12 }).points, 250);
    assert.equal(battleScore({ kind: 'boss', survivors: 4, partySize: 4, rounds: 18 }).points, 500);
});

test('fewer survivors score proportionally less', () => {
    assert.equal(battleScore({ kind: 'normal', survivors: 2, partySize: 4, rounds: 6 }).points, 50);
    assert.equal(battleScore({ kind: 'normal', survivors: 1, partySize: 3, rounds: 6 }).points, 33);
});

test('faster wins score more and slower ones less, within ×0.5 to ×2', () => {
    assert.equal(speedMultiplier('normal', 3), 2);
    assert.equal(speedMultiplier('normal', 1), 2, 'capped');
    assert.equal(speedMultiplier('normal', 12), 0.5);
    assert.equal(speedMultiplier('normal', 40), 0.5, 'floored');
    assert.equal(battleScore({ kind: 'normal', survivors: 3, partySize: 3, rounds: 4 }).points, 150);
});

test('runs started with one or two heroes score ×2 or ×1.5', () => {
    assert.equal(partySizeMultiplier(1), 2);
    assert.equal(partySizeMultiplier(2), 1.5);
    assert.equal(partySizeMultiplier(3), 1);
    assert.equal(battleScore({ kind: 'elite', survivors: 1, partySize: 1, rounds: 12, startPartySize: 1 }).points, 500);
    assert.equal(battleScore({ kind: 'elite', survivors: 2, partySize: 2, rounds: 12, startPartySize: 2 }).points, 375);
});

test('nonsense input never gives a negative or runaway score', () => {
    const { points } = battleScore({ kind: 'mystery', survivors: 9, partySize: 0, rounds: -3 });
    assert.ok(points >= 0 && points <= 200, `${points}`);
});

// ---- Counting in battle -----------------------------------------------------------------

const map = gridMap(Array.from({ length: 5 }, () => '.'.repeat(10)));

test('a battle counts party turns per member, and summons are neither turns nor members', () => {
    const a = createUnit('A', 'warden', 'player', 1, 1);
    const b = createUnit('B', 'evoker', 'player', 1, 2);
    const foe = createUnit('E', 'goblin', 'enemy', 8, 2);
    const battle = new TacticalBattle(map, [a, b, foe]);
    const wolf = Object.assign(createUnit('Wolf', 'wolf', 'player', 2, 2), { summonerId: a.id });
    battle.units.push(wolf);
    for (const u of [a, b, a, foe, wolf, wolf]) battle.startTurn(u);
    assert.equal(battle.partyTurns, 3);
    b.hp = 0;
    b.status.push('unconscious');
    assert.deepEqual(battle.partyResult(), { partySize: 2, survivors: 1, rounds: 2 });
});

test('each won battle adds its points to the run score, and the reward shows them', () => {
    const run = RunState.create({ jobs: ['warden', 'evoker', 'runebow'], seed: 5 });
    assert.equal(run.score, 0);
    const fight = () => {
        const ids = run.reachable();
        const id = ids[0];
        run.map.nodes[id].type = 'combat';
        run.enterNode(id);
    };
    fight();
    const reward = run.completeBattle(true, { partySize: 3, survivors: 3, rounds: 6 });
    assert.equal(reward.score.points, 100);
    assert.equal(reward.score.survivors, 3);
    assert.equal(run.score, 100);
    run.leaveNode?.();
    fight();
    run.completeBattle(true, { partySize: 3, survivors: 2, rounds: 3 });
    assert.equal(run.score, 100 + 133);
    // The score survives a save and load.
    assert.equal(RunState.deserialize(run.serialize()).score, 233);
});

test('a battle settled without a result (an older caller) adds no points', () => {
    const run = RunState.create({ jobs: ['warden'], seed: 6 });
    const id = run.reachable()[0];
    run.map.nodes[id].type = 'combat';
    run.enterNode(id);
    const reward = run.completeBattle(true);
    assert.equal(reward.score, null);
    assert.equal(run.score, 0);
});
