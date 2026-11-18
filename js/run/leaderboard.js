// The online leaderboard: high-scoring runs, won or lost, submitted with a name, highest score
// first, stored by the Worker (cloudflare-worker/riftbreak-api.js). A run is submitted at most
// once (by its id). Entries don't say whether the run was won: runResult works it out.
import { API_BASE } from '../core/cloud-config.js';
import { validateEntry, cleanName } from './leaderboard-rules.js';
import { loadProfile, saveProfile, defaultStorage } from './profile.js';

export const NAME_KEY = 'riftbreak.leaderboard.name';
export const LEADERBOARD_SIZE = 100;

/** The name last used to submit, for the name box. */
export function savedName(storage = defaultStorage()) {
    try { return cleanName(storage?.getItem(NAME_KEY) ?? ''); } catch { return ''; }
}

/** A remembered run (profile.bestRuns) as a leaderboard entry under `name`. */
export function entryFromRun(run, name) {
    return {
        id: run.id, name: cleanName(name), score: run.score, date: run.date,
        startPartySize: run.startPartySize ?? 3, tier: run.tier ?? 0,
        battles: run.battles, floors: run.floors, elites: run.elites, bosses: run.bosses,
        realms: run.realms ?? [],
        party: run.party.map(m => ({ job: m.job, origin: m.origin ?? null, level: m.level })),
    };
}

/**
 * How a leaderboard entry's run ended: { won, act }. Entries list the realms the run reached,
 * one per act, and a run is won once it has beaten every one of their bosses. (Entries from
 * before high scores were all wins, and list every realm with all its bosses beaten.)
 */
export function runResult(entry) {
    const acts = entry.realms?.length ?? 0;
    if (!acts) return { won: true, act: null };
    return { won: entry.bosses >= acts, act: Math.min(acts, entry.bosses + 1) };
}

/**
 * Whether a remembered run can go on the leaderboard (scored, with an id, not yet sent). Challenge
 * runs can't: leaderboard entries don't record a challenge.
 */
export function canSubmit(run) {
    return !!run?.id && run.score > 0 && !run.submitted && !run.challenge;
}

async function api(path, opts = {}, fetchImpl = globalThis.fetch) {
    let resp;
    try {
        resp = await fetchImpl(`${API_BASE}${path}`, opts);
    } catch {
        throw new Error('Couldn\'t reach the leaderboard. Check your connection and try again.');
    }
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(data.error || `The leaderboard answered with an error (${resp.status}).`);
    return data;
}

/**
 * Sends a run to the leaderboard under `name`, then marks it submitted in the profile and
 * remembers the name. Resolves to { rank, total }; throws with a message for the player.
 */
export async function submitRun(run, name, { fetchImpl, storage = defaultStorage() } = {}) {
    const { entry, error } = validateEntry(entryFromRun(run, name));
    if (error) throw new Error(error);
    const result = await api('/leaderboard', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry),
    }, fetchImpl);
    try { storage?.setItem(NAME_KEY, entry.name); } catch { /* not remembered */ }
    const profile = loadProfile(storage);
    const mine = profile.bestRuns.find(r => r.id === run.id);
    if (mine) {
        mine.submitted = true;
        saveProfile(profile, storage);
    }
    return { rank: result.rank ?? null, total: result.total ?? null };
}

/** The top entries, highest score first. Throws with a message for the player. */
export async function fetchLeaderboard({ limit = LEADERBOARD_SIZE, fetchImpl } = {}) {
    const data = await api(`/leaderboard?limit=${limit}`, {}, fetchImpl);
    return (Array.isArray(data.entries) ? data.entries : [])
        .map(e => validateEntry(e).entry).filter(Boolean);
}
