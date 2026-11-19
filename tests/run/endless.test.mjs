// Endless mode: after sealing the final rift, a run can go deeper instead of ending. Each
// endless act is a late realm whose enemies grow stronger with depth; the run already counts
// as won, and ends when the party falls (or it is abandoned).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { RunState } from '../../js/run/run-state.js';
import { ACT_REALMS } from '../../js/run/data/realms.js';
import { realmEncounters, buildEncounter } from '../../js/run/data/encounters.js';
import { newProfile, recordRun, noteEndlessDepth } from '../../js/run/profile.js';
import { canSubmit } from '../../js/run/leaderboard.js';

const RESULT = { partySize: 3, survivors: 3, rounds: 6 };
const LATE_REALMS = [...ACT_REALMS[3], ...ACT_REALMS[4]];

// A run standing at its last act, about to win the boss fight.
function atFinalBoss(options = {}) {
    const run = RunState.create({ jobs: ['warden', 'evoker', 'runebow'], seed: 21 });
    Object.assign(run.options, options);
    run.act = run.actCount;
    run._startAct();
    run.pending = { kind: 'battle', encounter: run._rollEncounter('boss') };
    return run;
}

function sealFinalRift(options) {
    const run = atFinalBoss(options);
    const reward = run.completeBattle(true, RESULT);
    assert.equal(reward.final, true);
    assert.equal(run.status, 'won');
    return run;
}

// Wins the current act's boss and moves on.
function beatBoss(run) {
    run.pending = { kind: 'battle', encounter: run._rollEncounter('boss') };
    const reward = run.completeBattle(true, RESULT);
    run.pending = null;
    run.currentNodeId = Object.values(run.map.nodes).find(n => n.type === 'boss').id;
    run.leaveNode();
    return reward;
}

test('sealing the final rift offers endless mode, except on a daily run or once declined', () => {
    assert.equal(sealFinalRift().canGoEndless, true);
    assert.equal(sealFinalRift({ daily: '2026-11-19' }).canGoEndless, false);
    const declined = sealFinalRift();
    declined.endlessDeclined = true;
    assert.equal(declined.canGoEndless, false);
});

test('going deeper reopens the run in a late realm, one act past the last, already counted as won', () => {
    // GIVEN: a run that has just sealed the final rift
    const run = sealFinalRift();
    const lastRealm = run.realmId, lastAct = run.act;

    // WHEN: it goes deeper
    assert.equal(run.goEndless(), true);

    // THEN
    assert.equal(run.status, 'active');
    assert.equal(run.sealedRift, true);
    assert.equal(run.endless.depth, 1);
    assert.equal(run.act, lastAct + 1);
    assert.ok(LATE_REALMS.includes(run.realmId), `${run.realmId} is a late realm`);
    assert.notEqual(run.realmId, lastRealm, 'not the realm it just left');
    assert.ok(run.map && Object.values(run.map.nodes).some(n => n.type === 'boss'), 'a fresh act map, ending in a boss');
    assert.equal(run.actLabel, 'Depth 1');
    assert.equal(run.goEndless(), false, 'only once');
});

test("an endless act's enemies are stronger than the same fight in the last act, more so with depth", () => {
    const run = sealFinalRift();
    run.goEndless();
    const hpAt = () => {
        const enc = run._rollEncounter('normal');
        const { def, zone } = realmEncounters(run.realmId, 'normal').find(e => e.def.id === enc.id);
        const plain = buildEncounter(def, 'normal', 4, run.party.length, false, run.realmId, zone);
        return enc.roster[0].statMods.maxHp - (plain.roster[0].statMods.maxHp ?? 0);
    };
    assert.equal(hpAt(), 10, 'depth 1: +10 max HP over the last act');
    run.endless.depth = 3;
    assert.equal(hpAt(), 30, 'depth 3: +30');
});

test('an endless boss is not the end: it gives its relic choice, and the next realm is a depth deeper', () => {
    const run = sealFinalRift();
    run.goEndless();

    const reward = beatBoss(run);

    assert.ok(!reward.final, 'not a final win');
    assert.ok(reward.relics.length > 0, 'a boss relic choice');
    assert.equal(run.status, 'active');
    assert.equal(run.endless.depth, 2);
    assert.equal(run.act, run.actCount, 'the run gains a realm per depth');
});

test('a run that goes deeper is recorded as it was when it sealed the rift; endless play only adds its depth', () => {
    // GIVEN: a run that seals the final rift and is recorded then, as the game does
    const run = sealFinalRift();
    const profile = newProfile();
    const renown = recordRun(profile, run);
    const sealed = { score: run.score, renown: profile.renown, wins: profile.stats.wins };
    const best = profile.bestRuns[0];

    // WHEN: it goes two realms deeper, scoring more, and then falls
    run.goEndless();
    beatBoss(run);
    run.pending = { kind: 'battle', encounter: run._rollEncounter('normal') };
    run.completeBattle(false);
    noteEndlessDepth(profile, run);

    // THEN: the record is the sealed run's, a submittable four-realm win; only the depth is new
    assert.ok(run.score > sealed.score, 'it kept scoring for fun');
    assert.equal(run.sealedScore, sealed.score);
    assert.equal(profile.renown, sealed.renown);
    assert.equal(profile.stats.wins, sealed.wins);
    assert.equal(profile.stats.runs, 1);
    assert.equal(profile.bestRuns.length, 1);
    assert.deepEqual(profile.bestRuns[0], best);
    assert.equal(best.won, true);
    assert.equal(best.score, sealed.score);
    assert.equal(best.realms.length, 4);
    assert.ok(canSubmit(best), 'the sealed win can go on the leaderboard');
    assert.ok(renown >= 25, 'with the victory bonus');
    assert.equal(profile.stats.bestDepth, 2);
});

test('an endless run survives a save and a load mid-way', () => {
    const run = sealFinalRift();
    run.goEndless();
    beatBoss(run);
    const loaded = RunState.deserialize(run.serialize());
    assert.deepEqual(loaded.endless, { depth: 2 });
    assert.equal(loaded.sealedRift, true);
    assert.deepEqual(loaded.realms, run.realms);
    assert.equal(loaded.realmId, run.realmId);
});
