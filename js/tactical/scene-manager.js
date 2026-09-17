export class SceneManager {
    constructor(containerEl, skinManager, onExit) {
        this._container   = containerEl;
        this._skinManager = skinManager;
        this._onRootExit  = onExit;
        this._stack       = [];
        this._rafId       = null;
        this._stopped     = false;
    }

    get current() { return this._stack[this._stack.length - 1] || null; }

    push(scene) {
        if (this.current) this.current.exit();
        this._stack.push(scene);
        scene.enter(this._container, this._skinManager, this);
        this._ensureLoop();
    }

    pop() {
        const leaving = this._stack.pop();
        if (leaving) leaving.exit();
        if (this._stack.length === 0) {
            this._stop();
            if (this._onRootExit) this._onRootExit();
            return;
        }
        const next = this.current;
        if (next) next.resume(this._container, this._skinManager, this);
    }

    replace(scene) {
        const leaving = this._stack.pop();
        if (leaving) leaving.exit();
        this._stack.push(scene);
        scene.enter(this._container, this._skinManager, this);
    }

    _ensureLoop() {
        if (this._rafId !== null) return;
        const tick = (now) => {
            if (this._stopped) return;
            const scene = this.current;
            if (scene) scene.render(now);
            this._rafId = requestAnimationFrame(tick);
        };
        this._rafId = requestAnimationFrame(tick);
    }

    _stop() {
        this._stopped = true;
        if (this._rafId !== null) {
            cancelAnimationFrame(this._rafId);
            this._rafId = null;
        }
    }
}
