// Build focus: each member follows a suggested build for their class (and, once promoted, one
// for their promotion), their own skill plan, or nothing. Chosen when they join and when they
// can promote; nothing is spent while the choice is still open.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    buildsFor, focusAllocate, focusNext, buildChoices, buildFromValue, buildSummary, sanitizeBuild, suggestedPlanSteps,
    pointsToSpend,
} from '../../js/run/builds.js';
import { sanitizeSteps } from '../../js/run/skill-plans.js';
import { RunState } from '../../js/run/run-state.js';
import { JOB_DATA } from '../../js/content/jobs.js';
import { isUpgradeable, rankChanges } from '../../js/tactical/data-registry.js';
import { isLearned, skillRank, learnAbility, PROMOTION_LEVEL } from '../../js/tactical/loadout.js';

// A fresh Runebow on a build: knows Long Shot, has 0 SP (so tests control every point).
const runebow = (build = { mode: 'focus', focus: 'retaliation' }) => ({
    name: 'Ava', job: 'runebow', origin: null, level: 1, xp: 0, sp: 0, learned: ['long_shot'], ranks: {},
    loadout: { reaction: null, support: null, movement: null }, build,
});
const spend = (m, sp) => { m.sp = sp; return focusAllocate(m); };
const L = (key) => ({ learn: key }), U = (key) => ({ upgrade: key });

test('every player class offers two builds, and none upgrades a skill past rank III or one that has no ranks', () => {
    for (const [job, def] of Object.entries(JOB_DATA).filter(([, j]) => j.tier)) {
        assert.equal(buildsFor(job).length, 2, job);
        for (const b of buildsFor(job)) {
            const ups = {};
            for (const s of b.steps.filter(x => x.endsWith('+')).map(x => x.slice(0, -1))) {
                ups[s] = (ups[s] || 0) + 1;
                assert.ok(isUpgradeable(s), `${job} ${b.key}: ${s} has no ranks`);
                assert.ok(ups[s] <= 2, `${job} ${b.key}: ${s} upgraded past rank III`);
                // Within one build; a Tier 2 build's upgrade of a Tier 1 skill may go one rank further.
                assert.ok(rankChanges(s, ups[s]).length > 0, `${job} ${b.key}: upgrading ${s} to rank ${ups[s] + 1} changes nothing`);
            }
            assert.ok(def.learnable, job);
        }
    }
});

test('a member on a build spends each point as it comes in, in the build\'s order', () => {
    // Retaliation: Return Fire, Long Shot II, Rune Arrow, Concentrate (2 SP), ...
    const m = runebow();
    assert.deepEqual(spend(m, 1), [{ key: 'return_fire', rank: 1 }]);
    assert.deepEqual(spend(m, 1), [{ key: 'long_shot', rank: 2 }]);
    assert.deepEqual(spend(m, 2), [{ key: 'rune_arrow', rank: 1 }], 'one point left: Concentrate costs 2');
    assert.equal(m.sp, 1, 'the point is banked rather than spent on a later, cheaper step');
    m.sp += 1;
    assert.deepEqual(focusAllocate(m), [{ key: 'concentrate', rank: 1 }]);
    assert.equal(m.loadout.reaction, 'return_fire', 'a reaction the build learns goes into its slot');
    assert.equal(m.loadout.support, 'concentrate');
});

test('the other build of the same class spends the same points quite differently', () => {
    const m = runebow({ mode: 'focus', focus: 'area' });
    spend(m, 4);
    assert.ok(isLearned(m, 'pinning_shot') && isLearned(m, 'arrow_rain'));
    assert.ok(!isLearned(m, 'return_fire'));
});

test('skills bought by hand count toward the build', () => {
    const m = runebow();
    m.sp = 1;
    assert.ok(learnAbility(m, 'return_fire'));
    assert.deepEqual(spend(m, 1), [{ key: 'long_shot', rank: 2 }]);
});

test('once the build is done, the rest of the skill tree is bought without pushing out its passives', () => {
    const m = runebow();
    m.sp = 40;
    focusAllocate(m);
    for (const key of Object.keys(JOB_DATA.runebow.learnable)) assert.ok(isLearned(m, key), key);
    assert.equal(skillRank(m, 'arrow_rain'), 3, 'leftover skills reach rank III too');
    assert.equal(focusNext(m), null);
    assert.equal(m.loadout.reaction, 'return_fire');
    assert.equal(m.loadout.movement, 'fleet_step', 'Retaliation names Fleet Step, so it is slotted');
});

