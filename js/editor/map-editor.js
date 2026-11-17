import * as THREE from '../../lib/three/three.module.js';
import {
    MATERIALS, MAX_Z, createEmptyMap, loadMapData, serializeMap, validateMap, validateMapJson,
    blockAt, setBlock, buildCells, columnTop, posKey,
} from '../tactical/battle-map.js';
import { TILE_RENDER, tileSprite, blockTopY, blockBottomY } from '../tactical/tile-render.js';
import { buildTerrainMesh, decodeOwner, cellForBlock, FACE_NORMAL } from '../tactical/terrain-mesh.js';

/**
 * Battle map editor (Settings > Dev Tools > Map). Builds block maps in 3D: pick a
 * material and place blocks at any level, including floating ones units can walk under.
 * Maps save as JSON into js/tactical/data/maps through the dev server (npm run dev), or
 * download as a file when the game is served without it.
 *
 * @par Thread Safety:
 *      Not thread-safe. Main thread only (touches WebGL and the DOM).
 */

const DEG = Math.PI / 180;
const CAMERA_DISTANCE = 80;
const MIN_PPU = 6, MAX_PPU = 120;
const MAX_UNDO = 100;
const SPAWNS_PER_SIDE = 6;
const DRAFT_KEY = 'riftbreakers_map_editor_draft';
const MAPS_URL = 'js/tactical/data/maps/';
const ID_RE = /^[a-z0-9_]{1,40}$/;

const TOOLS = [
    { id: 'place',  key: '1', label: 'Place',  help: 'Click a face to add a block against it. Where the layer grid is above the ground, click the grid to place a floating block on that layer.' },
    { id: 'erase',  key: '2', label: 'Erase',  help: 'Click a block to remove it.' },
    { id: 'paint',  key: '3', label: 'Paint',  help: 'Click blocks to change their material (brush size applies, same level).' },
    { id: 'height', key: '4', label: 'Height', help: 'Drag over columns to raise or lower the ground to the target height. Floating blocks are kept.' },
    { id: 'rect',   key: '5', label: 'Rect',   help: 'Drag a rectangle on the layer grid to fill it with blocks. Shift-drag clears it instead.' },
    { id: 'spawn',  key: '6', label: 'Spawn',  help: 'Click a surface to add or remove a spawn for the chosen side (6 per side).' },
    { id: 'pick',   key: '7', label: 'Pick',   help: 'Click a block to select its material.' },
];

const STYLE_ID = 'map-editor-style';
const CSS = `
#map-editor{position:fixed;inset:0;z-index:400;display:flex;flex-direction:column;background:#0a0a12;color:#cde;font:12px 'Courier New',monospace;}
#map-editor button,#map-editor input,#map-editor select{font:inherit;color:#cde;background:#1a1a2e;border:1px solid #446;border-radius:3px;padding:3px 7px;}
#map-editor button{cursor:pointer;}
#map-editor button:hover{background:#2a2a4e;}
#map-editor button.active{background:#2a4a8a;border-color:#7af;color:#fff;}
#map-editor button:disabled{opacity:.45;cursor:default;}
.me-top{display:flex;gap:6px;align-items:center;padding:6px 8px;border-bottom:1px solid #334;flex-wrap:wrap;}
.me-top .me-sep{width:1px;height:20px;background:#334;margin:0 4px;}
.me-top label{color:#99a;}
.me-body{flex:1;display:flex;min-height:0;}
.me-side{width:210px;padding:8px;overflow-y:auto;border-right:1px solid #334;display:flex;flex-direction:column;gap:10px;}
.me-right{width:250px;border-right:none;border-left:1px solid #334;}
.me-title{color:#fc0;font-weight:bold;margin-bottom:4px;}
.me-grid{display:grid;grid-template-columns:1fr 1fr;gap:4px;}
.me-swatch{display:flex;align-items:center;gap:5px;text-align:left;font-size:10px !important;padding:3px 4px !important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;}
.me-swatch canvas{flex:none;width:18px;height:18px;image-rendering:pixelated;border:1px solid #000;}
.me-row{display:flex;align-items:center;gap:6px;justify-content:space-between;}
.me-row input[type=range]{flex:1;}
.me-help{color:#99a;line-height:1.4;}
.me-view{flex:1;position:relative;min-width:0;}
.me-view canvas{position:absolute;inset:0;width:100%;height:100%;display:block;}
.me-status{padding:4px 8px;border-top:1px solid #334;color:#99a;display:flex;gap:16px;white-space:nowrap;overflow:hidden;}
.me-msg{color:#fc6;}
.me-issues div{margin-bottom:3px;line-height:1.3;}
.me-err{color:#f88;}.me-warn{color:#fc6;}.me-ok{color:#8f8;}
.me-keys{color:#778;line-height:1.5;}
`;

function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const el = document.createElement('style');
    el.id = STYLE_ID;
    el.textContent = CSS;
    document.head.appendChild(el);
}

let editorInstance = null;

/**
 * Opens the map editor full screen, hiding the start screen.
 * @param {object|null} skinManager  Shared skin manager, for terrain textures.
 */
export function launchMapEditor(skinManager = null) {
    document.getElementById('start-screen').style.display = 'none';
    if (!editorInstance) editorInstance = new MapEditor(skinManager);
    editorInstance.show();
}

