// What a leaderboard entry may contain. Shared by the game (leaderboard.js) and the Worker that
// stores entries (cloudflare-worker/riftbreak-api.js), so both check the same rules. No imports:
// the Worker bundles this file on its own.
//
// An entry: { id, name, score, date, startPartySize, tier, battles, floors, elites, bosses,
//             realms: [string], party: [{ job, origin, level }] }

export const NAME_MAX = 20;
export const MAX_PARTY_SIZE = 6;
// The most a single battle can score: a boss (500) at ×2 speed with a solo start (×2) at
// Rift Tier IV (×2.5, RIFT_TIER_SCORE in score.js).
export const MAX_POINTS_PER_BATTLE = 5000;

const ID_RE = /^[a-z0-9-]{1,40}$/i;
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
        },
    };
}
