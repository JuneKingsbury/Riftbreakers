// Cloud saves: keeps one copy of all progress (the same save as Export, save-transfer.js) in the
// player's Google Drive, as riftbreak-save.json in the game's hidden app folder.
//
// - Every save (save-events.js) marks local progress as changed and uploads it a few seconds
//   later, and right away when the page is hidden (closing the tab, switching apps).
// - sync() (on start-up and from Settings) compares the cloud copy with the one this device last
//   uploaded or downloaded:
//     cloud unchanged          → upload local changes, if any
//     cloud changed elsewhere  → download it, unless this device also has unsynced changes (or
//                                is linking for the first time with progress of its own): then
//                                the player chooses which copy to keep.
// Downloads replace progress exactly as importing a save does (applySave), so they never mix
// two saves together.
import { exportSave, readSaveText, describeSave, applySave, checkSave } from './save-transfer.js';
import { defaultStorage, loadProfile } from './profile.js';
import { SAVE_KEY } from './run-state.js';
import { onSaved } from './save-events.js';

export const CLOUD_FILE = 'riftbreak-save.json';
export const SYNC_STATE_KEY = 'riftbreak.cloud.v1';
export const UPLOAD_DELAY_MS = 5000;

const newSyncId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

// The id of a cloud copy: its syncId, or for a copy without one, its export time.
function cloudId(raw, checked) {
    try {
        const id = JSON.parse(raw)?.syncId;
        if (typeof id === 'string' && id) return id;
    } catch { /* a save code, not JSON */ }
    return checked.exportedAt ?? null;
}

/**
 * Whether this device has progress worth keeping: renown, unlocks, a played run or one under way.
 */
export function hasLocalProgress(storage = defaultStorage()) {
    const p = loadProfile(storage);
    let run = null;
    try { run = storage?.getItem(SAVE_KEY); } catch { run = null; }
    return p.renown > 0 || p.unlocked.length > 0 || p.stats.runs > 0 || !!run;
}

/**
 * @param {object} deps
 * @param {{cloudRead: Function, cloudWrite: Function, isConnected: Function}} deps.drive  core/gdrive.js
 * @param {Storage} [deps.storage]
 * @param {(c: {local: string, cloud: string}) => Promise<'local'|'cloud'|null>} [deps.resolveConflict]
 *        Asks the player which copy to keep (null: decide later). Default: decide later.
 * @param {(status: object) => void} [deps.onStatus]  Told about uploads, downloads and errors
 * @param {() => Date} [deps.now]
 */
export function createCloudSync({ drive, storage = defaultStorage(), resolveConflict = async () => null, onStatus = () => {}, now = () => new Date() }) {
    let changes = 0;          // local saves so far, so an upload only clears what it carried
    let timer = 0;
    let busy = Promise.resolve();
    // One cloud operation at a time.
    const exclusive = (task) => (busy = busy.then(task, task));

    const readState = () => {
        try {
            const s = JSON.parse(storage?.getItem(SYNC_STATE_KEY));
            return { lastSyncedId: typeof s?.lastSyncedId === 'string' ? s.lastSyncedId : null, dirty: s?.dirty === true };
        } catch { return { lastSyncedId: null, dirty: false }; }
    };
    const writeState = (s) => {
        try { storage?.setItem(SYNC_STATE_KEY, JSON.stringify(s)); } catch { /* storage full or off */ }
    };

    function markDirty() {
        changes++;
        const s = readState();
        if (!s.dirty) writeState({ ...s, dirty: true });
    }

    async function upload() {
        const carried = changes;
        // syncId names this exact upload, so devices can tell copies apart even if their clocks agree.
        const save = { ...exportSave(storage, now()), syncId: newSyncId() };
        await drive.cloudWrite(CLOUD_FILE, JSON.stringify(save));
        // A save made while uploading stays marked, for the next upload.
        writeState({ lastSyncedId: save.syncId, dirty: changes !== carried });
        onStatus({ kind: 'uploaded', at: save.exportedAt });
        return save;
    }

    function download(checked, id) {
        if (!applySave(checked, storage)) throw new Error('Couldn\'t save on this device. Storage may be full or turned off.');
        // applySave announced its own saves; they are the cloud copy, not local changes.
        changes++;
        writeState({ lastSyncedId: id, dirty: false });
        onStatus({ kind: 'downloaded', at: checked.exportedAt, runDropped: checked.runDropped });
    }

    /**
     * Brings this device and the cloud copy in line (see the top of the file).
     * Resolves to 'uploaded' | 'downloaded' | 'up-to-date' | 'kept-local' | 'undecided' | 'offline'.
     */
    function sync() {
        return exclusive(async () => {
            if (!drive.isConnected()) return 'offline';
            const raw = await drive.cloudRead(CLOUD_FILE);
            if (raw == null) { await upload(); return 'uploaded'; }
            const { save: cloud, error } = readSaveText(raw);
            // An unreadable cloud copy (damaged, or from a newer game version) is never overwritten
            // silently from an older game: report it and leave both alone.
            if (error) { onStatus({ kind: 'error', message: `The cloud save couldn't be read: ${error}` }); return 'undecided'; }
            const id = cloudId(raw, cloud);
            const st = readState();
            if (id && id === st.lastSyncedId) {
                if (!st.dirty) return 'up-to-date';
                await upload();
                return 'uploaded';
            }
            const linkedBefore = st.lastSyncedId != null;
            if ((linkedBefore && !st.dirty) || !hasLocalProgress(storage)) { download(cloud, id); return 'downloaded'; }
            const local = checkSave(exportSave(storage, now())).save;
            const choice = await resolveConflict({ local: describeSave(local), cloud: describeSave(cloud) });
            if (choice === 'cloud') { download(cloud, id); return 'downloaded'; }
            if (choice === 'local') { await upload(); return 'kept-local'; }
            return 'undecided';
        });
    }

    // Upload soon after a save, if there's still something unsynced by then.
    function scheduleUpload(delay = UPLOAD_DELAY_MS) {
        clearTimeout(timer);
        timer = setTimeout(flush, delay);
    }

    /** Uploads unsynced changes now. Never throws (errors go to onStatus). */
    function flush() {
        clearTimeout(timer);
        return exclusive(async () => {
            if (!drive.isConnected() || !readState().dirty) return false;
            await upload();
            return true;
        }).catch(e => { onStatus({ kind: 'error', message: e.message }); return false; });
    }

    /** Starts watching saves. Returns a function that stops. */
    function start() {
        const off = onSaved(() => {
            markDirty();
            if (drive.isConnected()) scheduleUpload();
        });
        const onHide = () => { if (document.visibilityState === 'hidden') flush(); };
        if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onHide);
        return () => {
            off();
            clearTimeout(timer);
            if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onHide);
        };
    }

    /** Forgets which cloud copy this device matched (after disconnecting). */
    function forget() {
        writeState({ lastSyncedId: null, dirty: readState().dirty });
    }

    return { sync, flush, start, markDirty, forget, state: readState };
}
