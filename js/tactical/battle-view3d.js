import * as THREE from '../../lib/three/three.module.js';
import { getTile } from './battle-map.js';
import { getTileRender, terrainTopY, SLAB_BOTTOM } from './tile-render.js';
import { STATES } from './battle.js';
import { ABILITIES } from './abilities.js';
import { getEntityRenderPos, isEntityMoving } from '../systems/movement-lerp.js';
import { isAlive, isUnconscious, facingForStep } from './units.js';
import { viewState } from './view-state.js';
import { UnitSprites } from './unit-sprites.js';

/**
 * Real-3D battle view: terrain is built from the map's tile types and elevations,
 * characters are upright billboard sprites, and the camera orbits in 90 degree steps
 * at a fixed pitch. One tile is one world unit. World X is the tile column, world Z is
 * the tile row, and world Y is height.
 *
 * Game logic never reads anything from here. All animation state lives in view-state.js.
 *
 * @par Thread Safety:
 *      Not thread-safe. Main thread only (touches WebGL and the DOM).
 */

const DEG = Math.PI / 180;
const PITCH = 32 * DEG;
const BASE_AZIMUTH = 45 * DEG;   // camera sits south-east of the target: north is up-right
const DEFAULT_TILE_SIZE = 48;
const PX_PER_UNIT_FACTOR = 0.85; // zoom (tileSize) -> pixels per world unit
const SPRITE_HEIGHT = 1.0;
const PAN_SPEED = 6;             // tiles per second at tileSize 48
const CAMERA_DISTANCE = 60;
const ROTATE_EASE_MS = 70;
const FACING_TWEEN_MS = 180;
const NAME_MIN_TILE_SIZE = 34;   // below this zoom, only the acting unit shows a name

const FACING_DIR = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] };

// Per-face shade baked into terrain vertex colors.
const SHADE_TOP = 1.0;
const SHADE_SOUTH = 0.82;
const SHADE_EAST  = 0.72;
const SHADE_NORTH = 0.58;
const SHADE_WEST  = 0.5;

// Animated terrain overlays, matching the old 2D renderer's timing.
const GRASS_SWAY_PERIOD_MS = 2500;
const GRASS_SWAY_AMPLITUDE = 0.022;   // radians
const WATER_PERIOD_MS = 2200;
const WATER_ALPHA_BASE = 0.72;
const WATER_ALPHA_VARIATION = 0.22;
const WATER_PHASE_BUCKETS = 4;        // one InstancedMesh opacity per bucket, so tiles ripple out of step
const TERRAIN_FX_LIFT = 0.004;        // keeps overlays just above the tile top

const TYPE_INDEX = { grass: 1, dirt: 2, water: 3, wall: 4, rubble: 5, high: 6 };

// Highlight appearance, grouped by opacity because each instanced mesh has one opacity.
const HIGHLIGHTS = {
    hit:       { color: '#3cff64', border: '#78ff8c', level: 2 },
    hover:     { color: '#8cc8ff', border: '#b4e6ff', level: 2 },
    aoe:       { color: '#ff8c00', border: '#ffb400', level: 1 },
    ability:   { color: '#ffdc00', border: '#fff050', level: 0 },
    move:      { color: '#3c78ff', border: '#64a0ff', level: 0 },
};
const KIND_INDEX = Object.fromEntries(Object.keys(HIGHLIGHTS).map((k, i) => [k, i]));
const HIGHLIGHT_LEVEL_OPACITY = [0.32, 0.45, 0.58];

const STYLE_ID = 'tac3d-style';
const CSS = `
.tac3d-overlay{position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:5;font-family:'Courier New',monospace;}
.tac3d-tag{position:absolute;left:0;top:0;display:flex;flex-direction:column;align-items:center;gap:1px;will-change:transform;}
.tac3d-name{font-size:11px;font-weight:bold;text-shadow:-1px -1px 0 #000,1px -1px 0 #000,-1px 1px 0 #000,1px 1px 0 #000;white-space:nowrap;}
.tac3d-name.player{color:#9df}.tac3d-name.enemy{color:#f88}
.tac3d-bar{width:34px;background:#111;box-shadow:0 0 0 1px #000;}
.tac3d-bar i{display:block;height:100%;}
.tac3d-hp{height:5px}.tac3d-hp i{background:#3c3}
.tac3d-mp{height:3px}.tac3d-mp i{background:#36f}
.tac3d-charge{width:34px;height:6px;background:#111;box-shadow:0 0 6px currentColor;}
.tac3d-charge i{display:block;height:100%;background:currentColor}
.tac3d-cname{font-size:9px;font-weight:bold;text-shadow:-1px -1px 0 #000,1px -1px 0 #000,-1px 1px 0 #000,1px 1px 0 #000;white-space:nowrap;}
.tac3d-status{font-size:10px;font-weight:bold;color:#fd6;text-shadow:0 0 2px #000,0 0 2px #000;white-space:nowrap;}
.tac3d-float{position:absolute;left:0;top:0;font-size:15px;font-weight:bold;text-shadow:-1px -1px 0 #000,1px -1px 0 #000,-1px 1px 0 #000,1px 1px 0 #000;white-space:nowrap;will-change:transform,opacity;}
.tac3d-compass{position:absolute;top:14px;display:flex;gap:6px;pointer-events:auto;}
.tac3d-compass button{width:34px;height:34px;border-radius:50%;border:1px solid #335;background:rgba(8,8,24,.8);color:#cde;font:bold 16px 'Courier New',monospace;cursor:pointer;padding:0;}
.tac3d-compass button:hover{background:rgba(40,40,90,.9)}
.tac3d-compass button.active{background:rgba(40,80,150,.95);border-color:#7af;color:#fff}
`;

function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const el = document.createElement('style');
    el.id = STYLE_ID;
    el.textContent = CSS;
    document.head.appendChild(el);
}

// Accumulates quads into one BufferGeometry. owners[i] is the tile index of quad i, so
// a raycast hit (faceIndex >> 1) maps straight back to a tile.
class QuadBatch {
    constructor() { this.pos = []; this.uv = []; this.col = []; this.idx = []; this.owners = []; }

    quad(a, b, c, d, color, owner, uvs = [[0, 1], [0, 0], [1, 0], [1, 1]]) {
        const base = this.pos.length / 3;
        for (const v of [a, b, c, d]) this.pos.push(v[0], v[1], v[2]);
        for (const t of uvs) this.uv.push(t[0], t[1]);
        for (let i = 0; i < 4; i++) this.col.push(color[0], color[1], color[2]);
        this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
        this.owners.push(owner);
    }

    get empty() { return this.owners.length === 0; }

    toGeometry() {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
        g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
        g.setIndex(this.idx);
        g.computeBoundingSphere();
        g.computeBoundingBox();
        return g;
    }
}

function shadeColor(hex, shade, tint = [1, 1, 1]) {
    const c = new THREE.Color(hex);
    return [c.r * shade * tint[0], c.g * shade * tint[1], c.b * shade * tint[2]];
}

function makeGlowTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.35, 'rgba(255,255,255,0.7)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

/**
 * Replaces a scene's content with a readable message when the 3D view cannot start
 * (typically no WebGL), so the player is not left on a blank screen.
 * @param {HTMLElement} container
 * @param {Error} err
 * @param {() => void} onBack  Called when the player presses Back.
 */
