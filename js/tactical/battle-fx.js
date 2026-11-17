// Battle visual effects, after Rifthold's combat views (see the notes on each preset):
//   - particles: small square "pixels" with velocity, gravity and a fading life, drawn as
//     THREE.Points in a few layers (additive sparks and motes, solid debris)
//   - effect sprites: the skin's single-frame effect images (hit, spell_heal, death, ...),
//     animated in code: they grow, rise, slide and fade
//   - camera shake, decaying, for the big moments
// Pure presentation: nothing here reads or changes the rules.
//
// Every duration is in battle time: update() is fed real time multiplied by the playback
// speed, so effects keep pace with a sped-up battle.
//
// @par Thread Safety:
//      Not thread-safe. Main thread only (owns WebGL resources).
import * as THREE from '../../lib/three/three.module.js';

const MAX_PARTICLES = 600;          // per layer; spawns past the cap are dropped (Rifthold: 800)
const MAX_STEP_MS = 500;            // longest step update() takes in one go

// Point sizes as a fraction of the zoom (pixels per tile), so particles keep their size on
// screen relative to the map at any zoom.
const LAYERS = {
    spark:  { size: 0.075, blending: THREE.AdditiveBlending },
    mote:   { size: 0.11,  blending: THREE.AdditiveBlending },
    debris: { size: 0.09,  blending: THREE.NormalBlending },
    // Big soft puffs for area effects: dust plumes, smoke, spore clouds, flame bursts.
    cloud:  { size: 0.24,  blending: THREE.NormalBlending, soft: true },
    glow:   { size: 0.2,   blending: THREE.AdditiveBlending, soft: true },
};

class ParticleLayer {
    constructor(scene, { size, blending, soft = false }) {
        this.sizeFactor = size;
        this.items = [];
        this.positions = new Float32Array(MAX_PARTICLES * 3);
        this.colors = new Float32Array(MAX_PARTICLES * 4);
        this.geometry = new THREE.BufferGeometry();
        this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
        // Four components: per-particle alpha (three.js turns on vertex alpha for itemSize 4).
        this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 4).setUsage(THREE.DynamicDrawUsage));
        this.geometry.setDrawRange(0, 0);
        this.material = new THREE.PointsMaterial({
            size: 4, sizeAttenuation: false, vertexColors: true, transparent: true,
            depthWrite: false, blending, ...(soft ? { map: softDot() } : {}),
        });
        this.points = new THREE.Points(this.geometry, this.material);
        this.points.frustumCulled = false;
        this.points.renderOrder = 25;
        scene.add(this.points);
    }

    add(p) {
        if (this.items.length < MAX_PARTICLES) this.items.push(p);
    }

    update(dtSec, pixelsPerTile) {
        this.material.size = Math.max(2, pixelsPerTile * this.sizeFactor);
        const color = this._color ?? (this._color = new THREE.Color());
        let n = 0;
        for (let i = this.items.length - 1; i >= 0; i--) {
            const p = this.items[i];
            p.life -= dtSec / p.lifeSec;
            if (p.life <= 0) { this.items[i] = this.items[this.items.length - 1]; this.items.pop(); continue; }
            p.vy -= p.gravity * dtSec;
            p.vx *= p.drag; p.vz *= p.drag;
            p.x += p.vx * dtSec; p.y += p.vy * dtSec; p.z += p.vz * dtSec;
            if (p.floor != null && p.y < p.floor) { p.y = p.floor; p.vy = 0; p.vx *= 0.5; p.vz *= 0.5; }
            const wob = p.wobble ? Math.sin(p.wobblePhase + (1 - p.life) * 12) * p.wobble : 0;
            const pi = n * 3, ci = n * 4;
            this.positions[pi] = p.x + wob; this.positions[pi + 1] = p.y; this.positions[pi + 2] = p.z;
            color.set(p.color);
            this.colors[ci] = color.r; this.colors[ci + 1] = color.g; this.colors[ci + 2] = color.b;
            this.colors[ci + 3] = p.alpha * Math.min(1, p.life * 1.6);
            n++;
        }
        this.geometry.setDrawRange(0, n);
        this.geometry.attributes.position.needsUpdate = true;
        this.geometry.attributes.color.needsUpdate = true;
    }

    dispose(scene) {
        scene.remove(this.points);
        this.geometry.dispose();
        this.material.dispose();
    }
}

// A round dot with soft edges, for the big particle layers (square pixels look blocky that large).
let _softDot = null;
function softDot() {
    if (_softDot || typeof document === 'undefined') return _softDot;
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.7)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 32, 32);
    _softDot = new THREE.CanvasTexture(c);
    return _softDot;
}

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (list) => list[Math.floor(Math.random() * list.length)];

