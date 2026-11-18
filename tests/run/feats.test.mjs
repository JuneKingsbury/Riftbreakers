// Feats: the item collection, the boss bestiary and the latest victories, kept in the
// profile across runs.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { RunState } from '../../js/run/run-state.js';
import {
    newProfile, sanitizeProfile, noteItems, noteBosses, recordRun, winSummary, BEST_WINS, BOSS_IDS,
} from '../../js/run/profile.js';
import { itemCatalog, bossCatalog, percent } from '../../js/run/feats.js';
import { EQUIPMENT } from '../../js/tactical/data/equipment.js';

const newRun = (seed = 3) => RunState.create({ jobs: ['warden', 'evoker', 'runebow'], seed });

test('the collection lists every item once, and the bestiary every boss once', () => {
    const items = Object.values(itemCatalog()).flat();
    assert.equal(items.length, Object.keys(EQUIPMENT).length);
    assert.equal(new Set(items).size, items.length);
    const bosses = bossCatalog().flatMap(a => a.bosses.map(b => b.id));
    assert.deepEqual([...bosses].sort(), [...BOSS_IDS].sort());
    assert.ok(bossCatalog().flatMap(a => a.bosses).every(b => b.name.startsWith('The ')), 'real names, not ids');
});

test('items count as found once held, in the bag or worn, and an enchanted find counts as its item', () => {
    const profile = newProfile();
    const run = newRun();
    assert.ok(noteItems(profile, run), 'starting gear counts');
    assert.ok(profile.items.includes(run.party[0].appearance.armorKey));
    run.addItem('ember_sigil+2');
    assert.ok(noteItems(profile, run));
    assert.ok(profile.items.includes('ember_sigil') && !profile.items.includes('ember_sigil+2'));
    assert.equal(noteItems(profile, run), false, 'nothing new the second time');
    run.removeItem('ember_sigil+2');
    noteItems(profile, run);
    assert.ok(profile.items.includes('ember_sigil'), 'selling or losing it keeps the feat');
});

test('each boss win is counted once, even when the run is saved and loaded in between', () => {
    const profile = newProfile();
    const run = newRun();
    run.bossesDefeated = ['boss_dire_wolf'];
    assert.ok(noteBosses(profile, run));
    assert.equal(noteBosses(profile, run), false);
    const loaded = RunState.deserialize(run.serialize());
    loaded.bossesDefeated.push('boss_dire_wolf', 'boss_high_king');
    noteBosses(profile, loaded);
    assert.deepEqual(profile.bossKills, { boss_dire_wolf: 2, boss_high_king: 1 });
});

test('winning runs are remembered by score: the best ten, highest first, ties newest first', () => {
    const profile = newProfile();
    const scores = [300, 1200, 50, 900, 900, 10, 700, 2000, 400, 650, 800, 120];
    scores.forEach((score, i) => {
        const run = newRun(i + 1);
        run.status = 'won';
        run.score = score;
        run.stats = { floors: 40 + i, battles: 20, elites: 3, bosses: 3 };
        recordRun(profile, run, new Date(Date.UTC(2026, 10, i + 1)));
    });
    assert.equal(profile.bestWins.length, BEST_WINS);
    assert.deepEqual(profile.bestWins.map(w => w.score), [2000, 1200, 900, 900, 800, 700, 650, 400, 300, 120]);
    // The two 900s: the later one (floors 44) ranks first.
    assert.deepEqual(profile.bestWins.slice(2, 4).map(w => w.floors), [44, 43]);
    assert.equal(profile.bestWins[0].party.length, 3);
    assert.ok(profile.bestWins[0].renown > 0);
    assert.ok(profile.bestWins.every(w => w.id), 'each win has an id for the leaderboard');
    assert.equal(new Set(profile.bestWins.map(w => w.id)).size, BEST_WINS);

    const lost = newRun(99);
    lost.status = 'lost';
    lost.score = 99999;
    recordRun(profile, lost);
    assert.equal(profile.bestWins[0].score, 2000, 'a loss is not a victory');

    const low = newRun(100);
    low.status = 'won';
    low.score = 5;
    recordRun(profile, low);
    assert.ok(!profile.bestWins.some(w => w.score === 5), 'a win below the best ten is not kept');
});

test('a win remembers its start size and Rift Tier; wins saved before scoring load with score 0', () => {
    const run = newRun(3);
    run.status = 'won';
    run.score = 450;
    run.startPartySize = 1;
    run.options = { ...run.options, tier: 2 };
    const w = winSummary(run, 30);
    assert.equal(w.score, 450);
    assert.equal(w.startPartySize, 1);
    assert.equal(w.tier, 2);
    const old = { ...w };
    delete old.score; delete old.startPartySize; delete old.tier; delete old.id;
    const p = sanitizeProfile({ recentWins: [old] });
    assert.equal(p.bestWins.length, 1);
    assert.equal(p.bestWins[0].score, 0);
    assert.equal(p.bestWins[0].startPartySize, 3);
});

test('damaged feats data loads as something valid', () => {
    const run = newRun();
    const good = winSummary(run, 30, new Date('2026-11-17T00:00:00Z'));
    const p = sanitizeProfile({
        items: ['iron_sword', 'iron_sword', 'iron_sword+1', 'not_an_item', 7, '__proto__'],
        bossKills: { boss_dire_wolf: 3, boss_fake: 9, boss_high_king: -2, boss_unraveler: 'lots' },
        bestWins: [good, { party: [] }, null, { party: [{ job: 'not_a_class' }] }, ...Array(12).fill(good)],
    });
    assert.deepEqual(p.items, ['iron_sword']);
    assert.deepEqual(p.bossKills, { boss_dire_wolf: 3 });
    assert.equal(p.bestWins.length, BEST_WINS);
    assert.deepEqual(sanitizeProfile({}).bestWins, []);
});

test('completion is a whole percent, and only 100% when everything is found', () => {
    assert.equal(percent(0, 156), 0);
    assert.equal(percent(155, 156), 99);
    assert.equal(percent(156, 156), 100);
    assert.equal(percent(1, 0), 0);
});
