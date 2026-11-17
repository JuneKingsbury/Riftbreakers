// Music and sound effects, after Rifthold's sound manager (js/core/sound.js there).
//
// - Two volume buses, music and SFX, follow the Settings sliders (0-100). Music is trimmed by
//   MUSIC_TRIM_DB so it sits level with the effects.
// - Music loops and crossfades (CROSSFADE_MS) when the track changes. playMusic takes a list
//   of candidates and plays the first whose file exists, so a missing realm track falls back
//   to a general one. The latest request always wins, even while an earlier one is loading.
// - Each sound effect gets a small random pitch shift (the manifest's `pitch`, in cents) so
//   repeated sounds don't grate. The same sound can't restart within SFX_COOLDOWN_MS, and at
//   most MAX_CONCURRENT_SFX play at once, so big fights don't turn into noise.
// - Files load on first use and are cached. A missing file is remembered and skipped quietly.
// - Browsers only allow audio after the player interacts with the page: the context starts
//   on the first click or key press (unlock), and music asked for before then starts there.
//
// Every browser dependency is passed in (`deps`), so the logic runs under test without one.
//
// @par Thread Safety:
//      Not thread-safe. Main thread only (Web Audio).
import { SOUND_MANIFEST } from './sound-manifest.js';

export const CROSSFADE_MS = 2000;
// The music files are mastered much louder than the sound effects (peaks near 0 dB, against
// −10 to −25 dB for the effects), so the music bus is turned down by this much to balance the
// two at equal slider values. Tune by ear: more negative makes music quieter.
export const MUSIC_TRIM_DB = -10;
const MUSIC_TRIM = 10 ** (MUSIC_TRIM_DB / 20);
export const SFX_COOLDOWN_MS = 200;
export const MAX_CONCURRENT_SFX = 8;
const DEFAULT_PITCH_CENTS = 300;

export class SoundManager {
    /**
     * @param {object} [deps]
     * @param {() => AudioContext|null} [deps.createContext]
     * @param {(url: string) => Promise<Response>} [deps.fetch]
     * @param {() => number} [deps.now]     Milliseconds, for the cooldown
     * @param {() => number} [deps.random]  [0, 1), for the pitch spread
     * @param {(fn: Function, ms: number) => void} [deps.setTimeout]
     * @param {object} [deps.manifest]
     */
    constructor(deps = {}) {
        this.deps = {
            createContext: () => {
                const Ctx = globalThis.AudioContext || globalThis.webkitAudioContext;
                return Ctx ? new Ctx() : null;
            },
            fetch: (url) => globalThis.fetch(url),
            now: () => globalThis.performance?.now() ?? Date.now(),
            random: Math.random,
            setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
            manifest: SOUND_MANIFEST,
            ...deps,
        };
        this.ctx = null;
        this.musicVolume = 50;
        this.sfxVolume = 80;
        this.buffers = new Map();     // cache key -> AudioBuffer
        this.pending = new Map();     // cache key -> Promise<AudioBuffer|null>
        this.unavailable = new Set(); // cache keys known to be missing
        this.lastPlay = new Map();    // sfx name -> time
        this.activeSfx = 0;
        this.music = null;            // { name, source, gain }
        this.wantedMusic = null;      // candidates asked for before the context existed
        this.musicRequest = 0;
    }

    /** Starts audio. Call from a user gesture; safe to call again. */
    unlock() {
        if (!this.ctx) {
            try { this.ctx = this.deps.createContext(); } catch { this.ctx = null; }
            if (!this.ctx) return;
            this.musicBus = this.ctx.createGain();
            this.sfxBus = this.ctx.createGain();
            this.musicBus.connect(this.ctx.destination);
            this.sfxBus.connect(this.ctx.destination);
            this._applyVolumes();
        }
        if (this.ctx.state === 'suspended') this.ctx.resume?.();
        if (this.wantedMusic) {
            const wanted = this.wantedMusic;
            this.wantedMusic = null;
            this.playMusic(wanted);
        }
    }

    setMusicVolume(value) {
        this.musicVolume = clampVolume(value);
        this._applyVolumes();
    }

    setSfxVolume(value) {
        this.sfxVolume = clampVolume(value);
        this._applyVolumes();
    }

    _applyVolumes() {
        if (this.musicBus) this.musicBus.gain.value = (this.musicVolume / 100) * MUSIC_TRIM;
        if (this.sfxBus) this.sfxBus.gain.value = this.sfxVolume / 100;
    }

