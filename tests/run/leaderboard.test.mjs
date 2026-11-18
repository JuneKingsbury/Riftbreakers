// The online leaderboard: what an entry may hold (leaderboard-rules.js, shared with the Worker),
// submitting a win from the game (leaderboard.js), and the Worker's endpoint
// (cloudflare-worker/riftbreak-api.js) against a small in-memory stand-in for D1.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { validateEntry, nameProblem, cleanName, MAX_POINTS_PER_BATTLE } from '../../js/run/leaderboard-rules.js';
import { entryFromWin, submitWin, fetchLeaderboard, canSubmit, savedName } from '../../js/run/leaderboard.js';
import { newProfile, saveProfile, loadProfile, winSummary } from '../../js/run/profile.js';
import { RunState } from '../../js/run/run-state.js';
import worker from '../../cloudflare-worker/riftbreak-api.js';

function memoryStorage() {
    const data = new Map();
    return { getItem: k => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, String(v)), removeItem: k => data.delete(k) };
}

function aWin(score = 4200) {
    const run = RunState.create({ jobs: ['warden', 'evoker', 'runebow'], seed: 11 });
    run.status = 'won';
    run.score = score;
    run.stats = { floors: 45, battles: 22, elites: 4, bosses: 3 };
    return winSummary(run, 80, new Date('2026-11-18T10:00:00Z'));
}

// ---- Rules ----

test('names are trimmed to single spaces and 20 characters; odd characters are refused', () => {
    assert.equal(cleanName('   June   the    Bold  '), 'June the Bold');
    assert.equal(cleanName('x'.repeat(30)).length, 20);
    assert.equal(nameProblem('Zoë-Ann'), null);
    assert.equal(nameProblem('ジュン'), null, 'any script');
    assert.ok(nameProblem(''));
    assert.ok(nameProblem('<script>'));
    assert.ok(nameProblem('-dash first'));
});

test('a win becomes a valid entry, keeping only the known fields', () => {
    const { entry, error } = validateEntry({ ...entryFromWin(aWin(), 'June'), extra: 'dropped' });
    assert.equal(error, undefined);
    assert.equal(entry.name, 'June');
    assert.equal(entry.score, 4200);
    assert.equal(entry.party.length, 3);
    assert.ok(!('extra' in entry));
    assert.ok(!('appearance' in entry.party[0]), 'only job, origin and level travel');
});

test('impossible or malformed entries are refused', () => {
    const good = entryFromWin(aWin(), 'June');
    const bad = (patch) => validateEntry({ ...good, ...patch }).error;
    assert.ok(bad({ score: good.battles * MAX_POINTS_PER_BATTLE + 1 }), 'more than the battles allow');
    assert.ok(bad({ score: -1 }));
    assert.ok(bad({ score: 1.5 }));
    assert.ok(bad({ id: 'has spaces' }));
    assert.ok(bad({ startPartySize: 4 }));
    assert.ok(bad({ party: [] }));
    assert.ok(bad({ party: Array(7).fill(good.party[0]) }));
    assert.ok(bad({ party: [{ job: 'Evoker!', level: 3 }] }));
    assert.ok(bad({ date: 'yesterday' }));
    assert.equal(validateEntry(null).error, 'Not an entry.');
});

// ---- The game side ----

test('submitting sends the entry once, remembers the name and marks the win submitted', async () => {
    const storage = memoryStorage();
    const win = aWin();
    saveProfile({ ...newProfile(), bestWins: [win] }, storage);
    assert.ok(canSubmit(win));
    const sent = [];
    const fetchImpl = async (url, opts) => {
        sent.push({ url, body: JSON.parse(opts.body) });
        return new Response(JSON.stringify({ rank: 3, total: 40 }), { status: 201 });
    };
    assert.deepEqual(await submitWin(win, '  June  ', { fetchImpl, storage }), { rank: 3, total: 40 });
    assert.match(sent[0].url, /\/leaderboard$/);
    assert.equal(sent[0].body.name, 'June');
    assert.equal(savedName(storage), 'June');
    const after = loadProfile(storage).bestWins[0];
    assert.equal(after.submitted, true);
    assert.equal(canSubmit(after), false);
});

