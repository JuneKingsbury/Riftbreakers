// A signal that saved progress changed (the profile, the run, skill plans), for cloud sync
// (cloud-sync.js) to upload it. Saving code calls notifySaved(); nothing else depends on it.
const listeners = new Set();

/** Calls fn() after every save. Returns a function that stops it. */
export function onSaved(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

export function notifySaved() {
    for (const fn of listeners) {
        try { fn(); } catch { /* a listener's failure never breaks saving */ }
    }
}
