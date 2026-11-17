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

test('boots and trinkets fit every class, and their stats count like any other gear', async () => {
    const { jobsOfTier } = await import('../../js/tactical/data-registry.js');
    const { createMember } = await import('../../js/run/data/recruits.js');
    const { Rng } = await import('../../js/run/rng.js');
    const run = newRun();
    for (const job of jobsOfTier(1)) {
        const m = createMember(new Rng(1), job, [], {});
        assert.ok(run.canEquip(m, 'leather_boots'), `${job} boots`);
        assert.ok(run.canEquip(m, 'ember_sigil'), `${job} trinket`);
    }
    const m = run.party[1];
    run.addItem('boots_of_haste');
    run.addItem('ember_sigil');
    const before = previewUnit(run, m);
    assert.ok(run.equip(m.name, 'bootsKey', 'boots_of_haste'));
    assert.ok(run.equip(m.name, 'trinketKey', 'ember_sigil'));
    const after = previewUnit(run, m);
    assert.equal(after.move, before.move + 1);
    assert.equal(after.spd, before.spd + 2);
    assert.equal(after.mat, before.mat + 6);
    assert.ok(!run.equip(m.name, 'trinketKey', 'leather_boots'), 'boots only go on feet');
});

test('saves from before boots and trinkets load with those slots empty', () => {
    const run = newRun();
    const raw = JSON.parse(run.serialize());
    for (const m of raw.party) { delete m.appearance.bootsKey; delete m.appearance.trinketKey; }
    const loaded = RunState.deserialize(JSON.stringify(raw));
    assert.ok(loaded);
    run.addItem('iron_greaves');
    loaded.addItem('iron_greaves');
    assert.ok(loaded.equip(loaded.party[0].name, 'bootsKey', 'iron_greaves'));
});

test('boots and trinkets turn up as loot, and can be enchanted', () => {
    const run = newRun();
    const seen = new Set();
    for (let i = 0; i < 300; i++) for (const k of run._rollItems({ common: 1, uncommon: 1, rare: 1 }, 3)) seen.add(EQUIPMENT[k].slot);
    assert.ok(seen.has('boots') && seen.has('trinket'));
    assert.ok(EQUIPMENT['ember_sigil+1'].mat > EQUIPMENT.ember_sigil.mat);
    // Enchanting never raises EVA, so an EVA-only charm gains HP instead (as the Lantern does).
    assert.equal(EQUIPMENT['ghost_step_charm+1'].eva, EQUIPMENT.ghost_step_charm.eva);
    assert.ok(EQUIPMENT['ghost_step_charm+1'].maxHp > 0);
});
