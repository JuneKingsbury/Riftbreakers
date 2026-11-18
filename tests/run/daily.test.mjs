// Daily runs (js/run/daily.js): one shared run per UTC day, its one attempt per device, and its
// own leaderboard (leaderboard.js and the Worker's /daily endpoint).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    dailyDate, dailySeed, dailyJobs, dailyLabel, msUntilNextDaily, createDailyRun, loadDaily, dailyPlayed,
    markDailyStarted, recordDailyResult,
} from '../../js/run/daily.js';
import { entryFromRun, submitRun, canSubmit, fetchDailyLeaderboard } from '../../js/run/leaderboard.js';
import { validateEntry, dailyOpen } from '../../js/run/leaderboard-rules.js';
import { newProfile, loadProfile, saveProfile, recordRun, hasUnlock, UNLOCKS } from '../../js/run/profile.js';
import { jobsOfTier } from '../../js/tactical/data-registry.js';
import worker from '../../cloudflare-worker/riftbreak-api.js';

function memoryStorage() {
    const data = new Map();
    return { getItem: k => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, String(v)), removeItem: k => data.delete(k) };
}

// A finished daily run of `date`, recorded the way the game does at the end of a run.
function finishedDaily(date, storage, { score = 3100, now = new Date(`${date}T20:00:00Z`) } = {}) {
    const run = createDailyRun(date);
    run.status = 'lost'; run.score = score; run.act = 2;
    run.stats = { floors: 20, battles: 12, elites: 1, bosses: 1 };
    const profile = loadProfile(storage);
    const renown = recordRun(profile, run, now);
    saveProfile(profile, storage);
    recordDailyResult(run, renown, now, storage);
    return loadDaily(storage).result;
}

// ---- The day ----

test('the daily date is the UTC day, so it is the same everywhere at the same moment', () => {
    // GIVEN: one moment, written in three time zones
    const moments = ['2026-11-18T23:30:00-08:00', '2026-11-19T07:30:00Z', '2026-11-19T16:30:00+09:00'];

    // WHEN / THEN: all of them are the same daily, the UTC date
    for (const m of moments) assert.equal(dailyDate(new Date(m)), '2026-11-19');
});

test('the next daily starts at the next UTC midnight', () => {
    assert.equal(msUntilNextDaily(Date.parse('2026-11-18T23:00:00Z')), 3_600_000);
    assert.equal(msUntilNextDaily(Date.parse('2026-11-18T00:00:00Z')), 86_400_000, 'just after a reset, a whole day to go');
});

test('the date label names the UTC day, not the local one', () => {
    assert.match(dailyLabel('2026-11-18'), /18/);
    assert.match(dailyLabel('2026-12-01'), /\b1\b/);
});

// ---- The same run for everyone ----

test('a day always has the same seed, and different days different seeds', () => {
    // A pinned value: if the hash changed, players on different versions would get different runs.
    assert.equal(dailySeed('2026-11-18'), dailySeed('2026-11-18'));
    assert.equal(dailySeed('2026-11-18'), 1797126354, 'FNV-1a of "riftbreak-daily:2026-11-18"');
    const seeds = new Set(Array.from({ length: 60 }, (_, i) => dailySeed(dailyDate(Date.UTC(2026, 0, 1) + i * 86_400_000))));
    assert.equal(seeds.size, 60);
});

test('each day picks three different starting classes, from every class, the same every time', () => {
    const all = jobsOfTier(1);
    const picks = Array.from({ length: 60 }, (_, i) => dailyJobs(dailyDate(Date.UTC(2026, 0, 1) + i * 86_400_000)));
    for (const jobs of picks) {
        assert.equal(jobs.length, 3);
        assert.equal(new Set(jobs).size, 3, 'no class twice');
        for (const j of jobs) assert.ok(all.includes(j));
    }
    assert.deepEqual(dailyJobs('2026-11-18'), dailyJobs('2026-11-18'));
    assert.ok(new Set(picks.map(j => [...j].sort().join())).size > 10, 'the party changes from day to day');
    // Locked classes come up too: over two months, more than the three open from the start.
    assert.ok(new Set(picks.flat()).size > 3);
});

