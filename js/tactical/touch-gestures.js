// Touch controls for the 3D battle view: one finger drags the camera, two fingers
// pinch to zoom. Mouse input is left to the scenes' own handlers, and a tap still
// arrives as an ordinary click (inspect a unit, pick a spawn tile).
const PAN_THRESHOLD = 8;

// Returns a function that removes the listeners.
export function attachTouchGestures(canvas, renderer) {
    const touches = new Map();          // pointerId → { x, y }
    let pan = null;                     // { startX, startY, active }
    let pinch = null;                   // last distance between two fingers
    canvas.style.touchAction = 'none';

    const dist = () => {
        const [a, b] = [...touches.values()];
        return Math.hypot(a.x - b.x, a.y - b.y);
    };

    const down = (e) => {
        if (e.pointerType !== 'touch') return;
        touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (touches.size === 1) pan = { startX: e.clientX, startY: e.clientY, active: false };
        if (touches.size === 2) {
            if (pan?.active) renderer.endPan();
            pan = null;
            pinch = dist();
        }
    };
    const move = (e) => {
        if (e.pointerType !== 'touch' || !touches.has(e.pointerId)) return;
        touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (touches.size === 2 && pinch) {
            const d = dist();
            // About one tile-size step per 12px of spread.
            const step = (d - pinch) / 12;
            if (Math.abs(step) >= 1) {
                renderer.zoomBy(Math.round(step));
                pinch = d;
            }
            return;
        }
        if (!pan) return;
        const dx = e.clientX - pan.startX, dy = e.clientY - pan.startY;
        if (!pan.active && Math.hypot(dx, dy) >= PAN_THRESHOLD) {
            pan.active = true;
            renderer.beginPan();
        }
        if (pan.active) renderer.panByPixels(dx, dy);
    };
    const up = (e) => {
        if (e.pointerType !== 'touch') return;
        touches.delete(e.pointerId);
        if (pan?.active || pinch) {
            if (pan?.active) renderer.endPan();
            // A drag or pinch is not a tap: drop the click the browser may send after it.
            suppressUntil = performance.now() + 400;
        }
        if (touches.size < 2) pinch = null;
        if (touches.size === 0) pan = null;
    };
    let suppressUntil = 0;
    const swallow = (c) => {
        if (performance.now() < suppressUntil) { c.stopImmediatePropagation(); c.preventDefault(); }
    };

    canvas.addEventListener('click', swallow, true);
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    return () => {
        canvas.removeEventListener('click', swallow, true);
        canvas.removeEventListener('pointerdown', down);
        canvas.removeEventListener('pointermove', move);
        canvas.removeEventListener('pointerup', up);
        canvas.removeEventListener('pointercancel', up);
    };
}
