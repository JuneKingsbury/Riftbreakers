// The studio splash shown when the game loads, as in Rifthold: the animated logo
// (icons/splash.gif) fades in over a slowly scrolling tile background, plays once, then the
// overlay fades out to the title screen. Any key press or tap skips it.
//
// The GIF is fetched and its loop flag removed so it plays exactly once; its first frame is
// shown while fading in, so the animation starts only once the logo is fully visible.

const MIN_SHOW_MS = 3000;     // the splash never ends sooner than this
const AFTER_GIF_MS = 2000;    // the last frame holds this long before fading out

// Total play time of a GIF, in ms, from its frame delays.
export function gifDuration(buffer) {
    const v = new Uint8Array(buffer);
    let i = 13;
    if (v[10] & 0x80) i += 3 * (1 << ((v[10] & 0x07) + 1));   // global color table
    let total = 0;
    while (i < v.length) {
        if (v[i] === 0x3B) break;                              // trailer
        if (v[i] === 0x21) {                                   // extension
            if (v[i + 1] === 0xF9) {                           // graphic control: frame delay
                total += ((v[i + 4] | (v[i + 5] << 8)) * 10) || 100;
                i += 8;
            } else {
                i += 2;
                while (i < v.length && v[i] !== 0) i += v[i] + 1;
                i++;
            }
        } else if (v[i] === 0x2C) {                            // image descriptor
            i += 9;
            const packed = v[i++];
            if (packed & 0x80) i += 3 * (1 << ((packed & 0x07) + 1));
            i++;                                               // LZW minimum code size
            while (i < v.length && v[i] !== 0) i += v[i] + 1;
            i++;
        } else {
            i++;
        }
    }
    return total;
}

// The GIF without its NETSCAPE2.0 looping block, so it plays once.
export function withoutLoop(buffer) {
    const src = new Uint8Array(buffer);
    for (let i = 0; i < src.length - 19; i++) {
        if (src[i] !== 0x21 || src[i + 1] !== 0xFF || src[i + 2] !== 0x0B) continue;
        if (String.fromCharCode(...src.slice(i + 3, i + 14)) !== 'NETSCAPE2.0') continue;
        const out = new Uint8Array(src.length - 19);
        out.set(src.slice(0, i));
        out.set(src.slice(i + 19), i);
        return out;
    }
    return src;
}

/**
 * Runs the splash in #splash-overlay, hiding `hideEl` (the title screen) until it ends.
 * Does nothing (and calls onDone) if the overlay isn't in the page.
 * @param {HTMLElement} hideEl
 * @param {() => void} [onDone]
 */
export function runSplash(hideEl, onDone) {
    const overlay = document.getElementById('splash-overlay');
    const image = document.getElementById('splash-image');
    const studio = document.getElementById('splash-studio');
    if (!overlay || !image) { onDone?.(); return; }

    let done = false;
    if (hideEl) hideEl.style.visibility = 'hidden';

    const reveal = () => {
        image.classList.add('visible');
        studio?.classList.add('visible');
    };

    const end = () => {
        if (done) return;
        done = true;
        document.removeEventListener('pointerdown', skip);
        document.removeEventListener('keydown', skip);
        if (hideEl) hideEl.style.visibility = '';
        overlay.classList.add('hidden');
        overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
        setTimeout(() => overlay.remove(), 1500);   // in case transitions are off
        onDone?.();
    };

    // A tap that skips the splash mustn't also press the title button underneath it.
    function skip(e) {
        if (e?.type === 'pointerdown') {
            if (e.cancelable) e.preventDefault();
            window.addEventListener('click', (ev) => { ev.stopPropagation(); ev.preventDefault(); }, { once: true, capture: true });
        }
        end();
    }
    document.addEventListener('pointerdown', skip);
    document.addEventListener('keydown', skip);

    const src = image.getAttribute('src');
    image.removeAttribute('src');
    fetch(src)
        .then(r => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.status))))
        .then(buf => {
            const duration = gifDuration(buf);
            const once = withoutLoop(buf);
            // Show a still of the first frame while fading in.
            const first = new Image();
            const firstUrl = URL.createObjectURL(new Blob([once], { type: 'image/gif' }));
            first.onload = () => {
                const c = document.createElement('canvas');
                c.width = first.naturalWidth;
                c.height = first.naturalHeight;
                c.getContext('2d').drawImage(first, 0, 0);
                URL.revokeObjectURL(firstUrl);
                image.onload = () => requestAnimationFrame(() => {
                    reveal();
                    image.addEventListener('transitionend', () => {
                        if (done) return;
                        image.onload = null;
                        image.src = URL.createObjectURL(new Blob([once], { type: 'image/gif' }));
                        setTimeout(end, Math.max(duration + AFTER_GIF_MS, MIN_SHOW_MS));
                    }, { once: true });
                });
                image.src = c.toDataURL();
            };
            first.onerror = end;
            first.src = firstUrl;
        })
        .catch(end);
}
