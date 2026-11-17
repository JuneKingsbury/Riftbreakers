// The rift transition between places: the screen fills with black, the portal sprite
// (effects/portal in the skin) opens in the middle, already spinning, and rushes toward the
// camera (a full turn in all) until it
// fills the view, as if the party were stepping through it, then everything fades away to
// reveal where they arrived. Used when a new run begins and when the party moves to a new act.
//
// The change of scene happens at the peak, while the portal covers the screen (onMidpoint),
// so the player never sees it.
import { Sound } from '../audio/sound.js';

const FADE_IN_MS = 380;    // black fades in, the portal appears small
const RUSH_MS = 720;       // the portal grows to fill the screen
const HOLD_MS = 120;       // fully inside the rift
const FADE_OUT_MS = 520;   // the rift fades, revealing the new place
const START_PX = 48;       // the portal's size as it appears

let running = false;

const wait = (ms) => new Promise(r => setTimeout(r, ms));
const reducedMotion = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

/**
 * Plays the transition. Resolves once it has finished; onMidpoint runs (and is awaited)
 * while the screen is covered.
 * @param {{ skinManager?: object, onMidpoint?: () => (void|Promise<void>) }} [opts]
 */
export async function riftTransition({ skinManager = globalThis._sharedSkinManager, onMidpoint } = {}) {
    if (running || typeof document === 'undefined') { await onMidpoint?.(); return; }
    running = true;
    const overlay = document.createElement('div');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.style.cssText = `position:fixed; inset:0; z-index:15000; background:#000; opacity:0;
        display:flex; align-items:center; justify-content:center; overflow:hidden; pointer-events:all;
        transition:opacity ${FADE_IN_MS}ms ease-in;`;

    // The portal: the skin sprite, kept crisp as it grows (a soft violet disc without a skin).
    const sprite = skinManager?.getSprite?.('effects', 'portal');
    const portal = document.createElement('canvas');
    portal.width = 16;
    portal.height = 16;
    const ctx = portal.getContext('2d');
    if (sprite) {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(sprite, 0, 0, 16, 16);
    } else {
        const g = ctx.createRadialGradient(8, 8, 1, 8, 8, 8);
        g.addColorStop(0, '#e9d4ff'); g.addColorStop(0.5, '#8a4dd8'); g.addColorStop(1, 'rgba(60,20,110,0)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, 16, 16);
    }
    // Large enough at its peak to cover the screen's diagonal.
    const peak = Math.ceil(Math.hypot(window.innerWidth, window.innerHeight) * 1.6);
    portal.style.cssText = `width:${START_PX}px; height:${START_PX}px; image-rendering:pixelated;
        filter:drop-shadow(0 0 10px rgba(170,110,255,0.85)); opacity:0; will-change:transform,opacity;
        transform:scale(0.6) rotate(0deg);`;
    overlay.appendChild(portal);
    document.body.appendChild(overlay);

    try {
        // Black, then the portal opens, spinning from the first moment. The turn and the growth
        // are separate animations: it spins one full turn at an even pace the whole way, while
        // it opens gently and then rushes toward the camera.
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        overlay.style.opacity = '1';
        Sound.playSfx('rift_travel');
        const rush = reducedMotion() ? 0 : RUSH_MS;
        const total = FADE_IN_MS + rush;
        const opened = FADE_IN_MS / total;
        portal.style.transform = 'none';
        const frames = [
            { offset: 0, opacity: 0, scale: '0.6', easing: 'ease-out' },
            { offset: opened, opacity: 1, scale: '1', easing: 'cubic-bezier(0.55, 0, 0.9, 0.35)' },
        ];
        if (rush) frames.push({ offset: 1, opacity: 1, scale: String(peak / START_PX) });
        const spin = portal.animate(frames, { duration: total, fill: 'forwards' });
        // One full turn by the time it fills the screen, and it keeps turning at that pace
        // through the hold and the fade out (until the overlay is removed).
        portal.animate([{ rotate: '0deg' }, { rotate: '360deg' }], { duration: total, easing: 'linear', iterations: Infinity });
        if (rush) portal.animate([
            { filter: 'drop-shadow(0 0 10px rgba(170,110,255,0.85))' },
            { offset: opened, filter: 'drop-shadow(0 0 10px rgba(170,110,255,0.85))' },
            { filter: 'drop-shadow(0 0 40px rgba(200,150,255,1)) brightness(1.4)' },
        ], { duration: total, fill: 'forwards' });
        await Promise.race([spin.finished, wait(total + 100)]);
        // Past the peak it keeps growing at the speed it reached there (mostly off screen by
        // now), through the hold and the fade out, until the overlay is removed.
        if (rush) {
            const peakScale = peak / START_PX;
            // The rush easing's slope at its end: (1 - 0.35) / (1 - 0.9) of the average rate.
            const perMs = ((peakScale - 1) / rush) * ((1 - 0.35) / (1 - 0.9));
            const keepMs = 4000;
            portal.animate([{ scale: String(peakScale) }, { scale: String(peakScale + perMs * keepMs) }],
                { duration: keepMs, easing: 'linear', fill: 'forwards' });
        }
        await wait(HOLD_MS);

        try { await onMidpoint?.(); } catch (e) { console.error(e); }

        // Out the other side.
        overlay.style.transition = `opacity ${FADE_OUT_MS}ms ease-out`;
        overlay.style.opacity = '0';
        overlay.style.pointerEvents = 'none';
        await wait(FADE_OUT_MS);
    } finally {
        overlay.remove();
        running = false;
    }
}
