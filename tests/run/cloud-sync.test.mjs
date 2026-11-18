// Cloud saves (run/cloud-sync.js) between devices sharing one Google Drive, with a fake Drive:
// uploads after saves, downloads of progress made elsewhere, and asking the player when both
// sides changed. Nothing is ever silently lost.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createCloudSync, CLOUD_FILE, hasLocalProgress } from '../../js/run/cloud-sync.js';
import { loadProfile, saveProfile, newProfile } from '../../js/run/profile.js';

function memoryStorage() {
    const data = new Map();
    return {
        getItem: (k) => (data.has(k) ? data.get(k) : null),
        setItem: (k, v) => { data.set(k, String(v)); },
        removeItem: (k) => { data.delete(k); },
    };
}

// One Drive, shared by every device that connects to it.
function fakeDrive() {
    const files = new Map();
    return {
        files,
        writes: 0,
        connected: true,
        isConnected() { return this.connected; },
        async cloudRead(name) { return files.has(name) ? files.get(name) : null; },
        async cloudWrite(name, data) { this.writes++; files.set(name, data); },
    };
}

// A clock that moves on a minute per call, so every export has its own time.
function clock() {
    let t = Date.UTC(2026, 10, 18, 12, 0, 0);
    return () => new Date((t += 60_000));
}

function device(drive, opts = {}) {
    const storage = memoryStorage();
    const sync = createCloudSync({ drive, storage, now: clock(), ...opts });
    const setRenown = (n) => {
        const p = loadProfile(storage);
        p.renown = n;
        saveProfile(p, storage);
        sync.markDirty();   // what the save-events listener does once started
    };
    return { storage, sync, setRenown, renown: () => loadProfile(storage).renown };
}

test('the first device to connect uploads its progress', async () => {
    const drive = fakeDrive();
    const a = device(drive);
    a.setRenown(40);
    assert.equal(await a.sync.sync(), 'uploaded');
    assert.equal(JSON.parse(drive.files.get(CLOUD_FILE)).profile.renown, 40);
    assert.equal(a.sync.state().dirty, false);
    assert.equal(await a.sync.sync(), 'up-to-date');
});

test('a fresh device downloads the cloud save without asking', async () => {
    const drive = fakeDrive();
    const a = device(drive);
    a.setRenown(75);
    await a.sync.sync();
    let asked = false;
    const b = device(drive, { resolveConflict: async () => { asked = true; return null; } });
    assert.ok(!hasLocalProgress(b.storage));
    assert.equal(await b.sync.sync(), 'downloaded');
    assert.equal(b.renown(), 75);
    assert.equal(asked, false);
});

test('progress made on one device reaches the other, both ways', async () => {
    const drive = fakeDrive();
    const a = device(drive), b = device(drive);
    a.setRenown(10);
    await a.sync.sync();
    await b.sync.sync();
    b.setRenown(20);
    assert.equal(await b.sync.flush(), true, 'local changes upload');
    assert.equal(await a.sync.sync(), 'downloaded');
    assert.equal(a.renown(), 20);
    a.setRenown(35);
    await a.sync.flush();
    assert.equal(await b.sync.sync(), 'downloaded');
    assert.equal(b.renown(), 35);
});

test('when both devices changed, the player chooses, and the other copy is kept until then', async () => {
    const drive = fakeDrive();
    let answer = null, seen = null;
    const a = device(drive);
    const b = device(drive, { resolveConflict: async (c) => { seen = c; return answer; } });
    a.setRenown(10);
    await a.sync.sync();
    await b.sync.sync();
    a.setRenown(50);
    await a.sync.flush();
    b.setRenown(99);           // offline play on b, not yet uploaded

    assert.equal(await b.sync.sync(), 'undecided');
    assert.match(seen.cloud, /50 renown/);
    assert.match(seen.local, /99 renown/);
    assert.equal(b.renown(), 99, 'nothing replaced');
    assert.equal(JSON.parse(drive.files.get(CLOUD_FILE)).profile.renown, 50, 'nothing overwritten');

    answer = 'local';
    assert.equal(await b.sync.sync(), 'kept-local');
    assert.equal(JSON.parse(drive.files.get(CLOUD_FILE)).profile.renown, 99);
    assert.equal(await a.sync.sync(), 'downloaded');
    assert.equal(a.renown(), 99);
});

test('choosing the cloud copy in a conflict replaces this device\'s progress with it', async () => {
    const drive = fakeDrive();
    const a = device(drive);
    a.setRenown(60);
    await a.sync.sync();
    const b = device(drive, { resolveConflict: async () => 'cloud' });
    b.setRenown(5);            // progress of its own, linking for the first time
    assert.equal(await b.sync.sync(), 'downloaded');
    assert.equal(b.renown(), 60);
});

test('a damaged cloud save is reported and left alone, never overwritten', async () => {
    const drive = fakeDrive();
    drive.files.set(CLOUD_FILE, '{not json');
    const statuses = [];
    const a = device(drive, { onStatus: (s) => statuses.push(s) });
    a.setRenown(30);
    assert.equal(await a.sync.sync(), 'undecided');
    assert.equal(drive.files.get(CLOUD_FILE), '{not json');
    assert.ok(statuses.some(s => s.kind === 'error'));
});

test('nothing uploads while disconnected, and a failed upload stays marked for later', async () => {
    const drive = fakeDrive();
    const statuses = [];
    const a = device(drive, { onStatus: (s) => statuses.push(s) });
    drive.connected = false;
    a.setRenown(12);
    assert.equal(await a.sync.sync(), 'offline');
    assert.equal(await a.sync.flush(), false);
    assert.equal(drive.writes, 0);

    drive.connected = true;
    drive.cloudWrite = async () => { throw new Error('network down'); };
    assert.equal(await a.sync.flush(), false);
    assert.equal(a.sync.state().dirty, true);
    assert.ok(statuses.some(s => s.kind === 'error' && /network down/.test(s.message)));
});

test('an empty profile is not progress', () => {
    const s = memoryStorage();
    assert.equal(hasLocalProgress(s), false);
    saveProfile({ ...newProfile(), renown: 1 }, s);
    assert.equal(hasLocalProgress(s), true);
});
