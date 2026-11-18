// Run with: node --test "tests/**/*.test.mjs"
// Settings > Graphics > Performance & Battery: what each saved choice means in game, and how
// the frame cap picks frames from the display's refresh.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { perfSettings, refreshPerfSettings, pixelRatio, scaledParticleCount } from '../../js/core/perf-settings.js';
import { FramePacer } from '../../js/tactical/scene-manager.js';

// A saved-settings store standing in for the browser's.
function saveSettings(obj) {
    const data = { riftbreakers_settings: JSON.stringify(obj) };
    globalThis.localStorage = { getItem: k => data[k] ?? null, setItem: (k, v) => { data[k] = String(v); } };
    refreshPerfSettings();
}

beforeEach(() => { delete globalThis.devicePixelRatio; });
afterEach(() => {
    delete globalThis.localStorage;
    delete globalThis.devicePixelRatio;
    refreshPerfSettings();
});

// Counts the frames drawn in one second of a display refreshing at `hz`.
function framesDrawnInOneSecond(hz, capFps) {
    const pacer = new FramePacer();
    let drawn = 0;
    for (let i = 0; i < hz; i++) if (pacer.shouldDraw(i * 1000 / hz, capFps ? 1000 / capFps : 0)) drawn++;
    return drawn;
}

test('a player who never opened the settings plays exactly as before', () => {
    // GIVEN: no saved settings at all
    saveSettings({});

    // WHEN: the game reads its performance settings
    const s = perfSettings();

    // THEN: no frame cap, high resolution, full effects, no idle slowdown, no counter
    assert.deepEqual({ ...s }, { fps: 0, renderScale: 2, effects: 'full', idleThrottle: false, showFps: false });
});

test('saves from before these settings existed keep the old behavior', () => {
    // GIVEN: settings saved by an older build, holding only audio and accessibility choices
    saveSettings({ musicVolume: 20, sfxVolume: 40, colorblindMode: 'none', tacticsLog: true });

    // WHEN / THEN: performance falls back to the defaults
    assert.equal(perfSettings().fps, 0);
    assert.equal(perfSettings().effects, 'full');
});

test('choosing 30 fps caps the frame rate at 30', () => {
    // GIVEN: Frame rate set to 30 fps
    saveSettings({ fpsCap: '30' });

    // WHEN / THEN: the game caps at 30
    assert.equal(perfSettings().fps, 30);
});

test('battery saver forces battery-friendly values over the individual choices', () => {
    // GIVEN: the player picked the most demanding options, then turned on Battery saver
    saveSettings({ fpsCap: '0', renderScale: '2', effects: 'full', idleThrottle: false, batterySaver: true });

    // WHEN: the game reads its settings
    const s = perfSettings();

    // THEN: 30 fps, 1x resolution, reduced effects, idle slowdown on
    assert.equal(s.fps, 30);
    assert.equal(s.renderScale, 1);
    assert.equal(s.effects, 'reduced');
    assert.equal(s.idleThrottle, true);
});

test('battery saver never raises a choice that is already lower', () => {
    // GIVEN: Minimal effects chosen before turning on Battery saver
    saveSettings({ effects: 'minimal', batterySaver: true });

    // WHEN / THEN: effects stay at Minimal rather than going up to Reduced
    assert.equal(perfSettings().effects, 'minimal');
});

test('a changed setting takes effect once the menu saves it', () => {
    // GIVEN: the game running uncapped
    saveSettings({ fpsCap: '0' });
    assert.equal(perfSettings().fps, 0);

    // WHEN: the player picks 30 fps in the menu
    saveSettings({ fpsCap: '30' });

    // THEN: the next read uses the new cap
    assert.equal(perfSettings().fps, 30);
});

test('a corrupted settings entry falls back to the defaults instead of breaking the game', () => {
    // GIVEN: settings that are not valid JSON
    globalThis.localStorage = { getItem: () => '{not json', setItem() {} };
    refreshPerfSettings();

    // WHEN / THEN: defaults apply
    assert.equal(perfSettings().fps, 0);
    assert.equal(perfSettings().renderScale, 2);
});

test('low resolution draws at 1x even on a 3x phone screen', () => {
    // GIVEN: a 3x screen and Render resolution set to Low
    globalThis.devicePixelRatio = 3;
    saveSettings({ renderScale: '1' });

    // WHEN / THEN: the game draws at 1x
    assert.equal(pixelRatio(), 1);
});

test('high resolution never draws above the screen\'s own density', () => {
    // GIVEN: an ordinary 1x monitor and Render resolution set to High
    globalThis.devicePixelRatio = 1;
    saveSettings({ renderScale: '2' });

    // WHEN / THEN: no supersampling beyond the screen
    assert.equal(pixelRatio(), 1);
});

test('full effects spawn every particle asked for', () => {
    saveSettings({ effects: 'full' });
    assert.equal(scaledParticleCount(12), 12);
});

test('reduced effects spawn about half the particles', () => {
    // GIVEN: Reduced effects
    saveSettings({ effects: 'reduced' });

    // WHEN: an even-sized burst is spawned
    // THEN: exactly half appear (no rounding needed)
    assert.equal(scaledParticleCount(12), 6);
});

test('minimal effects spawn about a quarter of the particles, on average', () => {
    // GIVEN: Minimal effects
    saveSettings({ effects: 'minimal' });

    // WHEN: many 2-particle bursts are spawned
    let total = 0;
    for (let i = 0; i < 4000; i++) total += scaledParticleCount(2);

    // THEN: small bursts still show sometimes, averaging a quarter (0.5 each)
    const average = total / 4000;
    assert.ok(average > 0.4 && average < 0.6, `average ${average}`);
});

test('a 30 fps cap draws every other frame on a 60 Hz display', () => {
    assert.equal(framesDrawnInOneSecond(60, 30), 30);
});

test('a 30 fps cap on a 120 Hz display draws 30 frames, not 120', () => {
    assert.equal(framesDrawnInOneSecond(120, 30), 30);
});

test('a 60 fps cap holds 60 on a 144 Hz display, which is not a multiple of 60', () => {
    // Leftover time carries between frames, so the average stays on target.
    const drawn = framesDrawnInOneSecond(144, 60);
    assert.ok(drawn >= 59 && drawn <= 61, `drew ${drawn}`);
});

test('with no cap every frame the display offers is drawn', () => {
    assert.equal(framesDrawnInOneSecond(120, 0), 120);
});

test('a frame arriving slightly early still counts toward a 30 fps cap', () => {
    // GIVEN: a 30 fps cap and a 60 Hz display whose frame times jitter by a fraction of a ms
    const pacer = new FramePacer();
    const interval = 1000 / 30;
    pacer.shouldDraw(0, interval);

    // WHEN: the second display frame after it lands 0.5 ms early
    pacer.shouldDraw(16.7, interval);
    const drawn = pacer.shouldDraw(2 * 1000 / 60 - 0.5, interval);

    // THEN: it is drawn, rather than slipping to the third frame (20 fps)
    assert.equal(drawn, true);
});

test('after a long pause the cap starts fresh instead of drawing a burst of catch-up frames', () => {
    // GIVEN: a 30 fps cap, and the tab hidden for 5 seconds after the first frame
    const pacer = new FramePacer();
    const interval = 1000 / 30;
    pacer.shouldDraw(0, interval);

    // WHEN: frames resume at 60 Hz
    const results = [5000, 5016.7, 5033.3, 5050].map(t => pacer.shouldDraw(t, interval));

    // THEN: one frame draws on return, then every other frame, with no catch-up run
    assert.deepEqual(results, [true, false, true, false]);
});
