import * as THREE from '../../lib/three/three.module.js';
import { getCell, topCell, standZ } from './battle-map.js';
import { terrainTopY, blockTopY, SLAB_BOTTOM } from './tile-render.js';
import { QuadBatch, buildTerrainMesh, updateTerrainFx, terrainSignature, decodeOwner, cellForBlock, TerrainShaker } from './terrain-mesh.js';
import { STATES } from './battle.js';
import { ABILITIES } from './abilities.js';
import { getEntityRenderPos, isEntityMoving } from '../systems/movement-lerp.js';
import { isAlive, isUnconscious, facingForStep } from './units.js';
import { viewState } from './view-state.js';
import { UnitSprites } from './unit-sprites.js';
import { BattleFx } from './battle-fx.js';
import { perfSettings, pixelRatio } from '../core/perf-settings.js';
import {
    abilityColors, projectileSprite, impactSprite, meleeSprite, isHeavyHit, hitShake, statusSprite, areaStyle,
    HEAL_COLORS, BUFF_COLORS, DEATH_COLORS, POISON_COLORS, PHYSICAL_SPARKS,
} from './fx-presets.js';

/**
 * Real-3D battle view: terrain is built from the map's blocks (see terrain-mesh.js),
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
// Background behind the map when its realm look doesn't set one.
const DEFAULT_SKY = 0x161a26;
const PAN_SPEED = 6;             // tiles per second at tileSize 48
const CAMERA_DISTANCE = 60;
const ROTATE_EASE_MS = 70;
const FACING_TWEEN_MS = 180;
// Unit motion for reactions, after Rifthold's expedition view (durations at 1x speed).
const RECOIL_MS = 260;     // knocked back from a hit, squashed and tilted
const DODGE_MS = 240;      // a quick hop when an attack misses
const FLASH_MS = 200;      // white silhouette on a hit
const TOPPLE_MS = 450;     // falling over when knocked out
const RISE_MS = 300;       // getting back up when revived
const VANISH_MS = 500;     // a dead unit sinks away after falling
const SPAWN_MS = 400;      // a summon scales in
const LYING_ANGLE = 1.35;  // radians: lying on the ground

// What plays on each tile an area ability hits (see fxArea and fx-presets.areaStyle).
// at: the center of the tile's top surface. ms(n) scales a duration for the playback speed.
const AREA_KINDS = {
    // Earth: dust thrown up and chunks of ground that fall back.
    quake: (fx, at, colors) => {
        fx.burst(at, { layer: 'debris', count: 9, colors, speed: [0.2, 0.8], up: [1.4, 2.6], gravity: 5, life: [0.6, 0.9], radius: 0.4, floor: at.y });
        fx.burst({ ...at, y: at.y + 0.1 }, { layer: 'cloud', count: 5, colors: ['#e0cfae', '#bfa883', '#9a8466'], speed: [0.1, 0.35], up: [0.2, 0.5], gravity: -0.05, drag: 0.97, life: [0.8, 1.3], radius: 0.4, alpha: 0.75 });
    },
    // Fire: a lick of flame and embers rising.
    flames: (fx, at, colors, ms) => {
        fx.sprite('fire', { ...at, y: at.y + 0.3 }, { ms: ms(560), size: 0.65, grow: 0.2, rise: 0.3, additive: true, popIn: ms(60) });
        fx.burst({ ...at, y: at.y + 0.15 }, { layer: 'glow', count: 4, colors, speed: [0.05, 0.2], up: [0.6, 1.1], gravity: -0.1, life: [0.4, 0.7], radius: 0.3, alpha: 0.7 });
        fx.burst({ ...at, y: at.y + 0.1 }, { layer: 'spark', count: 8, colors, speed: [0.05, 0.3], up: [0.8, 1.6], gravity: -0.2, life: [0.4, 0.8], radius: 0.35, wobble: 0.05 });
        fx.burst({ ...at, y: at.y + 0.5 }, { layer: 'cloud', count: 2, colors: ['#5a504a', '#3a3430'], speed: [0.05, 0.15], up: [0.4, 0.7], drag: 0.97, life: [0.8, 1.1], radius: 0.25, alpha: 0.35 });
    },
    // Ice: a frost crystal, and flakes drifting down.
    frost: (fx, at, colors, ms) => {
        fx.sprite('freezing', { ...at, y: at.y + 0.3 }, { ms: ms(600), size: 0.4, grow: 0.1, popIn: ms(80) });
        fx.burst({ ...at, y: at.y + 0.9 }, { layer: 'mote', count: 6, colors, speed: [0.05, 0.2], up: [-0.4, -0.2], life: [0.6, 0.9], radius: 0.4, wobble: 0.05 });
    },
    // Thunder: a bright crack and sparks skittering off the ground.
    storm: (fx, at, colors) => {
        fx.burst({ ...at, y: at.y + 0.1 }, { layer: 'glow', count: 2, colors: ['#ffffff', colors[1]], speed: [0, 0.05], up: [0, 0.1], life: [0.12, 0.22], radius: 0.05, alpha: 0.9 });
        fx.burst({ ...at, y: at.y + 0.05 }, { layer: 'spark', count: 10, colors, speed: [1, 2.2], up: [0.2, 0.9], gravity: 2, life: [0.15, 0.35], radius: 0.1 });
        fx.burst({ ...at, y: at.y + 0.6 }, { layer: 'spark', count: 4, colors: ['#ffffff'], speed: [0, 0.1], up: [-2.5, -1.5], life: [0.12, 0.2], radius: 0.05 });
    },
    // Holy: a column of light motes rising.
    light: (fx, at, colors) => {
        fx.burst(at, { layer: 'mote', count: 9, colors, speed: [0, 0.08], up: [1, 1.8], gravity: -0.3, life: [0.5, 0.9], radius: 0.3 });
        fx.burst({ ...at, y: at.y + 0.2 }, { layer: 'glow', count: 3, colors, speed: [0, 0.05], up: [0.8, 1.4], life: [0.5, 0.8], radius: 0.1, alpha: 0.6 });
    },
    // Void, shadow, spirit, arcane: motes swirling up and away.
    arcane: (fx, at, colors) => {
        fx.burst({ ...at, y: at.y + 0.2 }, { layer: 'glow', count: 2, colors, speed: [0.05, 0.2], up: [0.3, 0.6], life: [0.5, 0.8], radius: 0.2, alpha: 0.6 });
        fx.burst({ ...at, y: at.y + 0.15 }, { layer: 'mote', count: 9, colors, speed: [0.3, 0.7], up: [0.4, 0.9], gravity: 0.2, life: [0.5, 0.8], radius: 0.25, wobble: 0.06 });
    },
    // Nature: a slow cloud of spores that hangs over the tile.
    spores: (fx, at, colors) => {
        fx.burst({ ...at, y: at.y + 0.2 }, { layer: 'mote', count: 8, colors, speed: [0.05, 0.25], up: [0.1, 0.35], gravity: -0.02, life: [0.9, 1.4], radius: 0.4, wobble: 0.08, alpha: 0.7 });
        fx.burst({ ...at, y: at.y + 0.25 }, { layer: 'cloud', count: 3, colors, speed: [0.05, 0.2], up: [0.05, 0.2], drag: 0.97, life: [1, 1.5], radius: 0.35, alpha: 0.4 });
    },
    // Alchemy: droplets splashing up and falling back.
    splash: (fx, at, colors) => {
        fx.burst({ ...at, y: at.y + 0.05 }, { layer: 'spark', count: 10, colors, speed: [0.5, 1.2], up: [0.8, 1.5], gravity: 4, life: [0.35, 0.6], radius: 0.2, floor: at.y });
    },
    // Volleys and wide swings: impacts throwing up dust.
    impact: (fx, at, colors) => {
        fx.burst({ ...at, y: at.y + 0.05 }, { layer: 'debris', count: 6, colors: ['#c8b8a0', '#8a7a66'], speed: [0.3, 0.8], up: [0.6, 1.2], gravity: 4, life: [0.3, 0.5], radius: 0.3, floor: at.y });
        fx.burst({ ...at, y: at.y + 0.1 }, { layer: 'spark', count: 4, colors, speed: [0.6, 1.2], up: [0.2, 0.6], life: [0.15, 0.3], radius: 0.2 });
    },
    // Heals and boons on the group: gentle motes rising.
    blessing: (fx, at, colors) => {
        fx.burst(at, { layer: 'mote', count: 6, colors, speed: [0, 0.1], up: [0.6, 1.1], gravity: -0.2, life: [0.6, 0.9], radius: 0.35, wobble: 0.04 });
    },
    // Orders: a brief golden ring of sparks.
    rally: (fx, at, colors) => {
        fx.burst({ ...at, y: at.y + 0.1 }, { layer: 'spark', count: 6, colors, speed: [0.5, 0.8], up: [0.1, 0.3], life: [0.25, 0.4], radius: 0.05 });
    },
};
const NAME_MIN_TILE_SIZE = 34;   // below this zoom, only the acting unit shows a name

const FACING_DIR = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] };

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
        // Settings > Graphics > Render resolution caps this; _resize() follows changes.
        this._pixelRatio = pixelRatio();
        this.renderer.setPixelRatio(this._pixelRatio);
        this.renderer.setClearColor(DEFAULT_SKY, 1);

        this.scene  = new THREE.Scene();
        this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, CAMERA_DISTANCE * 3);
        this._ray   = new THREE.Raycaster();

        this._tileSize = DEFAULT_TILE_SIZE;
        this._insets   = { left: 0, right: 190, top: 0, bottom: 0 };
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
        this._terrain = null;          // from buildTerrainMesh: {group, pickMeshes, fx, dispose}
        this._textures = new WeakMap();
        this._ownedTextures = new Set();
        this._paddingCache = new WeakMap();
        this._unitViews = new Map();
        this._projectiles = [];

        this._glowTexture = makeGlowTexture();
        this._timeScale = 1;
        this._silhouettes = new WeakMap();   // sprite image -> white silhouette canvas
        this.fx = new BattleFx(this.scene, (category, key) => {
            const sm = this.skinManager;
            const image = sm && sm.isActive ? sm.getSprite(category, key) : null;
            return image ? this._textureFor(image) : null;
        });
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

    // Screen pixel the camera target is drawn at: the middle of the area the HUD leaves free.
    _targetScreen() {
        const offX = (this._insets.left - this._insets.right) / 2;
        const offY = ((this._insets.bottom || 0) - (this._insets.top || 0)) / 2;
        return { x: this._width / 2 + offX, y: this._height / 2 - offY };
    }

    /**
     * The camera as it is now: target, zoom, orbit, and where on screen the target sits. Hand
     * it to another view's setCameraState to carry the view across (deploy to battle).
     */
    getCameraState() {
        return {
            target: { x: this._target.x, y: this._target.y, z: this._target.z },
            tileSize: this._tileSize,
            azSteps: this._azTargetSteps,
            tracking: this._tracking,
            screen: this._targetScreen(),
        };
    }

    /**
     * Takes over a camera from getCameraState instead of framing the whole map. The map stays
     * on the same pixels even if this view's HUD panels differ: on the first frame the target
     * is shifted so the old target lands where it was drawn before.
     */
    setCameraState(state) {
        if (!state?.target) return;
        this._tracking = !!state.tracking;
        this._target.set(state.target.x, state.target.y, state.target.z);
        this._tileSize = Math.max(this._tracking ? 24 : 8, Math.min(80, state.tileSize ?? this._tileSize));
        this._azSteps = this._azTargetSteps = state.azSteps ?? 0;
        this._fitPending = false;
        this._desired = null;
        this._autoCenterNext = false;
        this._restoreScreen = state.screen ?? null;
    }

    // Moves the target so the point now drawn at the target pixel ends up at `screen` instead:
    // recentering on the ground point under pixel 2p - q carries what is at p over to q.
    _alignToScreen(screen) {
        const p = this._targetScreen();
        const px = 2 * p.x - screen.x, py = 2 * p.y - screen.y;
        if (Math.abs(px - p.x) < 0.5 && Math.abs(py - p.y) < 0.5) return;
        const ndc = new THREE.Vector2((px / this._width) * 2 - 1, -(py / this._height) * 2 + 1);
        this._ray.setFromCamera(ndc, this.camera);
        const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), -this._target.y);
        const hit = new THREE.Vector3();
        if (this._ray.ray.intersectPlane(ground, hit)) { this._target.x = hit.x; this._target.z = hit.z; }
    }

    /** Shows or hides the free camera button (the deploy screen has nothing to track). */
    showFreeCameraButton(visible) {
        if (this._freeButton) this._freeButton.style.display = visible ? '' : 'none';
    }

    /** Space the HUD takes on each side, so the map centers in the visible area. */
    setInsets(left, right, top = 0, bottom = 0) { this._insets = { left, right, top, bottom }; }

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

        const meshes = this._terrain ? this._terrain.pickMeshes : [];
        const terrainHit = this._ray.intersectObjects(meshes, false)[0];

        // Walkable terrain clearly nearer the camera than the unit (a plateau in front of it)
        // wins. Impassable terrain such as a wall never hides a unit from selection, because
        // nothing can stand there and the ghost silhouette shows the player where the unit is.
        const NEAR_TOLERANCE = 0.4;
        let terrainTile = null;
        if (terrainHit && map) {
            const id = terrainHit.object.userData.owners[terrainHit.faceIndex >> 1];
            if (id !== undefined) {
                const b = decodeOwner(map, id);
                terrainTile = cellForBlock(map, b.x, b.y, b.z);
            }
        }
        const terrainBlocksUnit = terrainHit && terrainTile && terrainTile.passable
            && unitHit && unitHit.distance > terrainHit.distance + NEAR_TOLERANCE;
        if (unitHit && !terrainBlocksUnit) {
            const unit = byObject.get(unitHit.object);
            return { x: unit.x, y: unit.y, z: unit.z };
        }
        if (terrainTile) return { x: terrainTile.x, y: terrainTile.y, z: terrainTile.z };
        return null;
    }

    // ---- Effects -------------------------------------------------------------

    /**
     * Fires a glowing projectile between two positions ({x, y, z}). A missing z means the
     * standing cell of that column nearest the other end's level.
     */
    spawnProjectile(from, to, color, durationMs, abilityKey = null) {
        const map = this._map;
        const sz = from.z ?? (map ? standZ(map, from.x, from.y, to.z ?? null) : 0);
        const tz = to.z ?? (map ? standZ(map, to.x, to.y, sz) : 0);
        const ends = { sx: from.x, sy: from.y, sz, tx: to.x, ty: to.y, tz };
        // A glow, plus the skin's projectile art pointing along the flight when it has one.
        const art = projectileSprite(abilityKey);
        const artTex = art ? this.fx.effectTexture('effects', art) : null;
        const mat = new THREE.SpriteMaterial({ map: this._glowTexture, color: new THREE.Color(color), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
        const sprite = new THREE.Sprite(mat);
        const glowSize = artTex && art === 'projectile_arrow' ? 0.22 : 0.5;
        sprite.scale.set(glowSize, glowSize, 1);
        sprite.renderOrder = 20;
        this.scene.add(sprite);
        let head = null;
        if (artTex) {
            head = new THREE.Sprite(new THREE.SpriteMaterial({ map: artTex, transparent: true, depthTest: false, depthWrite: false }));
            head.scale.set(0.55, 0.55, 1);
            head.renderOrder = 21;
            this.scene.add(head);
        }
        // Thrown stones arc higher and tumble; arrows and spells fly flatter.
        const thrown = !art && ABILITIES[abilityKey]?.animType === 'shot';
        this._projectiles.push({
            ...ends, sprite, head, glowSize, colors: abilityColors(abilityKey), thrown,
            arc: thrown ? 0.45 : 0.15, startMs: performance.now(), durationMs: durationMs || 500,
        });
    }

    /** Effects play at the battle's playback speed (1, 2, 4...). */
    setTimeScale(scale) {
        this._timeScale = Math.max(0.1, scale || 1);
    }

    // Chest height of a unit, where hits and spells land.
    _fxPoint(unit, lift = 0.45) {
        const pose = this._map ? this._unitPose(unit, this._map, performance.now()) : { x: unit.x, y: 0, z: unit.y };
        return { x: pose.x, y: pose.y + lift, z: pose.z };
    }

    // Ground direction from a to b ({x, y} grid), normalized, as world {x, z}.
    _dirBetween(a, b) {
        const dx = (b?.x ?? 0) - (a?.x ?? 0), dz = (b?.y ?? 0) - (a?.y ?? 0);
        const len = Math.hypot(dx, dz) || 1;
        return { x: dx / len, z: dz / len };
    }

    // Screen angle of a ground direction, for art that points right.
    _screenAngle(from, dir) {
        const a = new THREE.Vector3(from.x, from.y, from.z).project(this.camera);
        const b = new THREE.Vector3(from.x + dir.x, from.y, from.z + dir.z).project(this.camera);
        return Math.atan2((b.y - a.y) * this._height, (b.x - a.x) * this._width);
    }

    /**
     * An ability starts: a melee swoosh in front of the attacker, or a cast sparkle with motes
     * rising in the spell's colors. (Projectiles are spawned separately, see spawnProjectile.)
     */
    fxAbility(source, target, abilityKey) {
        const ab = ABILITIES[abilityKey];
        if (!ab || !source) return;
        const at = this._fxPoint(source);
        const ms = (n) => n / this._timeScale;
        if ((ab.animType || 'slash') === 'slash') {
            const dir = this._dirBetween(source, target);
            const start = { x: at.x + dir.x * 0.3, y: at.y, z: at.z + dir.z * 0.3 };
            // Rifthold: starts 0.3 tile out and slides 0.5 more, fading over the last 40%.
            this.fx.sprite(meleeSprite(abilityKey), start, { ms: ms(170), size: 0.65, slide: { x: dir.x * 0.5, y: 0, z: dir.z * 0.5 },
                rotation: this._screenAngle(start, dir), fadeFrom: 0.6 });
        } else if (ab.animType === 'cast') {
            const colors = abilityColors(abilityKey);
            this.fx.sprite('spell_cast', { ...at, y: at.y + 0.55 }, { ms: ms(380), size: 0.35, grow: 0.25, rise: 0.15, additive: true, popIn: ms(80) });
            this.fx.burst({ ...at, y: at.y - 0.3 }, { layer: 'mote', count: 8, colors, speed: [0.15, 0.4], up: [0.6, 1.1],
                gravity: 0.4, life: [0.4, 0.7], radius: 0.25, wobble: 0.03 });
        }
    }

    /** Effects for a battle event (TacticalBattle.onEvent): hits, misses, heals, buffs, statuses. */
    fxEvent(type, data = {}) {
        const { source, target, ability } = data;
        const ms = (n) => n / this._timeScale;
        const now = performance.now();
        if (type === 'area') { this.fxArea(data); return; }
        if (type === 'summon' && data.unit) {
            const vs = viewState(data.unit);
            vs.spawnAt = now;
            const at = this._fxPoint(data.unit, 0.2);
            this.fx.sprite('summon_arrive', at, { ms: ms(600), size: 0.4, grow: 0.9, additive: true });
            this.fx.burst(at, { layer: 'mote', count: 12, colors: abilityColors(ability), speed: [0.4, 0.9], up: [0.3, 0.9], gravity: 0.6, life: [0.4, 0.8] });
            return;
        }
        if (!target) return;
        const vs = viewState(target);
        const at = this._fxPoint(target);
        if (type === 'hit') {
            const dir = this._dirBetween(source, target);
            const heavy = isHeavyHit(data.damage, target);
            vs.react = { type: 'recoil', dx: dir.x, dz: dir.z, side: dir.x >= 0 ? -1 : 1, startMs: now, durationMs: ms(RECOIL_MS) };
            vs.flash = { startMs: now, durationMs: ms(FLASH_MS) };
            const magic = ABILITIES[ability]?.type === 'magic';
            // Rifthold's melee spray: a fan away from the attacker that falls to the ground.
            this.fx.burst(at, { layer: magic ? 'spark' : 'debris', count: heavy ? 12 : 7, colors: magic ? abilityColors(ability) : PHYSICAL_SPARKS,
                dir: magic ? null : dir, spread: 0.45 * Math.PI, speed: [0.6, 1.5], up: [0.1, 0.6], gravity: magic ? 0.2 : 2.4,
                life: [0.3, 0.55], floor: at.y - 0.45 });
            this.fx.sprite(impactSprite(ability), at, { ms: ms(heavy ? 260 : 200), size: heavy ? 0.6 : 0.45, grow: 0.25, additive: magic, popIn: ms(40) });
            this.fx.shake(hitShake(data.damage, target));
        } else if (type === 'miss') {
            const dir = this._dirBetween(source, target);
            // Sidestep, perpendicular to the attack.
            vs.react = { type: 'dodge', dx: -dir.z, dz: dir.x, startMs: now, durationMs: ms(DODGE_MS) };
            this.fx.sprite('shield_block', at, { ms: ms(260), size: 0.4, grow: 0.15, popIn: ms(40) });
        } else if (type === 'heal' || type === 'revive') {
            this.fx.sprite('spell_heal', at, { ms: ms(600), size: 0.4, rise: 0.4, popIn: ms(80) });
            this.fx.burst({ ...at, y: at.y - 0.35 }, { layer: 'mote', count: type === 'revive' ? 16 : 9, colors: HEAL_COLORS,
                speed: [0.05, 0.25], up: [0.5, 0.9], gravity: -0.2, life: [0.6, 0.9], radius: 0.3, wobble: 0.04 });
        } else if (type === 'buff') {
            this.fx.sprite('spell_buff', at, { ms: ms(600), size: 0.4, rise: 0.45, popIn: ms(80) });
            this.fx.burst({ ...at, y: at.y - 0.35 }, { layer: 'mote', count: 8, colors: BUFF_COLORS, speed: [0.05, 0.2],
                up: [0.5, 0.9], gravity: -0.2, life: [0.5, 0.8], radius: 0.3 });
        } else if (type === 'status') {
            const art = statusSprite(data.status);
            if (art) this.fx.sprite(art, { ...at, y: at.y + 0.25 }, { ms: ms(650), size: 0.42, grow: 0.12, rise: 0.15, popIn: ms(90) });
        }
    }

    /**
     * An area ability lands (TacticalBattle 'area' event): every tile it covers glows briefly
     * and plays the ability's style (fx-presets.areaStyle), rippling out from the center. Earth
     * spells also make the tiles themselves heave (TerrainShaker), and the camera with them.
     */
    fxArea({ ability, cells, center } = {}) {
        if (!this._map || !cells?.length) return;
        const style = areaStyle(ability);
        const ms = (n) => n / this._timeScale;
        const ring = (x, y) => Math.abs(x - center.x) + Math.abs(y - center.y);
        const parsed = cells.map(k => { const [x, y, z] = k.split(',').map(Number); return { key: k, x, y, z }; });
        const radius = Math.max(1, ...parsed.map(c => ring(c.x, c.y)));
        const RIPPLE_MS = 70;   // per tile of distance from the center
        for (const c of parsed) {
            const top = terrainTopY(getCell(this._map, c.x, c.y, c.z) ?? { z: c.z });
            const at = { x: c.x, y: top, z: c.y };
            const delay = ms(ring(c.x, c.y) * RIPPLE_MS);
            this.fx.later(delay, () => {
                this.fx.tileFlash(at, style.flash, { ms: ms(480) });
                AREA_KINDS[style.kind]?.(this.fx, at, style.colors, ms);
            });
        }
        if (style.quake > 0 && this._shaker) {
            this._shaker.quake(parsed.map(c => ({ key: c.key, delay: ms(ring(c.x, c.y) * RIPPLE_MS) })),
                { amp: style.quake, ms: ms(620) });
            this.fx.shake(Math.min(0.18, style.quake * (0.6 + 0.25 * radius)));
        }
    }

    /** A unit has just gone down: a puff, a rising skull if it died, and a jolt for the party. */
    fxDown(unit) {
        const ms = (n) => n / this._timeScale;
        const at = this._fxPoint(unit, 0.3);
        this.fx.burst(at, { layer: 'debris', count: 14, colors: DEATH_COLORS, speed: [0.3, 0.9], up: [0.2, 0.8],
            gravity: 1.6, life: [0.45, 0.8], radius: 0.15, floor: at.y - 0.3 });
        // Rifthold's death marker: floats up and grows from half size, fading in its second half.
        if (unit.status.includes('dead')) this.fx.sprite('death', { ...at, y: at.y + 0.3 }, { ms: ms(1100), size: 0.3, grow: 0.3, rise: 0.5, fadeFrom: 0.5 });
        this.fx.shake(unit.team === 'player' ? 0.1 : 0.05);
    }

    /** The battle is won or lost: the winners bounce for joy. */
    fxCheer(team, units) {
        const now = performance.now();
        for (const u of units) if (u.team === team) viewState(u).cheerAt = now + (u.id % 5) * 90;
    }

    /** A boss or elite steps up: a big jolt. */
    fxAlert(amount = 0.18) {
        this.fx.shake(amount);
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
        this._shaker?.update(now);
        // Grass sway and water shimmer are ambient: below Full effects they hold still, but a
        // quake (the shaker) still moves the tiles it shakes. One more update once a quake
        // ends puts the grass back on the settled ground.
        const terrainFxLive = perfSettings().effects === 'full' || !!this._shaker?.busy;
        if (terrainFxLive || this._terrainFxLive) {
            updateTerrainFx(this._terrain?.fx, now, this._shaker?.busy ? (key) => this._shaker.offsetAt(key, now) : null);
        }
        this._terrainFxLive = terrainFxLive;
        this._updateHighlights(battle);
        this._updateUnits(units, activeUnit, map, dt, now);
        this._updateProjectiles(map, now);
        this.fx.update(dt * this._timeScale, this._pixelsPerUnit());
        this._updateFloats(units, map, dt);

        this.renderer.render(this.scene, this.camera);
    }

    /**
     * True while something on screen is still moving on its own: effects, projectiles,
     * floating numbers, a walking unit, a camera glide or turn, a quake, or a pan in progress.
     * Low power when idle only slows down once this is false.
     * @param {object[]} units  The battle's units.
     */
    isBusy(units) {
        const keys = this._panKeys;
        return this.fx.busy
            || this._projectiles.length > 0
            || this._desired != null
            || this._azTargetSteps !== this._azSteps
            || !!this._shaker?.busy
            || this._panning || keys.left || keys.right || keys.up || keys.down
            || units.some(u => isEntityMoving(u) || viewState(u).floats.length > 0);
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
        this.fx.dispose();
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
            const groundY = terrainTopY(topCell(map, Math.round(this._target.x), Math.round(this._target.z)));
            this._target.y += (groundY - this._target.y) * Math.min(1, dt / 120);
        }

        // Ease the orbit to the requested quarter turn.
        const diff = this._azTargetSteps - this._azSteps;
        if (Math.abs(diff) < 0.001) this._azSteps = this._azTargetSteps;
        else this._azSteps += diff * (1 - Math.exp(-dt / ROTATE_EASE_MS));

        this._poseCamera();
        // A camera handed over from another view (setCameraState) lands where it was on screen.
        if (this._restoreScreen) {
            this._alignToScreen(this._restoreScreen);
            this._restoreScreen = null;
            this._poseCamera();
        }
    }

    // Places the camera for the current target, orbit, zoom and shake.
    _poseCamera() {
        const az = this._azimuth();
        const cam = this.camera;
        cam.position.set(
            this._target.x + Math.sin(az) * Math.cos(PITCH) * CAMERA_DISTANCE,
            this._target.y + Math.sin(PITCH) * CAMERA_DISTANCE,
            this._target.z + Math.cos(az) * Math.cos(PITCH) * CAMERA_DISTANCE
        );
        // Shake moves eye and target together, so the view jolts sideways without tilting.
        const shake = this.fx.shakeOffset();
        const look = this._target.clone();
        if (shake.x || shake.y) {
            const { right } = this._groundBasis();
            const offset = right.multiplyScalar(shake.x).add(new THREE.Vector3(0, shake.y, 0));
            cam.position.add(offset);
            look.add(offset);
        }
        cam.lookAt(look);
        cam.updateMatrixWorld();
        this._applyFrustum();
    }

    // Frames the whole map: zoom so the rotated map's silhouette fits the free area of the
    // canvas, and center on it. Uses the same projection as the camera (see _groundBasis).
    _fitToMap(map) {
        this._fitPending = false;
        if (!map) return;
        let maxTop = 0;
        for (const c of map.cells) maxTop = Math.max(maxTop, blockTopY(c.z));
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
        const availH = Math.max(100, this._height - this._insets.top - this._insets.bottom - 70);   // and the top HUD
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
        const offY = ((this._insets.bottom || 0) - (this._insets.top || 0)) / 2;
        const cam = this.camera;
        cam.left   = (-w / 2 - off) / ppu;
        cam.right  = ( w / 2 - off) / ppu;
        cam.top    = (h / 2 - offY) / ppu;
        cam.bottom = (-h / 2 - offY) / ppu;
        cam.updateProjectionMatrix();
    }

    _resize() {
        const rect = this.container.getBoundingClientRect();
        const w = Math.max(Math.floor(rect.width), 200);
        const h = Math.max(Math.floor(rect.height), 200);
        const ratio = pixelRatio();
        if (w !== this._width || h !== this._height || ratio !== this._pixelRatio) {
            this._width = w;
            this._height = h;
            if (ratio !== this._pixelRatio) {
                this._pixelRatio = ratio;
                this.renderer.setPixelRatio(ratio);
            }
            this.renderer.setSize(w, h, false);
        }
        const compassRight = this._insets.right + 16;
        this._compass.style.right = compassRight + 'px';
        this._compass.style.left = 'auto';
    }

    // ---- Terrain -------------------------------------------------------------

    _syncTerrain(map) {
        // Include the skin so terrain textures appear if the skin finishes loading after entry.
        const sm = this.skinManager;
        const sig = `${terrainSignature(map)}:${sm && sm.isActive ? sm.activeSkin : ''}`;
        if (this._terrain && this._terrainSig === sig && this._terrain.map === map) return;
        this._clearTerrain();
        this.renderer.setClearColor(new THREE.Color(map.look?.sky ?? DEFAULT_SKY), 1);
        this._terrain = buildTerrainMesh(map, this.skinManager, image => this._textureFor(image));
        this._terrain.map = map;
        // Tiles still quaking keep shaking across a rebuild (Stone Wall reshapes the ground mid-quake).
        const quaking = this._shaker?.active;
        this._shaker = new TerrainShaker(this._terrain, map);
        if (quaking) for (const [k, q] of quaking) if (this._shaker.cells.has(k)) this._shaker.active.set(k, q);
        this._terrainSig = sig;
        this.scene.add(this._terrain.group);
    }

    _clearTerrain() {
        if (!this._terrain) return;
        this.scene.remove(this._terrain.group);
        this._terrain.dispose();
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

        for (const cell of map.cells) {
            const { x, y } = cell;
            const key = `${x},${y},${cell.z}`;
            let kind = null;
            if (hit && hit.has(key)) kind = 'hit';
            else if (aoe.has(key)) kind = 'aoe';
            else if (ability.has(key)) kind = 'ability';
            else if (showHover && key === hoverKey) kind = 'hover';
            else if (move.has(key)) kind = 'move';
            if (!kind) continue;

            const style = HIGHLIGHTS[kind];
            // Cheap fingerprint of which tile has which highlight, to skip needless GPU uploads.
            hash = (hash * 31 + cell.index * 8 + KIND_INDEX[kind]) | 0;

            const ty = terrainTopY(cell) + 0.02;
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
        // White silhouette laid over the sprite for an instant when the unit is hit.
        const flash = makeSprite({ transparent: true, depthWrite: false, alphaTest: 0.01, opacity: 0 });
        flash.renderOrder = 11;
        flash.visible = false;

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
            sprite, ghost, outline, flash, shadow, arrow, tag,
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
        for (const s of [uv.sprite, uv.ghost, uv.outline, uv.flash]) { this.scene.remove(s); s.material.dispose(); }
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
        const cellY = (x, y, z) => {
            const c = getCell(map, x, y, z);
            return c ? terrainTopY(c) : blockTopY(z ?? 0);
        };
        let y = vs.vizX != null ? cellY(vs.vizX, vs.vizY, vs.vizZ ?? unit.z) : cellY(unit.x, unit.y, unit.z);
        let hop = 0;
        if (isEntityMoving(unit) && vs.prevX != null) {
            const srcY = cellY(vs.prevX, vs.prevY, vs.prevZ ?? unit.z);
            const moveT = Math.min(1, (now - vs.moveStartTime) / (vs.moveDuration || 1));
            const eased = moveT * (2 - moveT);
            const diff = y - srcY;
            const amp = 0.06 + (diff > 0 ? diff * 0.55 : -diff * 1.0);
            const hopT = diff > 0 ? Math.min(moveT / 0.7, 1) : moveT;
            y = srcY + diff * eased;
            hop = Math.sin(hopT * Math.PI) * amp;
        }
        // Standing on a quaking tile: ride it.
        if (this._shaker?.busy) y += this._shaker.offsetAt(`${unit.x},${unit.y},${unit.z}`, now);
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
            const vs = viewState(unit);
            // A unit that dies stays on screen long enough to fall over, then sinks away.
            if (alive) vs.deadAt = null;
            else if (vs.deadAt == null) vs.deadAt = now;
            const vanish = alive ? 0
                : Math.min(1, Math.max(0, (now - vs.deadAt - TOPPLE_MS / this._timeScale) / (VANISH_MS / this._timeScale)));
            const shown = alive || vanish < 1;
            uv.sprite.visible = uv.ghost.visible = shown;
            uv.shadow.visible = uv.arrow.visible = alive;
            uv.tag.style.display = alive ? '' : 'none';
            if (!shown) { uv.outline.visible = false; uv.flash.visible = false; continue; }

            const ko = isUnconscious(unit) || !alive;
            const pose = this._unitPose(unit, map, now);

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
            // Grey when down; a cold blue cast while slowed; faded and dim while hidden.
            const tint = ko ? 0x777777 : unit.status.includes('hidden') ? 0x7f86a8
                : unit.status.includes('slow') ? 0xc4d8ff : 0xffffff;
            uv.sprite.material.color.setHex(tint);
            uv.ghost.material.color.setHex(tint);

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
            // Breathing: deeper when badly hurt (Rifthold: ×2.2 below 30% HP), slow and deep asleep.
            const asleep = unit.status.includes('sleep');
            const breathDepth = (unit.hp / unit.maxHp < 0.3 ? 2.2 : 1) * (asleep ? 2 : 1);
            const breathe = (0.5 - 0.5 * Math.cos((now / (asleep ? 6400 : 3200)) * Math.PI * 2 + phaseSeed)) * 0.03 * breathDepth;
            let offX = 0, offY = 0, offZ = 0, extraRot = 0, extraScale = 1, squash = 1;
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
            offY += this._reactionMotion(vs, now, (dx, dz, rot, sq) => { offX += dx; offZ += dz; extraRot += rot; squash *= sq; });
            // Status body language: a dazed wobble while stunned.
            if (unit.status.includes('stun')) extraRot += Math.sin(now / 90) * 0.06;
            this._statusParticles(unit, vs, pose, now);
            // Falling over when knocked out, and getting back up when revived.
            const lie = this._lying(vs, ko, dt);
            extraRot += LYING_ANGLE * lie * ((unit.id & 1) ? 1 : -1);
            if (vs.spawnAt != null) {
                const t = (now - vs.spawnAt) / (SPAWN_MS / this._timeScale);
                if (t >= 1) vs.spawnAt = null;
                else extraScale *= Math.max(0.05, t * (2 - t));
            }
            if (vs.cheerAt != null && !ko) offY += Math.abs(Math.sin(((now - vs.cheerAt) / 600) * Math.PI)) * 0.16;
            if (vanish > 0) extraScale *= 1 - vanish;

            const sh = SPRITE_HEIGHT * extraScale * (1 + breathe) * squash;
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
            this._updateFlash(uv, vs, image, px, py, pz, sw, sh, sway + extraRot, camDir, now);

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

            // A unit lying down has its head near the ground, so its tag comes down too.
            const tagHeight = sh / Math.cos(PITCH) * (1 - 0.6 * lie) + 0.05;
            this._updateTag(uv, unit, ko, projected.set(px, py + tagHeight, pz), isActive);
        }
    }

    // Recoil and dodge (vs.react, set by the effect hooks). Calls apply(dx, dz, rotation, squash)
    // and returns the lift. Each follows sin(πt), so it starts and ends at rest (Rifthold).
    _reactionMotion(vs, now, apply) {
        const r = vs.react;
        if (!r) return 0;
        const t = (now - r.startMs) / r.durationMs;
        if (t >= 1) { vs.react = null; return 0; }
        const arc = Math.sin(t * Math.PI);
        if (r.type === 'recoil') {
            apply(r.dx * 0.14 * arc, r.dz * 0.14 * arc, 0.1 * r.side * arc, 1 - 0.12 * arc);
            return 0;
        }
        apply(r.dx * 0.1 * arc, r.dz * 0.1 * arc, 0, 1);   // dodge: a hop to the side
        return 0.2 * arc;
    }

    // Eases vs.lie toward 1 while down and back to 0 when up; returns it eased out (0..1).
    _lying(vs, down, dt) {
        const target = down ? 1 : 0;
        if (vs.lie == null) vs.lie = target;   // a unit that starts down is already lying
        const ms = target > vs.lie ? TOPPLE_MS : RISE_MS;
        const step = (dt * this._timeScale) / ms;
        vs.lie = target > vs.lie ? Math.min(1, vs.lie + step) : Math.max(0, vs.lie - step);
        return vs.lie * (2 - vs.lie);
    }

    // The white hit flash: the sprite's silhouette laid over it, fading out (Rifthold's
    // Shards view: alpha 0.7·(1 - t)).
    _updateFlash(uv, vs, image, px, py, pz, sw, sh, rotation, camDir, now) {
        const f = vs.flash;
        const t = f ? (now - f.startMs) / f.durationMs : 1;
        if (t >= 1) { vs.flash = null; uv.flash.visible = false; return; }
        const silhouette = this._silhouette(image);
        if (!silhouette) { uv.flash.visible = false; return; }
        const tex = this._textureFor(silhouette);
        if (uv.flash.material.map !== tex) { uv.flash.material.map = tex; uv.flash.material.needsUpdate = true; }
        uv.flash.visible = true;
        uv.flash.material.opacity = 0.75 * (1 - t);
        uv.flash.material.rotation = rotation;
        uv.flash.position.set(px, py, pz).addScaledVector(camDir, -0.01);
        uv.flash.scale.set(sw, sh, 1);
    }

    _silhouette(image) {
        if (!image) return null;
        let c = this._silhouettes.get(image);
        if (c !== undefined) return c;
        try {
            const w = image.naturalWidth || image.width, h = image.naturalHeight || image.height;
            c = document.createElement('canvas');
            c.width = w; c.height = h;
            const g = c.getContext('2d');
            g.drawImage(image, 0, 0);
            g.globalCompositeOperation = 'source-in';
            g.fillStyle = '#ffffff';
            g.fillRect(0, 0, w, h);
        } catch { c = null; }
        this._silhouettes.set(image, c);
        return c;
    }

    // Lingering statuses give off a few particles: poison bubbles, and sparks around haste.
    _statusParticles(unit, vs, pose, now) {
        if (unit.status.includes('dead') || unit.status.includes('unconscious')) return;
        // Minimal effects drops these ambient particles; the status still shows on the unit's tag.
        if (perfSettings().effects === 'minimal') return;
        const at = { x: pose.x, y: pose.y + 0.5, z: pose.z };
        if (unit.status.includes('poison') && now >= (vs.nextBubble ?? 0)) {
            vs.nextBubble = now + 420 / this._timeScale;
            this.fx.burst(at, { layer: 'mote', count: 1, colors: POISON_COLORS, speed: [0, 0.1], up: [0.25, 0.45],
                gravity: -0.1, life: [0.7, 1], radius: 0.18, wobble: 0.04, alpha: 0.8 });
        }
        if (unit.status.includes('haste') && now >= (vs.nextSpark ?? 0)) {
            vs.nextSpark = now + 300 / this._timeScale;
            this.fx.burst({ ...at, y: pose.y + 0.15 }, { layer: 'spark', count: 2, colors: BUFF_COLORS, speed: [0.1, 0.3],
                up: [0.1, 0.3], life: [0.3, 0.45], radius: 0.2 });
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
        if (unit.status.includes('hidden'))   marks.push('H');
        if (unit.status.includes('taunted'))  marks.push('T');
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
            const at = (u) => {
                const y0 = blockTopY(p.sz), y1 = blockTopY(p.tz);
                return new THREE.Vector3(p.sx + (p.tx - p.sx) * u, y0 + (y1 - y0) * u + 0.55 + Math.sin(u * Math.PI) * p.arc, p.sy + (p.ty - p.sy) * u);
            };
            if (t >= 1) {
                // A puff where it lands, so even a miss is seen to arrive.
                this.fx.burst(at(1), { layer: 'spark', count: 5, colors: p.colors, speed: [0.4, 0.9], up: [0, 0.4], life: [0.2, 0.35] });
                for (const s of [p.sprite, p.head].filter(Boolean)) { this.scene.remove(s); s.material.dispose(); }
                this._projectiles.splice(i, 1);
                continue;
            }
            const pos = at(t);
            p.sprite.position.copy(pos);
            p.sprite.material.opacity = t < 0.1 ? t * 10 : t > 0.85 ? (1 - t) / 0.15 : 1;
            if (p.head) {
                // Point the art (drawn facing right) along the on-screen direction of travel.
                const a = pos.clone().project(this.camera), b = at(Math.min(1, t + 0.02)).project(this.camera);
                p.head.position.copy(pos);
                p.head.material.rotation = Math.atan2((b.y - a.y) * this._height, (b.x - a.x) * this._width);
            }
            // A short trail of fading motes behind it.
            this.fx.burst(pos, { layer: p.thrown ? 'debris' : 'mote', count: 1, colors: p.colors, speed: [0, 0.05], up: [0, 0],
                life: [0.15, 0.25], radius: 0.03, alpha: p.thrown ? 0.6 : 0.7 });
        }
    }

    _updateFloats(units, map, dt) {
        const v = new THREE.Vector3();
        for (const unit of units) {
            const floats = viewState(unit).floats;
            if (floats.length === 0) continue;
            const top = terrainTopY(getCell(map, unit.x, unit.y, unit.z)) + SPRITE_HEIGHT + 0.25;
            for (let i = floats.length - 1; i >= 0; i--) {
                const f = floats[i];
                f.age += dt;
                if (f.age >= f.maxAge) { f.el?.remove(); floats.splice(i, 1); continue; }
                if (!f.el) {
                    f.el = document.createElement('div');
                    f.el.className = 'tac3d-float';
                    f.el.textContent = f.text;
                    f.el.style.color = f.color;
                    // A hit for a quarter of the unit's HP or more gets a bigger number.
                    const dmg = /^-(\d+)$/.exec(f.text);
                    if (dmg && isHeavyHit(Number(dmg[1]), unit)) f.el.style.fontSize = '21px';
                    // Drift a little to one side, so numbers landing together don't stack.
                    f.drift = (Math.random() - 0.5) * 22;
                    this.overlay.appendChild(f.el);
                }
                const progress = f.age / f.maxAge;
                v.set(unit.x, top, unit.y).project(this.camera);
                const sx = (v.x * 0.5 + 0.5) * this._width + (f.drift ?? 0) * progress;
                const sy = (-v.y * 0.5 + 0.5) * this._height - progress * 38;
                // Pop in at 1.5x and settle, then fade over the second half.
                const pop = progress < 0.12 ? 1.5 - (progress / 0.12) * 0.5 : 1;
                f.el.style.opacity = String(progress < 0.5 ? 1 : 1 - (progress - 0.5) * 2);
                f.el.style.transform = `translate(${Math.round(sx)}px, ${Math.round(sy)}px) translate(-50%, -100%) scale(${pop.toFixed(2)})`;
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
            b.dataset.tip = title;   // a styled tip that also shows on touch (run/ui-kit.js)
            b.addEventListener('click', (e) => { e.stopPropagation(); fn(); });
            b.addEventListener('mousedown', (e) => e.stopPropagation());
            b.addEventListener('pointerdown', (e) => e.stopPropagation());
            bar.appendChild(b);
            return b;
        };
        mk('↺', 'Rotate left (Q)',  () => this.rotateView(-1));
        mk('◎', 'Center (F)\nCenter on the unit, or show the whole map.', () => { if (this._tracking) this.onCenterRequest?.(); else this.fitToMap(); });
        mk('↻', 'Rotate right (E)', () => this.rotateView(1));
        this._freeButton = mk('⤢', 'Free camera (V)\nShows the whole map and stops following units.', () => this.setFreeCamera(this._tracking));
        this._freeButton.classList.toggle('active', !this._tracking);
        this.overlay.appendChild(bar);
        this._compass = bar;
    }
}
