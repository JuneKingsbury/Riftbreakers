// What a leaderboard entry may contain. Shared by the game (leaderboard.js) and the Worker that
// stores entries (cloudflare-worker/riftbreak-api.js), so both check the same rules. No imports:
// the Worker bundles this file on its own.
//
// An entry: { id, name, score, date, startPartySize, tier, battles, floors, elites, bosses,
//             realms: [string], party: [{ job, origin, level }], daily? }
// `daily` (an Eastern Time date, 'YYYY-MM-DD', DAILY_TIME_ZONE) marks a daily run (daily.js), which goes on that day's own
// leaderboard instead of the all-time one.

export const NAME_MAX = 20;
export const MAX_PARTY_SIZE = 6;
// The most a single battle can score: a boss (500) at ×2 speed with a solo start (×2) at
// Rift Tier VI (×3, RIFT_TIER_SCORE in score.js). The Worker checks it against a run's average
// over its battles, so it only needs to change when the top tier's multiplier does.
export const MAX_POINTS_PER_BATTLE = 6000;

// How many days after its own a daily run can still be submitted, so a run finished just
// after the midnight reset still counts for the day it was started.
export const DAILY_GRACE_DAYS = 2;

const ID_RE = /^[a-z0-9-]{1,40}$/i;
const DAILY_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

// The time zone whose calendar day is the daily run's day: midnight on New York clocks, following
// daylight saving (UTC-5 in winter, UTC-4 in summer). Changing it moves every player's daily.
export const DAILY_TIME_ZONE = 'America/New_York';

// 'en-CA' formats dates as YYYY-MM-DD. formatToParts keeps this independent of that, though.
const DAILY_DATE_FORMAT = new Intl.DateTimeFormat('en-CA', {
    timeZone: DAILY_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});

/** The wall-clock fields of `ms` in DAILY_TIME_ZONE, as numbers. */
function zonedParts(ms) {
    const parts = Object.fromEntries(DAILY_DATE_FORMAT.formatToParts(new Date(ms)).map(p => [p.type, p.value]));
    return { year: +parts.year, month: +parts.month, day: +parts.day, hour: +parts.hour, minute: +parts.minute, second: +parts.second };
}

/** The UTC date of `ms` as 'YYYY-MM-DD'. Used only for calendar arithmetic on date strings. */
export function utcDate(ms = Date.now()) {
    return new Date(ms).toISOString().slice(0, 10);
}

/** The Eastern Time date of `ms` as 'YYYY-MM-DD': the daily run every player shares at that moment. */
export function dailyDateAt(ms = Date.now()) {
    const p = zonedParts(ms);
    return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/**
 * The moment (ms) that the day `daily` ('YYYY-MM-DD') starts: midnight of that date in
 * DAILY_TIME_ZONE. New York's DST changes happen at 2 AM, so midnight always exists, once.
 */
export function dailyStartMs(daily) {
    const wallAsUtc = Date.parse(`${daily}T00:00:00Z`);
    // The zone's offset from UTC (ms) at instant `ms`: its wall clock read as if it were UTC, minus `ms`.
    const offsetAt = (ms) => {
        const p = zonedParts(ms);
        return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - ms;
    };
    // Guess with the offset at the UTC midnight, then correct once in case the offset differs there.
    const guess = wallAsUtc - offsetAt(wallAsUtc);
    return wallAsUtc - offsetAt(guess);
}

/** The date after `daily` ('YYYY-MM-DD'), by the calendar. */
export function nextDailyDate(daily) {
    return utcDate(Date.parse(`${daily}T00:00:00Z`) + DAY_MS);
}

/** Whether `daily` is a real 'YYYY-MM-DD' date. */
export function isDailyDate(daily) {
    return typeof daily === 'string' && DAILY_RE.test(daily) && utcDate(Date.parse(`${daily}T00:00:00Z`) || 0) === daily;
}

/** Whether the daily leaderboard for `daily` still takes runs at `nowMs`: from that day until DAILY_GRACE_DAYS after. */
export function dailyOpen(daily, nowMs = Date.now()) {
    if (!isDailyDate(daily)) return false;
    return daily <= dailyDateAt(nowMs) && daily >= dailyDateAt(nowMs - DAILY_GRACE_DAYS * DAY_MS);
}
const KEY_RE = /^[a-z0-9_]{1,32}$/;
// Letters and digits in any script, spaces, and a little punctuation.
const NAME_RE = /^[\p{L}\p{N}][\p{L}\p{N} _.'-]*$/u;

/** A display name as the leaderboard keeps it: trimmed, single spaces, at most NAME_MAX. */
export function cleanName(name) {
    return String(name ?? '').normalize('NFC').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX).trim();
}

/** Why a name can't be used, or null if it's fine. */
export function nameProblem(name) {
    const n = cleanName(name);
    if (!n) return 'Enter a name to show on the leaderboard.';
    if (!NAME_RE.test(n)) return 'Names can use letters, numbers, spaces and . _ \' - only.';
    return null;
}

const int = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;

/**
 * Checks an entry. Returns { entry } (a clean copy with only the known fields) or { error }.
 */
export function validateEntry(e) {
    if (!e || typeof e !== 'object') return { error: 'Not an entry.' };
    if (typeof e.id !== 'string' || !ID_RE.test(e.id)) return { error: 'Bad run id.' };
    const problem = nameProblem(e.name);
    if (problem) return { error: problem };
    for (const [k, lo, hi] of [['score', 0, 10_000_000], ['startPartySize', 1, 3], ['tier', 0, 9],
        ['battles', 1, 500], ['floors', 0, 500], ['elites', 0, 500], ['bosses', 0, 50]]) {
        if (!int(e[k], lo, hi)) return { error: `Bad ${k}.` };
    }
    if (e.score > e.battles * MAX_POINTS_PER_BATTLE) return { error: 'That score is higher than the battles allow.' };
    // Daily runs all start the same way: three members, no Rift Tier.
    if (e.daily != null && (!isDailyDate(e.daily) || e.tier !== 0 || e.startPartySize !== 3)) return { error: 'Bad daily run.' };
    const date = new Date(e.date);
    if (typeof e.date !== 'string' || Number.isNaN(date.getTime())) return { error: 'Bad date.' };
    if (!Array.isArray(e.realms) || e.realms.length > 5 || !e.realms.every(r => typeof r === 'string' && KEY_RE.test(r))) return { error: 'Bad realms.' };
    if (!Array.isArray(e.party) || e.party.length < 1 || e.party.length > MAX_PARTY_SIZE) return { error: 'Bad party.' };
    const party = [];
    for (const m of e.party) {
        if (!m || typeof m.job !== 'string' || !KEY_RE.test(m.job)) return { error: 'Bad party.' };
        if (m.origin != null && (typeof m.origin !== 'string' || !KEY_RE.test(m.origin))) return { error: 'Bad party.' };
        if (!int(m.level, 1, 99)) return { error: 'Bad party.' };
        party.push({ job: m.job, origin: m.origin ?? null, level: m.level });
    }
    return {
        entry: {
            id: e.id, name: cleanName(e.name), score: e.score, date: date.toISOString(),
            startPartySize: e.startPartySize, tier: e.tier, battles: e.battles, floors: e.floors,
            elites: e.elites, bosses: e.bosses, realms: [...e.realms], party,
            ...(e.daily != null ? { daily: e.daily } : {}),
        },
    };
}
