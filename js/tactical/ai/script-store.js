// Persistence for player-authored scripts. Scripts live in localStorage keyed
// by character name (names are unique in CHARACTER_DATA). Enemies never read
// from here, they always use the defaults.
import { defaultScriptFor } from './default-scripts.js';
import { sanitizeScript } from './script-validate.js';

export const STORAGE_KEY = 'riftbreak.tactical.scripts.v1';

function storage() {
    try { return globalThis.localStorage ?? null; } catch { return null; }
}

function readAll() {
    const s = storage();
    if (!s) return {};
    try {
        const parsed = JSON.parse(s.getItem(STORAGE_KEY) || '{}');
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

function writeAll(all) {
    const s = storage();
    if (!s) return false;
    try { s.setItem(STORAGE_KEY, JSON.stringify(all)); return true; } catch { return false; }
}

// The script a character fights with: the saved one if present and valid, else the job default.
export function getScriptFor(charData) {
    if (charData.team === 'player') {
        const saved = readAll()[charData.name];
        const clean = saved ? sanitizeScript(saved) : null;
        if (clean) return clean;
    }
    return defaultScriptFor(charData.job);
}

export function hasCustomScript(name) {
    return !!(readAll()[name] && sanitizeScript(readAll()[name]));
}

// Returns false when the script is invalid or storage is unavailable.
export function saveScript(name, script) {
    const clean = sanitizeScript(script);
    if (!clean) return false;
    const all = readAll();
    all[name] = clean;
    return writeAll(all);
}

export function resetScript(name) {
    const all = readAll();
    delete all[name];
    return writeAll(all);
}
