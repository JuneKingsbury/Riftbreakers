import { perfSettings, IDLE_FPS, IDLE_AFTER_MS } from '../core/perf-settings.js';

// Input that wakes the game from idle (Settings > Graphics > Low power when idle).
const WAKE_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'];

/**
 * Picks which animation frames to draw under a frame cap.
 *
 * The browser offers frames at the display's rate (60, 120, 144 Hz ...). A frame is drawn
 * once `interval` ms have passed since the last one. The schedule advances by exactly
 * `interval`, not to the frame's time, so leftover time carries over and the average rate
 * stays on target even when the display rate is not a multiple of the cap (144 Hz at 60).
 */
export class FramePacer {
    constructor() { this._last = null; }

    /**
     * @param {number} now       Frame time, ms.
     * @param {number} interval  Minimum ms between drawn frames; 0 draws every frame.
     * @returns {boolean} true to draw this frame.
     */
    shouldDraw(now, interval) {
        if (!(interval > 0) || this._last == null) { this._last = now; return true; }
        const elapsed = now - this._last;
        // 1 ms of slack: frame times jitter, and a frame landing a hair early should still count.
        if (elapsed < interval - 1) return false;
        // Far behind (a hidden tab, a long stall, the cap just loosened): start a fresh schedule.
        this._last = elapsed > interval * 2 ? now : this._last + interval;
        return true;
    }
}

export class SceneManager {
    constructor(containerEl, skinManager, onExit) {
        this._container   = containerEl;
        this._skinManager = skinManager;
        this._onRootExit  = onExit;
        this._stack       = [];
        this._rafId       = null;
        this._stopped     = false;
        this._pacer       = new FramePacer();
        this._lastInput   = performance.now();
        this._onInput     = () => { this._lastInput = performance.now(); };
        for (const type of WAKE_EVENTS) window.addEventListener(type, this._onInput, { capture: true, passive: true });
        this._fpsEl       = null;
        this._fpsFrames   = 0;
        this._fpsSince    = 0;
    }

    get current() { return this._stack[this._stack.length - 1] || null; }

    push(scene) {
        if (this.current) this.current.exit();
        this._stack.push(scene);
        scene.enter(this._container, this._skinManager, this);
        this._ensureLoop();
    }

    pop() {
        const leaving = this._stack.pop();
        if (leaving) leaving.exit();
        if (this._stack.length === 0) {
            this._stop();
            if (this._onRootExit) this._onRootExit();
            return;
        }
        const next = this.current;
        if (next) next.resume(this._container, this._skinManager, this);
    }

    replace(scene) {
        const leaving = this._stack.pop();
        if (leaving) leaving.exit();
        this._stack.push(scene);
        scene.enter(this._container, this._skinManager, this);
    }

    /** True while the game should slow to IDLE_FPS: idle mode on, no recent input, scene still. */
    _isIdle(now, scene, perf) {
        if (!perf.idleThrottle) return false;
        if (now - this._lastInput < IDLE_AFTER_MS) return false;
        // Scenes that animate on their own (a battle playing out) say so; others are still.
        return !(scene?.isBusy?.() ?? false);
    }

    _ensureLoop() {
        if (this._rafId !== null) return;
        const tick = (now) => {
            if (this._stopped) return;
            this._rafId = requestAnimationFrame(tick);
            const scene = this.current;
            const perf = perfSettings();
            const idle = this._isIdle(now, scene, perf);
            const cap = idle ? Math.min(IDLE_FPS, perf.fps || IDLE_FPS) : perf.fps;
            if (!this._pacer.shouldDraw(now, cap > 0 ? 1000 / cap : 0)) return;
            if (scene) scene.render(now);
            this._countFrame(now, perf.showFps, idle);
        };
        this._rafId = requestAnimationFrame(tick);
    }

    // The Show FPS counter: frames actually drawn, averaged over half a second.
    _countFrame(now, show, idle) {
        if (!show) {
            if (this._fpsEl) { this._fpsEl.remove(); this._fpsEl = null; }
            return;
        }
        if (!this._fpsEl) {
            this._fpsEl = document.createElement('div');
            this._fpsEl.style.cssText = 'position:fixed;left:6px;bottom:6px;z-index:2000;padding:2px 6px;'
                + 'background:rgba(0,0,0,0.6);color:#8f8;font:11px monospace;border-radius:3px;pointer-events:none;';
            document.body.appendChild(this._fpsEl);
            this._fpsFrames = 0;
            this._fpsSince = now;
        }
        this._fpsFrames++;
        const span = now - this._fpsSince;
        if (span >= 500) {
            this._fpsEl.textContent = `${Math.round(this._fpsFrames * 1000 / span)} fps${idle ? ' (idle)' : ''}`;
            this._fpsFrames = 0;
            this._fpsSince = now;
        }
    }

    _stop() {
        this._stopped = true;
        if (this._rafId !== null) {
            cancelAnimationFrame(this._rafId);
            this._rafId = null;
        }
        for (const type of WAKE_EVENTS) window.removeEventListener(type, this._onInput, { capture: true });
        this._fpsEl?.remove();
        this._fpsEl = null;
    }
}
