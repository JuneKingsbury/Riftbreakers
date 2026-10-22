import { CONFIG } from '../core/config.js';
import { viewState } from '../tactical/view-state.js';
import { setFacing, facingForStep } from '../tactical/units.js';

const MS_PER_STEP = 240;

// Move entity logically to newX/newY immediately; visual lerps one step at a time.
export function moveEntity(entity, newX, newY, durationMs) {
    if (entity.x === newX && entity.y === newY) return;
    moveEntityAlongPath(entity, [{ x: newX, y: newY }], durationMs || MS_PER_STEP);
}

// path: [{x,y},...] ordered steps not including current position, ending at destination.
// Game logic: entity.x/y set to destination immediately.
// Visual: lerps through each step sequentially at msPerStep ms each.
export function moveEntityAlongPath(entity, path, msPerStep) {
    if (!path || path.length === 0) return;
    const dest = path[path.length - 1];
    const vs   = viewState(entity);

    // Facing is a rule input (rear-attack evasion), so the logic layer settles it:
    // a unit ends a move facing the direction of its last step.
    if ('facing' in entity) {
        const last = path.length > 1 ? path[path.length - 2] : entity;
        const facing = facingForStep(dest.x - last.x, dest.y - last.y);
        if (facing) setFacing(entity, facing);
    }

    vs.prevX = entity.x;
    vs.prevY = entity.y;

    entity.x = dest.x;
    entity.y = dest.y;

    if (path.length === 1) {
        vs.vizX = dest.x;
        vs.vizY = dest.y;
        vs.moveQueue = [];
    } else {
        vs.vizX = path[0].x;
        vs.vizY = path[0].y;
        vs.moveQueue = path.slice(1);
    }

    vs.moveStartTime = performance.now();
    vs.moveDuration  = msPerStep;
    vs.msPerStep     = msPerStep;
}

export function teleportEntity(entity, newX, newY) {
    const vs = viewState(entity);
    vs.prevX = null;
    vs.prevY = null;
    vs.moveStartTime = 0;
    vs.moveDuration  = 0;
    vs.vizX = newX;
    vs.vizY = newY;
    vs.moveQueue = [];
    entity.x = newX;
    entity.y = newY;
}

const _pos = { x: 0, y: 0 };

export function getEntityRenderPos(entity, now) {
    const vs = viewState(entity);
    if (vs.prevX == null || vs.moveDuration <= 0) {
        _pos.x = entity.x;
        _pos.y = entity.y;
        return _pos;
    }

    const elapsed = now - vs.moveStartTime;

    if (elapsed >= vs.moveDuration) {
        const queue = vs.moveQueue;
        if (queue && queue.length > 0) {
            vs.prevX = vs.vizX;
            vs.prevY = vs.vizY;
            const next = queue.shift();
            vs.vizX = next.x;
            vs.vizY = next.y;
            vs.moveStartTime = now;
            _pos.x = vs.prevX;
            _pos.y = vs.prevY;
            return _pos;
        } else {
            vs.prevX = null;
            vs.prevY = null;
            _pos.x = entity.x;
            _pos.y = entity.y;
            return _pos;
        }
    }

    const t     = elapsed / vs.moveDuration;
    const eased = t * (2 - t);
    const vizX  = vs.vizX != null ? vs.vizX : entity.x;
    const vizY  = vs.vizY != null ? vs.vizY : entity.y;
    _pos.x = vs.prevX + (vizX - vs.prevX) * eased;
    _pos.y = vs.prevY + (vizY - vs.prevY) * eased;
    return _pos;
}

export function isEntityMoving(entity) {
    const vs = viewState(entity);
    return vs.prevX != null || (vs.moveQueue && vs.moveQueue.length > 0);
}

export function computeMoveCooldown(terrainCost, moveBonus) {
    let cooldown = Math.max(0, Math.floor((terrainCost - 1) / 3));
    if (moveBonus > 0 && cooldown > 0) {
        cooldown = Math.max(0, Math.round(cooldown * (1 - moveBonus)));
    }
    return cooldown;
}

export function computeMoveDuration(terrainCost, moveBonus, gameSpeed) {
    const cooldown = computeMoveCooldown(terrainCost, moveBonus);
    return (1 + cooldown) * CONFIG.TICK_RATE / gameSpeed;
}