class MapEditor {
    constructor(skinManager) {
        ensureStyle();
        this.skinManager = skinManager;
        this.tool = 'place';
        this.material = 'grass';
        this.layer = 1;
        this.heightTarget = 1;
        this.brush = 1;
        this.spawnSide = 'player';
        this.xray = false;
        this.showLayerGrid = true;
        this.undoStack = [];
        this.redoStack = [];
        this.dirty = false;
        this.server = false;      // dev server API reachable
        this.hover = null;        // last pick result
        this._drag = null;        // active stroke
        this._textures = new Map();
        this._terrain = null;
        this._raf = 0;

        this.azimuth = 45 * DEG;
        this.pitch = 40 * DEG;
        this.target = new THREE.Vector3();
        this.ppu = 24;

        this._buildDom();
        this._buildScene();
        this._bindInput();

        const draft = this._loadDraft();
        this._setMap(draft ?? this._newMapObject(24, 24), { keepUndo: false });
        if (draft) this._message('Restored the unsaved draft from last session.');
        this._probeServer();
    }

    // ---- Lifecycle -------------------------------------------------------------

    show() {
        this.root.style.display = 'flex';
        this._visible = true;
        const loop = (now) => {
            if (!this._visible) return;
            this._render(now);
            this._raf = requestAnimationFrame(loop);
        };
        this._raf = requestAnimationFrame(loop);
    }

    hide() {
        if (this.dirty && !confirm('Close the editor? Unsaved changes stay in the local draft.')) return;
        this._visible = false;
        cancelAnimationFrame(this._raf);
        this.root.style.display = 'none';
        document.getElementById('start-screen').style.display = '';
    }

    // ---- DOM -------------------------------------------------------------------

    _buildDom() {
        const root = document.createElement('div');
        root.id = 'map-editor';
        root.innerHTML = `
            <div class="me-top">
                <span class="me-title" style="margin:0">Map Editor</span>
                <span class="me-sep"></span>
                <button data-act="new">New</button>
                <select data-ref="open"><option value="">Open…</option></select>
                <button data-act="save" title="Ctrl+S">Save</button>
                <button data-act="saveas">Save As</button>
                <button data-act="export">Export</button>
                <button data-act="import">Import</button>
                <button data-act="resize">Resize</button>
                <span class="me-sep"></span>
                <button data-act="undo" title="Ctrl+Z">Undo</button>
                <button data-act="redo" title="Ctrl+Shift+Z">Redo</button>
                <span class="me-sep"></span>
                <label>id <input data-ref="id" size="14" spellcheck="false"></label>
                <label>name <input data-ref="name" size="20" spellcheck="false"></label>
                <span class="me-sep"></span>
                <button data-act="test" title="Open the saved map in the battle view harness">Test</button>
                <span style="flex:1"></span>
                <span data-ref="server" class="me-help"></span>
                <button data-act="close">Close</button>
            </div>
            <div class="me-body">
                <div class="me-side">
                    <div><div class="me-title">Tool</div><div class="me-grid" data-ref="tools"></div></div>
                    <div class="me-help" data-ref="toolhelp"></div>
                    <div><div class="me-title">Material</div><div class="me-grid" data-ref="materials"></div></div>
                    <div>
                        <div class="me-title">Layer</div>
                        <div class="me-row"><input type="range" min="0" max="${MAX_Z}" data-ref="layer"><span data-ref="layerval"></span></div>
                        <div class="me-row"><label><input type="checkbox" data-ref="grid"> layer grid</label><label><input type="checkbox" data-ref="xray"> hide above</label></div>
                    </div>
                    <div data-ref="heightbox">
                        <div class="me-title">Target height</div>
                        <div class="me-row"><input type="range" min="0" max="${MAX_Z}" data-ref="height"><span data-ref="heightval"></span></div>
                    </div>
                    <div data-ref="brushbox">
                        <div class="me-title">Brush</div>
                        <div class="me-grid" style="grid-template-columns:1fr 1fr 1fr" data-ref="brushes"></div>
                    </div>
                    <div data-ref="spawnbox">
                        <div class="me-title">Spawn side</div>
                        <div class="me-grid" data-ref="sides"></div>
                    </div>
                </div>
                <div class="me-view" data-ref="view"></div>
                <div class="me-side me-right">
                    <div><div class="me-title">Checks</div><div class="me-issues" data-ref="issues"></div></div>
                    <div><div class="me-title">Map</div><div class="me-help" data-ref="info"></div></div>
                    <div class="me-keys">
                        <div class="me-title">Controls</div>
                        Left click: use tool<br>
                        Right drag: orbit<br>
                        Middle / Shift+Right drag: pan<br>
                        Wheel: zoom<br>
                        Q / E: turn 90°, F: fit<br>
                        WASD / arrows: pan<br>
                        [ / ]: layer down / up<br>
                        1-7: tools, X: hide above layer<br>
                        G: layer grid<br>
                        Ctrl+Z / Ctrl+Shift+Z: undo / redo<br>
                        Ctrl+S: save
                    </div>
                </div>
            </div>
            <div class="me-status"><span data-ref="hover"></span><span class="me-msg" data-ref="msg"></span></div>
            <input type="file" accept=".json,application/json" data-ref="file" style="display:none">
        `;
        document.body.appendChild(root);
        this.root = root;
        this.refs = {};
        root.querySelectorAll('[data-ref]').forEach(el => { this.refs[el.dataset.ref] = el; });

        root.querySelectorAll('[data-act]').forEach(btn => {
            btn.addEventListener('click', () => this._action(btn.dataset.act));
        });

        for (const t of TOOLS) {
            const b = document.createElement('button');
            b.textContent = `${t.key} ${t.label}`;
            b.dataset.tool = t.id;
            b.addEventListener('click', () => this._setTool(t.id));
            this.refs.tools.appendChild(b);
        }
        for (const type of Object.keys(MATERIALS)) {
            const b = document.createElement('button');
            b.className = 'me-swatch';
            b.dataset.material = type;
            const c = document.createElement('canvas');
            c.width = c.height = 16;
            b.title = type;
            b.append(c, document.createTextNode(TILE_RENDER[type]?.label ?? type));
            b.addEventListener('click', () => this._setMaterial(type));
            this.refs.materials.appendChild(b);
        }
        this._paintSwatches();
        for (const n of [1, 3, 5]) {
            const b = document.createElement('button');
            b.textContent = `${n}×${n}`;
            b.dataset.brush = n;
            b.addEventListener('click', () => { this.brush = n; this._syncControls(); });
            this.refs.brushes.appendChild(b);
        }
        for (const side of ['player', 'enemy']) {
            const b = document.createElement('button');
            b.textContent = side;
            b.dataset.side = side;
            b.addEventListener('click', () => { this.spawnSide = side; this._syncControls(); });
            this.refs.sides.appendChild(b);
        }

        this.refs.layer.addEventListener('input', () => this._setLayer(Number(this.refs.layer.value)));
        this.refs.height.addEventListener('input', () => { this.heightTarget = Number(this.refs.height.value); this._syncControls(); });
        this.refs.grid.addEventListener('change', () => { this.showLayerGrid = this.refs.grid.checked; this._syncLayerGrid(); });
        this.refs.xray.addEventListener('change', () => { this.xray = this.refs.xray.checked; this._rebuildTerrain(); });
        this.refs.open.addEventListener('change', () => {
            const id = this.refs.open.value;
            this.refs.open.value = '';
            if (id) this._open(id);
        });
        this.refs.file.addEventListener('change', () => this._importFile());
        this.refs.id.addEventListener('change', () => { this.map.id = this.refs.id.value.trim(); this._markDirty(); });
        this.refs.name.addEventListener('change', () => { this.map.name = this.refs.name.value.trim(); this._markDirty(); });
    }