test('a bad name or a refusal from the server comes back as a message, and nothing is marked', async () => {
    const storage = memoryStorage();
    const win = aWin();
    saveProfile({ ...newProfile(), bestWins: [win] }, storage);
    await assert.rejects(submitWin(win, '', { fetchImpl: async () => assert.fail('not sent'), storage }), /Enter a name/);
    const refuse = async () => new Response(JSON.stringify({ error: 'This run is already on the leaderboard.' }), { status: 409 });
    await assert.rejects(submitWin(win, 'June', { fetchImpl: refuse, storage }), /already on the leaderboard/);
    const offline = async () => { throw new TypeError('Failed to fetch'); };
    await assert.rejects(submitWin(win, 'June', { fetchImpl: offline, storage }), /Couldn't reach/);
    assert.equal(loadProfile(storage).bestWins[0].submitted, false);
});

test('wins without a score (from before scoring) can\'t be submitted', () => {
    assert.equal(canSubmit({ ...aWin(), score: 0 }), false);
    assert.equal(canSubmit({ ...aWin(), id: '' }), false);
});

// ---- The Worker ----

// Just enough of D1 for the Worker's queries.
function fakeDb() {
    const entries = [], submissions = [];
    const stmt = (sql, args = []) => ({
        bind: (...a) => stmt(sql, a),
        async all() {
            const [limit] = args;
            const sorted = [...entries].sort((a, b) => b.score - a.score || a.date.localeCompare(b.date));
            return { results: sorted.slice(0, limit).map(e => ({ data: e.data })) };
        },
        async first() {
            if (sql.includes('FROM submissions')) return { n: submissions.filter(s => s.ip === args[0] && s.at > args[1]).length };
            if (sql.includes('score > ?')) return { n: entries.filter(e => e.score > args[0]).length };
            return { n: entries.length };
        },
        async run() {
            if (sql.startsWith('INSERT OR IGNORE INTO entries')) {
                if (entries.some(e => e.id === args[0])) return { meta: { changes: 0 } };
                entries.push({ id: args[0], score: args[2], date: args[3], data: args[4] });
                return { meta: { changes: 1 } };
            }
            if (sql.startsWith('INSERT INTO submissions')) submissions.push({ ip: args[0], at: args[1] });
            return { meta: { changes: 1 } };
        },
    });
    return { prepare: sql => stmt(sql), batch: async (list) => Promise.all(list.map(s => s.run())), entries };
}

const ORIGIN = 'https://junekingsbury.github.io';
const call = (env, method, path, { origin = ORIGIN, body, ip = '1.2.3.4' } = {}) => worker.fetch(new Request(`https://api.test${path}`, {
    method, body: body == null ? undefined : JSON.stringify(body),
    headers: { Origin: origin, 'Content-Type': 'application/json', 'CF-Connecting-IP': ip },
}), env);

test('the Worker stores valid entries once and lists them highest first', async () => {
    const env = { DB: fakeDb(), IP_SALT: 'test' };
    const low = { ...entryFromWin(aWin(900), 'Low'), id: 'run-low' };
    const high = { ...entryFromWin(aWin(5000), 'High'), id: 'run-high' };
    let r = await call(env, 'POST', '/leaderboard', { body: low });
    assert.equal(r.status, 201);
    assert.deepEqual(await r.json(), { rank: 1, total: 1 });
    r = await call(env, 'POST', '/leaderboard', { body: high });
    assert.deepEqual(await r.json(), { rank: 1, total: 2 });
    r = await call(env, 'POST', '/leaderboard', { body: low });
    assert.equal(r.status, 409, 'the same run twice');
    assert.equal(r.headers.get('Access-Control-Allow-Origin'), ORIGIN);

    r = await call(env, 'GET', '/leaderboard?limit=10');
    const { entries } = await r.json();
    assert.deepEqual(entries.map(e => e.name), ['High', 'Low']);
    // The game reads the list through the same rules.
    const listed = await fetchLeaderboard({ fetchImpl: async () => new Response(JSON.stringify({ entries: [...entries, { junk: 1 }] })) });
    assert.equal(listed.length, 2);
});

test('the Worker refuses other sites, bad entries and floods', async () => {
    const env = { DB: fakeDb(), IP_SALT: 'test' };
    assert.equal((await call(env, 'GET', '/leaderboard', { origin: 'https://evil.example' })).status, 403);
    assert.equal((await call(env, 'GET', '/leaderboard', { origin: 'http://localhost:8000' })).status, 200, 'local dev');
    const bad = await call(env, 'POST', '/leaderboard', { body: { ...entryFromWin(aWin(), 'June'), score: 10_000_000 } });
    assert.equal(bad.status, 400);
    assert.match((await bad.json()).error, /higher than the battles allow/);

    for (let i = 0; i < 10; i++) {
        const r = await call(env, 'POST', '/leaderboard', { body: { ...entryFromWin(aWin(), 'June'), id: `run-${i}` }, ip: '9.9.9.9' });
        assert.equal(r.status, 201);
    }
    const flood = await call(env, 'POST', '/leaderboard', { body: { ...entryFromWin(aWin(), 'June'), id: 'run-x' }, ip: '9.9.9.9' });
    assert.equal(flood.status, 429);
    const other = await call(env, 'POST', '/leaderboard', { body: { ...entryFromWin(aWin(), 'June'), id: 'run-y' }, ip: '5.5.5.5' });
    assert.equal(other.status, 201, 'others can still submit');
});
