// The title screen's backdrop: a skin tile (the player's pick from run/data/backdrops.js,
// abyss floor by default) repeated across the screen, tinted
// dark so the menu stays readable, with a soft vignette. Without a sprite (ASCII skin, or the
// skin still loading) the canvas is left clear and the plain page color shows.

// The default sprite to tile, as [category, key] in the skin.
const BACKDROP_TILE = ['floors', 'abyss_floor'];
const TILE_PX = 16 * 4;                 // sprite drawn at 4x, crisp
const TINT = 'rgba(14, 14, 30, 0.4)';  // darkening wash, close to the page color #1a1a2e

/**
 * Paints the backdrop onto a canvas.
 * @param {HTMLCanvasElement} canvas
 * @param {HTMLImageElement|null} sprite  The backdrop tile sprite, or null to clear.
 */
export function drawStartBackdrop(canvas, sprite) {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (!sprite) return;

    // Smaller tiles on phones so the pattern still reads as a wall.
    const tile = w < 600 ? TILE_PX * 0.75 : TILE_PX;
    ctx.imageSmoothingEnabled = false;
    // Centre the pattern so it crops evenly on both sides.
    const ox = ((w / 2) % tile) - tile, oy = ((h / 2) % tile) - tile;
    for (let y = oy; y < h; y += tile) {
        for (let x = ox; x < w; x += tile) ctx.drawImage(sprite, x, y, tile, tile);
    }

    ctx.fillStyle = TINT;
    ctx.fillRect(0, 0, w, h);

    // Vignette: lighter behind the menu, darker toward the edges.
    const r = Math.hypot(w, h) / 2;
    const g = ctx.createRadialGradient(w / 2, h / 2, r * 0.2, w / 2, h / 2, r);
    g.addColorStop(0, 'rgba(0, 0, 0, 0)');
    g.addColorStop(1, 'rgba(0, 0, 0, 0.65)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
}

/**
 * Keeps the title backdrop drawn: now, on resize, and whenever the skin changes.
 * @param {HTMLCanvasElement} canvas
 * @param {{ getSprite(category: string, key: string): HTMLImageElement|null }} skinManager
 * @param {() => [string, string]} [getTile]  The tile to use, read on every redraw.
 * @returns {() => void} Redraw, to call after a skin switch or backdrop change.
 */
export function mountStartBackdrop(canvas, skinManager, getTile = () => BACKDROP_TILE) {
    if (!canvas) return () => {};
    const redraw = () => {
        const [cat, key] = getTile() ?? BACKDROP_TILE;
        drawStartBackdrop(canvas, skinManager.getSprite(cat, key) ?? skinManager.getSprite(...BACKDROP_TILE));
    };
    let pending = 0;
    window.addEventListener('resize', () => {
        cancelAnimationFrame(pending);
        pending = requestAnimationFrame(redraw);
    });
    redraw();
    return redraw;
}
