import { getTileDef, getTile } from './battle-map.js';
import { STATES } from './battle.js';
import { ABILITIES } from './abilities.js';
import { getEntityRenderPos, isEntityMoving } from '../systems/movement-lerp.js';
import { isAlive, isUnconscious } from './units.js';

const TILE_SIZE  = 48;
const HP_BAR_H   = 5;
const MP_BAR_H   = 3;
const PAN_SPEED  = 6;
const ELEV_FRAC  = 0.55;

// Bayer 4x4 ordered-dither threshold matrix.
const BAYER4 = [
    [ 0,  8,  2, 10],
    [12,  4, 14,  6],
    [ 3, 11,  1,  9],
    [15,  7, 13,  5],
];

// Facing direction to rotation angle (radians) for the iso 2:1 diamond.
// hw = ts/2, hh = ts/4, so the iso axis directions on screen are:
//   north (ty-1): (+hw, -hh)   east (tx+1): (+hw, +hh)
//   south (ty+1): (-hw, +hh)   west (tx-1): (-hw, -hh)
// Arrow points up at 0; angle = atan2(screen_dx, -screen_dy).
const _ISO_A = Math.atan2(2, 1); // ~63.4 degrees, derived from 2:1 hw/hh ratio
const FACING_ROT = {
    north:  _ISO_A,
    east:   Math.PI - _ISO_A,
    south: -(Math.PI - _ISO_A),
    west:  -_ISO_A,
};

const LEDGE_LIGHT  = '#7a5533';
const LEDGE_DARK   = '#4a3018';
const LEDGE_SHADOW = '#2a1808'; // north/west faces are in shade

export class BattleRenderer {
    constructor(container, skinManager) {
        this.container   = container;
        this.skinManager = skinManager || null;
        this.canvas = document.createElement('canvas');
        this.canvas.style.cssText = 'display:block;position:absolute;inset:0;width:100%;height:100%;image-rendering:pixelated;cursor:crosshair;';
        this.canvas.id = 'tactical-canvas';
        container.appendChild(this.canvas);
        this.ctx = this.canvas.getContext('2d', { alpha: false });
        this.ctx.imageSmoothingEnabled = false;

        // Camera is in pixel space for iso.
        this.camX = 0;
        this.camY = 0;
        this.tileSize = TILE_SIZE;

        this._pulse    = 0;
        this._lastTime = 0;

        this._panKeys    = { left: false, right: false, up: false, down: false };
        this._autoCenterNext = true;

        this.viewAngle  = 0;  // 0=N, 1=E, 2=S, 3=W
        this._rotateBtns = [];

        // Spin animation state (smooth Q/E rotation)
        this._spinActive   = false;
        this._spinT        = 0;
        this._spinDuration = 300;
        this._spinFrom     = 0;
        this._spinDir      = 1;   // +1 CW, -1 CCW
        this._spinPivotU   = 0;   // virtual U of pivot tile in _spinFrom coords
        this._spinPivotV   = 0;
        this._spinQueue    = 0;   // pending delta to apply after current spin
        this._mapW = 22;
        this._mapH = 16;

        // Smooth camera pan: target is set by centerOn; actual cam lerps each frame.
        this._camTargetX = null;
        this._camTargetY = null;

        this._ditherMasks    = null;
        this._ditherTileSize = 0;
        this._ditherCache    = new Map();

        this._projectiles  = [];
        this._outlineCache = new Map();

        this._resize();
    }

    // Virtual coordinate helpers for camera rotation.
    // viewAngle: 0=N (default), 1=E (90 CW), 2=S (180), 3=W (270 CW)
    _toVirtual(tx, ty, W, H) {
        switch (this.viewAngle) {
            case 0: return { u: tx,             v: ty };
            case 1: return { u: ty,             v: W - 1 - tx };
            case 2: return { u: W - 1 - tx,     v: H - 1 - ty };
            case 3: return { u: H - 1 - ty,     v: tx };
        }
    }
    _fromVirtual(u, v, W, H) {
        switch (this.viewAngle) {
            case 0: return { tx: u,             ty: v };
            case 1: return { tx: W - 1 - v,     ty: u };
            case 2: return { tx: W - 1 - u,     ty: H - 1 - v };
            case 3: return { tx: v,             ty: H - 1 - u };
        }
    }
    _toVirtualAngle(tx, ty, W, H, angle) {
        switch (((angle % 4) + 4) % 4) {
            case 0: return { u: tx,             v: ty };
            case 1: return { u: ty,             v: W - 1 - tx };
            case 2: return { u: W - 1 - tx,     v: H - 1 - ty };
            case 3: return { u: H - 1 - ty,     v: tx };
        }
    }
    _fromVirtualAngle(u, v, W, H, angle) {
        switch (((angle % 4) + 4) % 4) {
            case 0: return { tx: u,             ty: v };
            case 1: return { tx: W - 1 - v,     ty: u };
            case 2: return { tx: W - 1 - u,     ty: H - 1 - v };
            case 3: return { tx: v,             ty: H - 1 - u };
        }
    }
    _vDims(mapW, mapH) {
        return (this.viewAngle === 1 || this.viewAngle === 3)
            ? { vW: mapH, vH: mapW }
            : { vW: mapW, vH: mapH };
    }
    // Virtual-space neighbors used for side-face visibility tests.
    // During a spin, use _spinFrom so neighbor lookups match the face geometry
    // (which is also computed in _spinFrom virtual space).
    _virtualNeighbors(tx, ty) {
        const W = this._mapW, H = this._mapH;
        const a = this._spinActive ? this._spinFrom : this.viewAngle;
        const { u, v } = this._toVirtualAngle(tx, ty, W, H, a);
        const sn = this._fromVirtualAngle(u,     v + 1, W, H, a);
        const en = this._fromVirtualAngle(u + 1, v,     W, H, a);
        return { southNeighbor: sn, eastNeighbor: en };
    }
    _virtualNorthWestNeighbors(tx, ty) {
        const W = this._mapW, H = this._mapH;
        const a = this._spinActive ? this._spinFrom : this.viewAngle;
        const { u, v } = this._toVirtualAngle(tx, ty, W, H, a);
        const nn = this._fromVirtualAngle(u,     v - 1, W, H, a);
        const wn = this._fromVirtualAngle(u - 1, v,     W, H, a);
        return { northNeighbor: nn, westNeighbor: wn };
    }
    // Rotate view by delta steps (positive = CW, negative = CCW).
    // Starts a 300ms spin animation; preserves the world tile at screen center.
    rotateView(delta) {
        if (this._spinActive) {
            const newQ = this._spinQueue + delta;
            this._spinQueue = Math.max(-1, Math.min(1, newQ));
            return;
        }

        const W = this._mapW, H = this._mapH;
        const ts = this.tileSize, hw = ts / 2, hh = ts / 4;
        const cw = (this.canvas.width - 190) / 2;
        const ch = this.canvas.height / 2;

        // Find the virtual tile at screen center before rotating.
        const rx = cw - this.camX;
        const ry = ch - this.camY;
        const u0 = rx / hw / 2 + ry / hh / 2;
        const v0 = ry / hh / 2 - rx / hw / 2;
        const { vW, vH } = this._vDims(W, H);
        const uc = Math.max(0, Math.min(vW - 1, Math.round(u0)));
        const vc = Math.max(0, Math.min(vH - 1, Math.round(v0)));

        // Cancel any in-progress camera lerp so it doesn't fight the spin.
        this._camTargetX = null;
        this._camTargetY = null;

        // Initialize spin state.
        this._spinActive  = true;
        this._spinT       = 0;
        this._spinFrom    = this.viewAngle;
        this._spinDir     = delta > 0 ? 1 : -1;
        this._spinPivotU  = uc;
        this._spinPivotV  = vc;
        this._spinQueue   = 0;

        // Commit viewAngle immediately so painter sort and hit-testing are correct.
        this.viewAngle = ((this.viewAngle + delta) % 4 + 4) % 4;
    }

    // Elevation lift in pixels for a tile.
    _elevOffset(tile) {
        return tile ? (tile.elevation || 0) * Math.round(this.tileSize * ELEV_FRAC) : 0;
    }