test('two players get the identical daily run, whatever they have unlocked', () => {
    // GIVEN: the same day on two machines (the run doesn't read the profile at all)
    const a = createDailyRun('2026-11-18');
    const b = createDailyRun('2026-11-18');

    // THEN: the whole run is the same: map, realms, party, gold, and the dice from here on
    assert.equal(a.serialize(), b.serialize());
    assert.deepEqual(a.party.map(m => m.job), dailyJobs('2026-11-18'));
    assert.equal(a.options.daily, '2026-11-18');
    assert.equal(a.options.tier, 0);
    assert.equal(a.options.challenge, null);
    assert.equal(a.options.heirloom, false, 'no unlocks');
    assert.notEqual(createDailyRun('2026-11-19').serialize(), a.serialize());
});

// ---- One attempt a day ----

test('starting the daily uses up the day; the next day opens again', () => {
    const storage = memoryStorage();
    assert.equal(dailyPlayed('2026-11-18', storage), false);

    markDailyStarted('2026-11-18', storage);

    assert.equal(dailyPlayed('2026-11-18', storage), true);
    assert.equal(loadDaily(storage).result, null, 'started, not finished');
    assert.equal(dailyPlayed('2026-11-19', storage), false);
});

test('a finished daily is remembered with the same id as its high score, so submitting marks both', async () => {
    // GIVEN: a finished daily run
    const storage = memoryStorage();
    markDailyStarted('2026-11-18', storage);
    const result = finishedDaily('2026-11-18', storage);
    assert.equal(result.daily, '2026-11-18');
    assert.equal(loadProfile(storage).bestRuns[0].id, result.id);
    assert.ok(canSubmit(result, Date.parse('2026-11-18T21:00:00Z')));

    // WHEN: it is submitted
    const sent = [];
    const fetchImpl = async (url, opts) => {
        sent.push({ url, body: JSON.parse(opts.body) });
        return new Response(JSON.stringify({ rank: 1, total: 1 }), { status: 201 });
    };
    await submitRun(result, 'June', { fetchImpl, storage });

    // THEN: it went to the daily leaderboard, and both copies are marked submitted
    assert.match(sent[0].url, /\/daily$/);
    assert.equal(sent[0].body.daily, '2026-11-18');
    assert.equal(loadDaily(storage).result.submitted, true);
    assert.equal(loadProfile(storage).bestRuns[0].submitted, true);
});

// ---- Daily leaderboard rules ----

test('a daily entry must be a standard start on a real day', () => {
    const storage = memoryStorage();
    const entry = entryFromRun(finishedDaily('2026-11-18', storage), 'June');
    assert.equal(validateEntry(entry).error, undefined);
    assert.equal(validateEntry(entry).entry.daily, '2026-11-18');
    assert.ok(validateEntry({ ...entry, tier: 2 }).error);
    assert.ok(validateEntry({ ...entry, startPartySize: 1 }).error);
    assert.ok(validateEntry({ ...entry, daily: '2026-02-30' }).error);
    assert.ok(validateEntry({ ...entry, daily: 'today' }).error);
});

test('a daily stays open for submissions until two days after it', () => {
    assert.ok(dailyOpen('2026-11-18', Date.parse('2026-11-18T12:00:00Z')));
    assert.ok(dailyOpen('2026-11-18', Date.parse('2026-11-20T23:00:00Z')), 'finished after the reset');
    assert.equal(dailyOpen('2026-11-18', Date.parse('2026-11-21T00:00:01Z')), false);
    assert.equal(dailyOpen('2026-11-19', Date.parse('2026-11-18T12:00:00Z')), false, 'not a future day');
});

// ---- The Worker ----

