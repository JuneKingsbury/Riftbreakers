// Save data between runs: the profile (renown, unlocks, stats) survives a save and load,
// damaged or edited data loads as something valid, and progress exports to a file or code
// and imports back, on this device or another.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    PROFILE_KEY, UNLOCKS, newProfile, loadProfile, saveProfile, sanitizeProfile, buyUnlock, recordRun, runOptions,
} from '../../js/run/profile.js';
import { RunState, SAVE_KEY } from '../../js/run/run-state.js';
import {
    exportSave, saveToCode, readSaveText, checkSave, describeSave, applySave, saveFileName, SAVE_FORMAT, SAVE_FORMAT_VERSION,
} from '../../js/run/save-transfer.js';

// localStorage stand-in: string values, like the real thing.
function memoryStorage(initial = {}) {
    const data = new Map(Object.entries(initial));
    return {
        getItem: (k) => (data.has(k) ? data.get(k) : null),
        setItem: (k, v) => { data.set(k, String(v)); },
        removeItem: (k) => { data.delete(k); },
        raw: data,
    };
}
const newRun = (seed = 4) => RunState.create({ jobs: ['warden', 'evoker', 'runebow'], seed });

// ---- The profile on this device ----------------------------------------------------------

test('renown, unlocks and stats survive a save and a load', () => {
    const storage = memoryStorage();
    const profile = newProfile();
    profile.renown = 120;
    assert.ok(buyUnlock(profile, 'purse_1') && buyUnlock(profile, 'job_seer'));
    profile.stats = { runs: 4, wins: 1, bestAct: 3, bestFloor: 40, riftTier: 1, bestDepth: 2 };
    assert.ok(saveProfile(profile, storage));

    const loaded = loadProfile(storage);
    assert.deepEqual(loaded, profile);
    assert.deepEqual(runOptions(loaded).jobs, ['warden', 'evoker', 'runebow', 'seer'], 'unlocks take effect after loading');
    assert.equal(runOptions(loaded).startGold, 150);
});

test('a finished run\'s renown is kept for the next session', () => {
    const storage = memoryStorage();
    const profile = loadProfile(storage);
    const run = newRun();
    run.stats = { floors: 12, battles: 8, elites: 1, bosses: 0 };
    run.status = 'lost';
    const earned = recordRun(profile, run);
    saveProfile(profile, storage);
    assert.equal(loadProfile(storage).renown, earned);
    assert.equal(loadProfile(storage).stats.runs, 1);
});

test('a fresh device starts with an empty profile', () => {
    assert.deepEqual(loadProfile(memoryStorage()), newProfile());
    assert.deepEqual(loadProfile(null), newProfile(), 'no storage at all (private mode)');
});

test('damaged or hand-edited profiles load as something valid instead of breaking the game', () => {
    const load = (raw) => loadProfile(memoryStorage({ [PROFILE_KEY]: raw }));
    assert.deepEqual(load('{not json'), newProfile());
    assert.deepEqual(load('null'), newProfile());
    assert.deepEqual(load('"a string"'), newProfile());

    const p = load(JSON.stringify({
        renown: -50, unlocked: ['purse_1', 'purse_1', 'made_up', 7, '__proto__', 'veterans'],
        stats: { runs: 3.7, wins: 9, bestAct: 'lots', bestFloor: Infinity }, cheat: true,
    }));
    assert.equal(p.renown, 0);
    assert.deepEqual(p.unlocked, ['purse_1', 'veterans'], 'only real unlocks, each once');
    assert.deepEqual(p.stats, { runs: 3, wins: 3, bestAct: 0, bestFloor: 0, riftTier: 1, bestDepth: 0 }, 'whole numbers; no more wins than runs; a past win opens Rift Tier I');
    assert.ok(!('cheat' in p));
    assert.deepEqual(load(JSON.stringify({ renown: 10, unlocked: 'purse_1' })).unlocked, []);
    assert.equal(sanitizeProfile({ renown: 12.9 }).renown, 12);
});

test('a failed save reports failure instead of throwing', () => {
    const full = { getItem: () => null, setItem: () => { throw new Error('QuotaExceededError'); } };
    assert.equal(saveProfile(newProfile(), full), false);
    assert.equal(saveProfile(newProfile(), null), false);
});

// ---- Export and import -------------------------------------------------------------------

function deviceWithProgress() {
    const storage = memoryStorage();
    const profile = newProfile();
    profile.renown = 75;
    profile.unlocked = ['heirloom', 'recruiter'];
    profile.stats.runs = 2;
    saveProfile(profile, storage);
    const run = newRun(9);
    run.party[0].name = 'Zoë Ñúñez';   // non-ASCII survives the code
    run.gold = 321;
    run.save(storage);
    return { storage, profile, run };
}