    // Isometric tile-to-screen: returns the N (top) vertex of the diamond.
    // camX/camY are pixel offsets (not tile offsets).
    // Applies virtual rotation via _toVirtual before projecting.
    tileToScreen(tx, ty) {
        const ts = this.tileSize;
        const hw = ts / 2;
        const hh = ts / 4;

        if (!this._spinActive) {
            const { u, v } = this._toVirtual(tx, ty, this._mapW, this._mapH);
            return {
                x: Math.round((u - v) * hw + this.camX),
                y: Math.round((u + v) * hh + this.camY),
            };
        }

        // During spin: interpolate linearly between the FROM and TO iso projections.
        // We use FROM virtual coords (u,v) and the pivot offset (du,dv). The FROM→TO
        // transform is a shear (not a pure rotation, because hw≠hh), so we blend the
        // 2×2 projection matrix from I at t=0 to M at t=1. This lands every tile
        // exactly on its correct position at both ends with no jump.
        //
        // For CW (+1):  TO position = hw*(du+dv), hh*(dv-du)
        // For CCW (-1): TO position = hw*(-du-dv), hh*(du-dv)
        // Unified: let s = 1-2*te,  A = (1+dir)/2 + (1-dir)/2*s,  B = 1-A
        //   x = hw*(du*A - dv*B),  y = hh*(du*B + dv*A)
        const pu = this._spinPivotU, pv = this._spinPivotV;
        const { u, v } = this._toVirtualAngle(tx, ty, this._mapW, this._mapH, this._spinFrom);
        const du = u - pu;
        const dv = v - pv;

        const te = this._spinT * this._spinT * (3 - 2 * this._spinT); // smoothstep
        const s   = 1 - 2 * te;
        const dir = this._spinDir;
        const A   = (1 + dir) / 2 + (1 - dir) / 2 * s;
        const B   = (1 - dir) / 2 + (1 + dir) / 2 * s;

        // Pivot screen position derived live from camX/camY so camera movement
        // during the spin doesn't accumulate drift.
        const pivotSX = (pu - pv) * hw + this.camX;
        const pivotSY = (pu + pv) * hh + this.camY;

        return {
            x: Math.round(hw * (du * A - dv * B) + pivotSX),
            y: Math.round(hh * (du * B + dv * A) + pivotSY),
        };
    }

    // Elevation-aware screen-to-tile. Checks unit sprites first (front to back),
    // then tile diamonds in virtual painter order, then falls back to flat inverse.
    screenToTile(sx, sy, map, units) {
        const ts = this.tileSize;
        const hw = ts / 2;
        const hh = ts / 4;
        const sw = Math.round(ts / 2);
        const sh = Math.round(ts / 2);

        const W = map ? map.width  : this._mapW;
        const H = map ? map.height : this._mapH;

        // Hit-test unit sprites first so clicking a character always resolves to
        // their tile even when their sprite extends above the tile diamond.
        if (units) {
            const liveUnits = units.filter(u => isAlive(u));
            // Sort front-to-back by virtual diag so the frontmost unit wins.
            liveUnits.sort((a, b) => {
                const va = this._toVirtual(b.x, b.y, W, H);
                const vb = this._toVirtual(a.x, a.y, W, H);
                return (va.u + va.v) - (vb.u + vb.v);
            });
            const now = performance.now();
            for (const unit of liveUnits) {
                const rp       = getEntityRenderPos(unit, now);
                const vizX     = unit._vizX != null ? unit._vizX : unit.x;
                const vizY     = unit._vizY != null ? unit._vizY : unit.y;
                const tile     = getTile(map, vizX, vizY);
                const elevOff  = this._elevOffset(tile);
                const isoSp    = this.tileToScreen(rp.x, rp.y);
                const footX    = isoSp.x;
                const footY    = isoSp.y + hh * 2 - elevOff - Math.round(hh * 0.5);
                const spx      = footX - sw / 2;
                const spy      = footY - sh;
                if (sx >= spx && sx <= spx + sw && sy >= spy && sy <= spy + sh) {
                    // Return the unit's logical tile so targeting resolves correctly.
                    return { x: unit.x, y: unit.y };
                }
            }
        }

        if (map) {
            // Iterate virtual grid front-to-back (highest virtual diag first).
            const { vW, vH } = this._vDims(W, H);
            const maxDiag = (vW - 1) + (vH - 1);
            for (let diag = maxDiag; diag >= 0; diag--) {
                const uMin = Math.max(0, diag - (vH - 1));
                const uMax = Math.min(diag, vW - 1);
                for (let u = uMax; u >= uMin; u--) {
                    const v = diag - u;
                    const { tx, ty } = this._fromVirtual(u, v, W, H);
                    const tile = getTile(map, tx, ty);
                    if (!tile) continue;
                    const sp      = this.tileToScreen(tx, ty);
                    const elevOff = this._elevOffset(tile);
                    const nx = sp.x, ny = sp.y - elevOff;
                    const dx = sx - nx, dy = sy - ny;
                    if (Math.abs(dx / hw) + Math.abs(dy / hh - 1) <= 1) {
                        return { x: tx, y: ty };
                    }
                }
            }
        }

        // Flat fallback: invert the virtual projection then map back to world.
        const rx = sx - this.camX;
        const ry = sy - this.camY;
        const u = Math.floor(rx / hw / 2 + ry / hh / 2);
        const v = Math.floor(ry / hh / 2 - rx / hw / 2);
        return this._fromVirtual(u, v, W, H);
    }

    centerOn(tx, ty, mapW, mapH) {
        const ts  = this.tileSize;
        const hw  = ts / 2;
        const hh  = ts / 4;
        const cw  = (this.canvas.width - 190) / 2;
        const ch  = this.canvas.height / 2;
        const { u, v } = this._toVirtual(tx, ty, mapW, mapH);
        this._camTargetX = Math.round(cw - (u - v) * hw);
        this._camTargetY = Math.round(ch - (u + v) * hh);
    }

    // Instantly snap the camera with no lerp (used by rotateView to pivot in place).
    _snapCamTo(tx, ty, mapW, mapH) {
        const ts  = this.tileSize;
        const hw  = ts / 2;
        const hh  = ts / 4;
        const cw  = (this.canvas.width - 190) / 2;
        const ch  = this.canvas.height / 2;
        const { u, v } = this._toVirtual(tx, ty, mapW, mapH);
        this.camX = Math.round(cw - (u - v) * hw);
        this.camY = Math.round(ch - (u + v) * hh);
        this._camTargetX = this.camX;
        this._camTargetY = this.camY;
        this._clampCam(mapW, mapH);
    }

    _clampCam(mapW, mapH) {
        const ts = this.tileSize;
        const hw = ts / 2;
        const hh = ts / 4;
        const { vW, vH } = this._vDims(mapW, mapH);
        const pad = Math.max(this.canvas.width, this.canvas.height);
        const minX = -(vH - 1) * hw  - pad;
        const maxX = (vW - 1) * hw   + (this.canvas.width - 190) + pad;
        const minY = -pad;
        const maxY = (vW + vH - 2) * hh + this.canvas.height + pad;
        this.camX = Math.max(minX, Math.min(maxX, this.camX));
        this.camY = Math.max(minY, Math.min(maxY, this.camY));
    }

    _resize() {
        const rect = this.container.getBoundingClientRect();
        const w = Math.max(rect.width,  400);
        const h = Math.max(rect.height, 300);
        if (this.canvas.width !== w || this.canvas.height !== h) {
            this.canvas.width  = w;
            this.canvas.height = h;
        }
    }

    spawnProjectile(sx, sy, tx, ty, color, durationMs) {
        this._projectiles.push({
            sx, sy, tx, ty, color,
            startMs: performance.now(),
            durationMs: durationMs || 500,
        });
    }