export function showViewError(container, err, onBack) {
    container.innerHTML = '';
    const box = document.createElement('div');
    box.style.cssText = 'position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;color:#cde;background:#0a0a12;font-family:\'Courier New\',monospace;text-align:center;padding:24px;';
    const msg = document.createElement('div');
    msg.textContent = 'The battle view needs WebGL, which could not be started.';
    const detail = document.createElement('div');
    detail.style.cssText = 'font-size:12px;color:#889;';
    detail.textContent = String(err && err.message ? err.message : err);
    const back = document.createElement('button');
    back.textContent = 'Back';
    back.style.cssText = 'padding:8px 18px;font:inherit;cursor:pointer;';
    back.addEventListener('click', () => onBack());
    box.append(msg, detail, back);
    container.appendChild(box);
}

export class BattleView3D {
    /**
     * @param {HTMLElement} container  Element the canvas and HUD overlay are added to.
     * @param {object|null} skinManager  Source of terrain and character images.
     */
    constructor(container, skinManager) {
        ensureStyle();
        this.container   = container;
        this.skinManager = skinManager || null;
        this.unitSprites = new UnitSprites(skinManager);

        this.canvas = document.createElement('canvas');
        this.canvas.id = 'tactical-canvas';
        this.canvas.style.cssText = 'display:block;position:absolute;inset:0;width:100%;height:100%;image-rendering:pixelated;cursor:crosshair;';
        container.appendChild(this.canvas);

        this.overlay = document.createElement('div');
        this.overlay.className = 'tac3d-overlay';
        container.appendChild(this.overlay);

        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false, alpha: false });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        this.renderer.setClearColor(0x0a0a12, 1);

        this.scene  = new THREE.Scene();
        this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, CAMERA_DISTANCE * 3);
        this._ray   = new THREE.Raycaster();

        this._tileSize = DEFAULT_TILE_SIZE;
        this._insets   = { left: 0, right: 190 };
        this._width = 0;
        this._height = 0;

        // Camera state. _azSteps counts quarter turns, so the orbit eases to a clean 90 degrees.
        this._azSteps = 0;
        this._azTargetSteps = 0;
        this._target  = new THREE.Vector3(0, 0, 0);
        this._desired = null;          // {x, z} the camera is gliding toward
        this._panKeys = { left: false, right: false, up: false, down: false };
        this._panStart = null;
        this._panning = false;
        this._autoCenterNext = true;
        this.onCenterRequest = null;
        // Free (default): the camera frames the whole map and never moves on its own.
        // Tracking: it follows the acting unit and walking units.
        this._tracking = false;
        this._fitPending = true;
        this._savedTileSize = DEFAULT_TILE_SIZE;   // zoom to return to when tracking is switched on
        this.onFreeCameraChange = null;

        this._lastTime = 0;
        this._pulse = 0;

        this._map = null;
        this._terrainSig = null;
        this._terrain = null;          // {group, tops: [{mesh, owners}], sides: {mesh, owners}}
        this._textures = new WeakMap();
        this._ownedTextures = new Set();
        this._paddingCache = new WeakMap();
        this._unitViews = new Map();
        this._projectiles = [];

        this._glowTexture = makeGlowTexture();
        this._shadowGeo = new THREE.CircleGeometry(0.34, 20);
        this._shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
        this._arrowGeo = new THREE.BufferGeometry();
        this._arrowGeo.setAttribute('position', new THREE.Float32BufferAttribute([0.2, 0, 0, -0.12, 0, 0.15, -0.12, 0, -0.15], 3));
        this._arrowGeo.setIndex([0, 2, 1]);

        this._buildHighlights();
        this._buildCompass();
        this._resize();
    }

    // ---- Public camera API ---------------------------------------------------

    /** Zoom as a tile size in pixels, 24 to 80 (down to 8 in the free camera, to fit big maps). */
    get tileSize() { return this._tileSize; }
    set tileSize(v) { this._tileSize = Math.max(this._tracking ? 24 : 8, Math.min(80, v)); }

    /** True while the free camera is on (no automatic following). */
    get freeCamera() { return !this._tracking; }

    /**
     * Turns the free camera on or off. On: automatic camera moves stop and the camera
     * frames the whole map. Off: the previous zoom returns and tracking resumes.
     * @param {boolean} on
     */
    setFreeCamera(on) {
        if (on === !this._tracking) return;
        this._tracking = !on;
        if (on) {
            this._savedTileSize = this._tileSize;
            this._desired = null;
            this._autoCenterNext = false;
            this._fitPending = true;
        } else {
            this._fitPending = false;
            if (this._savedTileSize !== null) this._tileSize = this._savedTileSize;
            this._autoCenterNext = true;
        }
        this._freeButton?.classList.toggle('active', on);
        this.onFreeCameraChange?.(on);
    }

    /** Re-frames the whole map (the free camera's starting view). */
    fitToMap() { this._desired = null; this._fitPending = true; }

    /** Shows or hides the free camera button (the deploy screen has nothing to track). */
    showFreeCameraButton(visible) {
        if (this._freeButton) this._freeButton.style.display = visible ? '' : 'none';
    }

    /** Space the HUD takes on each side, so the map centers in the visible area. */
    setInsets(left, right) { this._insets = { left, right }; }

    zoomBy(delta) { this.tileSize = this._tileSize + delta; }

    /** Quarter-turn the camera. Positive is clockwise as seen from above. */
    rotateView(delta) { this._azTargetSteps += delta; }

    /** Glide the camera to a tile. */
    centerOn(tx, ty) { this._desired = { x: tx, z: ty }; }

    /** Glide to a tile only while tracking. For automatic camera moves, not player requests. */
    trackAt(tx, ty) { if (this._tracking) this.centerOn(tx, ty); }

    /** Jump the camera to a tile with no glide. */
    snapTo(tx, ty) {
        this._target.x = tx;
        this._target.z = ty;
        this._desired = null;
        this._autoCenterNext = false;
    }

    /** Re-center on the active unit at the next render. */
    requestAutoCenter() { this._autoCenterNext = true; }

    setPanKey(dir, down) { this._panKeys[dir] = down; }

    /** Start a drag-pan. Follow with panByPixels(dx, dy), the offsets from the drag start. */
    beginPan() {
        this._panStart = { x: this._target.x, z: this._target.z };
        this._panning = true;
        this._desired = null;
    }

    /** End a drag-pan so the camera may follow walking units again. */
    endPan() {
        this._panning = false;
        this._panStart = null;
    }

    panByPixels(dx, dy) {
        if (!this._panStart) return;
        const ppu = this._pixelsPerUnit();
        const { right, up } = this._groundBasis();
        // Dragging the map right moves the camera left, so subtract along the screen axes.
        const k = 1 / ppu;
        const ku = 1 / (ppu * Math.sin(PITCH));
        this._target.x = this._panStart.x - right.x * dx * k + up.x * dy * ku;
        this._target.z = this._panStart.z - right.z * dx * k + up.z * dy * ku;
        this._clampTarget();
    }

    // ---- Picking -------------------------------------------------------------

    /**
     * Resolves a screen position to a tile. Units are tested first so clicking a
     * character resolves to their tile even where terrain would be hit behind them.
     * @param {number} clientX
     * @param {number} clientY
     * @param {object} map
     * @param {object[]} units
     * @returns {{x:number,y:number}|null}
     */
    pickTile(clientX, clientY, map, units) {
        const rect = this.canvas.getBoundingClientRect();
        if (!rect.width || !rect.height) return null;
        const ndc = new THREE.Vector2(
            ((clientX - rect.left) / rect.width) * 2 - 1,
            -((clientY - rect.top) / rect.height) * 2 + 1
        );
        this._ray.setFromCamera(ndc, this.camera);
        this.camera.updateMatrixWorld();

        const sprites = [];
        const byObject = new Map();
        for (const unit of units || []) {
            const uv = this._unitViews.get(unit);
            if (uv && uv.sprite.visible && isAlive(unit)) { sprites.push(uv.sprite); byObject.set(uv.sprite, unit); }
        }
        // Only the lower, central part of the billboard counts as the unit. The quad's upper
        // area overlaps the tile behind the unit on screen, and that tile must stay clickable.
        const unitHit = this._ray.intersectObjects(sprites, false)
            .find(h => h.uv && h.uv.x > 0.2 && h.uv.x < 0.8 && h.uv.y < 0.7);

        const meshes = this._terrain ? [...this._terrain.tops.map(t => t.mesh), this._terrain.sides.mesh] : [];
        const terrainHit = this._ray.intersectObjects(meshes, false)[0];

        // Walkable terrain clearly nearer the camera than the unit (a plateau in front of it)
        // wins. Impassable terrain such as a wall never hides a unit from selection, because
        // nothing can stand there and the ghost silhouette shows the player where the unit is.
        const NEAR_TOLERANCE = 0.4;
        let terrainTile = null;
        if (terrainHit && map) {
            const index = terrainHit.object.userData.owners[terrainHit.faceIndex >> 1];
            terrainTile = index === undefined ? null : map.tiles[index];
        }
        const terrainBlocksUnit = terrainHit && terrainTile && terrainTile.passable
            && unitHit && unitHit.distance > terrainHit.distance + NEAR_TOLERANCE;
        if (unitHit && !terrainBlocksUnit) {
            const unit = byObject.get(unitHit.object);
            return { x: unit.x, y: unit.y };
        }
        if (terrainHit) {
            const owners = terrainHit.object.userData.owners;
            const tileIndex = owners[terrainHit.faceIndex >> 1];
            if (tileIndex !== undefined && map) {
                return { x: tileIndex % map.width, y: Math.floor(tileIndex / map.width) };
            }
        }
        return null;
    }

    // ---- Effects -------------------------------------------------------------

    spawnProjectile(sx, sy, tx, ty, color, durationMs) {
        const mat = new THREE.SpriteMaterial({ map: this._glowTexture, color: new THREE.Color(color), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
        const sprite = new THREE.Sprite(mat);
        sprite.scale.set(0.5, 0.5, 1);
        sprite.renderOrder = 20;
        this.scene.add(sprite);
        this._projectiles.push({ sx, sy, tx, ty, sprite, startMs: performance.now(), durationMs: durationMs || 500 });
    }

    // ---- Frame ---------------------------------------------------------------

    /**
     * Draws one frame.
     * @param {object} battle  Needs map, units, activeUnit, state, hoverTile, getRangeHighlights().
     * @param {number} now  performance.now()-style milliseconds.
     */
    render(battle, now) {
        const dt = this._lastTime ? Math.min(100, now - this._lastTime) : 16;
        this._lastTime = now;
        this._pulse = (this._pulse + dt * 0.003) % (Math.PI * 2);
        this._resize();

        const { map, units, activeUnit } = battle;
        this._map = map;
        this._syncTerrain(map);
        this._syncUnits(units);

        this._updateCamera(battle, dt, now);
        this._updateTerrainFx(now);
        this._updateHighlights(battle);
        this._updateUnits(units, activeUnit, map, dt, now);
        this._updateProjectiles(map, now);
        this._updateFloats(units, map, dt);

        this.renderer.render(this.scene, this.camera);
    }

    dispose() {
        if (this._disposed) return;
        this._disposed = true;
        this._clearTerrain();
        for (const uv of this._unitViews.values()) this._disposeUnitView(uv);
        this._unitViews.clear();
        for (const p of this._projectiles) { p.sprite.material.dispose(); }
        this._projectiles = [];
        for (const mesh of [...this._hlFills, this._hlBorder]) {
            this.scene.remove(mesh);
            mesh.material.dispose();
            mesh.dispose();
        }
        this._hlFillGeo.dispose();
        this._hlFrameGeo.dispose();
        for (const t of this._ownedTextures) t.dispose();
        this._ownedTextures.clear();
        this._shadowGeo.dispose();
        this._shadowMat.dispose();
        this._arrowGeo.dispose();
        this._glowTexture.dispose();
        this.renderer.dispose();
        // Each scene makes its own context and browsers cap how many may be live.
        this.renderer.forceContextLoss();
        this.canvas.remove();
        this.overlay.remove();
    }

    // ---- Camera --------------------------------------------------------------

    _pixelsPerUnit() { return this._tileSize * PX_PER_UNIT_FACTOR; }

    _azimuth() { return BASE_AZIMUTH - this._azSteps * (Math.PI / 2); }

    // Ground-plane unit vectors for screen right and screen up (the camera's forward).
    _groundBasis() {
        const az = this._azimuth();
        const up = new THREE.Vector3(-Math.sin(az), 0, -Math.cos(az));
        const right = new THREE.Vector3(-up.z, 0, up.x);   // up x worldY
        return { right, up };
    }

    _clampTarget() {
        if (!this._map) return;
        this._target.x = Math.max(-1, Math.min(this._map.width, this._target.x));
        this._target.z = Math.max(-1, Math.min(this._map.height, this._target.z));
    }

    _updateCamera(battle, dt, now) {
        const { map, units, activeUnit } = battle;

        if (this._fitPending) this._fitToMap(map);

        if (this._tracking && this._autoCenterNext && activeUnit) {
            this.centerOn(activeUnit.x, activeUnit.y);
            this._autoCenterNext = false;
        }
        // While a unit walks, follow its interpolated position (tracking mode only).
        // Not while the player is dragging or holding a pan key, or they would fight the camera.
        const keys = this._panKeys;
        const manualPan = this._panning || keys.left || keys.right || keys.up || keys.down;
        const movingUnit = (!this._tracking || manualPan) ? null : units.find(u => isEntityMoving(u));
        if (movingUnit) {
            const rp = getEntityRenderPos(movingUnit, now);
            this.centerOn(rp.x, rp.y);
        }

        if (this._desired) {
            const k = 1 - Math.pow(0.004, dt / 1000);
            const dx = this._desired.x - this._target.x;
            const dz = this._desired.z - this._target.z;
            if (Math.abs(dx) < 0.01 && Math.abs(dz) < 0.01) {
                this._target.x = this._desired.x;
                this._target.z = this._desired.z;
                this._desired = null;
            } else {
                this._target.x += dx * k;
                this._target.z += dz * k;
            }
        }

        if (keys.left || keys.right || keys.up || keys.down) {
            this._desired = null;
            const step = PAN_SPEED * (dt / 1000);
            const { right, up } = this._groundBasis();
            const mx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
            const my = (keys.up ? 1 : 0) - (keys.down ? 1 : 0);
            this._target.x += (right.x * mx + up.x * my) * step;
            this._target.z += (right.z * mx + up.z * my) * step;
        }
        this._clampTarget();

        // Ease toward the tile's top height so the framing follows terrain. The free camera
        // keeps a fixed height instead, so panning over hills does not bob the view.
        if (this._tracking) {
            const groundY = terrainTopY(getTile(map, Math.round(this._target.x), Math.round(this._target.z)));
            this._target.y += (groundY - this._target.y) * Math.min(1, dt / 120);
        }

        // Ease the orbit to the requested quarter turn.
        const diff = this._azTargetSteps - this._azSteps;
        if (Math.abs(diff) < 0.001) this._azSteps = this._azTargetSteps;
        else this._azSteps += diff * (1 - Math.exp(-dt / ROTATE_EASE_MS));

        const az = this._azimuth();
        const cam = this.camera;
        cam.position.set(
            this._target.x + Math.sin(az) * Math.cos(PITCH) * CAMERA_DISTANCE,
            this._target.y + Math.sin(PITCH) * CAMERA_DISTANCE,
            this._target.z + Math.cos(az) * Math.cos(PITCH) * CAMERA_DISTANCE
        );
        cam.lookAt(this._target);
        cam.updateMatrixWorld();
        this._applyFrustum();
    }

    // Frames the whole map: zoom so the rotated map's silhouette fits the free area of the
    // canvas, and center on it. Uses the same projection as the camera (see _groundBasis).
    _fitToMap(map) {
        this._fitPending = false;
        if (!map) return;
        let maxTop = 0;
        for (const t of map.tiles) maxTop = Math.max(maxTop, terrainTopY(t));
        const { right, up } = this._groundBasis();
        const sinP = Math.sin(PITCH), cosP = Math.cos(PITCH);
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const cx of [-0.5, map.width - 0.5]) {
            for (const cz of [-0.5, map.height - 0.5]) {
                for (const y of [SLAB_BOTTOM, maxTop]) {
                    // Screen position relative to a target at the origin at height 0.
                    const sx = cx * right.x + cz * right.z;
                    const sy = y * cosP + (cx * up.x + cz * up.z) * sinP;
                    minX = Math.min(minX, sx); maxX = Math.max(maxX, sx);
                    minY = Math.min(minY, sy); maxY = Math.max(maxY, sy);
                }
            }
        }
        const margin = 1.5;   // world units of breathing room around the map
        const availW = Math.max(100, this._width - this._insets.left - this._insets.right);
        const availH = Math.max(100, this._height - 70);   // leave room for the top HUD
        const ppu = Math.min(availW / (maxX - minX + margin), availH / (maxY - minY + margin));
        this._tileSize = Math.max(8, Math.min(80, ppu / PX_PER_UNIT_FACTOR));

        // Put the middle of the silhouette at the target: shift along screen-right and screen-up.
        const midX = (minX + maxX) / 2, midY = (minY + maxY) / 2;
        this._target.set(
            right.x * midX + up.x * (midY / sinP),
            0,
            right.z * midX + up.z * (midY / sinP)
        );
        this._desired = null;
    }

    _applyFrustum() {
        const ppu = this._pixelsPerUnit();
        const w = this._width, h = this._height;
        // Shift so the map centers in the area the HUD leaves free.
        const off = (this._insets.left - this._insets.right) / 2;
        const cam = this.camera;
        cam.left   = (-w / 2 - off) / ppu;
        cam.right  = ( w / 2 - off) / ppu;
        cam.top    = (h / 2) / ppu;
        cam.bottom = (-h / 2) / ppu;
        cam.updateProjectionMatrix();
    }

    _resize() {
        const rect = this.container.getBoundingClientRect();
        const w = Math.max(Math.floor(rect.width), 400);
        const h = Math.max(Math.floor(rect.height), 300);
        if (w !== this._width || h !== this._height) {
            this._width = w;
            this._height = h;
            this.renderer.setSize(w, h, false);
        }
        const compassRight = this._insets.right + 16;
        this._compass.style.right = compassRight + 'px';
        this._compass.style.left = 'auto';
    }

    // ---- Terrain -------------------------------------------------------------

    _signature(map) {
        let h = map.width * 131 + map.height;
        for (const t of map.tiles) h = (h * 31 + (TYPE_INDEX[t.type] || 0) * 7 + (t.elevation || 0)) | 0;
        return h;
    }

    _syncTerrain(map) {
        // Include the skin so terrain textures appear if the skin finishes loading after entry.
        const sm = this.skinManager;
        const sig = `${this._signature(map)}:${sm && sm.isActive ? sm.activeSkin : ''}`;
        if (this._terrain && this._terrainSig === sig && this._terrain.map === map) return;
        this._clearTerrain();
        this._terrain = this._buildTerrain(map);
        this._terrain.map = map;
        this._terrainSig = sig;
        this.scene.add(this._terrain.group);
    }

    _clearTerrain() {
        if (!this._terrain) return;
        this.scene.remove(this._terrain.group);
        for (const t of this._terrain.tops) { t.mesh.geometry.dispose(); t.mesh.material.dispose(); }
        this._terrain.sides.mesh.geometry.dispose();
        this._terrain.sides.mesh.material.dispose();
        const fx = this._terrain.fx;
        if (fx) {
            const meshes = [fx.grass, ...fx.water.map(w => w.mesh)].filter(Boolean);
            for (const mesh of meshes) { mesh.material.dispose(); mesh.dispose(); }
            fx.geometry.dispose();
        }
        this._terrain = null;
    }

    _textureFor(image) {
        let tex = this._textures.get(image);
        if (!tex) {
            tex = new THREE.Texture(image);
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.magFilter = THREE.NearestFilter;
            tex.minFilter = THREE.NearestFilter;
            tex.generateMipmaps = false;
            tex.needsUpdate = true;
            this._textures.set(image, tex);
            this._ownedTextures.add(tex);
        }
        return tex;
    }

    _buildTerrain(map) {
        const W = map.width, H = map.height;
        const topsByType = new Map();   // type -> QuadBatch
        const sides = new QuadBatch();
        const grassTiles = [];          // tiles that get the swaying tuft overlay
        const waterTiles = [];          // tiles that get the wave overlay

        const topAt = (x, y) => {
            const t = getTile(map, x, y);
            return t ? terrainTopY(t) : SLAB_BOTTOM;
        };

        for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
                const tile = map.tiles[y * W + x];
                if (!tile) continue;
                const index = y * W + x;
                const top = terrainTopY(tile);
                const x0 = x - 0.5, x1 = x + 0.5, z0 = y - 0.5, z1 = y + 0.5;

                // Soft shadow from taller terrain to the south (light comes from the south).
                let shadow = 0;
                for (let k = 1; k <= 5; k++) {
                    const south = getTile(map, x, y + k);
                    const len = south ? (south.elevation || 0) - (tile.elevation || 0) : 0;
                    if (len >= k) shadow = Math.max(shadow, Math.min(0.58, 0.38 * (1 - (k - 1) / len)));
                }
                const dim = 1 - shadow * 0.9;
                const topColor = [SHADE_TOP * dim, SHADE_TOP * dim, SHADE_TOP * (1 - shadow * 0.6)];

                let batch = topsByType.get(tile.type);
                if (!batch) { batch = new QuadBatch(); topsByType.set(tile.type, batch); }
                batch.quad([x0, top, z0], [x0, top, z1], [x1, top, z1], [x1, top, z0], topColor, index);

                if (tile.type === 'grass' || tile.type === 'high') grassTiles.push({ x, z: y, top, index, topColor });
                else if (tile.type === 'water') waterTiles.push({ x, z: y, top, index, topColor });

                const sideHex = getTileRender(tile.type).side;
                const face = (nTop, shade, a, b) => {
                    if (nTop >= top - 1e-4) return;
                    const c = shadeColor(sideHex, shade);
                    sides.quad([a[0], top, a[1]], [b[0], top, b[1]], [b[0], nTop, b[1]], [a[0], nTop, a[1]], c, index);
                };
                face(topAt(x + 1, y), SHADE_EAST,  [x1, z1], [x1, z0]);
                face(topAt(x - 1, y), SHADE_WEST,  [x0, z0], [x0, z1]);
                face(topAt(x, y + 1), SHADE_SOUTH, [x0, z1], [x1, z1]);
                face(topAt(x, y - 1), SHADE_NORTH, [x1, z0], [x0, z0]);
            }
        }

        const group = new THREE.Group();
        const tops = [];
        const sm = this.skinManager;
        for (const [type, batch] of topsByType) {
            const def = getTileRender(type);
            const image = sm && sm.isActive ? (sm.getSprite('terrain', def.spriteKey) || sm.getSprite('terrain', 'grass')) : null;
            const mat = new THREE.MeshBasicMaterial({
                vertexColors: true,
                map: image ? this._textureFor(image) : null,
                color: image ? 0xffffff : new THREE.Color(def.color),
            });
            const mesh = new THREE.Mesh(batch.toGeometry(), mat);
            mesh.userData.owners = batch.owners;
            group.add(mesh);
            tops.push({ mesh });
        }
        const sideMesh = new THREE.Mesh(
            sides.toGeometry(),
            new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })
        );
        sideMesh.userData.owners = sides.owners;
        group.add(sideMesh);
        const fx = this._buildTerrainFx(group, grassTiles, waterTiles);
        return { group, tops, sides: { mesh: sideMesh }, fx };
    }

    // Overlay quads for the skin's animated grass and water sprites. Only built when the
    // skin supplies the sprites, so ascii mode and skins without them simply skip it.
    _buildTerrainFx(group, grassTiles, waterTiles) {
        const sm = this.skinManager;
        if (!sm || !sm.isActive) return null;
        const tuft  = sm.getSprite('effects', 'grass_tuft');
        const waves = sm.getSprite('effects', 'water_waves');
        const quad = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
        const fx = { geometry: quad, grass: null, grassTiles, water: [], waterTiles: [] };

        const makeMesh = (image, tiles) => {
            const mat = new THREE.MeshBasicMaterial({
                map: this._textureFor(image), transparent: true, depthWrite: false,
                polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
            });
            const mesh = new THREE.InstancedMesh(quad, mat, Math.max(1, tiles.length));
            mesh.count = tiles.length;
            mesh.frustumCulled = false;
            mesh.renderOrder = 2;
            const color = new THREE.Color();
            tiles.forEach((t, i) => mesh.setColorAt(i, color.setRGB(t.topColor[0], t.topColor[1], t.topColor[2])));
            group.add(mesh);
            return mesh;
        };

        if (tuft && grassTiles.length) {
            fx.grass = makeMesh(tuft, grassTiles);
            this._tmpMatrix = this._tmpMatrix || new THREE.Matrix4();
        }
        if (waves && waterTiles.length) {
            // Split the water tiles by phase so each bucket can have its own opacity.
            const buckets = Array.from({ length: WATER_PHASE_BUCKETS }, () => []);
            for (const t of waterTiles) {
                const phase = (t.index % 1000) / 1000;
                buckets[Math.min(WATER_PHASE_BUCKETS - 1, Math.floor(phase * WATER_PHASE_BUCKETS))].push(t);
            }
            buckets.forEach((tiles, b) => {
                if (!tiles.length) return;
                const mesh = makeMesh(waves, tiles);
                const m = new THREE.Matrix4();
                tiles.forEach((t, i) => mesh.setMatrixAt(i, m.makeTranslation(t.x, t.top + TERRAIN_FX_LIFT, t.z)));
                mesh.instanceMatrix.needsUpdate = true;
                fx.water.push({ mesh, phase: ((b + 0.5) / WATER_PHASE_BUCKETS) * Math.PI * 2 });
            });
        }
        return fx;
    }

    _updateTerrainFx(now) {
        const fx = this._terrain && this._terrain.fx;
        if (!fx) return;
        if (fx.grass) {
            const m = this._tmpMatrix, q = this._tmpQuat || (this._tmpQuat = new THREE.Quaternion());
            const pos = this._tmpPos || (this._tmpPos = new THREE.Vector3());
            const scl = this._tmpScl || (this._tmpScl = new THREE.Vector3(1, 1, 1));
            const up = this._upAxis || (this._upAxis = new THREE.Vector3(0, 1, 0));
            const t = (now / GRASS_SWAY_PERIOD_MS) * Math.PI * 2;
            fx.grassTiles.forEach((tile, i) => {
                const sway = Math.sin(t + ((tile.index % 1000) / 1000) * 6.28) * GRASS_SWAY_AMPLITUDE;
                q.setFromAxisAngle(up, sway);
                fx.grass.setMatrixAt(i, m.compose(pos.set(tile.x, tile.top + TERRAIN_FX_LIFT, tile.z), q, scl));
            });
            fx.grass.instanceMatrix.needsUpdate = true;
        }
        for (const w of fx.water) {
            const a = WATER_ALPHA_BASE + WATER_ALPHA_VARIATION * Math.cos((now / WATER_PERIOD_MS) * Math.PI * 2 + w.phase);
            w.mesh.material.opacity = Math.max(0, Math.min(1, a));
        }
    }

    // ---- Highlights ----------------------------------------------------------

    _buildHighlights() {
        const capacity = 64 * 64;
        const fillGeo = new THREE.PlaneGeometry(0.94, 0.94).rotateX(-Math.PI / 2);
        // A square frame made of four thin quads.
        const t = 0.06, o = 0.47, i = o - t;
        const frame = new QuadBatch();
        const edge = (a, b, c, d) => frame.quad(a, b, c, d, [1, 1, 1], 0);
        edge([-o, 0, -o], [-o, 0, -i], [o, 0, -i], [o, 0, -o]);
        edge([-o, 0, i], [-o, 0, o], [o, 0, o], [o, 0, i]);
        edge([-o, 0, -i], [-o, 0, i], [-i, 0, i], [-i, 0, -i]);
        edge([i, 0, -i], [i, 0, i], [o, 0, i], [o, 0, -i]);
        const frameGeo = frame.toGeometry();

        const make = (geo, opacity, order) => {
            const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
            const mesh = new THREE.InstancedMesh(geo, mat, capacity);
            mesh.count = 0;
            mesh.frustumCulled = false;
            mesh.renderOrder = order;
            this.scene.add(mesh);
            return mesh;
        };
        this._hlFillGeo = fillGeo;
        this._hlFrameGeo = frameGeo;
        this._hlHash = null;
        this._hlFills = HIGHLIGHT_LEVEL_OPACITY.map((op, n) => make(fillGeo, op, 5 + n));
        this._hlBorder = make(frameGeo, 0.85, 9);
        this._hlMatrix = new THREE.Matrix4();
    }

    _updateHighlights(battle) {
        const { map } = battle;
        const { move, ability, aoe, hit } = battle.getRangeHighlights();
        const hoverKey = battle.hoverTile || null;
        const showHover = (battle.state === STATES.SELECT_MOVE || battle.state === STATES.PLAYER_TURN)
            && hoverKey && move.has(hoverKey);

        const counts = this._hlFills.map(() => 0);
        let borders = 0;
        const color = new THREE.Color();
        const m = this._hlMatrix;
        const limit = this._hlBorder.instanceMatrix.count;
        let hash = this._terrainSig === null ? 0 : String(this._terrainSig).length;

        for (let y = 0; y < map.height; y++) {
            for (let x = 0; x < map.width; x++) {
                const key = `${x},${y}`;
                let kind = null;
                if (hit && hit.has(key)) kind = 'hit';
                else if (aoe.has(key)) kind = 'aoe';
                else if (ability.has(key)) kind = 'ability';
                else if (showHover && key === hoverKey) kind = 'hover';
                else if (move.has(key)) kind = 'move';
                if (!kind) continue;

                const style = HIGHLIGHTS[kind];
                // Cheap fingerprint of which tile has which highlight, to skip needless GPU uploads.
                hash = (hash * 31 + (y * map.width + x) * 8 + KIND_INDEX[kind]) | 0;

                const ty = terrainTopY(map.tiles[y * map.width + x]) + 0.02;
                m.makeTranslation(x, ty, y);

                const fill = this._hlFills[style.level];
                const fi = counts[style.level];
                if (fi < limit && borders < limit) {
                    fill.setMatrixAt(fi, m);
                    fill.setColorAt(fi, color.set(style.color));
                    counts[style.level]++;
                    this._hlBorder.setMatrixAt(borders, m);
                    this._hlBorder.setColorAt(borders, color.set(style.border));
                    borders++;
                }
            }
        }
        // Re-upload the instance buffers only when the highlighted set (or terrain) changed.
        const changed = hash !== this._hlHash || this._hlTerrainSig !== this._terrainSig
            || counts.some((c, n) => c !== this._hlFills[n].count) || borders !== this._hlBorder.count;
        this._hlHash = hash;
        this._hlTerrainSig = this._terrainSig;
        this._hlFills.forEach((mesh, n) => {
            mesh.count = counts[n];
            if (changed) {
                mesh.instanceMatrix.needsUpdate = true;
                if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
            }
        });
        this._hlBorder.count = borders;
        if (changed) {
            this._hlBorder.instanceMatrix.needsUpdate = true;
            if (this._hlBorder.instanceColor) this._hlBorder.instanceColor.needsUpdate = true;
        }
    }

    // ---- Units ---------------------------------------------------------------

    _syncUnits(units) {
        const live = new Set(units);
        for (const [unit, uv] of this._unitViews) {
            if (!live.has(unit)) { this._disposeUnitView(uv); this._unitViews.delete(unit); }
        }
        for (const unit of units) {
            if (!this._unitViews.has(unit)) this._unitViews.set(unit, this._createUnitView(unit));
        }
    }

    _createUnitView(unit) {
        const makeSprite = (opts) => {
            const mat = new THREE.SpriteMaterial({ transparent: false, alphaTest: 0.5, ...opts });
            const s = new THREE.Sprite(mat);
            s.center.set(0.5, 0);
            this.scene.add(s);
            return s;
        };
        const sprite  = makeSprite({});
        const ghost   = makeSprite({ transparent: true, depthWrite: false, depthFunc: THREE.GreaterDepth, opacity: 0.4 });
        ghost.renderOrder = 10;
        const outline = makeSprite({ transparent: true, depthWrite: false, alphaTest: 0.01 });
        outline.renderOrder = 4;
        outline.visible = false;

        const shadow = new THREE.Mesh(this._shadowGeo, this._shadowMat);
        shadow.rotation.x = -Math.PI / 2;
        shadow.renderOrder = 3;
        this.scene.add(shadow);

        const arrow = new THREE.Mesh(this._arrowGeo, new THREE.MeshBasicMaterial({
            color: unit.team === 'player' ? 0x99ddff : 0xff8888, depthTest: false, transparent: true, opacity: 0.95, side: THREE.DoubleSide,
        }));
        arrow.renderOrder = 30;
        this.scene.add(arrow);

        const tag = document.createElement('div');
        tag.className = 'tac3d-tag';
        tag.innerHTML = `<div class="tac3d-name ${unit.team === 'player' ? 'player' : 'enemy'}"></div>`
            + `<div class="tac3d-cname" style="display:none"></div><div class="tac3d-charge" style="display:none"><i></i></div>`
            + `<div class="tac3d-status"></div><div class="tac3d-bar tac3d-hp"><i></i></div><div class="tac3d-bar tac3d-mp"><i></i></div>`;
        this.overlay.appendChild(tag);

        return {
            sprite, ghost, outline, shadow, arrow, tag,
            els: {
                cname: tag.querySelector('.tac3d-cname'),
                charge: tag.querySelector('.tac3d-charge'),
                chargeFill: tag.querySelector('.tac3d-charge i'),
                status: tag.querySelector('.tac3d-status'),
                hp: tag.querySelector('.tac3d-hp i'),
                mpBar: tag.querySelector('.tac3d-mp'),
                mp: tag.querySelector('.tac3d-mp i'),
                name: tag.querySelector('.tac3d-name'),
            },
            src: null, outlineSrc: null, texture: null, outlineTexture: null,
            aspect: 1,
            last: {},
        };
    }

    _disposeUnitView(uv) {
        for (const s of [uv.sprite, uv.ghost, uv.outline]) { this.scene.remove(s); s.material.dispose(); }
        this.scene.remove(uv.shadow);
        this.scene.remove(uv.arrow);
        uv.arrow.material.dispose();
        uv.texture?.dispose();
        uv.outlineTexture?.dispose();
        uv.tag.remove();
    }

    // Flat letter fallback for units with no sprite image.
    _glyphCanvas(unit) {
        const c = document.createElement('canvas');
        c.width = c.height = 48;
        const g = c.getContext('2d');
        g.font = "bold 36px 'Courier New', monospace";
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.lineWidth = 5;
        g.strokeStyle = '#000';
        g.strokeText(unit.char || '?', 24, 26);
        g.fillStyle = unit.team === 'player' ? '#9df' : '#f76';
        g.fillText(unit.char || '?', 24, 26);
        return c;
    }

    _setTexture(uv, key, image) {
        // key is 'texture' or 'outlineTexture'; image is the 2D source.
        const srcKey = key === 'texture' ? 'src' : 'outlineSrc';
        if (uv[srcKey] === image) return;
        uv[key]?.dispose();
        uv[srcKey] = image;
        if (!image) { uv[key] = null; return; }
        const tex = new THREE.Texture(image);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.magFilter = THREE.NearestFilter;
        tex.minFilter = THREE.NearestFilter;
        tex.generateMipmaps = false;
        tex.needsUpdate = true;
        uv[key] = tex;
    }

    // Fraction of an image's height that is fully transparent along its bottom edge.
    _bottomPadding(image) {
        let pad = this._paddingCache.get(image);
        if (pad !== undefined) return pad;
        pad = 0;
        try {
            const w = image.naturalWidth || image.width, h = image.naturalHeight || image.height;
            if (w > 0 && h > 0) {
                const c = document.createElement('canvas');
                c.width = w; c.height = h;
                const g = c.getContext('2d', { willReadFrequently: true });
                g.drawImage(image, 0, 0);
                const data = g.getImageData(0, 0, w, h).data;
                let lastRow = -1;
                for (let y = h - 1; y >= 0 && lastRow < 0; y--) {
                    for (let x = 0; x < w; x++) if (data[(y * w + x) * 4 + 3] > 127) { lastRow = y; break; }
                }
                pad = lastRow < 0 ? 0 : (h - 1 - lastRow) / h;
            }
        } catch (e) {
            pad = 0;   // unreadable image (cross-origin): fall back to no adjustment
        }
        this._paddingCache.set(image, pad);
        return pad;
    }

    _unitPose(unit, map, now) {
        const vs = viewState(unit);
        const rp = getEntityRenderPos(unit, now);
        const x = rp.x, z = rp.y;
        const destTile = getTile(map, vs.vizX != null ? vs.vizX : unit.x, vs.vizY != null ? vs.vizY : unit.y);
        let y = terrainTopY(destTile);
        let hop = 0;
        if (isEntityMoving(unit) && vs.prevX != null) {
            const srcY = terrainTopY(getTile(map, vs.prevX, vs.prevY));
            const moveT = Math.min(1, (now - vs.moveStartTime) / (vs.moveDuration || 1));
            const eased = moveT * (2 - moveT);
            const diff = y - srcY;
            const amp = 0.06 + (diff > 0 ? diff * 0.55 : -diff * 1.0);
            const hopT = diff > 0 ? Math.min(moveT / 0.7, 1) : moveT;
            y = srcY + diff * eased;
            hop = Math.sin(hopT * Math.PI) * amp;
        }
        return { x, y, z, hop };
    }

    _updateUnits(units, activeUnit, map, dt, now) {
        const camDir = new THREE.Vector3();
        this.camera.getWorldDirection(camDir);
        const ppu = this._pixelsPerUnit();
        const projected = new THREE.Vector3();
        // Screen-up as a world vector: how to slide a billboard straight down on screen.
        const groundUp = this._groundBasis().up;
        const camUp = new THREE.Vector3(groundUp.x * Math.sin(PITCH), Math.cos(PITCH), groundUp.z * Math.sin(PITCH));

        for (const unit of units) {
            const uv = this._unitViews.get(unit);
            if (!uv) continue;
            const alive = isAlive(unit);
            uv.sprite.visible = uv.ghost.visible = alive;
            uv.shadow.visible = uv.arrow.visible = alive;
            uv.tag.style.display = alive ? '' : 'none';
            if (!alive) { uv.outline.visible = false; continue; }

            const ko = isUnconscious(unit);
            const pose = this._unitPose(unit, map, now);
            const vs = viewState(unit);

            // Textures. Composite canvases can be swapped by the skin manager, so compare each frame.
            let image = this.unitSprites.get(unit, false, null);
            if (!image) image = uv.glyph || (uv.glyph = this._glyphCanvas(unit));
            this._setTexture(uv, 'texture', image);
            const w = image.naturalWidth || image.width || 1;
            const h = image.naturalHeight || image.height || 1;
            uv.aspect = w / h;
            for (const m of [uv.sprite.material, uv.ghost.material]) {
                if (m.map !== uv.texture) { m.map = uv.texture; m.needsUpdate = true; }
            }
            uv.sprite.material.color.setHex(ko ? 0x777777 : 0xffffff);
            uv.ghost.material.color.setHex(ko ? 0x777777 : 0xffffff);

            // Idle sway and breathing, walk sway, and attack animation, mirroring the old 2D motion.
            const seed = (unit.id * 1619) || 0;
            const phaseSeed = (seed % 1000) / 1000 * 6.28;
            const moving = isEntityMoving(unit) && vs.moveDuration > 0;
            let sway;
            if (moving) {
                const moveT = Math.min(1, (now - vs.moveStartTime) / vs.moveDuration);
                sway = Math.sin(moveT * Math.PI * 2) * 0.09 * ((seed & 1) ? -1 : 1);
            } else {
                sway = Math.sin((now / 2600) * Math.PI * 2 + phaseSeed) * 0.02;
            }
            const breathe = (0.5 - 0.5 * Math.cos((now / 3200) * Math.PI * 2 + phaseSeed)) * 0.03;
            let offX = 0, offY = 0, offZ = 0, extraRot = 0, extraScale = 1;
            const a = vs.anim;
            if (a) {
                const t = Math.min(1, (now - a.startMs) / a.durationMs);
                if (t >= 1) vs.anim = null;
                else {
                    const arc = Math.sin(t * Math.PI);
                    if (a.type === 'slash') {
                        offX = a.dx * 0.25 * arc; offZ = a.dy * 0.25 * arc;
                        extraRot = -0.3 * (a.dx >= 0 ? 1 : -1) * arc;
                    } else if (a.type === 'cast') {
                        offY = 0.22 * arc; extraScale = 1 + 0.1 * arc;
                    } else if (a.type === 'shot') {
                        const pull = t < 0.5 ? -(t / 0.5) * 0.28 : -(1 - (t - 0.5) / 0.5) * 0.28;
                        offX = a.dx * pull; offZ = a.dy * pull;
                    }
                }
            }

            const sh = SPRITE_HEIGHT * extraScale * (1 + breathe);
            const sw = SPRITE_HEIGHT * uv.aspect * extraScale;
            // Sprite art leaves empty rows under the feet. Slide the quad down on screen by that
            // gap so the feet meet the ground (and the shadow) instead of floating above them.
            const drop = this._bottomPadding(image) * sh;
            const px = pose.x + offX - camUp.x * drop;
            const py = pose.y + pose.hop + offY - camUp.y * drop;
            const pz = pose.z + offZ - camUp.z * drop;
            for (const s of [uv.sprite, uv.ghost]) {
                s.position.set(px, py, pz);
                s.scale.set(sw, sh, 1);
                s.material.rotation = sway + extraRot;
            }
            uv.ghost.material.opacity = ko ? 0.25 : 0.4;

            // Selection glow for the acting unit, drawn as a larger outline just behind the sprite.
            const isActive = unit === activeUnit;
            uv.outline.visible = isActive;
            if (isActive) {
                const color = unit.team === 'player' ? '#ffee44' : '#ff4444';
                const outlined = this.unitSprites.get(unit, true, color);
                this._setTexture(uv, 'outlineTexture', outlined);
                if (outlined && uv.outlineTexture) {
                    if (uv.outline.material.map !== uv.outlineTexture) {
                        uv.outline.material.map = uv.outlineTexture;
                        uv.outline.material.needsUpdate = true;
                    }
                    uv.outline.material.opacity = (0.6 + 0.4 * Math.sin(this._pulse)) * (ko ? 0.5 : 1);
                    uv.outline.position.set(px, py, pz).addScaledVector(camDir, 0.02);
                    uv.outline.scale.set(sw * 1.08, sh * 1.08, 1);
                    uv.outline.material.rotation = sway + extraRot;
                } else uv.outline.visible = false;
            }

            // Ground contact: blob shadow and facing arrow.
            uv.shadow.position.set(pose.x, pose.y + 0.02, pose.z);
            // While walking, point along the current step. This is display only: the unit's
            // real facing was already settled by the movement logic.
            let facingName = unit.facing;
            if (moving && vs.prevX != null && vs.vizX != null) {
                facingName = facingForStep(vs.vizX - vs.prevX, vs.vizY - vs.prevY) || facingName;
            }
            const f = FACING_DIR[facingName] || FACING_DIR.south;
            let angle = Math.atan2(-f[1], f[0]);
            if (!moving && vs.prevFacing && vs.facingChangeAt) {
                const t = (now - vs.facingChangeAt) / FACING_TWEEN_MS;
                if (t < 1) {
                    const pf = FACING_DIR[vs.prevFacing] || f;
                    const from = Math.atan2(-pf[1], pf[0]);
                    let d = angle - from;
                    d = Math.atan2(Math.sin(d), Math.cos(d));
                    angle = from + d * (t * (2 - t));
                } else vs.prevFacing = null;
            }
            uv.arrow.rotation.y = angle;
            uv.arrow.position.set(pose.x + Math.cos(angle) * 0.42, pose.y + 0.04, pose.z - Math.sin(angle) * 0.42);
            uv.arrow.material.opacity = ko ? 0.4 : 0.95;

            this._updateTag(uv, unit, ko, projected.set(px, py + sh / Math.cos(PITCH) + 0.05, pz), isActive);
        }
    }

    _updateTag(uv, unit, ko, worldPos, isActive) {
        const { els, last } = uv;
        const set = (key, val, apply) => { if (last[key] !== val) { last[key] = val; apply(val); } };
        set('name', unit.name, v => { els.name.textContent = v; });
        set('hp', Math.max(0, Math.min(1, unit.hp / unit.maxHp)), v => { els.hp.style.width = (v * 100) + '%'; });
        set('hasMp', unit.maxMp > 0, v => { els.mpBar.style.display = v ? '' : 'none'; });
        if (unit.maxMp > 0) set('mp', Math.max(0, Math.min(1, unit.mp / unit.maxMp)), v => { els.mp.style.width = (v * 100) + '%'; });

        const ch = unit._charging;
        set('charging', !!ch, v => { els.charge.style.display = v ? '' : 'none'; els.cname.style.display = v ? '' : 'none'; });
        if (ch) {
            const color = unit.team === 'player' ? '#0ff' : '#c4f';
            set('chargeColor', color, v => { els.charge.style.color = v; els.cname.style.color = v; });
            set('chargeFrac', Math.min(1, ch.ct / ch.needed), v => { els.chargeFill.style.width = (v * 100) + '%'; });
            set('chargeName', ABILITIES[ch.ability]?.name || 'Charging', v => { els.cname.textContent = v; });
        }

        const marks = [];
        if (unit.status.includes('stun'))     marks.push('*');
        if (unit.status.includes('slow'))     marks.push('S');
        if (unit.status.includes('defend'))   marks.push('D');
        if (unit.status.includes('charging')) marks.push('!');
        if (ko) marks.push('KO');
        set('marks', marks.join(' '), v => { els.status.textContent = v; });

        worldPos.project(this.camera);
        const sx = (worldPos.x * 0.5 + 0.5) * this._width;
        const sy = (-worldPos.y * 0.5 + 0.5) * this._height;
        uv.tag.style.opacity = ko ? '0.55' : '1';
        // Zoomed far out, twelve tags would pile up. Shrink them with the zoom and drop the
        // names (keeping the bars) unless it is the acting unit.
        const zoomScale = Math.max(0.6, Math.min(1, this._tileSize / DEFAULT_TILE_SIZE));
        const showName = this._tileSize >= NAME_MIN_TILE_SIZE || isActive;
        set('showName', showName, v => { els.name.style.display = v ? '' : 'none'; });
        uv.tag.style.transform = `translate(${Math.round(sx)}px, ${Math.round(sy)}px) translate(-50%, -100%) scale(${zoomScale.toFixed(2)})`;
        uv.tag.style.transformOrigin = '50% 100%';
    }

    // ---- Projectiles and floating text --------------------------------------

    _updateProjectiles(map, now) {
        for (let i = this._projectiles.length - 1; i >= 0; i--) {
            const p = this._projectiles[i];
            const t = (now - p.startMs) / p.durationMs;
            if (t >= 1) {
                this.scene.remove(p.sprite);
                p.sprite.material.dispose();
                this._projectiles.splice(i, 1);
                continue;
            }
            const x = p.sx + (p.tx - p.sx) * t;
            const z = p.sy + (p.ty - p.sy) * t;
            const y0 = terrainTopY(getTile(map, p.sx, p.sy)), y1 = terrainTopY(getTile(map, p.tx, p.ty));
            const y = y0 + (y1 - y0) * t + 0.55 + Math.sin(t * Math.PI) * 0.15;
            p.sprite.position.set(x, y, z);
            p.sprite.material.opacity = t < 0.1 ? t * 10 : t > 0.85 ? (1 - t) / 0.15 : 1;
        }
    }

    _updateFloats(units, map, dt) {
        const v = new THREE.Vector3();
        for (const unit of units) {
            const floats = viewState(unit).floats;
            if (floats.length === 0) continue;
            const top = terrainTopY(getTile(map, unit.x, unit.y)) + SPRITE_HEIGHT + 0.25;
            for (let i = floats.length - 1; i >= 0; i--) {
                const f = floats[i];
                f.age += dt;
                if (f.age >= f.maxAge) { f.el?.remove(); floats.splice(i, 1); continue; }
                if (!f.el) {
                    f.el = document.createElement('div');
                    f.el.className = 'tac3d-float';
                    f.el.textContent = f.text;
                    f.el.style.color = f.color;
                    this.overlay.appendChild(f.el);
                }
                const progress = f.age / f.maxAge;
                v.set(unit.x, top, unit.y).project(this.camera);
                const sx = (v.x * 0.5 + 0.5) * this._width;
                const sy = (-v.y * 0.5 + 0.5) * this._height - progress * 38;
                f.el.style.opacity = String(1 - progress);
                f.el.style.transform = `translate(${Math.round(sx)}px, ${Math.round(sy)}px) translate(-50%, -100%)`;
            }
        }
    }

    // ---- HUD -----------------------------------------------------------------

    _buildCompass() {
        const bar = document.createElement('div');
        bar.className = 'tac3d-compass';
        const mk = (label, title, fn) => {
            const b = document.createElement('button');
            b.textContent = label;
            b.title = title;
            b.addEventListener('click', (e) => { e.stopPropagation(); fn(); });
            b.addEventListener('mousedown', (e) => e.stopPropagation());
            bar.appendChild(b);
            return b;
        };
        mk('↺', 'Rotate left (Q)',  () => this.rotateView(-1));
        mk('◎', 'Fit whole map / center on unit (F)', () => { if (this._tracking) this.onCenterRequest?.(); else this.fitToMap(); });
        mk('↻', 'Rotate right (E)', () => this.rotateView(1));
        this._freeButton = mk('⤢', 'Free camera on/off (V). On: whole map, no auto-follow', () => this.setFreeCamera(this._tracking));
        this._freeButton.classList.toggle('active', !this._tracking);
        this.overlay.appendChild(bar);
        this._compass = bar;
    }
}
