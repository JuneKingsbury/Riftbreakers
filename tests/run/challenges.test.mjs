// Challenge runs (Feats > Challenges): Empty Purse (no gold, no shops), Humble Origins (no
// promotions) and Take It or Leave It (one reward choice), and how a won challenge is
// remembered in the profile.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { RunState } from '../../js/run/run-state.js';
import { newProfile, runOptions, recordRun, sanitizeProfile, CHALLENGES } from '../../js/run/profile.js';
import { generateActMap } from '../../js/run/map-gen.js';
import { Rng } from '../../js/run/rng.js';
import { RELICS } from '../../js/run/data/relics.js';
import { EVENTS } from '../../js/run/data/events.js';
import { canSubmit } from '../../js/run/leaderboard.js';
import { promotionOptions } from '../../js/tactical/loadout.js';

const JOBS = ['warden', 'evoker', 'runebow'];
const run = (opts = {}, seed = 5) => RunState.create({ jobs: JOBS, seed, options: { ...runOptions(null), ...opts } });
function enter(r, type) {
    const id = r.reachable()[0];
    r.map.nodes[id].type = type;
    return r.enterNode(id);
}
const winBattle = (r, type = 'combat') => {
    enter(r, type);
    return r.completeBattle(true, { survivors: 3, partySize: 3, rounds: 6 });
};
const types = (map) => Object.values(map.nodes).map(n => n.type);

// ---- Empty Purse ----

test('an Empty Purse run starts with no gold and wins none from battles', () => {
    const r = run({ challenge: 'no_gold' });
    assert.equal(r.gold, 0);
    const reward = winBattle(r);
    assert.equal(reward.gold, 0);
    assert.equal(r.gold, 0);
    // The same fight pays gold on a normal run.
    assert.ok(winBattle(run()).gold > 0);
});

test('Empty Purse treasure, turned-away recruits and events pay no gold', () => {
    const r = run({ challenge: 'no_gold' });
    enter(r, 'treasure');
    assert.ok(r.claimTreasure());
    assert.equal(r.gold, 0);

    const r2 = run({ challenge: 'no_gold' });
    enter(r2, 'recruit');
    assert.ok(r2.declineRecruit());
    assert.equal(r2.gold, 0);

    const r3 = run({ challenge: 'no_gold' });
    const fx = r3.applyEffect({ gold: 50 });
    assert.equal(r3.gold, 0);
    assert.equal(fx.goldLost, true, 'the event result can say the gold was lost');
});

test('an Empty Purse event that pays gold says the gold slipped away', () => {
    const ev = EVENTS.find(e => e.choices.some(c => c.effect?.gold > 0 && !c.requires && !c.effect.battle && !c.outcomes));
    const index = ev.choices.findIndex(c => c.effect?.gold > 0 && !c.requires && !c.effect.battle && !c.outcomes);
    const r = run({ challenge: 'no_gold' });
    enter(r, 'event');
    r.pending.eventId = ev.id;
    const { text } = r.chooseEvent(index);
    assert.equal(r.gold, 0);
    assert.match(text, /Empty Purse/);
});

test('an Empty Purse run never meets a shop on any act map', () => {
    // Across many runs and maps, so a shop-free result isn't luck.
    for (let seed = 1; seed <= 40; seed++) {
        assert.ok(!types(run({ challenge: 'no_gold' }, seed).map).includes('shop'), `run seed ${seed}`);
    }
    assert.ok(Array.from({ length: 40 }, (_, i) => run({}, i + 1)).some(r => types(r.map).includes('shop')), 'normal runs do meet shops');
    for (let seed = 1; seed <= 40; seed++) {
        assert.ok(!types(generateActMap(new Rng(seed), 2, { shops: false })).includes('shop'), `seed ${seed}`);
    }
    const withShops = Array.from({ length: 40 }, (_, i) => generateActMap(new Rng(i + 1), 2)).some(m => types(m).includes('shop'));
    assert.ok(withShops, 'normal maps do have shops');
});

test('an Empty Purse run never finds gold or shop relics', () => {
    const r = run({ challenge: 'no_gold' });
    const all = r._rollRelics(['common', 'uncommon', 'rare'], Object.keys(RELICS).length);
    assert.ok(all.length > 0);
    for (const k of all) assert.ok(!RELICS[k].goldMult && !RELICS[k].shopDiscount, k);
});

// ---- Humble Origins ----

