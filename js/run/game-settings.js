// Player settings that game code reads during a run. They live in the title screen's settings
// object (localStorage 'riftbreakers_settings', see core/main.js), which also holds audio and
// graphics options; these helpers read and update single keys without touching the rest.
export const SETTINGS_KEY = 'riftbreakers_settings';

function storage() {
    try { return globalThis.localStorage ?? null; } catch { return null; }
}

/** All saved settings ({} when none or unreadable). */
export function loadGameSettings() {
    try { return JSON.parse(storage()?.getItem(SETTINGS_KEY)) || {}; } catch { return {}; }
}

/** Sets one setting, keeping the others. Returns false when it couldn't be saved. */
export function setGameSetting(key, value) {
    const s = storage();
    if (!s) return false;
    try { s.setItem(SETTINGS_KEY, JSON.stringify({ ...loadGameSettings(), [key]: value })); return true; } catch { return false; }
}

/** Auto-equip: give each new item to whoever it's a strict upgrade for (run/equip-options.js). Off by default. */
export function autoEquipEnabled() {
    return loadGameSettings().autoEquip === true;
}