test('after promotion the promotion\'s build comes first, then what the starting build still lacks', () => {
    const m = runebow();
    spend(m, 2);   // Return Fire, Long Shot II
    m.origin = 'runebow';
    m.job = 'skyhunter';
    m.build = sanitizeBuild(m, { ...m.build, promoFocus: 'single' });
    // Single Target opens with Piercing Shot, which needs Hunter's Mark: that is learned first.
    assert.deepEqual(spend(m, 2), [{ key: 'hunters_mark', rank: 1 }, { key: 'piercing_shot', rank: 1 }]);
    assert.deepEqual(spend(m, 2), [{ key: 'eagle_eye', rank: 1 }]);
    assert.ok(!isLearned(m, 'rune_arrow'), 'the starting build waits until the promotion build is done');
    assert.equal(buildSummary(m), 'Retaliation → Single Target');
});

test('manual members spend nothing, and plan members follow their plan even with auto-allocate off', () => {
    const run = RunState.create({ jobs: ['runebow', 'evoker'], seed: 5 });
    const [rb, ev] = run.party;
    const plans = { evoker: { auto: false, steps: [L('ice'), L('thunder')] } };
    assert.ok(run.setBuild(rb.name, { mode: 'manual' }));
    assert.ok(run.setBuild(ev.name, { mode: 'plan' }));
    const sp = rb.sp;
    const bought = run.autoAllocate(plans);
    assert.equal(rb.sp, sp);
    assert.deepEqual(bought.map(b => b.key), ['ice', 'thunder']);
});

test('a new run spends nothing until each member has a build, and recruits get asked too', () => {
    const run = RunState.create({ jobs: ['runebow', 'warden'], seed: 5 });
    assert.deepEqual(run.membersNeedingBuild().map(m => m.name), run.party.map(m => m.name));
    assert.deepEqual(run.autoAllocate({}), [], 'nothing bought while the choice is open');
    for (const m of run.party) run.setBuild(m.name, buildFromValue(m, `focus:${buildsFor(m.job)[0].key}`));
    assert.deepEqual(run.membersNeedingBuild(), []);
    assert.ok(run.autoAllocate({}).length > 0, 'starting points go to the builds');

    run.party.push({ ...run.party[1], name: 'Newcomer', build: undefined });
    assert.deepEqual(run.membersNeedingBuild().map(m => m.name), ['Newcomer']);
});

test('a member who reaches the promotion level is offered it once; "not now" leaves promoting to the Party menu', () => {
    const run = RunState.create({ jobs: ['runebow'], seed: 5 });
    const [m] = run.party;
    run.setBuild(m.name, { mode: 'focus', focus: 'area' });
    assert.equal(run.memberReadyToPromote(), null);
    m.level = PROMOTION_LEVEL;
    assert.equal(run.memberReadyToPromote()?.name, m.name);
    assert.ok(run.declinePromotion(m.name));
    assert.equal(run.memberReadyToPromote(), null);
    assert.ok(run.canPromote(m), 'still free to promote by hand');

    assert.ok(run.promoteWithBuild(m.name, 'beastcaller', 'brawler'));
    assert.equal(m.job, 'beastcaller');
    assert.deepEqual(m.build, { mode: 'focus', focus: 'area', promoFocus: 'brawler', promoAsked: true });
    assert.equal(run.memberReadyToPromote(), null);
});

test('picking a promotion build switches a manual member to build focus; promoting without one keeps them manual', () => {
    const run = RunState.create({ jobs: ['runebow', 'warden'], seed: 5 });
    const [rb, wa] = run.party;
    for (const m of run.party) { run.setBuild(m.name, { mode: 'manual' }); m.level = PROMOTION_LEVEL; }
    assert.ok(run.promoteWithBuild(rb.name, 'skyhunter', 'cover'));
    assert.equal(rb.build.mode, 'focus');
    assert.equal(buildSummary(rb), 'Retaliation → Covering Fire', 'the starting focus defaults to the first build');
    assert.ok(run.promoteWithBuild(wa.name, 'paladin', null));
    assert.equal(wa.build.mode, 'manual');
});

test('on Humble Origins no one is offered promotion', () => {
    const run = RunState.create({ jobs: ['runebow'], seed: 5, options: { ...RunState.create({ seed: 1 }).options, challenge: 'no_promotions' } });
    const [m] = run.party;
    run.setBuild(m.name, { mode: 'focus', focus: 'area' });
    m.level = PROMOTION_LEVEL;
    assert.equal(run.memberReadyToPromote(), null);
});