    _getOutlinedSprite(spriteKey, color) {
        const cacheKey = spriteKey + ':' + color;
        if (this._outlineCache.has(cacheKey)) return this._outlineCache.get(cacheKey);

        const sm = this.skinManager;
        if (!sm) return null;
        const src = sm.getSprite('entities', spriteKey);
        if (!src) { this._outlineCache.set(cacheKey, null); return null; }

        const w = src.naturalWidth || src.width;
        const h = src.naturalHeight || src.height;
        const tmp = document.createElement('canvas');
        tmp.width = w; tmp.height = h;
        const tmpCtx = tmp.getContext('2d');
        tmpCtx.imageSmoothingEnabled = false;
        tmpCtx.drawImage(src, 0, 0);

        if (typeof sm._addOutline === 'function') {
            const result = sm._addOutline(tmp, color);
            this._outlineCache.set(cacheKey, result);
            return result;
        }

        this._outlineCache.set(cacheKey, null);
        return null;
    }

    // Returns the E and W vertex offsets from the N vertex, accounting for spin.
    // At rest: E=(+hw,+hh), W=(-hw,+hh). During spin these rotate with the grid.
    _isoVerts(hw, hh) {
        if (!this._spinActive) {
            return { ex: hw, ey: hh, wx: -hw, wy: hh };
        }
        const te  = this._spinT * this._spinT * (3 - 2 * this._spinT);
        const s   = 1 - 2 * te;
        const dir = this._spinDir;
        const A   = (1 + dir) / 2 + (1 - dir) / 2 * s;
        const B   = (1 - dir) / 2 + (1 + dir) / 2 * s;
        return { ex: hw * A, ey: hh * B, wx: -hw * B, wy: hh * A };
    }

    // Draw a diamond (iso tile top face) path.
    _diamondPath(ctx, nx, ny, hw, hh) {
        const { ex, ey, wx, wy } = this._isoVerts(hw, hh);
        ctx.beginPath();
        ctx.moveTo(nx,          ny);          // N vertex (top)
        ctx.lineTo(nx + ex,     ny + ey);     // E vertex
        ctx.lineTo(nx + ex + wx, ny + ey + wy); // S vertex
        ctx.lineTo(nx + wx,     ny + wy);     // W vertex
        ctx.closePath();
    }

    // Draw a parallelogram for a side face.
    // Vertices in painter order (top-left, top-right, bottom-right, bottom-left).
    _parallelogram(ctx, x0, y0, x1, y1, x2, y2, x3, y3) {
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.lineTo(x3, y3);
        ctx.closePath();
    }

    _generateDitherMasks() {
        const ts    = this.tileSize;
        const depth = Math.max(1, Math.round(ts * 0.25));
        this._ditherTileSize = ts;
        this._ditherCache.clear();
        this._ditherMasks = {};

        const dirs = ['north', 'south', 'west', 'east'];
        for (const dir of dirs) {
            const canvas = document.createElement('canvas');
            canvas.width  = ts;
            canvas.height = ts / 2;
            const mctx = canvas.getContext('2d');
            mctx.imageSmoothingEnabled = false;
            const id   = mctx.createImageData(ts, ts / 2);
            const data = id.data;
            const rows = ts / 2;

            for (let y = 0; y < rows; y++) {
                for (let x = 0; x < ts; x++) {
                    let edgeDist;
                    if      (dir === 'north') edgeDist = y;
                    else if (dir === 'south') edgeDist = rows - 1 - y;
                    else if (dir === 'west')  edgeDist = x;
                    else                      edgeDist = ts - 1 - x;

                    if (edgeDist >= depth) continue;
                    const t         = edgeDist / depth;
                    const intensity = 0.5 * (1 - t);
                    const threshold = (BAYER4[y % 4][x % 4] + 0.5) / 16;
                    if (intensity > threshold) {
                        const idx = (y * ts + x) * 4;
                        data[idx] = data[idx + 1] = data[idx + 2] = data[idx + 3] = 255;
                    }
                }
            }
            mctx.putImageData(id, 0, 0);
            this._ditherMasks[dir] = canvas;
        }
    }

    // ---- Main render -------------------------------------------------------

    render(battle, now) {
        const dt = now - this._lastTime;
        this._lastTime = now;
        this._pulse = (this._pulse + dt * 0.003) % (Math.PI * 2);
        this._resize();

        // Ensure map dims are fresh before spin tick uses them.
        if (battle && battle.map) {
            this._mapW = battle.map.width;
            this._mapH = battle.map.height;
        }

        // Advance spin animation.
        if (this._spinActive) {
            this._spinT += dt / this._spinDuration;
            if (this._spinT >= 1) {
                this._spinT = 1;
                const mW = this._mapW, mH = this._mapH;
                const ts2 = this.tileSize, hw2 = ts2 / 2, hh2 = ts2 / 4;
                const pu = this._spinPivotU, pv = this._spinPivotV;

                // Capture where the pivot tile sits right now (camX/camY still in _spinFrom space).
                const pivotSX = (pu - pv) * hw2 + this.camX;
                const pivotSY = (pu + pv) * hh2 + this.camY;

                this._spinActive = false;

                // Recompute camX/camY so the pivot tile stays at that same screen pixel
                // in the new viewAngle, with no snap.
                const { tx: ptx, ty: pty } = this._fromVirtualAngle(pu, pv, mW, mH, this._spinFrom);
                const { u: uf, v: vf } = this._toVirtualAngle(ptx, pty, mW, mH, this.viewAngle);
                this.camX = Math.round(pivotSX - (uf - vf) * hw2);
                this.camY = Math.round(pivotSY - (uf + vf) * hh2);
                this._camTargetX = this.camX;
                this._camTargetY = this.camY;
                this._clampCam(mW, mH);
                if (this._spinQueue !== 0) {
                    const q = this._spinQueue;
                    this._spinQueue = 0;
                    this.rotateView(q);
                }
            }
        }

        const ctx = this.ctx;
        ctx.imageSmoothingEnabled = false;

        const W   = this.canvas.width;
        const H   = this.canvas.height;
        const ts  = this.tileSize;
        const hw  = ts / 2;   // iso diamond half-width
        const hh  = ts / 4;   // iso diamond half-height
        const { map, units, activeUnit } = battle;

        // Cache map dimensions so _toVirtual/_fromVirtual work outside render loop.
        this._mapW = map.width;
        this._mapH = map.height;

        if (this._autoCenterNext && activeUnit) {
            this.centerOn(activeUnit.x, activeUnit.y, map.width, map.height);
            this._autoCenterNext = false;
        }

        // While a unit is actively moving, keep the camera target on their
        // interpolated render position so it follows the walk smoothly.
        {
            const movingUnit = units.find(u => isEntityMoving(u));
            if (movingUnit) {
                const rp = getEntityRenderPos(movingUnit, now);
                this.centerOn(rp.x, rp.y, map.width, map.height);
            }
        }

        // Lerp camera toward target (smooth centering).
        if (this._camTargetX !== null) {
            const CAM_LERP = 1 - Math.pow(0.004, dt / 1000);
            const dx = this._camTargetX - this.camX;
            const dy = this._camTargetY - this.camY;
            if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
                this.camX = this._camTargetX;
                this.camY = this._camTargetY;
                this._camTargetX = null;
                this._camTargetY = null;
            } else {
                this.camX += dx * CAM_LERP;
                this.camY += dy * CAM_LERP;
            }
            if (!this._spinActive) this._clampCam(map.width, map.height);
        }

        // Keyboard pan (pixels/sec). Cancels active lerp so manual panning
        // is not fought by the smooth-center animation.
        const panPx = PAN_SPEED * ts * (dt / 1000);
        if (this._panKeys.left  || this._panKeys.right || this._panKeys.up || this._panKeys.down) {
            this._camTargetX = null;
            this._camTargetY = null;
        }
        if (this._panKeys.left)  this.camX += panPx;
        if (this._panKeys.right) this.camX -= panPx;
        if (this._panKeys.up)    this.camY += panPx;
        if (this._panKeys.down)  this.camY -= panPx;
        if (!this._spinActive) this._clampCam(map.width, map.height);

        ctx.fillStyle = '#0a0a12';
        ctx.fillRect(0, 0, W, H);

        const { move, ability, aoe, hit } = battle.getRangeHighlights();
        const hoverKey = battle.hoverTile || null;
        const showMoveHover = (battle.state === STATES.SELECT_MOVE || battle.state === STATES.PLAYER_TURN) && hoverKey && move.has(hoverKey);

        const sm         = this.skinManager;
        const useSprites = sm && sm.isActive;

        if (useSprites && this._ditherTileSize !== ts) {
            this._generateDitherMasks();
        }

        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';

