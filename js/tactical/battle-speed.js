// The battle playback speed the player last picked (1x, 2x or 4x). It is a player
// preference, not part of a run, so it lives in its own localStorage key. The settings
// object (riftbreakers_settings) is rewritten whole by the settings screen, which would
// drop it.

export const BATTLE_SPEED_KEY = 'riftbreak.battle_speed';
export const BATTLE_SPEEDS = [1, 2, 4];

function defaultStorage() {
    try { return globalThis.localStorage ?? null; } catch { return null; }
}

/** The saved speed, or 1 when nothing valid is saved. */
export function loadBattleSpeed(storage = defaultStorage()) {
    let n;
    try { n = Number(storage?.getItem(BATTLE_SPEED_KEY)); } catch { return 1; }
    return BATTLE_SPEEDS.includes(n) ? n : 1;
}

/** Remember `speed` for later battles. Values other than 1, 2 and 4 are ignored. */
export function saveBattleSpeed(speed, storage = defaultStorage()) {
    if (!BATTLE_SPEEDS.includes(speed)) return;
    try { storage?.setItem(BATTLE_SPEED_KEY, String(speed)); } catch { /* storage full or off */ }
}