    /**
     * Plays a sound effect by manifest name. Returns a promise of whether it started.
     * @param {string} name
     * @param {{semitones?: number}} [opts]  A fixed pitch offset, on top of the random spread
     */
    async playSfx(name, { semitones = 0 } = {}) {
        try {
            const spec = this.deps.manifest.sfx[name];
            if (!this.ctx || !spec || this.sfxVolume <= 0) return false;
            if (this.unavailable.has('sfx:' + name)) return false;
            if (this.activeSfx >= MAX_CONCURRENT_SFX) return false;
            const now = this.deps.now();
            if (now - (this.lastPlay.get(name) ?? -Infinity) < SFX_COOLDOWN_MS) return false;
            this.lastPlay.set(name, now);

            const buffer = await this._buffer('sfx:' + name, spec.file);
            if (!buffer) return false;
            const source = this.ctx.createBufferSource();
            source.buffer = buffer;
            source.detune.value = semitones * 100 + this.pitchCents(spec);
            const gain = this.ctx.createGain();
            gain.gain.value = spec.gain ?? 1;
            source.connect(gain);
            gain.connect(this.sfxBus);
            this.activeSfx++;
            source.onended = () => { this.activeSfx = Math.max(0, this.activeSfx - 1); };
            source.start(0);
            return true;
        } catch {
            return false;
        }
    }

    /** A random pitch shift for one play of `spec`, in cents: uniform in ±spec.pitch. */
    pitchCents(spec) {
        const range = spec.pitch ?? DEFAULT_PITCH_CENTS;
        return (this.deps.random() * 2 - 1) * range;
    }

    /**
     * Crossfades to the first track in `candidates` (a name or list of names) whose file
     * exists. Does nothing if it is already playing; stops the music if none exist.
     */
    async playMusic(candidates) {
        const list = (Array.isArray(candidates) ? candidates : [candidates]).filter(Boolean);
        if (!this.ctx) { this.wantedMusic = list; return; }
        const request = ++this.musicRequest;
        if (this.music && list[0] === this.music.name) return;
        let name = null, buffer = null;
        for (const candidate of list) {
            const file = this.deps.manifest.music[candidate];
            if (!file) continue;
            buffer = await this._buffer('music:' + candidate, file);
            if (request !== this.musicRequest) return;   // a newer request took over
            if (buffer) { name = candidate; break; }
        }
        if (!name) { this.stopMusic(); return; }
        if (this.music?.name === name) return;
        try {
            const fade = CROSSFADE_MS / 1000;
            const t = this.ctx.currentTime;
            this._fadeOut(this.music, fade);
            const gain = this.ctx.createGain();
            gain.connect(this.musicBus);
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(1, t + fade);
            const source = this.ctx.createBufferSource();
            source.buffer = buffer;
            source.loop = true;
            source.connect(gain);
            source.start(0);
            this.music = { name, source, gain };
        } catch { /* audio failure: stay quiet */ }
    }

    /** Fades out and stops whatever music is playing. */
    stopMusic(fadeMs = 1000) {
        this.musicRequest++;
        this.wantedMusic = null;
        if (!this.music || !this.ctx) return;
        this._fadeOut(this.music, fadeMs / 1000);
        this.music = null;
    }

    get currentMusic() {
        return this.music?.name ?? null;
    }

    _fadeOut(track, seconds) {
        if (!track) return;
        try {
            const t = this.ctx.currentTime;
            track.gain.gain.setValueAtTime(track.gain.gain.value, t);
            track.gain.gain.linearRampToValueAtTime(0, t + seconds);
            this.deps.setTimeout(() => { try { track.source.stop(); } catch { /* already stopped */ } }, seconds * 1000);
        } catch { /* ignore */ }
    }

    // Fetches and decodes a file once; concurrent requests share the load.
    async _buffer(key, file) {
        if (this.buffers.has(key)) return this.buffers.get(key);
        if (this.unavailable.has(key)) return null;
        if (this.pending.has(key)) return this.pending.get(key);
        const load = (async () => {
            try {
                const res = await this.deps.fetch(file);
                if (!res.ok) throw new Error(`${res.status}`);
                const buffer = await this.ctx.decodeAudioData(await res.arrayBuffer());
                this.buffers.set(key, buffer);
                return buffer;
            } catch {
                this.unavailable.add(key);
                return null;
            } finally {
                this.pending.delete(key);
            }
        })();
        this.pending.set(key, load);
        return load;
    }
}

function clampVolume(value) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0;
}

/** The game's one sound manager. */
export const Sound = new SoundManager();
