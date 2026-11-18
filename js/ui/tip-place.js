// Where to put a floating tooltip next to the pointer, shared by every tooltip in the game
// (ui-kit.js data-tip tips and the battle skill tooltips in battle-ui.js).
//
// With a mouse the tip sits just beside the cursor. With touch it must clear the finger, or the
// thumb covers the text: it goes well above the touch point, else beside it, and only below
// (where the hand usually is) when there is no other room. Always kept on screen.

// Clearance from a touch point: a fingertip plus some margin, in CSS pixels.
export const TOUCH_CLEARANCE = 64;
// Horizontal clearance when the tip has to sit beside the finger instead.
export const TOUCH_SIDE_CLEARANCE = 44;
const MOUSE_GAP = 12;
const EDGE = 4;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/**
 * Picks the tip's top-left corner.
 * @param {number} x, y      Pointer position (client coordinates)
 * @param {number} w, h      Tip size
 * @param {number} vw, vh    Viewport size
 * @param {boolean} touch    True for a finger, false for a mouse or pen
 * @returns {{ left: number, top: number, where: 'above'|'left'|'right'|'below' }}
 */
export function tipPosition(x, y, w, h, vw, vh, touch) {
    const maxLeft = Math.max(EDGE, vw - w - EDGE);
    const maxTop = Math.max(EDGE, vh - h - EDGE);
    if (!touch) {
        // Below-right of the cursor; flipped above when it would run off the bottom.
        const left = clamp(x + MOUSE_GAP, EDGE, maxLeft);
        const top = y + MOUSE_GAP + h > vh - EDGE ? Math.max(EDGE, y - h - MOUSE_GAP) : y + MOUSE_GAP;
        return { left, top, where: top < y ? 'above' : 'below' };
    }
    // Above the finger, centred on it.
    const above = y - TOUCH_CLEARANCE - h;
    if (above >= EDGE) return { left: clamp(x - w / 2, EDGE, maxLeft), top: above, where: 'above' };
    // Beside it, on whichever side has room (the wider side first), as high as fits.
    const top = clamp(y - h - TOUCH_CLEARANCE / 2, EDGE, maxTop);
    const leftSide = x - TOUCH_SIDE_CLEARANCE - w;
    const rightSide = x + TOUCH_SIDE_CLEARANCE;
    const sides = x > vw / 2 ? ['left', 'right'] : ['right', 'left'];
    for (const side of sides) {
        if (side === 'left' && leftSide >= EDGE) return { left: leftSide, top, where: 'left' };
        if (side === 'right' && rightSide + w <= vw - EDGE) return { left: rightSide, top, where: 'right' };
    }
    // No room above or beside: below the finger, clear of it.
    return { left: clamp(x - w / 2, EDGE, maxLeft), top: clamp(y + TOUCH_CLEARANCE, EDGE, maxTop), where: 'below' };
}

/** Moves a position:fixed tooltip element next to the pointer (see tipPosition). */
export function placeTipAt(el, x, y, touch) {
    const { left, top } = tipPosition(x, y, el.offsetWidth, el.offsetHeight, window.innerWidth, window.innerHeight, touch);
    el.style.left = `${Math.round(left)}px`;
    el.style.top = `${Math.round(top)}px`;
}