    // Swatch images: the skin's terrain sprite when one is active, else the flat color.
    _paintSwatches() {
        const sm = this.skinManager;
        for (const b of this.refs.materials.children) {
            const def = TILE_RENDER[b.dataset.material];
            const g = b.querySelector('canvas').getContext('2d');
            g.fillStyle = def.color;
            g.fillRect(0, 0, 16, 16);
            const img = tileSprite(sm, def.tex);
            if (img) {
                g.imageSmoothingEnabled = false;
                g.drawImage(img, 0, 0, 16, 16);
                if (def.tint) {
                    // Same recolor the 3D view applies: multiply, then keep the sprite's alpha.
                    g.globalCompositeOperation = 'multiply';
                    g.fillStyle = def.tint;
                    g.fillRect(0, 0, 16, 16);
                    g.globalCompositeOperation = 'destination-in';
                    g.drawImage(img, 0, 0, 16, 16);
                    g.globalCompositeOperation = 'source-over';
                }
            }
        }
    }

    _syncControls() {
        const r = this.refs;
        for (const b of r.tools.children) b.classList.toggle('active', b.dataset.tool === this.tool);
        for (const b of r.materials.children) b.classList.toggle('active', b.dataset.material === this.material);
        for (const b of r.brushes.children) b.classList.toggle('active', Number(b.dataset.brush) === this.brush);
        for (const b of r.sides.children) b.classList.toggle('active', b.dataset.side === this.spawnSide);
        r.toolhelp.textContent = TOOLS.find(t => t.id === this.tool).help;
        r.layer.value = this.layer;
        r.layerval.textContent = this.layer;
        r.height.value = this.heightTarget;
        r.heightval.textContent = this.heightTarget;
        r.grid.checked = this.showLayerGrid;
        r.xray.checked = this.xray;
        r.heightbox.style.display = this.tool === 'height' ? '' : 'none';
        r.brushbox.style.display = (this.tool === 'height' || this.tool === 'paint') ? '' : 'none';
        r.spawnbox.style.display = this.tool === 'spawn' ? '' : 'none';
        r.id.value = this.map?.id ?? '';
        r.name.value = this.map?.name ?? '';
        this.root.querySelector('[data-act=undo]').disabled = this.undoStack.length === 0;
        this.root.querySelector('[data-act=redo]').disabled = this.redoStack.length === 0;
    }

    _message(text) {
        this.refs.msg.textContent = text;
        clearTimeout(this._msgTimer);
        this._msgTimer = setTimeout(() => { this.refs.msg.textContent = ''; }, 6000);
    }

    // ---- Scene -----------------------------------------------------------------

    _buildScene() {
        this.canvas = document.createElement('canvas');
        this.refs.view.appendChild(this.canvas);
        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        this.renderer.setClearColor(0x0a0a12, 1);
        this.scene = new THREE.Scene();
        this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, CAMERA_DISTANCE * 3);
        this.ray = new THREE.Raycaster();

