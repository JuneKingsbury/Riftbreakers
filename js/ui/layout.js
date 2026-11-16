// Screen-shape helpers shared by every scene. Portrait (taller than wide, e.g. a phone
// held upright) swaps side panels for top and bottom bars. The body carries matching
// classes so css/style.css can restyle panels: `portrait` and, on touch screens, `touch`.

export function isPortrait() {
    return window.innerHeight > window.innerWidth;
}

export function isTouch() {
    return !!window.matchMedia?.('(pointer: coarse)').matches;
}

function apply() {
    document.body.classList.toggle('portrait', isPortrait());
    document.body.classList.toggle('touch', isTouch());
}

// Keeps the body classes current. Call once at startup.
export function watchLayout() {
    apply();
    window.addEventListener('resize', apply);
    window.addEventListener('orientationchange', apply);
}