test('an export holds the profile and the run in progress, and names its file by date', () => {
    const { storage, profile } = deviceWithProgress();
    const save = exportSave(storage, new Date('2026-11-17T10:00:00Z'));
    assert.equal(save.format, SAVE_FORMAT);
    assert.equal(save.version, SAVE_FORMAT_VERSION);
    assert.deepEqual(save.profile, profile);
    assert.equal(save.run.gold, 321);
    assert.equal(saveFileName(save), 'riftbreak-save-2026-11-17.json');

    assert.equal(exportSave(memoryStorage()).run, null, 'no run in progress');
});

test('progress moves to another device by file or by code, run and all', () => {
    const { storage } = deviceWithProgress();
    const save = exportSave(storage);
    for (const text of [JSON.stringify(save, null, 1), saveToCode(save), `\n  ${saveToCode(save)}  \n`]) {
        const other = memoryStorage();
        const read = readSaveText(text);
        assert.ok(read.save, read.error);
        assert.ok(applySave(read.save, other));
        assert.deepEqual(loadProfile(other), loadProfile(storage));
        const run = RunState.load(other);
        assert.equal(run.gold, 321);
        assert.equal(run.party[0].name, 'Zoë Ñúñez');
        assert.deepEqual(run.realms, RunState.load(storage).realms);
    }
});

test('importing replaces current progress, including clearing a run the save doesn\'t have', () => {
    const { storage } = deviceWithProgress();
    const fresh = { ...exportSave(memoryStorage()), profile: { ...newProfile(), renown: 5 } };
    const read = readSaveText(saveToCode(fresh));
    assert.ok(applySave(read.save, storage));
    assert.equal(loadProfile(storage).renown, 5);
    assert.equal(RunState.load(storage), null, 'the old run is gone');
    assert.equal(storage.raw.has(SAVE_KEY), false);
});

test('bad imports are refused with a reason, and change nothing', () => {
    const { storage } = deviceWithProgress();
    const before = [...storage.raw.entries()];
    const code = saveToCode(exportSave(storage));
    const cases = {
        '': /Nothing/,
        'hello': /isn't a Riftbreak save/,
        '{"format":"other"}': /isn't a Riftbreak save/,
        [JSON.stringify({ format: SAVE_FORMAT, version: SAVE_FORMAT_VERSION + 1, profile: {} })]: /newer version/,
        [code.slice(0, code.length / 2)]: /damaged|isn't/,
        'RB1:!!!!': /damaged/,
    };
    for (const [text, why] of Object.entries(cases)) {
        const { save, error } = readSaveText(text);
        assert.equal(save, undefined, text.slice(0, 20));
        assert.match(error, why);
    }
    assert.deepEqual([...storage.raw.entries()], before);
});

test('a save whose run can\'t be read still imports its profile, and says so', () => {
    const { storage } = deviceWithProgress();
    const save = exportSave(storage);
    save.run = { ...save.run, version: 999 };
    save.profile.unlocked.push('not_a_real_unlock');
    const { save: checked } = checkSave(save);
    assert.equal(checked.run, null);
    assert.ok(checked.runDropped);
    assert.deepEqual(checked.profile.unlocked, ['heirloom', 'recruiter'], 'the profile is cleaned too');
    assert.match(describeSave(checked), /couldn't be read/);
});

test('the import confirmation sums up what the save holds', () => {
    const { storage } = deviceWithProgress();
    const { save } = readSaveText(saveToCode(exportSave(storage, new Date('2026-11-17T00:00:00Z'))));
    const text = describeSave(save);
    assert.match(text, /75 renown/);
    assert.match(text, new RegExp(`2 of ${Object.keys(UNLOCKS).length} unlocks`));
    assert.match(text, /Run in progress: act 1/);
    assert.match(text, /2026-11-17/);
});

test('skill plans travel with an export, and an older save without them leaves the current plans alone', async () => {
    const { savePlans, loadPlans } = await import('../../js/run/skill-plans.js');
    const { storage } = deviceWithProgress();
    const plans = { evoker: { auto: true, steps: [{ learn: 'fire' }, { learn: 'ice' }] } };
    savePlans(plans, storage);
    const save = exportSave(storage);
    assert.deepEqual(save.skillPlans, plans);

    const other = memoryStorage();
    const { save: checked } = readSaveText(saveToCode(save));
    assert.match(describeSave(checked), /1 skill plan\b/);
    assert.ok(applySave(checked, other));
    assert.deepEqual(loadPlans(other), plans);

    // A save from before skill plans existed.
    const old = { ...save };
    delete old.skillPlans;
    const mine = { warden: { auto: true, steps: [{ learn: 'ward' }] } };
    savePlans(mine, other);
    const { save: oldChecked } = checkSave(old);
    assert.equal(oldChecked.skillPlans, null);
    assert.ok(applySave(oldChecked, other));
    assert.deepEqual(loadPlans(other), mine);
});