        // Ghost block showing where the tool will act.
        const box = new THREE.BoxGeometry(1, 1, 1);
        this.ghost = new THREE.Group();
        this.ghostFill = new THREE.Mesh(box, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.28, depthWrite: false }));
        this.ghostEdges = new THREE.LineSegments(new THREE.EdgesGeometry(box), new THREE.LineBasicMaterial({ color: 0xffffff, depthTest: false, transparent: true }));
        this.ghostEdges.renderOrder = 50;
        this.ghost.add(this.ghostFill, this.ghostEdges);
        this.ghost.visible = false;
        this.scene.add(this.ghost);

        this.layerGrid = null;
        this.spawnGroup = new THREE.Group();
        this.scene.add(this.spawnGroup);
        this._coneGeo = new THREE.ConeGeometry(0.22, 0.5, 12).rotateX(Math.PI);
        this._spawnMats = {
            player: new THREE.MeshBasicMaterial({ color: 0x55aaff }),
            enemy:  new THREE.MeshBasicMaterial({ color: 0xff5555 }),
        };
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
        }
        return tex;
    }

    _rebuildTerrain() {
        if (this._terrain) {
            this.scene.remove(this._terrain.group);
            this._terrain.dispose();
        }
        this._terrain = buildTerrainMesh(this.map, this.skinManager, img => this._textureFor(img),
            { cutAbove: this.xray ? this.layer : Infinity });
        this.scene.add(this._terrain.group);
        this._skinSeen = this._skinKey();
        this._syncSpawns();
    }

    _skinKey() {
        const sm = this.skinManager;
        return sm && sm.isActive ? sm.activeSkin : '';
    }

    // Grid lines on the floor of the active layer: where a floating block on it would sit.
    _syncLayerGrid() {
        if (this.layerGrid) {
            this.scene.remove(this.layerGrid);
            this.layerGrid.geometry.dispose();
            this.layerGrid.material.dispose();
            this.layerGrid = null;
        }
        if (!this.showLayerGrid || !this.map) return;
        const W = this.map.width, H = this.map.height;
        const pts = [];
        for (let x = 0; x <= W; x++) pts.push(x - 0.5, 0, -0.5, x - 0.5, 0, H - 0.5);
        for (let y = 0; y <= H; y++) pts.push(-0.5, 0, y - 0.5, W - 0.5, 0, y - 0.5);
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
        this.layerGrid = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x66ccff, transparent: true, opacity: 0.35, depthWrite: false }));
        this.layerGrid.position.y = this._layerFloorY() + 0.003;
        this.layerGrid.renderOrder = 40;
        this.scene.add(this.layerGrid);
    }

    _layerFloorY() { return blockBottomY(this.layer); }

    _syncSpawns() {
        for (const m of [...this.spawnGroup.children]) this.spawnGroup.remove(m);
        for (const side of ['player', 'enemy']) {
            for (const s of this.map[`${side}Spawns`]) {
                const m = new THREE.Mesh(this._coneGeo, this._spawnMats[side]);
                m.position.set(s.x, blockTopY(s.z) + 0.3, s.y);
                this.spawnGroup.add(m);
            }
        }
    }

    // ---- Camera ----------------------------------------------------------------

    _resize() {
        const rect = this.refs.view.getBoundingClientRect();
        const w = Math.max(1, Math.floor(rect.width)), h = Math.max(1, Math.floor(rect.height));
        if (w !== this._w || h !== this._h) {
            this._w = w; this._h = h;
            this.renderer.setSize(w, h, false);
        }
    }

    _basis() {
        const az = this.azimuth;
        const up = new THREE.Vector3(-Math.sin(az), 0, -Math.cos(az));
        const right = new THREE.Vector3(-up.z, 0, up.x);
        return { right, up };
    }

    _updateCamera(dt) {
        const k = this._keys || {};
        const step = (8 / this.ppu) * 24 * (dt / 1000);
        const mx = (k.right ? 1 : 0) - (k.left ? 1 : 0);
        const my = (k.up ? 1 : 0) - (k.down ? 1 : 0);
        if (mx || my) {
            const { right, up } = this._basis();
            this.target.x += (right.x * mx + up.x * my) * step;
            this.target.z += (right.z * mx + up.z * my) * step;
        }
        if (this._azGoal !== undefined) {
            const d = this._azGoal - this.azimuth;
            if (Math.abs(d) < 0.001) { this.azimuth = this._azGoal; this._azGoal = undefined; }
            else this.azimuth += d * Math.min(1, dt / 70);
        }
        const cam = this.camera;
        const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
        cam.position.set(
            this.target.x + Math.sin(this.azimuth) * cp * CAMERA_DISTANCE,
            this.target.y + sp * CAMERA_DISTANCE,
            this.target.z + Math.cos(this.azimuth) * cp * CAMERA_DISTANCE,
        );
        cam.lookAt(this.target);
        cam.left = -this._w / 2 / this.ppu;
        cam.right = this._w / 2 / this.ppu;
        cam.top = this._h / 2 / this.ppu;
        cam.bottom = -this._h / 2 / this.ppu;
        cam.updateProjectionMatrix();
        cam.updateMatrixWorld();
    }

    _fit() {
        this._resize();
        const W = this.map.width, H = this.map.height;
        this.target.set((W - 1) / 2, 0, (H - 1) / 2);
        const span = Math.hypot(W, H) + 2;
        this.ppu = Math.max(MIN_PPU, Math.min(MAX_PPU, Math.min(this._w, this._h * 1.4) / span));
    }

    // ---- Render ----------------------------------------------------------------

    _render(now) {
        const dt = this._last ? Math.min(100, now - this._last) : 16;
        this._last = now;
        this._resize();
        // Terrain textures appear once the skin finishes loading.
        if (this._skinKey() !== this._skinSeen) { this._rebuildTerrain(); this._paintSwatches(); }
        this._updateCamera(dt);
        this.renderer.render(this.scene, this.camera);
    }

    // ---- Picking ---------------------------------------------------------------

    _setRay(e) {
        const rect = this.canvas.getBoundingClientRect();
        const ndc = new THREE.Vector2(
            ((e.clientX - rect.left) / rect.width) * 2 - 1,
            -((e.clientY - rect.top) / rect.height) * 2 + 1,
        );
        this.camera.updateMatrixWorld();
        this.ray.setFromCamera(ndc, this.camera);
    }

    // The block face under the pointer: {x, y, z, face} or null.
    _pickBlock() {
        if (!this._terrain) return null;
        const hit = this.ray.intersectObjects(this._terrain.pickMeshes, false)[0];
        if (!hit) return null;
        const id = hit.object.userData.owners[hit.faceIndex >> 1];
        if (id === undefined) return null;
        return { ...decodeOwner(this.map, id), distance: hit.distance };
    }

    // The column on the active layer's grid under the pointer: {x, y, distance} or null.
    _pickLayer() {
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -this._layerFloorY());
        const p = new THREE.Vector3();
        if (!this.ray.ray.intersectPlane(plane, p)) return null;
        const x = Math.round(p.x), y = Math.round(p.z);
        if (x < 0 || y < 0 || x >= this.map.width || y >= this.map.height) return null;
        return { x, y, distance: p.distanceTo(this.ray.ray.origin) };
    }

    // Resolves what the current tool would act on. Returns {kind, x, y, z, ...} or null.
    _resolveTarget(e) {
        this._setRay(e);
        const block = this._pickBlock();
        const layerHit = this.showLayerGrid ? this._pickLayer() : null;
        const map = this.map;
        switch (this.tool) {
            case 'place': {
                // The layer grid wins when it is in front of the terrain (it floats above it).
                if (layerHit && (!block || layerHit.distance < block.distance - 1e-3)) {
                    if (blockAt(map, layerHit.x, layerHit.y, this.layer)) return null;
                    return { kind: 'block', x: layerHit.x, y: layerHit.y, z: this.layer };
                }
                if (!block) return null;
                const n = FACE_NORMAL[block.face];
                const t = { kind: 'block', x: block.x + n.dx, y: block.y + n.dy, z: block.z + n.dz };
                if (t.x < 0 || t.y < 0 || t.x >= map.width || t.y >= map.height || t.z < 0 || t.z > MAX_Z) return null;
                return t;
            }
            case 'erase': case 'paint': case 'pick':
                return block ? { kind: 'block', x: block.x, y: block.y, z: block.z } : null;
            case 'height':
                if (block) return { kind: 'column', x: block.x, y: block.y };
                return layerHit ? { kind: 'column', x: layerHit.x, y: layerHit.y } : null;
            case 'rect':
                return layerHit ? { kind: 'block', x: layerHit.x, y: layerHit.y, z: this.layer } : null;
            case 'spawn': {
                if (!block) return null;
                const cell = cellForBlock(map, block.x, block.y, block.z);
                return cell ? { kind: 'cell', x: cell.x, y: cell.y, z: cell.z, cell } : null;
            }
        }
        return null;
    }

    _showGhost(t, rectFrom = null) {
        if (!t) { this.ghost.visible = false; return; }
        const colors = { place: 0x66ff88, erase: 0xff5555, paint: 0xffdd44, height: 0x66ccff, rect: 0x66ff88, spawn: 0xffffff, pick: 0xffffff };
        const color = this.tool === 'spawn' ? this._spawnMats[this.spawnSide].color.getHex() : colors[this.tool];
        this.ghostFill.material.color.setHex(color);
        this.ghostEdges.material.color.setHex(color);
        let x0 = t.x, x1 = t.x, y0 = t.y, y1 = t.y, zLo, zHi;
        if (rectFrom) {
            x0 = Math.min(rectFrom.x, t.x); x1 = Math.max(rectFrom.x, t.x);
            y0 = Math.min(rectFrom.y, t.y); y1 = Math.max(rectFrom.y, t.y);
        }
        if (t.kind === 'column') {
            const r = Math.floor(this.brush / 2);
            x0 -= r; x1 += r; y0 -= r; y1 += r;
            zLo = blockBottomY(0); zHi = blockTopY(this.heightTarget);
        } else if (t.kind === 'cell') {
            zLo = blockTopY(t.z); zHi = zLo + 0.08;
        } else {
            if (this.tool === 'paint') { const r = Math.floor(this.brush / 2); x0 -= r; x1 += r; y0 -= r; y1 += r; }
            zLo = blockBottomY(t.z); zHi = blockTopY(t.z);
        }
        const pad = 0.02;
        this.ghost.position.set((x0 + x1) / 2, (zLo + zHi) / 2, (y0 + y1) / 2);
        this.ghost.scale.set(x1 - x0 + 1 + pad, Math.max(0.05, zHi - zLo) + pad, y1 - y0 + 1 + pad);
        this.ghost.visible = true;
    }

    _describeHover(e) {
        this._setRay(e);
        const b = this._pickBlock();
        if (!b) { this.refs.hover.textContent = ''; return; }
        const type = blockAt(this.map, b.x, b.y, b.z);
        const cell = cellForBlock(this.map, b.x, b.y, b.z);
        const surf = cell ? `surface z${cell.z} ${cell.passable ? 'walkable' : 'not walkable'}` : '';
        this.refs.hover.textContent = `(${b.x}, ${b.y}) block z${b.z} ${type} | ${surf}`;
    }

    // ---- Input -----------------------------------------------------------------

    _bindInput() {
        const c = this.canvas;
        c.addEventListener('contextmenu', e => e.preventDefault());
        c.addEventListener('pointerdown', e => this._onPointerDown(e));
        window.addEventListener('pointermove', e => this._onPointerMove(e));
        window.addEventListener('pointerup', e => this._onPointerUp(e));
        c.addEventListener('wheel', e => {
            e.preventDefault();
            const f = Math.exp(-e.deltaY * 0.0015);
            this.ppu = Math.max(MIN_PPU, Math.min(MAX_PPU, this.ppu * f));
        }, { passive: false });
        c.addEventListener('pointerleave', () => { if (!this._drag) this.ghost.visible = false; });

        this._keys = { left: false, right: false, up: false, down: false };
        const PAN = { ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right', ArrowUp: 'up', w: 'up', ArrowDown: 'down', s: 'down' };
        window.addEventListener('keydown', e => {
            if (!this._visible) return;
            const tag = e.target?.tagName;
            if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
            const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
            const mod = e.ctrlKey || e.metaKey;
            if (mod && key === 'z') { e.preventDefault(); e.shiftKey ? this._redo() : this._undo(); return; }
            if (mod && key === 'y') { e.preventDefault(); this._redo(); return; }
            if (mod && key === 's') { e.preventDefault(); this._save(); return; }
            if (mod) return;
            if (PAN[key]) { this._keys[PAN[key]] = true; e.preventDefault(); return; }
            const tool = TOOLS.find(t => t.key === key);
            if (tool) { this._setTool(tool.id); return; }
            if (key === 'q') this._turn(-1);
            else if (key === 'e') this._turn(1);
            else if (key === 'f') this._fit();
            else if (key === '[') this._setLayer(this.layer - 1);
            else if (key === ']') this._setLayer(this.layer + 1);
            else if (key === 'x') { this.xray = !this.xray; this._syncControls(); this._rebuildTerrain(); }
            else if (key === 'g') { this.showLayerGrid = !this.showLayerGrid; this._syncControls(); this._syncLayerGrid(); }
            else if (key === 'Escape') { this._drag = null; this.ghost.visible = false; }
        });
        window.addEventListener('keyup', e => {
            const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
            if (PAN[key]) this._keys[PAN[key]] = false;
        });
    }

    _turn(dir) {
        this._azGoal = (this._azGoal ?? this.azimuth) - dir * 90 * DEG;
    }

    _onPointerDown(e) {
        this.canvas.setPointerCapture?.(e.pointerId);
        if (e.button === 1 || (e.button === 2 && e.shiftKey)) {
            this._drag = { kind: 'pan', sx: e.clientX, sy: e.clientY, tx: this.target.x, tz: this.target.z };
            return;
        }
        if (e.button === 2) {
            this._drag = { kind: 'orbit', sx: e.clientX, sy: e.clientY, az: this.azimuth, pitch: this.pitch };
            this._azGoal = undefined;
            return;
        }
        if (e.button !== 0) return;
        const t = this._resolveTarget(e);
        if (!t) return;
        if (this.tool === 'pick') {
            const type = blockAt(this.map, t.x, t.y, t.z);
            if (type) this._setMaterial(type);
            return;
        }
        this._pushUndo();
        if (this.tool === 'rect') {
            this._drag = { kind: 'rect', from: t, to: t, clear: e.shiftKey };
            this._showGhost(t, t);
            return;
        }
        this._drag = { kind: 'stroke', done: new Set() };
        this._applyAt(t);
    }

    _onPointerMove(e) {
        if (!this._visible) return;
        const d = this._drag;
        if (d?.kind === 'pan') {
            const { right, up } = this._basis();
            const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
            const k = 1 / this.ppu, ku = 1 / (this.ppu * Math.sin(this.pitch));
            this.target.x = d.tx - right.x * dx * k + up.x * dy * ku;
            this.target.z = d.tz - right.z * dx * k + up.z * dy * ku;
            return;
        }
        if (d?.kind === 'orbit') {
            this.azimuth = d.az - (e.clientX - d.sx) * 0.01;
            this.pitch = Math.max(12 * DEG, Math.min(89 * DEG, d.pitch + (e.clientY - d.sy) * 0.005));
            return;
        }
        if (e.target !== this.canvas && !d) return;
        const t = this._resolveTarget(e);
        if (d?.kind === 'rect') {
            if (t) d.to = t;
            this._showGhost(d.to, d.from);
            return;
        }
        if (d?.kind === 'stroke' && t && (this.tool === 'height' || this.tool === 'paint' || this.tool === 'erase' || this.tool === 'place')) {
            // Dragging paints, sculpts, or lays a row of blocks. Place and erase stay on the
            // level the stroke started at, so a drag cannot stack a tower or dig a pit.
            this._applyAt(t);
        }
        this._showGhost(t);
        this._describeHover(e);
    }

    _onPointerUp(e) {
        const d = this._drag;
        if (!d) return;
        this._drag = null;
        if (d.kind === 'rect') {
            this._fillRect(d.from, d.to, d.clear);
            this._afterEdit();
        }
        if (d.kind === 'stroke' && !d.changed) this.undoStack.pop();   // nothing happened
        this._syncControls();
    }

    // ---- Editing ---------------------------------------------------------------

    _applyAt(t) {
        const d = this._drag;
        const map = this.map;
        const key = `${t.x},${t.y},${t.z ?? ''}`;
        if (d.done.has(key)) return;
        if (d.z0 === undefined) d.z0 = t.z;
        if ((this.tool === 'place' || this.tool === 'erase') && t.z !== d.z0) return;
        d.done.add(key);
        let changed = false;
        switch (this.tool) {
            case 'place':
                if (!blockAt(map, t.x, t.y, t.z)) { setBlock(map, t.x, t.y, t.z, this.material); changed = true; }
                break;
            case 'erase':
                if (blockAt(map, t.x, t.y, t.z)) { setBlock(map, t.x, t.y, t.z, null); changed = true; }
                break;
            case 'paint':
                for (const [x, y] of this._brushColumns(t.x, t.y)) {
                    const cur = blockAt(map, x, y, t.z);
                    if (cur && cur !== this.material) { setBlock(map, x, y, t.z, this.material); changed = true; }
                }
                break;
            case 'height':
                for (const [x, y] of this._brushColumns(t.x, t.y)) changed = this._setGroundHeight(x, y, this.heightTarget) || changed;
                break;
            case 'spawn':
                changed = this._toggleSpawn(t);
                break;
        }
        if (changed) { d.changed = true; this._afterEdit(); }
    }

    _brushColumns(cx, cy) {
        const r = Math.floor(this.brush / 2);
        const out = [];
        for (let y = cy - r; y <= cy + r; y++) {
            for (let x = cx - r; x <= cx + r; x++) {
                if (x >= 0 && y >= 0 && x < this.map.width && y < this.map.height) out.push([x, y]);
            }
        }
        return out;
    }

    // Raises or lowers the ground stack (the run of blocks from z = 0 up) to height h.
    // Blocks floating above the stack are left alone. New top gets the current material.
    _setGroundHeight(x, y, h) {
        const map = this.map;
        let stackTop = -1;
        while (stackTop + 1 <= MAX_Z && blockAt(map, x, y, stackTop + 1)) stackTop++;
        if (stackTop === h && blockAt(map, x, y, h) === this.material) return false;
        for (let z = stackTop; z > h; z--) setBlock(map, x, y, z, null);
        for (let z = 0; z <= h; z++) {
            if (z === h) setBlock(map, x, y, z, this.material);
            else if (!blockAt(map, x, y, z)) setBlock(map, x, y, z, this.material);
        }
        return true;
    }

    _fillRect(a, b, clear) {
        const map = this.map;
        let changed = false;
        for (let y = Math.min(a.y, b.y); y <= Math.max(a.y, b.y); y++) {
            for (let x = Math.min(a.x, b.x); x <= Math.max(a.x, b.x); x++) {
                const cur = blockAt(map, x, y, this.layer);
                if (clear ? cur : cur !== this.material) {
                    setBlock(map, x, y, this.layer, clear ? null : this.material);
                    changed = true;
                }
            }
        }
        if (!changed) this.undoStack.pop();
    }

    _toggleSpawn(t) {
        const list = this.map[`${this.spawnSide}Spawns`];
        const other = this.map[`${this.spawnSide === 'player' ? 'enemy' : 'player'}Spawns`];
        const key = posKey(t);
        const i = list.findIndex(s => posKey(s) === key);
        if (i >= 0) { list.splice(i, 1); return true; }
        const j = other.findIndex(s => posKey(s) === key);
        if (j >= 0) other.splice(j, 1);
        if (list.length >= SPAWNS_PER_SIDE) {
            this._message(`The ${this.spawnSide} side already has ${SPAWNS_PER_SIDE} spawns. Click one to remove it.`);
            return j >= 0;
        }
        if (!t.cell.passable) this._message('Note: that surface is not walkable (material or low ceiling).');
        list.push({ x: t.x, y: t.y, z: t.z });
        return true;
    }

    // Keeps derived data in step after any change to blocks or spawns.
    _afterEdit() {
        buildCells(this.map);
        // A spawn whose surface is gone moves to the column's new top, or is dropped.
        for (const side of ['playerSpawns', 'enemySpawns']) {
            this.map[side] = this.map[side].filter(s => {
                if (this.map.columnCells[s.y * this.map.width + s.x].some(c => c.z === s.z)) return true;
                const top = columnTop(this.map, s.x, s.y);
                if (top < 0) return false;
                s.z = top;
                return true;
            });
        }
        this._rebuildTerrain();
        this._markDirty();
    }

    _markDirty() {
        this.dirty = true;
        this._refreshChecks();
        this._saveDraft();
        this._syncControls();
    }

    _refreshChecks() {
        const { errors, warnings } = validateMap(this.map);
        const fileErrors = validateMapJson(serializeMap(this.map));
        const lines = [
            ...fileErrors.map(t => `<div class="me-err">✖ ${escapeHtml(t)}</div>`),
            ...errors.map(t => `<div class="me-err">✖ ${escapeHtml(t)}</div>`),
            ...warnings.map(t => `<div class="me-warn">! ${escapeHtml(t)}</div>`),
        ];
        this.refs.issues.innerHTML = lines.length ? lines.join('') : '<div class="me-ok">✔ ready to play</div>';
        const m = this.map;
        const blocks = m.columns.reduce((n, col) => n + Object.keys(col).length, 0);
        const walk = m.cells.filter(c => c.passable).length;
        this.refs.info.innerHTML = `${m.width} × ${m.height} columns<br>${blocks} blocks, ${walk} walkable surfaces<br>`
            + `spawns: ${m.playerSpawns.length} player, ${m.enemySpawns.length} enemy<br>${this.dirty ? 'unsaved changes' : 'saved'}`;
        return { errors: [...fileErrors, ...errors], warnings };
    }

    _setTool(id) { this.tool = id; this.ghost.visible = false; this._syncControls(); }
    _setMaterial(type) { this.material = type; this._syncControls(); }

    _setLayer(z) {
        this.layer = Math.max(0, Math.min(MAX_Z, z));
        this._syncControls();
        this._syncLayerGrid();
        if (this.xray) this._rebuildTerrain();
    }

    // ---- Undo ------------------------------------------------------------------

    _snapshot() { return JSON.stringify(serializeMap(this.map)); }

    _pushUndo() {
        this.undoStack.push(this._snapshot());
        if (this.undoStack.length > MAX_UNDO) this.undoStack.shift();
        this.redoStack = [];
    }

    _restore(snap) {
        const json = JSON.parse(snap);
        this.map = loadMapData(json);
        this._afterEdit();
    }

    _undo() {
        if (!this.undoStack.length) return;
        this.redoStack.push(this._snapshot());
        this._restore(this.undoStack.pop());
    }

    _redo() {
        if (!this.redoStack.length) return;
        this.undoStack.push(this._snapshot());
        this._restore(this.redoStack.pop());
    }

    // ---- Files -----------------------------------------------------------------

    _newMapObject(width, depth) {
        const map = createEmptyMap(width, depth);
        map.id = 'new_map';
        map.name = 'New Map';
        return map;
    }

    _setMap(map, { keepUndo = false } = {}) {
        this.map = map;
        if (!keepUndo) { this.undoStack = []; this.redoStack = []; }
        this.dirty = false;
        this._rebuildTerrain();
        this._syncLayerGrid();
        this._fit();
        this._refreshChecks();
        this._syncControls();
    }

    _loadDraft() {
        try {
            const raw = localStorage.getItem(DRAFT_KEY);
            if (!raw) return null;
            const map = loadMapData(JSON.parse(raw));
            return map;
        } catch { return null; }
    }

    _saveDraft() {
        try { localStorage.setItem(DRAFT_KEY, this._snapshot()); } catch { /* storage full or blocked */ }
    }

    async _probeServer() {
        try {
            const r = await fetch('api/maps', { cache: 'no-store' });
            if (!r.ok) throw new Error(r.status);
            const { maps } = await r.json();
            this.server = true;
            this._fillOpenList(maps.map(m => ({ id: m.id, name: m.name })));
        } catch {
            this.server = false;
            const { MAP_DATA } = await import('../tactical/data/maps/index.js');
            this._fillOpenList(MAP_DATA.map(m => ({ id: m.id, name: m.name })));
        }
        this.refs.server.textContent = this.server ? 'dev server: saves to disk' : 'no dev server: Save downloads a file (run npm run dev)';
    }

    _fillOpenList(maps) {
        const sel = this.refs.open;
        sel.length = 1;
        for (const m of maps) {
            const o = document.createElement('option');
            o.value = m.id;
            o.textContent = `${m.name} (${m.id})`;
            sel.appendChild(o);
        }
    }

    _confirmDiscard() {
        return !this.dirty || confirm('Discard unsaved changes to this map?');
    }

    async _open(id) {
        if (!this._confirmDiscard()) return;
        try {
            const r = await fetch(`${MAPS_URL}${id}.json?t=${Date.now()}`, { cache: 'no-store' });
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            this._setMap(loadMapData(await r.json()));
            this._saveDraft();
            this._message(`Opened ${id}.`);
        } catch (e) {
            this._message(`Could not open ${id}: ${e.message}`);
        }
    }

    async _save(asNew = false) {
        const map = this.map;
        if (asNew || !ID_RE.test(map.id || '')) {
            const id = prompt('Map id (a-z, 0-9, _). This is also the file name:', map.id || 'new_map');
            if (id === null) return;
            if (!ID_RE.test(id)) { this._message('Map id must be 1-40 chars of a-z, 0-9 and _.'); return; }
            map.id = id;
            if (asNew) map.name = prompt('Map name:', map.name || id) ?? map.name;
        }
        const { errors } = this._refreshChecks();
        if (errors.length && !confirm(`This map has ${errors.length} problem(s) and may not play correctly:\n\n${errors.slice(0, 5).join('\n')}\n\nSave anyway?`)) return;
        const json = serializeMap(map);
        if (!this.server) { this._download(json); return; }
        try {
            const exists = [...this.refs.open.options].some(o => o.value === json.id);
            if (asNew && exists && !confirm(`A map called ${json.id} exists. Overwrite it?`)) return;
            const r = await fetch(`api/maps/${json.id}`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(json),
            });
            const body = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(body.error || `HTTP ${r.status}`);
            this.dirty = false;
            this._refreshChecks();
            this._syncControls();
            this._probeServer();
            this._message(`Saved js/tactical/data/maps/${json.id}.json. Battles now include it (reload the game).`);
        } catch (e) {
            this._message(`Save failed: ${e.message}`);
        }
    }

    _download(json) {
        const blob = new Blob([JSON.stringify(json)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${json.id || 'map'}.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        this._message(`Downloaded ${a.download}. Put it in js/tactical/data/maps and run npm run dev once to update index.js.`);
    }

    async _importFile() {
        const file = this.refs.file.files[0];
        this.refs.file.value = '';
        if (!file || !this._confirmDiscard()) return;
        try {
            this._setMap(loadMapData(JSON.parse(await file.text())));
            this.dirty = true;
            this._saveDraft();
            this._message(`Imported ${file.name}.`);
        } catch (e) {
            this._message(`Import failed: ${e.message}`);
        }
    }

    _askSize(title, w, h) {
        const raw = prompt(`${title} (width x depth, 4-128):`, `${w}x${h}`);
        if (raw === null) return null;
        const m = raw.match(/^\s*(\d+)\s*[x×, ]\s*(\d+)\s*$/i);
        const nw = m && Number(m[1]), nh = m && Number(m[2]);
        if (!m || nw < 4 || nh < 4 || nw > 128 || nh > 128) { this._message('Size must look like 24x24, each side 4-128.'); return null; }
        return [nw, nh];
    }

    _resizeMap() {
        const size = this._askSize('New size', this.map.width, this.map.height);
        if (!size) return;
        const [w, h] = size;
        this._pushUndo();
        const old = this.map;
        const map = createEmptyMap(w, h);
        map.id = old.id; map.name = old.name;
        for (let y = 0; y < Math.min(h, old.height); y++) {
            for (let x = 0; x < Math.min(w, old.width); x++) map.columns[y * w + x] = old.columns[y * old.width + x];
        }
        const inside = s => s.x < w && s.y < h;
        map.playerSpawns = old.playerSpawns.filter(inside);
        map.enemySpawns = old.enemySpawns.filter(inside);
        this.map = map;
        this._afterEdit();
        this._syncLayerGrid();
        this._fit();
    }

    _action(act) {
        switch (act) {
            case 'new': {
                if (!this._confirmDiscard()) return;
                const size = this._askSize('New map size', 24, 24);
                if (size) { this._setMap(this._newMapObject(...size)); this._saveDraft(); }
                break;
            }
            case 'save':   this._save(false); break;
            case 'saveas': this._save(true); break;
            case 'export': this._download(serializeMap(this.map)); break;
            case 'import': this.refs.file.click(); break;
            case 'resize': this._resizeMap(); break;
            case 'undo':   this._undo(); break;
            case 'redo':   this._redo(); break;
            case 'test':
                if (this.dirty) this._message('Save first: the harness loads the saved file.');
                else window.open(`tests/harness/view3d.html?map=${encodeURIComponent(this.map.id)}`, '_blank');
                break;
            case 'close':  this.hide(); break;
        }
    }
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