        // Build a unified draw list sorted by painter order (tx+ty ascending).
        // Tiles draw before units on the same diagonal so elevated terrain occludes units behind it.
        const liveUnits = units.filter(u => isAlive(u));

        // During a spin, painter order must use _spinFrom so depth sort matches
        // the coordinate space tiles are actually drawn in.
        const sortAngle = this._spinActive ? this._spinFrom : this.viewAngle;
        const toVSort = (tx, ty) => this._toVirtualAngle(tx, ty, map.width, map.height, sortAngle);

        const drawList = [];
        for (let ty = 0; ty < map.height; ty++) {
            for (let tx = 0; tx < map.width; tx++) {
                const tile = map.tiles[ty * map.width + tx];
                if (tile) {
                    const vt = toVSort(tx, ty);
                    drawList.push({ kind: 'tile', tx, ty, tile, diag: vt.u + vt.v, vv: vt.v });
                }
            }
        }
        for (const unit of liveUnits) {
            // Use the current VISUAL step's source and destination for painter order,
            // not unit.x/y (which is the logical final destination and jumps there
            // immediately). Max of the two handles both directions of movement.
            const vizX  = unit._vizX  != null ? unit._vizX  : unit.x;
            const vizY  = unit._vizY  != null ? unit._vizY  : unit.y;
            const prevX = unit._prevX != null ? unit._prevX : unit.x;
            const prevY = unit._prevY != null ? unit._prevY : unit.y;
            const vViz  = toVSort(vizX,  vizY);
            const vPrev = toVSort(prevX, prevY);
            drawList.push({ kind: 'unit', unit, diag: Math.max(vViz.u + vViz.v, vPrev.u + vPrev.v) });
        }
        drawList.sort((a, b) => {
            if (a.diag !== b.diag) return a.diag - b.diag;
            if (a.kind !== b.kind) return a.kind === 'tile' ? -1 : 1;
            if (a.kind === 'tile') return a.vv - b.vv;
            return 0;
        });

        const WALK_CYCLES    = 1;
        const WALK_AMP_RAD   = 0.09;
        const IDLE_PERIOD    = 2600;
        const IDLE_AMP_RAD   = 0.02;
        const BREATHE_PERIOD = 3200;
        const BREATHE_AMP_PX = 1.4;

        for (const entry of drawList) {
        if (entry.kind === 'unit') {
            const unit = entry.unit;
            const unconscious = isUnconscious(unit);
            const rp       = getEntityRenderPos(unit, now);
            const vizX     = unit._vizX != null ? unit._vizX : unit.x;
            const vizY     = unit._vizY != null ? unit._vizY : unit.y;
            const stepDestTile = getTile(map, vizX, vizY);
            const stepDestElev = this._elevOffset(stepDestTile);
            let unitElevOff = stepDestElev;
            let hopOff = 0;
            if (isEntityMoving(unit) && unit._prevX != null) {
                const srcTile  = getTile(map, unit._prevX, unit._prevY);
                const srcElev  = this._elevOffset(srcTile);
                const elapsed  = now - unit._moveStartTime;
                const moveT    = Math.min(1, elapsed / (unit._moveDuration || 1));
                const eased    = moveT * (2 - moveT);
                unitElevOff    = srcElev + (stepDestElev - srcElev) * eased;
                const elevDiff = stepDestElev - srcElev;
                const flatHop  = Math.round(ts * 0.03);
                // When climbing up: smaller arc that peaks early (t~0.35) so
                // the character crests just above the destination height then
                // lands cleanly. When descending or flat: normal symmetric arc.
                let hopAmp, hopT;
                if (elevDiff > 0) {
                    hopAmp = flatHop + elevDiff * 0.55;
                    hopT   = Math.min(moveT / 0.7, 1);
                } else {
                    hopAmp = flatHop + Math.abs(elevDiff) * 1.2;
                    hopT   = moveT;
                }
                hopOff = Math.sin(hopT * Math.PI) * hopAmp;
                // Update facing to match current step direction.
                const dx = vizX - unit._prevX;
                const dy = vizY - unit._prevY;
                if (dx !== 0 || dy !== 0) {
                    if (Math.abs(dx) >= Math.abs(dy)) {
                        unit.facing = dx > 0 ? 'east' : 'west';
                    } else {
                        unit.facing = dy > 0 ? 'south' : 'north';
                    }
                }
            }
            const isoSp = this.tileToScreen(rp.x, rp.y);
            const footX = isoSp.x;
            const footY = isoSp.y + hh * 2 - unitElevOff - Math.round(hh * 0.5) - hopOff;
            const sw    = Math.round(ts / 2);
            const sh    = Math.round(ts / 2);
            const spx   = Math.round(footX - sw / 2);
            const spy   = Math.round(footY - sh);
            const spyUI = spy;

            if (useSprites) {
                const shadowSprite = sm.getSprite('effects', 'shadow');
                if (shadowSprite) {
                    ctx.save();
                    ctx.imageSmoothingEnabled = false;
                    ctx.drawImage(shadowSprite, spx, Math.round(spy + hopOff) + 4, sw, sh);
                    ctx.restore();
                    ctx.imageSmoothingEnabled = false;
                }
            }

            if (unconscious) ctx.globalAlpha = 0.5;

            const seed   = (unit.id * 1619) || 0;
            const moving = isEntityMoving(unit);
            let swayRot  = 0;
            let growPx   = 0;

            if (moving && unit._moveDuration > 0) {
                const elapsed = now - unit._moveStartTime;
                const moveT   = Math.min(1, elapsed / unit._moveDuration);
                const dir     = (seed & 1) ? -1 : 1;
                const phase   = moveT * Math.PI * 2 * WALK_CYCLES;
                swayRot = Math.sin(phase) * WALK_AMP_RAD * dir;
            } else {
                const phase = (now / IDLE_PERIOD) * Math.PI * 2 + (seed % 1000) / 1000 * 6.28;
                swayRot = Math.sin(phase) * IDLE_AMP_RAD;
            }

            const breathPhase = (now / BREATHE_PERIOD) * Math.PI * 2 + (seed % 1000) / 1000 * 6.28;
            growPx = (0.5 - 0.5 * Math.cos(breathPhase)) * BREATHE_AMP_PX;

            let extraOffX = 0, extraOffY = 0, extraRot = 0, extraScl = 1;
            if (unit._anim) {
                const a = unit._anim;
                const t = Math.min(1, (now - a.startMs) / a.durationMs);
                if (t >= 1) {
                    unit._anim = null;
                } else {
                    const arc = Math.sin(t * Math.PI);
                    if (a.type === 'slash') {
                        extraOffX = a.dx * 7 * arc;
                        extraOffY = a.dy * 7 * arc;
                        extraRot  = 0.3 * (a.dx >= 0 ? 1 : -1) * arc;
                    } else if (a.type === 'cast') {
                        extraOffY = -7 * arc;
                        extraScl  = 1 + 0.1 * arc;
                    } else if (a.type === 'shot') {
                        const pull = t < 0.5 ? -(t / 0.5) * 8 : -((1 - (t - 0.5) / 0.5)) * 8;
                        extraOffX  = a.dx * pull;
                        extraOffY  = a.dy * pull;
                    }
                }
            }

            const totalRot = swayRot + extraRot;
            const needsTransform = totalRot !== 0 || extraOffX !== 0 || extraOffY !== 0 || extraScl !== 1;
            if (needsTransform) {
                ctx.save();
                ctx.translate(footX + extraOffX, footY + extraOffY);
                if (extraScl !== 1) ctx.scale(extraScl, extraScl);
                ctx.rotate(totalRot);
                ctx.translate(-footX, -footY);
            }

            let drew = false;
            if (useSprites && unit.spriteKey) {
                if (unit === activeUnit) {
                    const outlineColor = unit.team === 'player' ? '#ffee44' : '#ff4444';
                    const outlined = this._getOutlinedSprite(unit.spriteKey, outlineColor);
                    if (outlined) {
                        const pulse = 0.6 + 0.4 * Math.sin(this._pulse);
                        ctx.globalAlpha = unconscious ? 0.5 * pulse : pulse;
                        ctx.drawImage(outlined, spx - 1, spy - growPx - 1, sw + 2, sh + 2 + growPx);
                        ctx.globalAlpha = unconscious ? 0.5 : 1;
                    }
                }
                if (unconscious) ctx.filter = 'grayscale(1)';
                const img = sm.getSprite('entities', unit.spriteKey);
                if (img) {
                    ctx.imageSmoothingEnabled = false;
                    ctx.drawImage(img, spx, spy - growPx, sw, sh + growPx);
                    drew = true;
                }
                if (unconscious) ctx.filter = 'none';
            }
            if (!drew) {
                ctx.fillStyle = unconscious ? '#666' : (unit.team === 'player' ? '#9df' : '#f76');
                ctx.font = `bold ${Math.round(sh * 0.7)}px 'Courier New', monospace`;
                ctx.fillText(unit.char, footX, footY - sh / 2 - growPx);
                if (unit === activeUnit) {
                    const pulse = 0.55 + 0.45 * Math.sin(this._pulse);
                    ctx.strokeStyle = `rgba(255,240,80,${pulse})`;
                    ctx.lineWidth = 2.5;
                    ctx.strokeRect(spx + 1, spy - growPx + 1, sw - 2, sh + growPx - 2);
                }
            }

            if (needsTransform) ctx.restore();
            ctx.globalAlpha = 1;

            let barStartY = spyUI - HP_BAR_H - (unit.maxMp > 0 ? MP_BAR_H + 1 : 0) - 2;
            if (unit._charging) {
                const chargeFrac = Math.min(1, unit._charging.ct / unit._charging.needed);
                const barH    = 6;
                const barW    = sw - 4;
                const barX    = spx + 2;
                const barY    = barStartY - barH - 10;
                const color   = unit.team === 'player' ? '#0ff' : '#c4f';
                // Pulsing glow behind bar
                const pulse   = 0.5 + 0.5 * Math.sin(now / 200);
                ctx.save();
                ctx.globalAlpha = 0.35 + 0.2 * pulse;
                ctx.shadowColor = color;
                ctx.shadowBlur  = 8;
                ctx.fillStyle   = color;
                ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);
                ctx.restore();
                // Bar background + fill
                this._drawBar(ctx, barX, barY, barW, barH, chargeFrac, color, '#111');
                // Ability name above bar
                const abName = ABILITIES[unit._charging.ability]?.name || 'Charging';
                ctx.save();
                ctx.font = `bold ${Math.round(sw * 0.26)}px 'Courier New', monospace`;
                ctx.textAlign = 'center';
                ctx.strokeStyle = '#000';
                ctx.lineWidth = 2;
                ctx.lineJoin = 'round';
                ctx.strokeText(abName, footX, barY - 3);
                ctx.fillStyle = color;
                ctx.fillText(abName, footX, barY - 3);
                ctx.restore();
                barStartY = barY - 14;
            }
            this._drawBar(ctx, spx + 2, barStartY, sw - 4, HP_BAR_H, unit.hp / unit.maxHp, '#3c3', '#111');
            if (unit.maxMp > 0) {
                this._drawBar(ctx, spx + 2, barStartY + HP_BAR_H + 1, sw - 4, MP_BAR_H, unit.mp / unit.maxMp, '#36f', '#111');
            }

            const iconSize = Math.round(sw * 0.28);
            ctx.font = `${iconSize}px monospace`;
            if (unit.status.includes('stun'))     { ctx.fillStyle = '#ff0'; ctx.fillText('*', spx + sw - 6, spyUI + 10); }
            if (unit.status.includes('slow'))     { ctx.fillStyle = '#8cf'; ctx.fillText('S', spx + 6,      spyUI + 10); }
            if (unit.status.includes('defend'))   { ctx.fillStyle = '#7bf'; ctx.fillText('D', spx + sw - 6, spyUI + 20); }
            if (unit.status.includes('charging')) { ctx.fillStyle = '#c8f'; ctx.fillText('!', footX,        spyUI + 10); }
            if (unconscious) {
                ctx.fillStyle = '#f84';
                ctx.font = `${Math.round(sw * 0.22)}px monospace`;
                ctx.fillText('KO', footX, spyUI + sh * 0.35);
            }

            continue;
        }

