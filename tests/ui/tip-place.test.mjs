// Tooltip placement (ui/tip-place.js): a touch tip must never sit under the finger.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { tipPosition, TOUCH_CLEARANCE } from '../../js/ui/tip-place.js';

const VW = 390, VH = 844;   // a phone in portrait
const W = 220, H = 90;

// Whether the tip's box keeps clear of a finger at (x, y): no part within the clearance.
const clearOfFinger = (p, x, y, gap) =>
    p.top + H <= y - gap + 0.5 || p.top >= y + gap - 0.5 || p.left + W <= x - gap / 2 || p.left >= x + gap / 2;

test('a touch tip goes well above the finger when there is room', () => {
    const p = tipPosition(200, 500, W, H, VW, VH, true);
    assert.equal(p.where, 'above');
    assert.ok(p.top + H <= 500 - TOUCH_CLEARANCE, `bottom ${p.top + H}`);
    assert.ok(Math.abs(p.left + W / 2 - 200) < 1, 'centred on the finger');
});

test('near the top it goes beside the finger, on the roomier side, not under it', () => {
    const right = tipPosition(330, 60, W, H, VW, VH, true);
    assert.equal(right.where, 'left');
    assert.ok(right.left + W <= 330 - 40);
    const left = tipPosition(60, 60, W, H, VW, VH, true);
    assert.equal(left.where, 'right');
    assert.ok(left.left >= 60 + 40);
});

test('only when nothing else fits does it go below, still clear of the finger', () => {
    const wide = 380;
    const p = tipPosition(195, 40, wide, H, VW, VH, true);
    assert.equal(p.where, 'below');
    assert.ok(p.top >= 40 + TOUCH_CLEARANCE);
});

test('touch tips always stay on screen and off the finger, anywhere it lands', () => {
    for (let x = 0; x <= VW; x += 13) {
        for (let y = 0; y <= VH; y += 29) {
            const p = tipPosition(x, y, W, H, VW, VH, true);
            assert.ok(p.left >= 0 && p.left + W <= VW && p.top >= 0 && p.top + H <= VH, `on screen at ${x},${y}`);
            assert.ok(clearOfFinger(p, x, y, 40), `clear of the finger at ${x},${y}: ${JSON.stringify(p)}`);
        }
    }
});

test('a mouse tip sits just beside the cursor, flipping up near the bottom', () => {
    const p = tipPosition(100, 100, W, H, 1280, 800, false);
    assert.deepEqual([p.left, p.top], [112, 112]);
    const low = tipPosition(100, 780, W, H, 1280, 800, false);
    assert.ok(low.top + H <= 780);
});
