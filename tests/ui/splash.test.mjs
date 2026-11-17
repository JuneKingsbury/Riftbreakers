// The studio splash plays its GIF once: it reads how long the animation runs and strips the
// loop flag, so the overlay can fade out after the last frame.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { gifDuration, withoutLoop } from '../../js/ui/splash.js';

const file = readFileSync(new URL('../../icons/splash.gif', import.meta.url));
const gif = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
const hasLoop = (bytes) => Buffer.from(bytes).includes(Buffer.from('NETSCAPE2.0'));

test('the splash GIF has a real running time', () => {
    const ms = gifDuration(gif);
    assert.ok(ms > 200 && ms < 30000, `${ms} ms`);
});

test('the splash GIF is made to play once', () => {
    const once = withoutLoop(gif);
    if (hasLoop(file)) {
        assert.ok(!hasLoop(once), 'the loop block is gone');
        assert.equal(once.length, file.length - 19, 'only the 19-byte loop block is removed');
    } else {
        assert.equal(once.length, file.length, 'a GIF that never loops is left alone');
    }
    assert.equal(Buffer.from(once.slice(0, 6)).toString(), 'GIF89a');
    assert.equal(gifDuration(once.buffer), gifDuration(gif), 'same frames, same timing');
});
