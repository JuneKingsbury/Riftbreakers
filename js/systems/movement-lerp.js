import { CONFIG } from '../core/config.js';

const MS_PER_STEP = 240;

// Move entity logically to newX/newY immediately; visual lerps one step at a time.
export function moveEntity(entity, newX, newY, _durationMs) {
    if (entity.x === newX && entity.y === newY) return;
    moveEntityAlongPath(entity, [{ x: newX, y: newY }], MS_PER_STEP);
}

// path: [{x,y},...] ordered steps not including current position, ending at destination.
// Game logic: entity.x/y set to destination immediately.
// Visual: lerps through each step sequentially at msPerStep ms each.
export function moveEntityAlongPath(entity, path, msPerStep) {
    if (!path || path.length === 0) return;
    const dest = path[path.length - 1];

    entity._prevX = entity.x;
    entity._prevY = entity.y;

    entity.x = dest.x;
    entity.y = dest.y;

    if (path.length === 1) {
        entity._vizX = dest.x;
        entity._vizY = dest.y;
        entity._moveQueue = [];
    } else {
        entity._vizX = path[0].x;
        entity._vizY = path[0].y;
        entity._moveQueue = path.slice(1);
    }

    entity._moveStartTime = performance.now();
    entity._moveDuration  = msPerStep;
    entity._msPerStep     = msPerStep;
}

export function teleportEntity(entity, newX, newY) {
    entity._prevX = null;
    entity._prevY = null;
    entity._moveStartTime = 0;
    entity._moveDuration  = 0;
    entity._vizX = newX;
    entity._vizY = newY;
    entity._moveQueue = [];
    entity.x = newX;
    entity.y = newY;
}

const _pos = { x: 0, y: 0 };

export function getEntityRenderPos(entity, now) {
    if (entity._prevX == null || entity._moveDuration <= 0) {
        _pos.x = entity.x;
        _pos.y = entity.y;
        return _pos;
    }

    const elapsed = now - entity._moveStartTime;

    if (elapsed >= entity._moveDuration) {
        const queue = entity._moveQueue;
        if (queue && queue.length > 0) {
            entity._prevX = entity._vizX;
            entity._prevY = entity._vizY;
            const next = queue.shift();
            entity._vizX = next.x;
            entity._vizY = next.y;
            entity._moveStartTime = now;
            _pos.x = entity._prevX;
            _pos.y = entity._prevY;
            return _pos;
        } else {
            entity._prevX = null;
            entity._prevY = null;
            _pos.x = entity.x;
            _pos.y = entity.y;
            return _pos;
        }
    }

    const t     = elapsed / entity._moveDuration;
    const eased = t * (2 - t);
    const vizX  = entity._vizX != null ? entity._vizX : entity.x;
    const vizY  = entity._vizY != null ? entity._vizY : entity.y;
    _pos.x = entity._prevX + (vizX - entity._prevX) * eased;
    _pos.y = entity._prevY + (vizY - entity._prevY) * eased;
    return _pos;
}

export function isEntityMoving(entity) {
    return entity._prevX != null || (entity._moveQueue && entity._moveQueue.length > 0);
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
