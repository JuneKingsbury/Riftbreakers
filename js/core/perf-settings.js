// Performance and battery settings (Settings > Graphics > Performance).
//
// They are saved with the other settings under riftbreakers_settings (core/main.js writes
// them). The game loop and the renderers read them through perfSettings(), which caches the
// parsed values: call refreshPerfSettings() after saving so a change applies on the next frame.
//
// Every default keeps today's behavior: no frame cap, high resolution, full effects.

const SETTINGS_KEY = 'riftbreakers_settings';

/** Saved-setting defaults. The values are the strings the Settings menu's <select>s use. */
export const PERF_DEFAULTS = Object.freeze({
    fpsCap:       '0',     // '0' (match the display), '60' or '30'
    renderScale:  '2',     // highest pixel ratio drawn: '2' high, '1.5' balanced, '1' low
    effects:      'full',  // 'full' | 'reduced' | 'minimal'
    batterySaver: false,   // overrides the above with battery-friendly values
    idleThrottle: false,   // draw at IDLE_FPS while nothing moves and nobody is touching the game
    showFps:      false,   // frame-rate counter in the corner
});

/** Frames a second while idle (Low power when idle). */
export const IDLE_FPS = 10;
/** How long without input (ms) before the game counts as idle. */
export const IDLE_AFTER_MS = 2000;

const EFFECT_RANK = { full: 2, reduced: 1, minimal: 0 };

let cached = null;

function readSaved() {
    try { return JSON.parse(globalThis.localStorage?.getItem(SETTINGS_KEY)) || {}; }
    catch { return {}; }
}

/**
 * The settings in force, with Battery saver applied:
 *   fps          frame cap, 0 for none
 *   renderScale  highest device pixel ratio to draw at
 *   effects      'full' | 'reduced' | 'minimal'
 *   idleThrottle true to slow down while idle
 *   showFps      true to show the counter
 */
export function perfSettings() {
    if (cached) return cached;
    const s = { ...PERF_DEFAULTS, ...readSaved() };
    let fps = Number(s.fpsCap);
    if (!(fps > 0)) fps = 0;
    let renderScale = Number(s.renderScale);
    if (!(renderScale > 0)) renderScale = 2;
    let effects = EFFECT_RANK[s.effects] != null ? s.effects : 'full';
    let idleThrottle = s.idleThrottle === true;
    if (s.batterySaver === true) {
        fps = fps > 0 ? Math.min(fps, 30) : 30;
        renderScale = Math.min(renderScale, 1);
        if (effects === 'full') effects = 'reduced';
        idleThrottle = true;
    }
    cached = Object.freeze({ fps, renderScale, effects, idleThrottle, showFps: s.showFps === true });
    return cached;
}

/** Drops the cached values so the next perfSettings() re-reads what was saved. */
export function refreshPerfSettings() {
    cached = null;
}

/** The pixel ratio to draw at: the display's, capped by Render resolution. */
export function pixelRatio() {
    return Math.min(globalThis.devicePixelRatio || 1, perfSettings().renderScale);
}

/** How many particles to spawn for a burst of `count` at the current Effects level. */
export function scaledParticleCount(count) {
    const level = perfSettings().effects;
    if (level === 'full') return count;
    const scaled = count * (level === 'reduced' ? 0.5 : 0.25);
    // Round at random so small bursts (1 or 2 particles) still show some of the time
    // instead of vanishing entirely.
    const whole = Math.floor(scaled);
    return whole + (Math.random() < scaled - whole ? 1 : 0);
}
