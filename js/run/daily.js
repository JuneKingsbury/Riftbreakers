// Daily runs: one run a day that every player shares. The day is the UTC date, so it changes at
// the same moment everywhere, and everything about the run comes from that date: the seed, the
// three starting classes, and the rules (a fresh profile's, with no unlocks or Rift Tier, so
// one player's unlocks can't change the run's rolls). Each device gets one attempt a day: the
// attempt counts as soon as the run starts. Finished daily runs go on that day's own leaderboard
// (leaderboard.js, the Worker's /daily endpoint).
//
// The run's rolls also depend on the game's content (seeded picks index into content lists), so
// players on different versions of the game can get different runs for the same day.
import { Rng } from './rng.js';
import { RunState, START_PARTY } from './run-state.js';
import { runOptions, runSummary, defaultStorage } from './profile.js';
import { jobsOfTier } from '../tactical/data-registry.js';
import { utcDate, isDailyDate } from './leaderboard-rules.js';

export const DAILY_KEY = 'riftbreak.daily.v1';
const DAY_MS = 86_400_000;

/** Today's daily run, as its UTC date 'YYYY-MM-DD'. */
export function dailyDate(now = Date.now()) {
    return utcDate(typeof now === 'number' ? now : now.getTime());
}

/** Milliseconds from `now` until the next daily run (the next UTC midnight). */
export function msUntilNextDaily(now = Date.now()) {
    const ms = typeof now === 'number' ? now : now.getTime();
    return DAY_MS - (((ms % DAY_MS) + DAY_MS) % DAY_MS);
}

/** The seed of the daily run on `date`: a 32-bit FNV-1a hash of the date, the same on every machine. */
export function dailySeed(date) {
    let h = 0x811C9DC5;
    for (const ch of `riftbreak-daily:${date}`) {
        h ^= ch.charCodeAt(0);
        h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h >>> 0;
}

/**
 * The starting classes of the daily run on `date`: START_PARTY different Tier 1 classes, from all
 * of them (locked or not). Rolled on their own stream, so they don't shift the run's rolls.
 */
export function dailyJobs(date) {
    return new Rng((dailySeed(date) ^ 0x0DA11E5) >>> 0).sample(jobsOfTier(1), START_PARTY);
}

/** A short label for a daily's date, such as 'Nov 18', read in UTC so it matches the date itself. */
export function dailyLabel(date) {
    return new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

/** The daily run of `date`, ready to play: its own seed, classes and rules. */
export function createDailyRun(date) {
    return RunState.create({
        jobs: dailyJobs(date),
        options: { ...runOptions(null), tier: 0, challenge: null, daily: date },
        seed: dailySeed(date),
    });
}

/**
 * This device's latest daily attempt: { date, result } where result is the finished run's
 * summary (profile.js runSummary, with `submitted`), or null while it is unfinished or was
 * abandoned. Null if no daily has been played.
 */
export function loadDaily(storage = defaultStorage()) {
    try {
        const d = JSON.parse(storage?.getItem(DAILY_KEY) ?? 'null');
        if (!d || !isDailyDate(d.date)) return null;
        return { date: d.date, result: d.result && typeof d.result === 'object' ? d.result : null };
    } catch {
        return null;
    }
}

function saveDaily(record, storage) {
    try { storage?.setItem(DAILY_KEY, JSON.stringify(record)); return true; } catch { return false; }
}

/** Whether this device has already started the daily run of `date`. */
export function dailyPlayed(date, storage = defaultStorage()) {
    return loadDaily(storage)?.date === date;
}

/** Notes that the daily run of `date` has started: the day's one attempt is used. */
export function markDailyStarted(date, storage = defaultStorage()) {
    return saveDaily({ date, result: null }, storage);
}

/**
 * Remembers how a finished daily run went, for the title screen. `now` must be the time passed
 * to recordRun, so the summary has the same id as the one in the profile's high scores.
 */
export function recordDailyResult(run, renown, now = new Date(), storage = defaultStorage()) {
    const date = run.options?.daily;
    if (!isDailyDate(date)) return false;
    const result = runSummary(run, renown, now);
    if (!result) return false;
    return saveDaily({ date, result: { ...result, submitted: false } }, storage);
}

/** Marks the remembered daily result with run id `id` as on the leaderboard. */
export function markDailySubmitted(id, storage = defaultStorage()) {
    const d = loadDaily(storage);
    if (!d?.result || d.result.id !== id) return false;
    d.result.submitted = true;
    return saveDaily(d, storage);
}
