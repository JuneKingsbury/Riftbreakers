/**
 * @file Placement: items and relics may say where in a run they can be found (`acts`, `realms`
 * in js/content/vocab.js). Covers the rule itself (appearsIn) and that loot and relic rolls
 * follow it. Content without placement fields can turn up anywhere, which is what every
 * shipped item and relic does today, so the roll tests restrict one entry temporarily.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { appearsIn } from '../../js/run/data/realms.js';
import { RunState } from '../../js/run/run-state.js';
import { EQUIPMENT } from '../../js/tactical/data/equipment.js';
import { RELICS } from '../../js/run/data/relics.js';

/** Runs `fn` with `patch` merged into `table[key]`, putting the entry back afterwards. */
function withPatched(table, key, patch, fn) {
    const before = table[key];
    table[key] = { ...before, ...patch };
    try { return fn(); } finally { table[key] = before; }
}

/** @test Content with no placement can turn up in any act and realm. */
test('without placement fields, content can turn up anywhere', () => {
    // GIVEN: an item that says nothing about where it is found
    const item = { name: 'Plain Ring' };

    // WHEN / THEN: it fits every act, in any realm
    for (const [act, realm] of [[1, 'wild_frontiers'], [2, 'arcane_library'], [4, 'shifting_labyrinth']]) {
        assert.equal(appearsIn(item, act, realm), true, `act ${act} in ${realm}`);
    }
});

/** @test `acts` limits content to the listed acts. */
test('content limited to some acts only turns up in those acts', () => {
    const lateItem = { acts: [3, 4] };

    assert.equal(appearsIn(lateItem, 1, 'wild_frontiers'), false);
    assert.equal(appearsIn(lateItem, 3, 'palace_fortress'), true);
});

/** @test `realms` matches the act's realm and the realms folded into it, like realm events. */
test('content limited to a realm turns up there, and in the act realm it is folded into', () => {
    // GIVEN: a relic from the Crystal Mines, a realm no act lists (it folds into Crystal Caves)
    const minesRelic = { realms: ['crystal_mines'] };

    // THEN: it can be found in an act set in Crystal Caves, but not elsewhere
    assert.equal(appearsIn(minesRelic, 1, 'crystal_caves'), true);
    assert.equal(appearsIn(minesRelic, 1, 'wild_frontiers'), false);
});

/** @test An item limited to a later act is never offered by an earlier act's loot. */
test('an item meant for act 4 never drops in act 1', () => {
    // GIVEN: an act 1 run, and a common item its party can use, limited to act 4
    // (loot prefers gear the party can use, so an unusable one might never come up anyway)
    const run = RunState.create({ jobs: ['warden', 'evoker', 'runebow'], seed: 7 });
    const key = Object.keys(EQUIPMENT).find(k => !EQUIPMENT[k].rarity && !EQUIPMENT[k].featOnly && run.usableByParty(k));
    withPatched(EQUIPMENT, key, { acts: [4] }, () => {

        // WHEN: the run rolls a lot of common loot
        const rolled = new Set();
        for (let i = 0; i < 60; i++) for (const k of run._rollItems({ common: 1 }, 5)) rolled.add(k.replace(/\+\d$/, ''));

        // THEN: the act 4 item is never among it, though other commons are
        assert.ok(rolled.size > 5, 'loot was rolled');
        assert.ok(!rolled.has(key), `${key} dropped in act 1`);
    });
});

/** @test A relic limited to one realm is only found in runs whose act is set there. */
test('a realm relic is only found in that realm', () => {
    // GIVEN: a common relic limited to the Wild Frontiers
    const key = Object.keys(RELICS).find(k => RELICS[k].rarity === 'common' && RELICS[k].statMods);
    withPatched(RELICS, key, { realms: ['wild_frontiers'] }, () => {
        const pool = (run) => run._rollRelics(['common'], Object.keys(RELICS).length);
        // WHEN: runs set in different act 1 realms roll every common relic they can find
        const runs = [];
        for (let seed = 1; seed <= 30; seed++) runs.push(RunState.create({ jobs: ['warden'], seed }));
        const there = runs.filter(r => r.realmId === 'wild_frontiers');
        const elsewhere = runs.filter(r => r.realmId !== 'wild_frontiers');
        assert.ok(there.length && elsewhere.length, 'seeds cover both cases');

        // THEN: it is in the Wild Frontiers pool and in no other
        for (const r of there) assert.ok(pool(r).includes(key));
        for (const r of elsewhere) assert.ok(!pool(r).includes(key), `found in ${r.realmId}`);
    });
});