test('no one can promote on a Humble Origins run, even when ready', () => {
    const r = run({ challenge: 'no_promotions', startLevel: 5 });
    const m = r.party[0];
    const job = promotionOptions(m)[0];
    assert.ok(job, 'the member has a class to promote into');
    assert.equal(r.canPromote(m), false);
    assert.equal(r.promote(m.name, job), false);
    assert.equal(m.origin ?? null, null, 'still in their Tier 1 class');

    const normal = run({ startLevel: 5 });
    assert.equal(normal.canPromote(normal.party[0]), true);
    assert.ok(normal.promote(normal.party[0].name, job));
});

test('a skill plan cannot promote anyone on a Humble Origins run', () => {
    const r = run({ challenge: 'no_promotions', startLevel: 5 });
    const m = r.party[0];
    const plans = { [m.job]: { auto: true, promotion: promotionOptions(m)[0], steps: [] } };
    const done = r.autoAllocate(plans);
    assert.ok(!done.some(d => d.promoted));
    assert.equal(m.origin ?? null, null);
});

// ---- Take It or Leave It ----

test('Take It or Leave It battle rewards offer exactly one item', () => {
    for (const type of ['combat', 'elite']) {
        const reward = winBattle(run({ challenge: 'one_choice' }), type);
        assert.equal(reward.items.length, 1, type);
        assert.ok(winBattle(run(), type).items.length > 1, `${type} offers more on a normal run`);
    }
});

test('Take It or Leave It bosses offer one relic instead of three', () => {
    const reward = winBattle(run({ challenge: 'one_choice' }), 'boss');
    assert.equal(reward.relics.length, 1);
    assert.equal(reward.items.length, 1);
    assert.equal(winBattle(run(), 'boss').relics.length, 3);
});

test('a relic that adds item choices adds none on Take It or Leave It', () => {
    const extra = Object.keys(RELICS).find(k => RELICS[k].extraItemChoice);
    const r = run({ challenge: 'one_choice' });
    r.addRelic(extra);
    assert.equal(winBattle(r).items.length, 1);
});

// ---- The profile ----

const finish = (r, won) => { r.status = won ? 'won' : 'lost'; r.stats.battles = 3; };

test('winning a challenge checks it off with the first winning team, and counts later wins', () => {
    const profile = newProfile();
    const first = run({ challenge: 'one_choice', tier: 2 });
    finish(first, true);
    recordRun(profile, first, new Date('2026-11-01T00:00:00Z'));
    const rec = profile.challenges.one_choice;
    assert.equal(rec.wins, 1);
    assert.deepEqual(rec.first.party.map(m => m.name), first.party.map(m => m.name));
    assert.equal(rec.first.tier, 2);

    const again = run({ challenge: 'one_choice' }, 9);
    finish(again, true);
    recordRun(profile, again);
    assert.equal(profile.challenges.one_choice.wins, 2);
    assert.deepEqual(profile.challenges.one_choice.first.party.map(m => m.name), first.party.map(m => m.name), 'the first team is kept');
});

test('losing a challenge or winning a normal run checks off nothing', () => {
    const profile = newProfile();
    const lost = run({ challenge: 'no_gold' });
    finish(lost, false);
    recordRun(profile, lost);
    const plain = run();
    finish(plain, true);
    recordRun(profile, plain);
    assert.deepEqual(profile.challenges, {});
});

test('challenge wins survive a save round trip, and unknown challenges are dropped', () => {
    const profile = newProfile();
    const r = run({ challenge: 'no_promotions' });
    finish(r, true);
    recordRun(profile, r);
    const back = sanitizeProfile(JSON.parse(JSON.stringify({ ...profile, challenges: { ...profile.challenges, made_up: profile.challenges.no_promotions } })));
    assert.deepEqual(Object.keys(back.challenges), ['no_promotions']);
    assert.equal(back.challenges.no_promotions.wins, 1);
    assert.equal(back.challenges.no_promotions.first.challenge, 'no_promotions');
    assert.deepEqual(sanitizeProfile({ challenges: 'nonsense' }).challenges, {});
});

test('a challenge run is remembered with its challenge but stays off the leaderboard', () => {
    const profile = newProfile();
    const r = run({ challenge: 'no_gold' });
    finish(r, true);
    r.score = 500;
    recordRun(profile, r);
    const best = profile.bestRuns[0];
    assert.equal(best.challenge, 'no_gold');
    assert.equal(canSubmit(best), false);

    const plain = run();
    finish(plain, true);
    plain.score = 500;
    recordRun(profile, plain);
    assert.ok(canSubmit(profile.bestRuns.find(w => !w.challenge)));
});

test('every challenge has a name and a description', () => {
    assert.deepEqual(Object.keys(CHALLENGES).sort(), ['no_gold', 'no_promotions', 'one_choice']);
    for (const c of Object.values(CHALLENGES)) assert.ok(c.name && c.desc);
});