export class BattleFx {
    /**
     * @param {THREE.Scene} scene
     * @param {(category: string, key: string) => THREE.Texture|null} effectTexture
     *        The skin's effect sprite as a texture, or null (ascii mode: particles only).
     */
    constructor(scene, effectTexture) {
        this.scene = scene;
        this.effectTexture = effectTexture;
        this.layers = Object.fromEntries(Object.entries(LAYERS).map(([k, opts]) => [k, new ParticleLayer(scene, opts)]));
        this.sprites = [];
        this.flashes = [];           // glows laid flat on tiles (tileFlash)
        this.pending = [];           // { at, fn }: effects waiting for their moment (later)
        this.clock = 0;              // battle time, ms
        this.shakeAmount = 0;        // tiles; decays
        this.flashGeometry = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
        this.reducedMotion = !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    }

    // ---- Particles ---------------------------------------------------------------------

    /**
     * Spawns `count` particles at `at` ({x, y, z}, world units).
     *   layer        'spark' | 'mote' | 'debris'
     *   colors       a color or a list to pick from per particle
     *   dir          {x, z} unit vector to fan around (null: all directions)
     *   spread       fan half-angle, radians (with dir)
     *   speed        [min, max] world units/s outwards
     *   up           [min, max] initial upward speed
     *   gravity      world units/s² down (negative floats up)
     *   life         [min, max] seconds
     *   radius       random start offset around `at`
     *   floor        stop falling at this height (debris lands on the ground)
     *   wobble       sideways sine sway, world units (motes)
     */
    burst(at, { layer = 'spark', count = 6, colors = '#ffffff', dir = null, spread = Math.PI, speed = [0.6, 1.4],
        up = [0, 0.3], gravity = 0, life = [0.35, 0.6], radius = 0.05, floor = null, wobble = 0, alpha = 0.95, drag = 1 } = {}) {
        const target = this.layers[layer];
        const list = Array.isArray(colors) ? colors : [colors];
        const base = dir ? Math.atan2(dir.z, dir.x) : 0;
        for (let i = 0; i < count; i++) {
            // Evenly spaced around the fan, plus jitter, so a burst reads as a burst (Rifthold).
            const a = dir ? base + (count > 1 ? (i / (count - 1) - 0.5) * 2 * spread : 0) + rand(-0.25, 0.25)
                          : (i / count) * Math.PI * 2 + rand(-0.6, 0.6);
            const s = rand(speed[0], speed[1]);
            target.add({
                x: at.x + rand(-radius, radius), y: at.y + rand(-radius, radius), z: at.z + rand(-radius, radius),
                vx: Math.cos(a) * s, vy: rand(up[0], up[1]), vz: Math.sin(a) * s,
                gravity, drag, floor, wobble, wobblePhase: rand(0, 6.28),
                life: 1, lifeSec: rand(life[0], life[1]), color: pick(list), alpha,
            });
        }
    }

    // ---- Effect sprites ----------------------------------------------------------------

    /**
     * Shows a skin effect sprite (category 'effects') at `at`. Does nothing without the art.
     *   ms        lifetime          size     start size, world units     grow   size added by the end
     *   rise      world units risen by the end                          slide  {x, y, z} travelled
     *   rotation  radians (screen)  spin     radians turned by the end
     *   fadeFrom  0..1, the point the fade begins (Rifthold fades the last 40%)
     *   popIn     ms to scale in from 60%
     *   additive  glow blending
     */
    sprite(key, at, { ms = 400, size = 0.6, grow = 0, rise = 0, slide = null, rotation = 0, spin = 0,
        fadeFrom = 0.6, popIn = 0, additive = false, color = 0xffffff, opacity = 1 } = {}) {
        const tex = this.effectTexture('effects', key);
        if (!tex) return null;
        const mat = new THREE.SpriteMaterial({
            map: tex, color, transparent: true, depthTest: false, depthWrite: false,
            blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
        });
        const s = new THREE.Sprite(mat);
        s.renderOrder = 26;
        this.scene.add(s);
        const fx = { s, at: { ...at }, age: 0, ms, size, grow, rise, slide, rotation, spin, fadeFrom, popIn, opacity };
        this.sprites.push(fx);
        this._placeSprite(fx);
        return fx;
    }

