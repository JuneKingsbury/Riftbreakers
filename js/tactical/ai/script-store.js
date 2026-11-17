// Persistence for player-authored scripts, keyed by character name (names are
// unique within a party). During a run the scripts live in the run's own save
// (setScriptBacking(run.scripts)); otherwise, e.g. in the dev harnesses, they live
// in localStorage. Enemies never read from here, they always use the defaults.
import { autoScriptFor } from './default-scripts.js';
import { abilitiesForMember } from './party.js';
import { sanitizeScript } from './script-validate.js';

export const STORAGE_KEY = 'riftbreak.tactical.scripts.v1';

function storage() {
    try { return globalThis.localStorage ?? null; } catch { return null; }
}

let backing = null;

// Point the store at a plain object (a run's `scripts` map), or null for localStorage.
export function setScriptBacking(obj) {
    backing = obj;
}

function readAll() {
    if (backing) return backing;
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
    if (backing) {
        if (all !== backing) { for (const k of Object.keys(backing)) delete backing[k]; Object.assign(backing, all); }
        return true;
    }
    const s = storage();
    if (!s) return false;
    try { s.setItem(STORAGE_KEY, JSON.stringify(all)); return true; } catch { return false; }
}

// The script a character fights with: their custom tactics if they have valid ones,
// else the default behavior generated from the abilities they have right now.
export function getScriptFor(charData) {
    if (charData.team === 'player') {
        const saved = readAll()[charData.name];
        const clean = saved ? sanitizeScript(saved) : null;
        if (clean) return clean;
    }
    return defaultBehaviorFor(charData);
}

export function defaultBehaviorFor(charData) {
    return autoScriptFor(charData.job, abilitiesForMember(charData));
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

// ---- Template (Tactician's Codex) ----
// One script saved apart from any character, to load onto any of them. Rules naming a skill
// the character lacks are flagged in the editor and skipped in battle.
export const TEMPLATE_KEY = 'riftbreak.tactical.template.v1';

export function saveTemplate(script) {
    const clean = sanitizeScript(script);
    const s = storage();
    if (!clean || !s) return false;
    try { s.setItem(TEMPLATE_KEY, JSON.stringify(clean)); return true; } catch { return false; }
}

export function loadTemplate() {
    try {
        const raw = storage()?.getItem(TEMPLATE_KEY);
        return raw ? sanitizeScript(JSON.parse(raw)) : null;
    } catch { return null; }
}

export function resetScript(name) {
    const all = readAll();
    delete all[name];
    return writeAll(all);
}
