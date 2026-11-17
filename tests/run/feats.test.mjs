// Feats: the item collection, the boss bestiary and the latest victories, kept in the
// profile across runs.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { RunState } from '../../js/run/run-state.js';
import {
    newProfile, sanitizeProfile, noteItems, noteBosses, recordRun, winSummary, RECENT_WINS, BOSS_IDS,
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

test('winning a run is remembered, keeping only the latest five, newest first', () => {
    const profile = newProfile();
    for (let i = 1; i <= RECENT_WINS + 2; i++) {
        const run = newRun(i);
        run.status = 'won';
        run.stats = { floors: 40 + i, battles: 20, elites: 3, bosses: 3 };
        recordRun(profile, run, new Date(Date.UTC(2026, 10, i)));
    }
    assert.equal(profile.recentWins.length, RECENT_WINS);
    assert.deepEqual(profile.recentWins.map(w => w.floors), [47, 46, 45, 44, 43]);
    assert.equal(profile.recentWins[0].party.length, 3);
    assert.ok(profile.recentWins[0].renown > 0);

    const lost = newRun(9);
    lost.status = 'lost';
    recordRun(profile, lost);
    assert.equal(profile.recentWins[0].floors, 47, 'a loss is not a victory');
});

test('damaged feats data loads as something valid', () => {
    const run = newRun();
    const good = winSummary(run, 30, new Date('2026-11-17T00:00:00Z'));
    const p = sanitizeProfile({
        items: ['iron_sword', 'iron_sword', 'iron_sword+1', 'not_an_item', 7, '__proto__'],
        bossKills: { boss_dire_wolf: 3, boss_fake: 9, boss_high_king: -2, boss_unraveler: 'lots' },
        recentWins: [good, { party: [] }, null, { party: [{ job: 'not_a_class' }] }, good, good, good, good, good],
    });
    assert.deepEqual(p.items, ['iron_sword']);
    assert.deepEqual(p.bossKills, { boss_dire_wolf: 3 });
    assert.equal(p.recentWins.length, RECENT_WINS);
    assert.deepEqual(sanitizeProfile({}).recentWins, []);
});

test('completion is a whole percent, and only 100% when everything is found', () => {
    assert.equal(percent(0, 156), 0);
    assert.equal(percent(155, 156), 99);
    assert.equal(percent(156, 156), 100);
    assert.equal(percent(1, 0), 0);
});