    _placeSprite(fx) {
        const t = Math.min(1, fx.age / fx.ms);
        const pop = fx.popIn ? Math.min(1, fx.age / fx.popIn) : 1;
        const popScale = 0.6 + 0.4 * (pop * (2 - pop));
        const size = (fx.size + fx.grow * t) * popScale;
        const ease = t * (2 - t);
        fx.s.position.set(
            fx.at.x + (fx.slide?.x ?? 0) * ease,
            fx.at.y + fx.rise * ease + (fx.slide?.y ?? 0) * ease,
            fx.at.z + (fx.slide?.z ?? 0) * ease);
        fx.s.scale.set(size, size, 1);
        fx.s.material.rotation = fx.rotation + fx.spin * t;
        fx.s.material.opacity = fx.opacity * (t < fx.fadeFrom ? 1 : 1 - (t - fx.fadeFrom) / (1 - fx.fadeFrom));
    }

    // ---- Timing and tile glows ------------------------------------------------------------

    /** Runs fn after `delayMs` of battle time (so it keeps pace with the playback speed). */
    later(delayMs, fn) {
        if (delayMs <= 0) { fn(); return; }
        this.pending.push({ at: this.clock + delayMs, fn });
    }

    /**
     * A glow laid flat on a tile's top surface (`at` is the center of that surface): marks a
     * tile an area ability hit. It swells in quickly and fades out.
     */
    tileFlash(at, color, { ms = 450, size = 0.96, opacity = 0.55 } = {}) {
        const mat = new THREE.MeshBasicMaterial({
            color, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending,
            polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
        });
        const mesh = new THREE.Mesh(this.flashGeometry, mat);
        mesh.position.set(at.x, at.y + 0.015, at.z);
        mesh.scale.set(size, 1, size);
        mesh.renderOrder = 5;
        this.scene.add(mesh);
        this.flashes.push({ mesh, age: 0, ms, opacity });
    }

    // ---- Shake -------------------------------------------------------------------------

    /** Adds camera shake, in tiles (a hit ~0.05, a knockout ~0.1, a boss ~0.2). */
    shake(amount) {
        if (this.reducedMotion) return;
        this.shakeAmount = Math.min(0.3, Math.max(this.shakeAmount, amount));
    }

    /** This frame's camera offset along screen right/up, in tiles. */
    shakeOffset() {
        if (this.shakeAmount <= 0.001) return { x: 0, y: 0 };
        return { x: rand(-1, 1) * this.shakeAmount, y: rand(-1, 1) * this.shakeAmount };
    }

    // ---- Frame -------------------------------------------------------------------------

    /** Advances everything by `dtMs` of battle time. pixelsPerTile sets the particle size. */
    update(dtMs, pixelsPerTile) {
        // dtMs is already battle time (real time × speed, real time clamped by the view), so
        // only a long stall is capped here; a tighter cap would slow effects at high speed.
        dtMs = Math.min(MAX_STEP_MS, dtMs);
        const dt = dtMs / 1000;
        this.clock += dtMs;
        if (this.pending.length) {
            const due = this.pending.filter(p => p.at <= this.clock);
            this.pending = this.pending.filter(p => p.at > this.clock);
            for (const p of due) p.fn();
        }
        for (let i = this.flashes.length - 1; i >= 0; i--) {
            const f = this.flashes[i];
            f.age += dtMs;
            const t = f.age / f.ms;
            if (t >= 1) { this.scene.remove(f.mesh); f.mesh.material.dispose(); this.flashes.splice(i, 1); continue; }
            f.mesh.material.opacity = f.opacity * (t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85);
        }
        for (const layer of Object.values(this.layers)) layer.update(dt, pixelsPerTile);
        for (let i = this.sprites.length - 1; i >= 0; i--) {
            const fx = this.sprites[i];
            fx.age += dtMs;
            if (fx.age >= fx.ms) { this.scene.remove(fx.s); fx.s.material.dispose(); this.sprites.splice(i, 1); continue; }
            this._placeSprite(fx);
        }
        // Decays to nothing in about a quarter of a second.
        this.shakeAmount *= Math.pow(0.0005, dt);
    }

    get busy() {
        return this.sprites.length > 0 || this.flashes.length > 0 || this.pending.length > 0
            || Object.values(this.layers).some(l => l.items.length > 0);
    }

    dispose() {
        for (const layer of Object.values(this.layers)) layer.dispose(this.scene);
        for (const fx of this.sprites) { this.scene.remove(fx.s); fx.s.material.dispose(); }
        for (const f of this.flashes) { this.scene.remove(f.mesh); f.mesh.material.dispose(); }
        this.sprites = [];
        this.flashes = [];
        this.pending = [];
        this.flashGeometry.dispose();
    }
}
