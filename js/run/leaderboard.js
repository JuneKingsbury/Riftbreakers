// The online leaderboard: winning runs submitted with a name, highest score first, stored by the
// Worker (cloudflare-worker/riftbreak-api.js). A win is submitted at most once (by its id).
import { API_BASE } from '../core/cloud-config.js';
import { validateEntry, cleanName } from './leaderboard-rules.js';
import { loadProfile, saveProfile, defaultStorage } from './profile.js';

export const NAME_KEY = 'riftbreak.leaderboard.name';
export const LEADERBOARD_SIZE = 100;

/** The name last used to submit, for the name box. */
export function savedName(storage = defaultStorage()) {
    try { return cleanName(storage?.getItem(NAME_KEY) ?? ''); } catch { return ''; }
}

/** A remembered win (profile.bestWins) as a leaderboard entry under `name`. */
export function entryFromWin(win, name) {
    return {
        id: win.id, name: cleanName(name), score: win.score, date: win.date,
        startPartySize: win.startPartySize ?? 3, tier: win.tier ?? 0,
        battles: win.battles, floors: win.floors, elites: win.elites, bosses: win.bosses,
        realms: win.realms ?? [],
        party: win.party.map(m => ({ job: m.job, origin: m.origin ?? null, level: m.level })),
    };
}

/** Whether a remembered win can go on the leaderboard (scored, with an id, not yet sent). */
export function canSubmit(win) {
    return !!win?.id && win.score > 0 && !win.submitted;
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
 * Sends a win to the leaderboard under `name`, then marks it submitted in the profile and
 * remembers the name. Resolves to { rank, total }; throws with a message for the player.
 */
export async function submitWin(win, name, { fetchImpl, storage = defaultStorage() } = {}) {
    const { entry, error } = validateEntry(entryFromWin(win, name));
    if (error) throw new Error(error);
    const result = await api('/leaderboard', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry),
    }, fetchImpl);
    try { storage?.setItem(NAME_KEY, entry.name); } catch { /* not remembered */ }
    const profile = loadProfile(storage);
    const mine = profile.bestWins.find(w => w.id === win.id);
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