        // entry.kind === 'tile'
        {
            const { tx, ty, tile } = entry;
            const def     = getTileDef(tile.type);
            const sp      = this.tileToScreen(tx, ty);
            const elevOff = this._elevOffset(tile);
            const tileKey = ty * map.width + tx;

            // N vertex of diamond top face shifted up by elevation.
            const nx = sp.x;
            const ny = sp.y - elevOff;

            // Spinning-aware E/W vertex offsets (collapse to ±hw/hh at rest).
            const { ex: EX, ey: EY, wx: WX, wy: WY } = this._isoVerts(hw, hh);
            // Derived S vertex offset from N = E + W
            const SX = EX + WX, SY = EY + WY;

            // --- North/West side faces (back-facing, in shade) ---
            // Suppressed during spin: sheared diamonds don't cover these faces
            // correctly mid-rotation, causing bleed-through on interior tiles.
            // They're never visible at either resting angle so the omission is
            // undetectable to the player.
            if (!this._spinActive) {
                const { northNeighbor, westNeighbor } = this._virtualNorthWestNeighbors(tx, ty);
                const tileN   = getTile(map, northNeighbor.tx, northNeighbor.ty);
                const elevN   = this._elevOffset(tileN);
                const faceH_N = elevOff - elevN;
                if (faceH_N > 0) {
                    const nv2x = nx,        nv2y = ny;
                    const ev2x = nx + EX,   ev2y = ny + EY;
                    const ev3x = ev2x,      ev3y = ev2y + faceH_N;
                    const nv3x = nv2x,      nv3y = nv2y + faceH_N;
                    ctx.fillStyle = LEDGE_SHADOW;
                    this._parallelogram(ctx, nv2x, nv2y, ev2x, ev2y, ev3x, ev3y, nv3x, nv3y);
                    ctx.fill();
                }

                const tileW   = getTile(map, westNeighbor.tx, westNeighbor.ty);
                const elevW   = this._elevOffset(tileW);
                const faceH_W = elevOff - elevW;
                if (faceH_W > 0) {
                    const nv2x = nx,        nv2y = ny;
                    const wv2x = nx + WX,   wv2y = ny + WY;
                    const wv3x = wv2x,      wv3y = wv2y + faceH_W;
                    const nv3x = nv2x,      nv3y = nv2y + faceH_W;
                    ctx.fillStyle = LEDGE_SHADOW;
                    this._parallelogram(ctx, nv2x, nv2y, wv2x, wv2y, wv3x, wv3y, nv3x, nv3y);
                    ctx.fill();
                }
            }

            // --- South side face (visible when this tile is higher than virtual-south neighbor) ---
            const { southNeighbor, eastNeighbor } = this._virtualNeighbors(tx, ty);
            const tileS   = getTile(map, southNeighbor.tx, southNeighbor.ty);
            const elevS   = this._elevOffset(tileS);
            const faceH_S = elevOff - elevS;
            if (faceH_S > 0) {
                // South face: W..S edge of diamond going downward.
                const wx  = nx + WX,  wy  = ny + WY;
                const sx2 = nx + SX,  sy2 = ny + SY;
                const sx3 = sx2,      sy3 = sy2 + faceH_S;
                const wx3 = wx,       wy3 = wy  + faceH_S;
                ctx.fillStyle = LEDGE_DARK;
                this._parallelogram(ctx, wx, wy, sx2, sy2, sx3, sy3, wx3, wy3);
                ctx.fill();
                // Lighter strip at top.
                const stripH = Math.ceil(faceH_S * 0.25);
                ctx.fillStyle = LEDGE_LIGHT;
                this._parallelogram(ctx, wx, wy, sx2, sy2, sx2, sy2 + stripH, wx, wy + stripH);
                ctx.fill();
            }

            // --- East side face (visible when this tile is higher than virtual-east neighbor) ---
            const tileE   = getTile(map, eastNeighbor.tx, eastNeighbor.ty);
            const elevE   = this._elevOffset(tileE);
            const faceH_E = elevOff - elevE;
            if (faceH_E > 0) {
                // East face: E..S edge of diamond going downward.
                const ex  = nx + EX, ey  = ny + EY;
                const sx2 = nx + SX, sy2 = ny + SY;
                const sx3 = sx2,     sy3 = sy2 + faceH_E;
                const ex3 = ex,      ey3 = ey  + faceH_E;
                ctx.fillStyle = LEDGE_DARK;
                this._parallelogram(ctx, ex, ey, sx2, sy2, sx3, sy3, ex3, ey3);
                ctx.fill();
                const stripH = Math.ceil(faceH_E * 0.25);
                ctx.fillStyle = '#6a4828';
                this._parallelogram(ctx, ex, ey, sx2, sy2, sx2, sy2 + stripH, ex, ey + stripH);
                ctx.fill();
            }

            // --- Diamond top face ---
            this._diamondPath(ctx, nx, ny, hw, hh);
            ctx.fillStyle = def.bg;
            ctx.fill();

            if (useSprites) {
                const img = sm.getSprite('terrain', def.spriteKey) || sm.getSprite('terrain', 'grass');
                if (img) {
                    // setTransform maps the full ts x ts sprite to the diamond.
                    // Columns are the E-axis and W-axis directions (spin-aware).
                    ctx.save();
                    ctx.setTransform(EX / ts, EY / ts, WX / ts, WY / ts, nx, ny);
                    ctx.imageSmoothingEnabled = false;
                    ctx.drawImage(img, 0, 0, ts, ts);
                    ctx.restore();
                    ctx.imageSmoothingEnabled = false;
                }
            } else {
                // ASCII fallback: draw char at diamond center.
                ctx.fillStyle = def.color;
                ctx.font = `bold ${Math.round(hh * 1.2)}px 'Courier New', monospace`;
                ctx.fillText(def.char, nx + (EX + WX) / 2, ny + (EY + WY) / 2);
            }

            // Animated overlays drawn into diamond clip region.
            if (useSprites) {
                if (tile.type === 'grass' || tile.type === 'high') {
                    const tuft = sm.getSprite('effects', 'grass_tuft');
                    if (tuft) {
                        const period = 2500;
                        const amp    = 0.022;
                        const phase  = (now / period) * Math.PI * 2 + (tileKey % 1000) / 1000 * 6.28;
                        const rot    = Math.sin(phase) * amp;
                        ctx.save();
                        // Apply sway rotation around the iso center of the diamond,
                        // then project the full ts x ts sprite onto the diamond face.
                        ctx.setTransform(EX / ts, EY / ts, WX / ts, WY / ts, nx, ny);
                        ctx.translate(ts / 2, ts / 2);
                        ctx.rotate(rot);
                        ctx.translate(-ts / 2, -ts / 2);
                        ctx.imageSmoothingEnabled = false;
                        ctx.drawImage(tuft, 0, 0, ts, ts);
                        ctx.restore();
                        ctx.imageSmoothingEnabled = false;
                    }
                }
                if (tile.type === 'water') {
                    const waves = sm.getSprite('effects', 'water_waves');
                    if (waves) {
                        const period    = 2200;
                        const alphaBase = 0.72;
                        const alphaVar  = 0.22;
                        const phase   = (now / period) * Math.PI * 2 + (tileKey % 1000) / 1000 * 6.28;
                        const alpha   = Math.max(0, Math.min(1, alphaBase + alphaVar * Math.cos(phase)));
                        ctx.save();
                        ctx.globalAlpha = alpha;
                        ctx.setTransform(EX / ts, EY / ts, WX / ts, WY / ts, nx, ny);
                        ctx.imageSmoothingEnabled = false;
                        ctx.drawImage(waves, 0, 0, ts, ts);
                        ctx.restore();
                        ctx.globalAlpha = 1;
                        ctx.imageSmoothingEnabled = false;
                    }
                }
            }

            // Subtle high-ground tint.
            if (tile.type === 'high') {
                this._diamondPath(ctx, nx, ny, hw, hh);
                ctx.fillStyle = 'rgba(100,200,100,0.12)';
                ctx.fill();
            }

            // Shadow from elevated terrain to the south (light source is world-south,
            // shadows fall north). Always in world-space so view-rotation-independent.
            // A tile at elevation sElev casts a shadow sElev-cElev tiles northward;
            // alpha fades linearly from the base of the caster to the shadow tip.
            {
                let shadowAlpha = 0;
                const cElev = tile.elevation || 0;
                for (let k = 1; k <= 5; k++) {
                    const sTile = getTile(map, tx, ty + k);
                    const sElev = sTile ? (sTile.elevation || 0) : 0;
                    const shadowLen = sElev - cElev;
                    if (shadowLen >= k) {
                        // Fade from 1 at k=1 down to 0 at k=shadowLen.
                        const fade = 1 - (k - 1) / shadowLen;
                        const s = Math.min(0.58, 0.38 * fade);
                        if (s > shadowAlpha) shadowAlpha = s;
                    }
                }
                if (shadowAlpha > 0.01) {
                    this._diamondPath(ctx, nx, ny, hw, hh);
                    ctx.fillStyle = `rgba(0,0,20,${shadowAlpha.toFixed(3)})`;
                    ctx.fill();
                }
            }

            // Range overlay drawn inline so elevated tiles occlude them correctly.
            const key = `${tx},${ty}`;
            if (hit && hit.has(key)) {
                this._diamondPath(ctx, nx, ny, hw, hh);
                ctx.fillStyle = 'rgba(60,255,100,0.55)';
                ctx.fill();
                ctx.strokeStyle = 'rgba(120,255,140,0.9)';
                ctx.lineWidth = 2;
                ctx.stroke();
            } else if (aoe.has(key)) {
                this._diamondPath(ctx, nx, ny, hw, hh);
                ctx.fillStyle = 'rgba(255,140,0,0.42)';
                ctx.fill();
                ctx.strokeStyle = 'rgba(255,180,0,0.7)';
                ctx.lineWidth = 1;
                ctx.stroke();
            } else if (ability.has(key)) {
                this._diamondPath(ctx, nx, ny, hw, hh);
                ctx.fillStyle = 'rgba(255,220,0,0.30)';
                ctx.fill();
                ctx.strokeStyle = 'rgba(255,240,80,0.6)';
                ctx.lineWidth = 1;
                ctx.stroke();
            } else if (showMoveHover && key === hoverKey) {
                this._diamondPath(ctx, nx, ny, hw, hh);
                ctx.fillStyle = 'rgba(140,200,255,0.55)';
                ctx.fill();
                ctx.strokeStyle = 'rgba(180,230,255,0.9)';
                ctx.lineWidth = 2;
                ctx.stroke();
            } else if (move.has(key)) {
                this._diamondPath(ctx, nx, ny, hw, hh);
                ctx.fillStyle = 'rgba(60,120,255,0.32)';
                ctx.fill();
                ctx.strokeStyle = 'rgba(100,160,255,0.55)';
                ctx.lineWidth = 1;
                ctx.stroke();
            }
        }
        } // end drawList loop

        // ---- Ghost pass: units hidden behind elevated terrain ----------------
        // Re-draw any unit whose sprite rect is covered by a higher-diag elevated
        // tile, so the player can still see and hover over them.
        {
            const sw = Math.round(ts / 2);
            const sh = Math.round(ts / 2);

            // Collect bounding rects for all elevated tiles in the draw list.
            // Only tiles with elevation > 0 can occlude a unit above tile height.
            const occluderRects = [];
            for (const entry of drawList) {
                if (entry.kind !== 'tile') continue;
                const elevOff = this._elevOffset(entry.tile);
                if (elevOff <= 0) continue;
                const sp = this.tileToScreen(entry.tx, entry.ty);
                const nx = sp.x, ny = sp.y - elevOff;
                occluderRects.push({
                    tlx: nx - hw,
                    tly: ny,
                    brx: nx + hw,
                    bry: ny + hh * 2 + elevOff,
                    diag: entry.diag,
                });
            }

            for (const unit of liveUnits) {
                const vizX  = unit._vizX  != null ? unit._vizX  : unit.x;
                const vizY  = unit._vizY  != null ? unit._vizY  : unit.y;
                const prevX = unit._prevX != null ? unit._prevX : unit.x;
                const prevY = unit._prevY != null ? unit._prevY : unit.y;
                const vViz  = this._toVirtual(vizX,  vizY,  map.width, map.height);
                const vPrev = this._toVirtual(prevX, prevY, map.width, map.height);
                const unitDiag = Math.max(vViz.u + vViz.v, vPrev.u + vPrev.v);

                const rp           = getEntityRenderPos(unit, now);
                const stepDestTile = getTile(map, vizX, vizY);
                const stepDestElev = this._elevOffset(stepDestTile);
                let unitElevOff = stepDestElev;
                let hopOff = 0;
                if (isEntityMoving(unit) && unit._prevX != null) {
                    const srcTile  = getTile(map, unit._prevX, unit._prevY);
                    const srcElev  = this._elevOffset(srcTile);
                    const elapsed  = now - unit._moveStartTime;
                    const moveT    = Math.min(1, elapsed / (unit._moveDuration || 1));
                    unitElevOff    = srcElev + (stepDestElev - srcElev) * moveT * (2 - moveT);
                    const elevDiff = stepDestElev - srcElev;
                    const flatHop  = Math.round(ts * 0.03);
                    let hopAmp, hopT;
                    if (elevDiff > 0) {
                        hopAmp = flatHop + elevDiff * 0.55;
                        hopT   = Math.min(moveT / 0.7, 1);
                    } else {
                        hopAmp = flatHop + Math.abs(elevDiff) * 1.2;
                        hopT   = moveT;
                    }
                    hopOff = Math.sin(hopT * Math.PI) * hopAmp;
                }
                const isoSp = this.tileToScreen(rp.x, rp.y);
                const footX = isoSp.x;
                const footY = isoSp.y + hh * 2 - unitElevOff - Math.round(hh * 0.5) - hopOff;
                const spx   = Math.round(footX - sw / 2);
                const spy   = Math.round(footY - sh);

                let occluded = false;
                for (const r of occluderRects) {
                    if (r.diag <= unitDiag) continue;
                    if (spx < r.brx && spx + sw > r.tlx && spy < r.bry && spy + sh > r.tly) {
                        occluded = true;
                        break;
                    }
                }
                if (!occluded) continue;

                ctx.save();
                ctx.globalAlpha = 0.42;
                if (useSprites && unit.spriteKey) {
                    const img = sm.getSprite('entities', unit.spriteKey);
                    if (img) {
                        ctx.imageSmoothingEnabled = false;
                        ctx.drawImage(img, spx, spy, sw, sh);
                    } else {
                        ctx.fillStyle = unit.team === 'player' ? '#9df' : '#f76';
                        ctx.font = `bold ${Math.round(sh * 0.7)}px 'Courier New', monospace`;
                        ctx.textAlign = 'center';
                        ctx.fillText(unit.char, footX, footY - sh / 2);
                    }
                } else {
                    ctx.fillStyle = unit.team === 'player' ? '#9df' : '#f76';
                    ctx.font = `bold ${Math.round(sh * 0.7)}px 'Courier New', monospace`;
                    ctx.textAlign = 'center';
                    ctx.fillText(unit.char, footX, footY - sh / 2);
                }
                ctx.restore();
            }
        }

        // ---- Name labels: always on top, never occluded by terrain ----------
        ctx.textBaseline = 'middle';
        for (const unit of liveUnits) {
            const unconscious = isUnconscious(unit);
            const rp    = getEntityRenderPos(unit, now);
            const vizX  = unit._vizX != null ? unit._vizX : unit.x;
            const vizY  = unit._vizY != null ? unit._vizY : unit.y;
            const stepDestTile = getTile(map, vizX, vizY);
            const stepDestElev = this._elevOffset(stepDestTile);
            let unitElevOff = stepDestElev;
            let hopOff = 0;
            if (isEntityMoving(unit) && unit._prevX != null) {
                const srcTile  = getTile(map, unit._prevX, unit._prevY);
                const srcElev  = this._elevOffset(srcTile);
                const elapsed  = now - unit._moveStartTime;
                const moveT    = Math.min(1, elapsed / (unit._moveDuration || 1));
                const eased    = moveT * (2 - moveT);
                unitElevOff    = srcElev + (stepDestElev - srcElev) * eased;
                const elevDiff = stepDestElev - srcElev;
                const flatHop  = Math.round(ts * 0.03);
                let hopAmp2, hopT2;
                if (elevDiff > 0) {
                    hopAmp2 = flatHop + elevDiff * 0.55;
                    hopT2   = Math.min(moveT / 0.7, 1);
                } else {
                    hopAmp2 = flatHop + Math.abs(elevDiff) * 1.2;
                    hopT2   = moveT;
                }
                hopOff = Math.sin(hopT2 * Math.PI) * hopAmp2;
            }
            const isoSp = this.tileToScreen(rp.x, rp.y);
            const footX = isoSp.x;
            const footY = isoSp.y + hh * 2 - unitElevOff - Math.round(hh * 0.5) - hopOff;
            const sw    = Math.round(ts / 2);
            const spy   = Math.round(footY - sw);
            const barStartY = spy - HP_BAR_H - (unit.maxMp > 0 ? MP_BAR_H + 1 : 0) - 2
                - (unit._charging ? (6 + 10 + 14) : 0);
            const nameLabelY = barStartY - 10;

            ctx.globalAlpha = unconscious ? 0.5 : 1;
            ctx.font = `bold ${Math.round(sw * 0.32)}px 'Courier New', monospace`;
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 3;
            ctx.lineJoin = 'round';
            ctx.strokeText(unit.name, footX, nameLabelY);
            ctx.fillStyle = unit.team === 'player' ? '#9df' : '#f88';
            ctx.fillText(unit.name, footX, nameLabelY);
            ctx.globalAlpha = 1;
        }

        // ---- Facing arrows: always on top, never occluded by terrain --------
        for (const unit of liveUnits) {
            const rp    = getEntityRenderPos(unit, now);
            const vizX  = unit._vizX != null ? unit._vizX : unit.x;
            const vizY  = unit._vizY != null ? unit._vizY : unit.y;
            const stepDestTile = getTile(map, vizX, vizY);
            const stepDestElev = this._elevOffset(stepDestTile);
            let unitElevOff = stepDestElev;
            let hopOff = 0;
            if (isEntityMoving(unit) && unit._prevX != null) {
                const srcTile  = getTile(map, unit._prevX, unit._prevY);
                const srcElev  = this._elevOffset(srcTile);
                const elapsed  = now - unit._moveStartTime;
                const moveT    = Math.min(1, elapsed / (unit._moveDuration || 1));
                const eased    = moveT * (2 - moveT);
                unitElevOff    = srcElev + (stepDestElev - srcElev) * eased;
                const elevDiff = Math.abs(stepDestElev - srcElev);
                const flatHop  = Math.round(ts * 0.03);
                hopOff = Math.sin(moveT * Math.PI) * (flatHop + elevDiff * 1.2);
            }
            const isoSp    = this.tileToScreen(rp.x, rp.y);
            const footX    = isoSp.x;
            const footY    = isoSp.y + hh * 2 - unitElevOff - Math.round(hh * 0.5) - hopOff;
            // Rotate the facing direction by viewAngle steps so the arrow matches
            // the visual orientation of the rotated map. We shift the direction
            // name CW by viewAngle and look up in FACING_ROT (which bakes in the
            // non-uniform iso axis angles) rather than adding a flat angle offset.
            const DIRS_CW = ['north', 'east', 'south', 'west'];
            const facingIdx = DIRS_CW.indexOf(unit.facing || 'south');
            // Subtract viewAngle: rotating camera CW makes world directions appear CCW.
            const rotatedFacing = DIRS_CW[(facingIdx - this.viewAngle + 4) % 4];
            const arrowRot = FACING_ROT[rotatedFacing] || 0;
            const arrowColor = unit.team === 'player' ? '#7bf' : '#f76';

            ctx.save();
            ctx.globalAlpha = 0.45;
            ctx.translate(footX, footY + 10);
            ctx.rotate(arrowRot);
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.moveTo(0, 5);
            ctx.lineTo(0, -2);
            ctx.stroke();
            ctx.strokeStyle = arrowColor;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(0, 5);
            ctx.lineTo(0, -2);
            ctx.stroke();
            ctx.fillStyle = arrowColor;
            ctx.beginPath();
            ctx.moveTo(0, -9);
            ctx.lineTo(-6, -1.5);
            ctx.lineTo(6, -1.5);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(0, -9);
            ctx.lineTo(-6, -1.5);
            ctx.lineTo(6, -1.5);
            ctx.closePath();
            ctx.stroke();
            ctx.restore();
            ctx.globalAlpha = 1;
        }

        // ---- Layer 4: projectiles ------------------------------------------
        for (let i = this._projectiles.length - 1; i >= 0; i--) {
            const proj = this._projectiles[i];
            const t = (now - proj.startMs) / proj.durationMs;
            if (t >= 1) { this._projectiles.splice(i, 1); continue; }

            const wx = proj.sx + (proj.tx - proj.sx) * t;
            const wy = proj.sy + (proj.ty - proj.sy) * t;
            const ps = this.tileToScreen(wx, wy);
            const pcx = ps.x;
            const pcy = ps.y + hh;

            const alpha  = t < 0.1 ? t * 10 : t > 0.85 ? (1 - t) / 0.15 : 1;
            const radius = Math.max(3, ts * 0.08);

            ctx.save();
            ctx.globalAlpha = alpha * 0.25;
            ctx.beginPath();
            ctx.arc(pcx, pcy, radius * 2, 0, Math.PI * 2);
            ctx.fillStyle = proj.color;
            ctx.fill();
            ctx.globalAlpha = alpha;
            ctx.beginPath();
            ctx.arc(pcx, pcy, radius, 0, Math.PI * 2);
            ctx.fillStyle = proj.color;
            ctx.fill();
            ctx.restore();
        }

        // ---- Layer 5: floating damage/heal text ----------------------------
        for (const unit of units) {
            if (!unit._floats || unit._floats.length === 0) continue;
            const sp     = this.tileToScreen(unit.x, unit.y);
            const fElev  = this._elevOffset(getTile(map, unit.x, unit.y));
            const floatX = sp.x;
            const floatY = sp.y + hh - fElev;
            for (let i = unit._floats.length - 1; i >= 0; i--) {
                const f = unit._floats[i];
                f.age += dt;
                if (f.age >= f.maxAge) { unit._floats.splice(i, 1); continue; }
                const progress = f.age / f.maxAge;
                ctx.globalAlpha = 1 - progress;
                ctx.fillStyle   = f.color;
                ctx.font = `bold ${Math.round(ts * 0.32)}px 'Courier New', monospace`;
                ctx.fillText(f.text, floatX, floatY - progress * ts * 0.9);
            }
            ctx.globalAlpha = 1;
        }

        this._drawCompass(ctx);
    }

    _drawCompass(ctx) {
        const sidebarW = 190;
        const cx = this.canvas.width - sidebarW - 50;
        const cy = 50;
        const r  = 32;

        ctx.save();
        ctx.globalAlpha = 0.75;
        ctx.fillStyle = 'rgba(8,8,24,0.85)';
        ctx.beginPath();
        ctx.arc(cx, cy, r + 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#335';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.globalAlpha = 1;

        // Each CW rotation shifts all compass angles by -PI/2 so labels
        // track world direction regardless of view orientation.
        const rotOffset = this._spinActive
            ? (this._spinFrom + this._spinDir * (this._spinT * this._spinT * (3 - 2 * this._spinT))) * (-Math.PI / 2)
            : this.viewAngle * (-Math.PI / 2);
        const DIRS = [
            { label: 'N', baseAngle: -1 * Math.PI / 4, color: '#f66', major: true  },
            { label: 'E', baseAngle:  1 * Math.PI / 4, color: '#ccc', major: false },
            { label: 'S', baseAngle:  3 * Math.PI / 4, color: '#ccc', major: false },
            { label: 'W', baseAngle: -3 * Math.PI / 4, color: '#ccc', major: false },
        ];

        ctx.font = 'bold 9px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (const d of DIRS) {
            const angle = d.baseAngle + rotOffset;
            const dx = Math.cos(angle), dy = Math.sin(angle);
            ctx.strokeStyle = d.color;
            ctx.lineWidth   = d.major ? 2 : 1;
            ctx.globalAlpha = d.major ? 1 : 0.6;
            ctx.beginPath();
            ctx.moveTo(cx + dx * r * 0.45, cy + dy * r * 0.45);
            ctx.lineTo(cx + dx * r * 0.85, cy + dy * r * 0.85);
            ctx.stroke();
            ctx.fillStyle   = d.color;
            ctx.globalAlpha = d.major ? 1 : 0.55;
            ctx.fillText(d.label, cx + dx * r * 1.18, cy + dy * r * 1.18);
        }

        // North arrow triangle rotates with viewAngle.
        const na    = -Math.PI / 4 + rotOffset;
        const tipX  = cx + Math.cos(na) * r * 0.7;
        const tipY  = cy + Math.sin(na) * r * 0.7;
        const tailX = cx - Math.cos(na) * r * 0.22;
        const tailY = cy - Math.sin(na) * r * 0.22;
        const perpX = Math.cos(na + Math.PI / 2) * r * 0.12;
        const perpY = Math.sin(na + Math.PI / 2) * r * 0.12;
        ctx.globalAlpha = 1;
        ctx.fillStyle   = '#f66';
        ctx.beginPath();
        ctx.moveTo(tipX, tipY);
        ctx.lineTo(tailX + perpX, tailY + perpY);
        ctx.lineTo(tailX - perpX, tailY - perpY);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#800';
        ctx.lineWidth   = 1;
        ctx.stroke();

        // Rotate buttons (CCW left, CW right) and center button drawn below compass.
        const btnY   = cy + r + 14;
        const btnH   = 14;
        const btnW   = 20;
        const gap    = 6;
        const leftX  = cx - btnW - gap / 2;
        const rightX = cx + gap / 2;
        const ctrX   = rightX + btnW + gap;

        this._rotateBtns = [
            { x: leftX,  y: btnY, w: btnW, h: btnH, delta: -1 },
            { x: rightX, y: btnY, w: btnW, h: btnH, delta:  1 },
        ];
        this._centerBtn = { x: ctrX, y: btnY, w: btnH, h: btnH };

        ctx.globalAlpha = 0.85;
        ctx.fillStyle   = '#446';
        ctx.strokeStyle = '#88a';
        ctx.lineWidth   = 1;

        ctx.font = 'bold 8px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // CCW button: left-pointing triangle with 'q' label
        ctx.beginPath();
        ctx.moveTo(leftX,        btnY + btnH / 2);
        ctx.lineTo(leftX + btnW, btnY);
        ctx.lineTo(leftX + btnW, btnY + btnH);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.fillStyle   = '#cce';
        ctx.globalAlpha = 0.9;
        ctx.fillText('q', leftX + btnW * 0.62, btnY + btnH / 2);

        // CW button: right-pointing triangle with 'e' label
        ctx.globalAlpha = 0.85;
        ctx.fillStyle   = '#446';
        ctx.strokeStyle = '#88a';
        ctx.beginPath();
        ctx.moveTo(rightX + btnW, btnY + btnH / 2);
        ctx.lineTo(rightX,        btnY);
        ctx.lineTo(rightX,        btnY + btnH);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.fillStyle   = '#cce';
        ctx.globalAlpha = 0.9;
        ctx.fillText('e', rightX + btnW * 0.38, btnY + btnH / 2);

        // Center button: square with 'f' label
        ctx.globalAlpha = 0.85;
        ctx.fillStyle   = '#244';
        ctx.strokeStyle = '#6aa';
        ctx.beginPath();
        ctx.rect(ctrX, btnY, btnH, btnH);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle   = '#aef';
        ctx.globalAlpha = 0.9;
        ctx.fillText('f', ctrX + btnH / 2, btnY + btnH / 2);

        ctx.globalAlpha  = 1;
        ctx.textAlign    = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.restore();
    }

    _drawBar(ctx, x, y, w, h, frac, fillColor, bgColor) {
        ctx.fillStyle = bgColor;
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = fillColor;
        ctx.fillRect(x, y, Math.round(w * Math.max(0, frac)), h);
    }
}
