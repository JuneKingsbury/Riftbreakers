// Skill plans: a class's planned order of skills to learn and upgrade, bought automatically
// as soon as a member can afford the next step, and kept between sessions.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    PLANS_KEY, sanitizePlans, loadPlans, savePlans, autoAllocate, plannedNext, stepOptions, planCost,
    describeSteps, stepLabel, describePurchases, planCount,
} from '../../js/run/skill-plans.js';
import { RunState } from '../../js/run/run-state.js';
import { addXp, skillRank, isLearned, learnAbility, promote, PROMOTION_LEVEL } from '../../js/tactical/loadout.js';

function memoryStorage(initial = {}) {
    const data = new Map(Object.entries(initial));
    return { getItem: (k) => (data.has(k) ? data.get(k) : null), setItem: (k, v) => { data.set(k, String(v)); }, raw: data };
}

// A fresh Evoker: knows Fire, has 0 SP (so tests control every point).
const evoker = () => ({ name: 'Ava', job: 'evoker', origin: null, level: 1, xp: 0, sp: 0, learned: ['fire'], ranks: {} });
const L = (key) => ({ learn: key }), U = (key) => ({ upgrade: key });

test('a plan buys its steps in order as points come in, one level at a time', () => {
    const m = evoker();
    const plans = { evoker: { auto: true, steps: [L('fire'), L('ice'), U('fire'), L('thunder')] } };
    const bought = [];
    for (let lv = 0; lv < 3; lv++) {
        addXp(m, 100);
        bought.push(...autoAllocate(m, plans));
    }
    assert.deepEqual(bought, [{ key: 'ice', rank: 1 }, { key: 'fire', rank: 2 }, { key: 'thunder', rank: 1 }]);
    assert.equal(m.sp, 0);
    assert.equal(plannedNext(m, plans), null, 'the plan is finished');
});

test('when the next step costs more than the member has, they save up instead of skipping ahead', () => {
    const m = evoker();
    m.learned.push('ice');
    // Mana Surge costs 2 SP; Thunder (1 SP) comes after it and must wait.
    const plans = { evoker: { auto: true, steps: [L('ice'), L('mana_surge'), L('thunder')] } };
    m.sp = 1;
    assert.deepEqual(autoAllocate(m, plans), []);
    assert.equal(m.sp, 1, 'the point is banked');
    assert.ok(!isLearned(m, 'thunder'));
    m.sp = 3;
    assert.deepEqual(autoAllocate(m, plans).map(b => b.key), ['mana_surge', 'thunder']);
    assert.equal(m.sp, 0);
});

test('skills bought by hand count as done steps', () => {
    const m = evoker();
    m.sp = 1;
    assert.ok(learnAbility(m, 'thunder'));
    m.sp = 1;
    const plans = { evoker: { auto: true, steps: [L('thunder'), L('ice')] } };
    assert.deepEqual(autoAllocate(m, plans), [{ key: 'ice', rank: 1 }]);
});

test('upgrade steps take a skill to rank II and then III, at their rising costs', () => {
    const m = evoker();
    m.sp = 3;   // II costs 1, III costs 2
    const plans = { evoker: { auto: true, steps: [U('fire'), U('fire')] } };
    // The plan lacks a Fire learn step, so sanitizing drops the upgrades: plans must be valid.
    assert.deepEqual(sanitizePlans(plans), { evoker: { auto: true, steps: [] } });
    const valid = { evoker: { auto: true, steps: [L('fire'), U('fire'), U('fire')] } };
    assert.deepEqual(autoAllocate(m, valid), [{ key: 'fire', rank: 2 }, { key: 'fire', rank: 3 }]);
    assert.equal(skillRank(m, 'fire'), 3);
    assert.equal(m.sp, 0);
    assert.equal(planCost('evoker', valid.evoker.steps), 1 + 1 + 2);
});

test('a plan with auto-allocate off, or no plan, spends nothing', () => {
    const m = evoker();
    m.sp = 5;
    assert.deepEqual(autoAllocate(m, { evoker: { auto: false, steps: [L('fire'), L('ice')] } }), []);
    assert.deepEqual(autoAllocate(m, {}), []);
    assert.equal(m.sp, 5);
});

