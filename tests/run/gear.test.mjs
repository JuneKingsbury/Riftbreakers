// The equipment screen's comparisons: what equipping a bag item would do to a character's
// stats, the same numbers the battle uses.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { RunState } from '../../js/run/run-state.js';
import { equipDelta, previewUnit, STATS } from '../../js/run/member-stats.js';
import { EQUIPMENT } from '../../js/tactical/data/equipment.js';

const newRun = () => RunState.create({ jobs: ['warden', 'evoker', 'runebow'], seed: 5 });

test('comparing an item shows exactly how the stats would change, and equipping makes it so', () => {
    const run = newRun();
    const m = run.party[1];   // Evoker, with a wooden wand
    run.addItem('wooden_wand+2');
    const { before, after, delta } = equipDelta(run, m, 'weaponKey', 'wooden_wand+2');
    assert.ok(delta.mat > 0, 'the enchanted wand adds MAT');
    for (const [s] of STATS) assert.equal(after[s] - before[s], delta[s], s);

    assert.ok(run.equip(m.name, 'weaponKey', 'wooden_wand+2'));
    const now = previewUnit(run, m);
    for (const [s] of STATS) assert.equal(now[s], after[s], `${s} matches the preview`);
});

test('the comparison never changes the character or the bag', () => {
    const run = newRun();
    const m = run.party[0];
    run.addItem('iron_sword');
    const snapshot = JSON.stringify([m.appearance, run.inventory]);
    equipDelta(run, m, 'weaponKey', 'iron_sword');
    equipDelta(run, m, 'armorKey', null);
    assert.equal(JSON.stringify([m.appearance, run.inventory]), snapshot);
});

test('taking an item off shows its stats leaving', () => {
    const run = newRun();
    const m = run.party[0];
    const armor = m.appearance.armorKey;
    const { delta } = equipDelta(run, m, 'armorKey', null);
    assert.equal(delta.def, -(EQUIPMENT[armor].def || 0));
});

test('relics count in the preview, as they do in battle', () => {
    const run = newRun();
    const m = run.party[0];
    const base = previewUnit(run, m).atk;
    run.addRelic('whetstone');   // +2 ATK for everyone
    assert.equal(previewUnit(run, m).atk, base + 2);
});