test('build choices survive saving, and damaged choices are cleaned up', () => {
    const run = RunState.create({ jobs: ['runebow'], seed: 5 });
    run.setBuild(run.party[0].name, { mode: 'focus', focus: 'area' });
    const loaded = RunState.deserialize(run.serialize());
    assert.deepEqual(loaded.party[0].build, { mode: 'focus', focus: 'area' });
    assert.ok(loaded.buildFocus);

    const m = runebow();
    assert.equal(sanitizeBuild(m, { mode: 'cheat' }), null);
    assert.deepEqual(sanitizeBuild(m, { mode: 'focus', focus: 'nope' }), { mode: 'focus', focus: 'retaliation' });
    assert.deepEqual(sanitizeBuild(m, { mode: 'manual', promoFocus: 'single', promoAsked: 'yes' }), { mode: 'manual' });
});

test('the choices offered: the class\'s builds, the skill plan when there is one, and manual', () => {
    const m = runebow();
    assert.deepEqual(buildChoices(m, {}).map(c => c.value), ['focus:retaliation', 'focus:area', 'manual']);
    const plans = { runebow: { auto: false, steps: [L('return_fire')] } };
    assert.deepEqual(buildChoices(m, plans).map(c => c.value), ['focus:retaliation', 'focus:area', 'plan', 'manual']);
    m.origin = 'runebow'; m.job = 'skyhunter';
    assert.deepEqual(buildChoices(m, {}).map(c => c.value), ['focus:single', 'focus:cover', 'manual'], 'promoted: the promotion\'s builds');
});

test('a suggested build loads into the plan editor as a valid plan through its promotion', () => {
    for (const [job, def] of Object.entries(JOB_DATA).filter(([, j]) => j.tier === 1)) {
        for (const a of buildsFor(job)) {
            for (const promotion of def.promotions) {
                for (const b of buildsFor(promotion)) {
                    const steps = suggestedPlanSteps(job, a.key, promotion, b.key);
                    assert.deepEqual(sanitizeSteps(job, promotion, steps), steps, `${job} ${a.key} → ${promotion} ${b.key}`);
                }
            }
        }
    }
    assert.deepEqual(suggestedPlanSteps('runebow', 'retaliation').slice(0, 4), [L('long_shot'), L('return_fire'), U('long_shot'), L('rune_arrow')]);
});

test('a reaction the builds never asked for doesn\'t replace the one they slotted', () => {
    // Retaliation slots Return Fire; Single Target never names Overwatch, so it only comes as filler.
    const m = runebow();
    spend(m, 1);
    m.origin = 'runebow';
    m.job = 'skyhunter';
    m.build = sanitizeBuild(m, { ...m.build, promoFocus: 'single' });
    spend(m, 60);
    assert.ok(isLearned(m, 'overwatch'));
    assert.equal(m.loadout.reaction, 'return_fire');
    assert.equal(m.loadout.support, 'eagle_eye', 'a passive the promotion build names does take the slot');
});

test('points earned while the promotion choice is open wait for it, so they can go to the new class', () => {
    const run = RunState.create({ jobs: ['runebow'], seed: 5 });
    const [m] = run.party;
    run.setBuild(m.name, { mode: 'focus', focus: 'area' });
    run.autoAllocate({});
    m.level = PROMOTION_LEVEL;
    m.sp = 2;
    assert.deepEqual(run.autoAllocate({}), [], 'held until the player picks');
    assert.ok(run.promoteWithBuild(m.name, 'skyhunter', 'cover'));
    assert.deepEqual(run.autoAllocate({}).map(b => b.key), ['hunters_mark', 'overwatch']);

    // "Not now" releases them to the starting build.
    const run2 = RunState.create({ jobs: ['runebow'], seed: 5 });
    const [m2] = run2.party;
    run2.setBuild(m2.name, { mode: 'focus', focus: 'area' });
    m2.level = PROMOTION_LEVEL;
    assert.deepEqual(run2.autoAllocate({}), []);
    run2.declinePromotion(m2.name);
    assert.ok(run2.autoAllocate({}).length > 0);
});

test('only members who spend by hand show points to spend, even while a build is saving up', () => {
    const plans = { runebow: { auto: true, steps: [L('return_fire')] } };
    assert.equal(pointsToSpend({ ...runebow({ mode: 'manual' }), sp: 5 }, plans), true);
    assert.equal(pointsToSpend({ ...runebow(), sp: 5 }, plans), false);
    assert.equal(pointsToSpend({ ...runebow({ mode: 'plan' }), sp: 5 }, plans), false);
    // Runs from before build focus: auto-allocate on the class's skill plan decides.
    assert.equal(pointsToSpend({ ...runebow(null), sp: 5 }, plans), false);
    assert.equal(pointsToSpend({ ...runebow(null), sp: 5 }, { runebow: { ...plans.runebow, auto: false } }), true);
});
