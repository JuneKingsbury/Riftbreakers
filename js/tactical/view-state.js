// Per-unit presentation state (walk interpolation, facing tween, floating text).
// Game logic never reads this. Keeping it off the unit objects means a renderer can
// own and reset its animation data without touching anything the rules depend on.

const _states = new WeakMap();

/** Returns the (lazily created) animation state for a unit or other entity. */
export function viewState(entity) {
    let vs = _states.get(entity);
    if (!vs) {
        vs = {
            prevX: null, prevY: null,
            vizX: null, vizY: null,
            moveQueue: [],
            moveStartTime: 0, moveDuration: 0, msPerStep: 0,
            prevFacing: null, facingChangeAt: null,
            floats: [],
            anim: null,
        };
        _states.set(entity, vs);
    }
    return vs;
}
