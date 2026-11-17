// Exporting and importing save data, so progress can be backed up or moved to another device:
// the profile (renown, unlocks and stats) and the run in progress, if any.
//
// A save is { format: 'riftbreak-save', version, exportedAt, profile, run, skillPlans }, where
// run is the run's own save data (RunState.serialize) or null, and skillPlans the class skill
// plans (skill-plans.js). Saves from before skill plans have no skillPlans field. It travels as a .json file or as a save
// code: the same JSON, base64 encoded with a 'RB1:' prefix, for copying and pasting.
//
// Importing never trusts the data: the profile goes through sanitizeProfile and the run must
// load (RunState.deserialize), or the run is left out.
import { loadProfile, saveProfile, sanitizeProfile, defaultStorage, UNLOCKS } from './profile.js';
import { RunState, SAVE_KEY } from './run-state.js';
import { REALMS } from './data/realms.js';
import { loadPlans, savePlans, sanitizePlans, planCount } from './skill-plans.js';

export const SAVE_FORMAT = 'riftbreak-save';
export const SAVE_FORMAT_VERSION = 1;
const CODE_PREFIX = 'RB1:';

/** The current progress as an exportable save. */
export function exportSave(storage = defaultStorage(), now = new Date()) {
    let run = null;
    try {
        const raw = storage?.getItem(SAVE_KEY);
        if (raw && RunState.deserialize(raw)) run = JSON.parse(raw);
    } catch { run = null; }
    return {
        format: SAVE_FORMAT, version: SAVE_FORMAT_VERSION, exportedAt: now.toISOString(),
        profile: loadProfile(storage), run, skillPlans: loadPlans(storage),
    };
}

/** A file name for an export, e.g. riftbreak-save-2026-11-17.json. */
export function saveFileName(save) {
    return `riftbreak-save-${String(save.exportedAt ?? '').slice(0, 10) || 'export'}.json`;
}

/** A save as a code for copying: 'RB1:' + base64 of its JSON (UTF-8). */
export function saveToCode(save) {
    const bytes = new TextEncoder().encode(JSON.stringify(save));
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return CODE_PREFIX + btoa(binary);
}

/**
 * Reads pasted or loaded text: a save code, or a save file's JSON.
 * Returns { save } or { error } with a message for the player.
 */
export function readSaveText(text) {
    const t = String(text ?? '').trim();
    if (!t) return { error: 'Nothing to load.' };
    let json = t;
    if (t.startsWith(CODE_PREFIX)) {
        try {
            const binary = atob(t.slice(CODE_PREFIX.length).replace(/\s+/g, ''));
            json = new TextDecoder().decode(Uint8Array.from(binary, c => c.charCodeAt(0)));
        } catch {
            return { error: 'That save code is damaged or incomplete. Copy the whole code and try again.' };
        }
    }
    let save;
    try { save = JSON.parse(json); } catch { return { error: 'That isn\'t a Riftbreak save code or save file.' }; }
    return checkSave(save);
}

/**
 * Validates a parsed save. Returns { save: { profile, run, exportedAt } } with a clean profile
 * and a run that loads (or null), or { error }.
 */
export function checkSave(save) {
    if (!save || typeof save !== 'object' || save.format !== SAVE_FORMAT) {
        return { error: 'That isn\'t a Riftbreak save code or save file.' };
    }
    if (!Number.isInteger(save.version) || save.version > SAVE_FORMAT_VERSION) {
        return { error: 'This save comes from a newer version of the game. Update the game, then try again.' };
    }
    const profile = sanitizeProfile(save.profile);
    let run = null, runDropped = false;
    if (save.run) {
        const loaded = (() => { try { return RunState.deserialize(save.run); } catch { return null; } })();
        if (loaded?.status === 'active') run = loaded;
        else runDropped = true;
    }
    // null: the save has no plans (an older save), so importing leaves the current ones.
    const skillPlans = save.skillPlans === undefined ? null : sanitizePlans(save.skillPlans);
    return { save: { profile, run, runDropped, skillPlans, exportedAt: save.exportedAt ?? null } };
}

/** One-paragraph summary of a checked save, for the import confirmation. */
export function describeSave({ profile, run, runDropped, skillPlans, exportedAt }) {
    const unlocks = profile.unlocked.length;
    const parts = [
        `${profile.renown} renown`,
        `${unlocks} of ${Object.keys(UNLOCKS).length} unlocks`,
        `${profile.stats.runs} run${profile.stats.runs === 1 ? '' : 's'} played (${profile.stats.wins} won)`,
    ];
    if (skillPlans) parts.push(`${planCount(skillPlans)} skill plan${planCount(skillPlans) === 1 ? '' : 's'}`);
    let runLine = 'No run in progress.';
    if (run) runLine = `Run in progress: act ${run.act}, ${REALMS[run.realmId]?.name ?? 'unknown realm'}, ${run.party.length} members.`;
    else if (runDropped) runLine = 'The run in progress in this save couldn\'t be read, so it will be left out.';
    const when = exportedAt ? ` Saved ${String(exportedAt).slice(0, 10)}.` : '';
    return `${parts.join(', ')}. ${runLine}${when}`;
}

/**
 * Replaces the current progress with a checked save: the profile, and the run in progress
 * (or no run, if the save has none). Returns true on success.
 */
export function applySave({ profile, run, skillPlans }, storage = defaultStorage()) {
    if (!storage) return false;
    if (!saveProfile(profile, storage)) return false;
    if (skillPlans && !savePlans(skillPlans, storage)) return false;
    if (run) return run.save(storage);
    RunState.clearSave(storage);
    return true;
}