// Just enough of D1 for the Worker's queries, with both leaderboards.
function fakeDb() {
    const tables = { entries: [], daily_entries: [] }, submissions = [];
    const tableOf = (sql) => (sql.includes('daily_entries') ? tables.daily_entries : tables.entries);
    const stmt = (sql, args = []) => ({
        bind: (...a) => stmt(sql, a),
        async all() {
            const daily = sql.includes('daily_entries');
            const rows = daily ? tableOf(sql).filter(e => e.daily === args[0]) : tableOf(sql);
            const limit = daily ? args[1] : args[0];
            const sorted = [...rows].sort((a, b) => b.score - a.score || a.date.localeCompare(b.date));
            return { results: sorted.slice(0, limit).map(e => ({ data: e.data })) };
        },
        async first() {
            if (sql.includes('FROM submissions')) return { n: submissions.filter(s => s.ip === args[0] && s.at > args[1]).length };
            const rows = tableOf(sql);
            if (sql.includes('daily_entries')) {
                const day = rows.filter(e => e.daily === args[0]);
                return { n: sql.includes('score > ?') ? day.filter(e => e.score > args[1]).length : day.length };
            }
            return { n: sql.includes('score > ?') ? rows.filter(e => e.score > args[0]).length : rows.length };
        },
        async run() {
            if (sql.startsWith('INSERT OR IGNORE')) {
                const rows = tableOf(sql);
                if (rows.some(e => e.id === args[0])) return { meta: { changes: 0 } };
                const [id, ...rest] = args;
                rows.push(sql.includes('daily_entries')
                    ? { id, daily: rest[0], score: rest[2], date: rest[3], data: rest[4] }
                    : { id, score: rest[1], date: rest[2], data: rest[3] });
                return { meta: { changes: 1 } };
            }
            if (sql.startsWith('INSERT INTO submissions')) submissions.push({ ip: args[0], at: args[1] });
            return { meta: { changes: 1 } };
        },
    });
    return { prepare: sql => stmt(sql), batch: async (list) => Promise.all(list.map(s => s.run())), tables };
}

const ORIGIN = 'https://junekingsbury.github.io';
const call = (env, method, path, { body, ip = '1.2.3.4' } = {}) => worker.fetch(new Request(`https://api.test${path}`, {
    method, body: body == null ? undefined : JSON.stringify(body),
    headers: { Origin: ORIGIN, 'Content-Type': 'application/json', 'CF-Connecting-IP': ip },
}), env);

const today = dailyDate();
const dailyEntry = (name, score, date = today) => {
    const storage = memoryStorage();
    return { ...entryFromRun(finishedDaily(date, storage, { score }), name), id: `${name.toLowerCase()}-${date}` };
};

test('the Worker keeps a separate leaderboard for each day, ranked within the day', async () => {
    const env = { DB: fakeDb(), IP_SALT: 'test' };
    const yesterday = dailyDate(Date.now() - 86_400_000);
    let r = await call(env, 'POST', '/daily', { body: dailyEntry('Low', 900) });
    assert.equal(r.status, 201);
    r = await call(env, 'POST', '/daily', { body: dailyEntry('Old', 9000, yesterday) });
    assert.equal(r.status, 201, 'yesterday is still open');
    r = await call(env, 'POST', '/daily', { body: dailyEntry('High', 3000) });
    assert.deepEqual(await r.json(), { rank: 1, total: 2 }, 'yesterday\'s bigger score doesn\'t count today');

    r = await call(env, 'GET', `/daily?date=${today}&limit=10`);
    const { entries } = await r.json();
    assert.deepEqual(entries.map(e => e.name), ['High', 'Low']);
    const listed = await fetchDailyLeaderboard(today, { fetchImpl: async () => new Response(JSON.stringify({ entries: [...entries, { junk: 1 }] })) });
    assert.deepEqual(listed.map(e => e.name), ['High', 'Low']);
    assert.equal(env.DB.tables.entries.length, 0, 'nothing on the all-time leaderboard');
});

test('the Worker keeps daily and all-time runs apart, and refuses closed days', async () => {
    const env = { DB: fakeDb(), IP_SALT: 'test' };
    const daily = dailyEntry('June', 1000);
    const { daily: _, ...plain } = { ...daily, id: 'plain-run' };

    assert.equal((await call(env, 'POST', '/leaderboard', { body: daily })).status, 400, 'a daily run on the all-time board');
    assert.equal((await call(env, 'POST', '/daily', { body: plain })).status, 400, 'an ordinary run on the daily board');
    const old = await call(env, 'POST', '/daily', { body: dailyEntry('Late', 1000, dailyDate(Date.now() - 4 * 86_400_000)) });
    assert.equal(old.status, 400);
    assert.match((await old.json()).error, /closed/);
    assert.equal((await call(env, 'GET', '/daily?date=nope')).status, 400);
});