test('a promoted member finishes their starting plan, then follows the promoted class\'s plan', () => {
    const m = evoker();
    m.level = PROMOTION_LEVEL;
    assert.ok(promote(m, 'battlemage'));
    const plans = {
        evoker: { auto: true, steps: [L('fire'), L('ice'), L('mana_surge')] },
        battlemage: { auto: true, steps: [L('arcane_strike'), L('force_pulse')] },
    };
    m.sp = 2;   // Ice (1), then Mana Surge (2) is unaffordable: Arcane Strike waits behind it
    assert.deepEqual(autoAllocate(m, plans), [{ key: 'ice', rank: 1 }]);
    assert.equal(m.sp, 1);
    m.sp = 4;
    assert.deepEqual(autoAllocate(m, plans).map(b => b.key), ['mana_surge', 'arcane_strike', 'force_pulse']);

    // With the starting plan off, the promoted plan starts right away.
    const n = evoker();
    n.level = PROMOTION_LEVEL;
    promote(n, 'battlemage');
    n.sp = 1;
    assert.deepEqual(autoAllocate(n, { ...plans, evoker: { ...plans.evoker, auto: false } }), [{ key: 'arcane_strike', rank: 1 }]);
});

test('damaged or hand-edited plans are cleaned up instead of breaking the game', () => {
    const clean = sanitizePlans({
        evoker: { auto: true, steps: [
            L('ice'),                       // before its prerequisite Fire
            L('fire'), L('fire'),           // a duplicate
            U('ice'),                       // upgrade before the learn
            L('ice'), U('ice'), U('ice'), U('ice'),   // a third upgrade is past rank III
            L('smite'),                     // another class's skill
            L('mana_stride'), U('mana_stride'),       // movement skills can't be upgraded
            null, 'fire', { learn: 7 },
        ] },
        goblin: { auto: true, steps: [L('fire')] },   // not a player class
        warden: 'nonsense',
        seer: { auto: 'yes', steps: [] },             // nothing worth keeping
        __proto__: { auto: true },
    });
    assert.deepEqual(clean, { evoker: { auto: true, steps: [L('fire'), L('ice'), U('ice'), U('ice'), L('mana_stride')] } });
    assert.deepEqual(sanitizePlans(null), {});
    assert.deepEqual(sanitizePlans([1, 2]), {});
});

test('plans are kept between sessions, and a failed save reports failure', () => {
    const storage = memoryStorage();
    const plans = { evoker: { auto: true, steps: [L('fire'), L('ice')] }, warden: { auto: false, steps: [L('ward'), L('cure')] } };
    assert.ok(savePlans(plans, storage));
    assert.deepEqual(loadPlans(storage), plans);
    assert.equal(planCount(loadPlans(storage)), 2);
    assert.deepEqual(loadPlans(memoryStorage({ [PLANS_KEY]: '{oops' })), {});
    assert.deepEqual(loadPlans(null), {});
    assert.equal(savePlans(plans, { setItem: () => { throw new Error('QuotaExceededError'); } }), false);
    assert.equal(savePlans(plans, null), false);
});

test('the editor is only offered steps that keep the plan valid', () => {
    const keys = (opts) => opts.map(o => (o.step.learn ? `L:${o.step.learn}` : `U:${o.step.upgrade}>${o.rank}`));
    assert.deepEqual(keys(stepOptions('evoker', [])), ['L:fire', 'L:mana_stride'], 'only skills with no prerequisite');
    const after = keys(stepOptions('evoker', [L('fire'), U('fire')]));
    assert.ok(after.includes('L:ice') && after.includes('L:thunder') && after.includes('U:fire>3'));
    assert.ok(!after.includes('L:fire'));
    assert.ok(!keys(stepOptions('evoker', [L('fire'), U('fire'), U('fire')])).some(k => k.startsWith('U:fire')), 'rank III is the top');
});

test('steps and purchases read naturally', () => {
    const d = describeSteps('evoker', [L('fire'), U('fire'), U('fire')]);
    assert.deepEqual(d.map(stepLabel), ['Learn Fire', 'Upgrade Fire → II', 'Upgrade Fire → III']);
    assert.deepEqual(d.map(x => x.cost), [1, 1, 2]);
    assert.equal(describePurchases([{ name: 'Ava', key: 'ice', rank: 1 }, { name: 'Ava', key: 'fire', rank: 2 }, { name: 'Bo', key: 'cure', rank: 1 }]),
        'Ava learned Ice, upgraded Fire → II · Bo learned Cure');
});

test('a run spends its party\'s points on their plans, and still saves and loads', () => {
    const run = RunState.create({ jobs: ['evoker', 'warden'], seed: 3 });
    const [ev, wa] = run.party;
    const plans = { evoker: { auto: true, steps: [L('fire'), L('ice'), L('thunder')] } };
    const sp = wa.sp;
    const bought = run.autoAllocate(plans);
    assert.deepEqual(bought, [{ name: ev.name, key: 'ice', rank: 1 }, { name: ev.name, key: 'thunder', rank: 1 }]);
    assert.equal(wa.sp, sp, 'a class without a plan keeps its points');
    const loaded = RunState.deserialize(run.serialize());
    assert.ok(loaded.party[0].learned.includes('thunder'));
    assert.deepEqual(loaded.autoAllocate(plans), [], 'nothing left to buy');
});
