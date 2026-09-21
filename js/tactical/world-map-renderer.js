const NODE_COLORS = {
    town:     { fill: '#e8c96a', stroke: '#c8a030', icon: 'T' },
    wilds:    { fill: '#6db86d', stroke: '#3a8a3a', icon: 'W' },
    ruins:    { fill: '#a0906a', stroke: '#7a6040', icon: 'R' },
    dungeon:  { fill: '#8070a0', stroke: '#5040a0', icon: 'D' },
    fortress: { fill: '#c05050', stroke: '#902020', icon: 'F' },
};

const ROAD_COLOR     = '#c86830';
const ROAD_UNDISCOV  = '#604020';
const NODE_RADIUS    = 18;
const PULSE_SPEED    = 0.002;

export class WorldMapRenderer {
    constructor(canvas, skinManager) {
        this.canvas      = canvas;
        this.ctx         = canvas.getContext('2d');
        this.skinManager = skinManager || null;
        this._bgImg      = null;
        this._bgLoaded   = false;
        this.hoveredNodeId  = null;
        this.selectedNodeId = null;
        // Camera: offset in canvas pixels and zoom scale
        this.camX     = 0;
        this.camY     = 0;
        this.camScale = 1.0;
        // Player marker animation state (normalized 0-1 coords)
        this._markerNx       = -1; // -1 = uninitialized
        this._markerNy       = 0;
        this._markerTargetNx = 0;
        this._markerTargetNy = 0;
        this._prevNodeId     = null;
        this._isWalking      = false;
        this._walkDirX       = 1;  // 1=right, -1=left (for sprite flip)
        this._walkPhase      = 0;  // accumulated walk oscillation phase
        // Per-enemy lerp state keyed by enemy.id
        this._enemyStates    = new Map();
        this._loadBackground();
    }

    _loadBackground() {
        const img = new Image();
        img.onload = () => { this._bgImg = img; this._bgLoaded = true; };
        img.onerror = () => { this._bgLoaded = true; };
        img.src = 'fftaMap.png';
    }

    resize(w, h) {
        this.canvas.width  = w;
        this.canvas.height = h;
        this._clampCam();
    }

    _clampCam() {
        const W = this.canvas.width;
        const H = this.canvas.height;
        const s = this.camScale;
        const margin = 120;
        this.camX = Math.min(W - margin, Math.max(margin - W * s, this.camX));
        this.camY = Math.min(H - margin, Math.max(margin - H * s, this.camY));
    }

    // Convert normalized (0-1) node coords to world-space pixels (before camera transform)
    _toWorld(nx, ny) {
        return {
            x: nx * this.canvas.width,
            y: ny * this.canvas.height,
        };
    }

    _updateMarker(worldMap, dt) {
        const nodeMap = Object.fromEntries(worldMap.nodes.map(n => [n.id, n]));
        const target  = nodeMap[worldMap.currentNodeId];
        if (!target) return;

        // First frame: snap to starting position
        if (this._markerNx < 0) {
            this._markerNx       = target.x;
            this._markerNy       = target.y;
            this._markerTargetNx = target.x;
            this._markerTargetNy = target.y;
            this._prevNodeId     = worldMap.currentNodeId;
            return;
        }

        // Destination changed: set new target
        if (worldMap.currentNodeId !== this._prevNodeId) {
            const oldNode = nodeMap[this._prevNodeId];
            if (oldNode) {
                this._walkDirX = target.x >= oldNode.x ? 1 : -1;
            }
            this._markerTargetNx = target.x;
            this._markerTargetNy = target.y;
            this._prevNodeId = worldMap.currentNodeId;
        }

        // Lerp marker toward target
        const dx   = this._markerTargetNx - this._markerNx;
        const dy   = this._markerTargetNy - this._markerNy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const SNAP = 0.003;
        if (dist < SNAP) {
            this._markerNx  = this._markerTargetNx;
            this._markerNy  = this._markerTargetNy;
            this._isWalking = false;
        } else {
            const speed = Math.min(dist, 0.22 * dt);
            this._markerNx  += (dx / dist) * speed;
            this._markerNy  += (dy / dist) * speed;
            this._isWalking  = true;
            // Advance walk oscillation phase (radians per second, 2 cycles per trip)
            this._walkPhase += dt * Math.PI * 4;
        }
    }

    _updateEnemyStates(worldMap, dt) {
        const nodeMap = Object.fromEntries(worldMap.nodes.map(n => [n.id, n]));
        // Remove states for roamers that have been removed from the roster
        const liveIds = new Set((worldMap.roamingEnemies || []).map(e => e.id));
        for (const id of this._enemyStates.keys()) {
            if (!liveIds.has(id)) this._enemyStates.delete(id);
        }
        for (const enemy of (worldMap.roamingEnemies || [])) {
            if (enemy.defeated) { this._enemyStates.delete(enemy.id); continue; }
            const target = nodeMap[enemy.nodeId];
            if (!target) continue;

            let s = this._enemyStates.get(enemy.id);
            if (!s) {
                s = {
                    nx: target.x, ny: target.y,
                    targetNx: target.x, targetNy: target.y,
                    prevNodeId: enemy.nodeId,
                    isWalking: false, walkPhase: 0, walkDirX: 1,
                    tripDist: 0, fromDiscovered: target.discovered, toDiscovered: target.discovered,
                };
                this._enemyStates.set(enemy.id, s);
                continue;
            }

            if (enemy.nodeId !== s.prevNodeId) {
                const oldNode = nodeMap[s.prevNodeId];
                if (oldNode) s.walkDirX = target.x >= oldNode.x ? 1 : -1;
                // Record discovery state of both ends before the lerp begins
                s.fromDiscovered = oldNode ? oldNode.discovered : false;
                s.toDiscovered   = target.discovered;
                s.targetNx  = target.x;
                s.targetNy  = target.y;
                s.prevNodeId = enemy.nodeId;
                // Total distance of this trip, used to compute walk progress
                const tdx = s.targetNx - s.nx;
                const tdy = s.targetNy - s.ny;
                s.tripDist = Math.sqrt(tdx * tdx + tdy * tdy) || 0.001;
            }

            const dx   = s.targetNx - s.nx;
            const dy   = s.targetNy - s.ny;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 0.003) {
                s.nx = s.targetNx; s.ny = s.targetNy; s.isWalking = false;
            } else {
                const speed = Math.min(dist, 0.22 * dt);
                s.nx += (dx / dist) * speed;
                s.ny += (dy / dist) * speed;
                s.isWalking  = true;
                s.walkPhase += dt * Math.PI * 4;
            }
        }
    }

    render(worldMap, now) {
        const ctx = this.ctx;
        const W   = this.canvas.width;
        const H   = this.canvas.height;

        // Delta time in seconds, capped to avoid big jumps on tab resume
        const dt = Math.min((now - (this._lastNow || now)) / 1000, 0.05);
        this._lastNow = now;

        this._updateMarker(worldMap, dt);
        this._updateEnemyStates(worldMap, dt);

        ctx.clearRect(0, 0, W, H);

        // Apply camera transform for all map content
        ctx.save();
        ctx.translate(this.camX, this.camY);
        ctx.scale(this.camScale, this.camScale);

        if (this._bgLoaded && this._bgImg) {
            ctx.drawImage(this._bgImg, 0, 0, W, H);
            ctx.fillStyle = 'rgba(0,0,0,0.25)';
            ctx.fillRect(0, 0, W, H);
        } else {
            const grad = ctx.createLinearGradient(0, 0, W, H);
            grad.addColorStop(0,   '#3a2e18');
            grad.addColorStop(0.5, '#2a2010');
            grad.addColorStop(1,   '#1e1808');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, W, H);
        }

        const nodes   = worldMap.nodes;
        const nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]));

        this._drawConnections(ctx, nodes, nodeMap, worldMap.currentNodeId);

        for (const node of nodes) {
            if (!node.discovered) continue;
            this._drawNode(ctx, node, worldMap, now);
        }

        // Draw roaming enemies with fade in/out across discovery boundary
        for (const enemy of (worldMap.roamingEnemies || [])) {
            if (enemy.defeated) continue;
            const s = this._enemyStates.get(enemy.id);
            if (!s) continue;

            // Walk progress t: 0 = just left source, 1 = arrived at target
            const dx       = s.targetNx - s.nx;
            const dy       = s.targetNy - s.ny;
            const remDist  = Math.sqrt(dx * dx + dy * dy);
            const t        = s.tripDist > 0 ? Math.max(0, Math.min(1, 1 - remDist / s.tripDist)) : 1;

            let alpha;
            if (s.fromDiscovered && s.toDiscovered) {
                alpha = 1;
            } else if (!s.fromDiscovered && s.toDiscovered) {
                // Fading in as we approach a known node
                alpha = t;
            } else if (s.fromDiscovered && !s.toDiscovered) {
                // Fading out as we leave for an unknown node
                alpha = 1 - t;
            } else {
                // Both undiscovered: invisible
                alpha = 0;
            }

            if (alpha <= 0.01) continue;
            const ex = s.nx * W;
            const ey = s.ny * H;
            this._drawEnemyMarker(ctx, ex, ey, enemy, s, alpha, now);
        }

        // Draw pinned encounters (static markers at their node, offset slightly)
        for (const enc of (worldMap.pinnedEncounters || [])) {
            if (enc.defeated) continue;
            const node = nodeMap[enc.nodeId];
            if (!node || !node.discovered) continue;
            const pos = this._toWorld(node.x, node.y);
            // Offset right of the node so it doesn't overlap the node icon
            const ex = pos.x + NODE_RADIUS + 6;
            const ey = pos.y - NODE_RADIUS + 4;
            const staticState = { isWalking: false, walkPhase: 0, walkDirX: 1 };
            this._drawEnemyMarker(ctx, ex, ey, enc, staticState, 1.0, now);
        }

        // Draw player marker on top of nodes
        if (this._markerNx >= 0) {
            const mx = this._markerNx * W;
            const my = this._markerNy * H;
            this._drawPlayerMarker(ctx, mx, my, now);
        }

        ctx.restore();

        // Title watermark drawn outside camera transform (fixed position)
        ctx.font      = 'bold 18px "Courier New", monospace';
        ctx.fillStyle = 'rgba(220,180,80,0.5)';
        ctx.textAlign = 'right';
        ctx.fillText('RIFTBREAK', W - 12, 22);
        ctx.textAlign = 'left';

        // Zoom hint
        ctx.font      = '10px "Courier New", monospace';
        ctx.fillStyle = 'rgba(150,130,80,0.5)';
        ctx.fillText('Drag to pan  |  Scroll to zoom', 10, H - 10);
    }

    _drawConnections(ctx, nodes, nodeMap, currentNodeId) {
        const drawn = new Set();
        for (const node of nodes) {
            if (!node.discovered) continue;
            for (const connId of node.connections) {
                const key  = [node.id, connId].sort().join('|');
                if (drawn.has(key)) continue;
                drawn.add(key);
                const other = nodeMap[connId];
                if (!other) continue;

                const a = this._toWorld(node.x, node.y);
                const b = this._toWorld(other.x, other.y);

                const bothDiscovered = node.discovered && other.discovered;

                ctx.beginPath();
                ctx.moveTo(a.x, a.y);

                // Slight curve via midpoint offset
                const mx = (a.x + b.x) / 2 + (b.y - a.y) * 0.12;
                const my = (a.y + b.y) / 2 - (b.x - a.x) * 0.12;
                ctx.quadraticCurveTo(mx, my, b.x, b.y);

                ctx.lineWidth = 3;
                if (!bothDiscovered) {
                    ctx.strokeStyle = ROAD_UNDISCOV;
                    ctx.setLineDash([6, 8]);
                    ctx.globalAlpha = 0.5;
                } else {
                    ctx.strokeStyle = ROAD_COLOR;
                    ctx.setLineDash([]);
                    ctx.globalAlpha = 0.85;
                }
                ctx.stroke();
                ctx.setLineDash([]);
                ctx.globalAlpha = 1;
            }
        }
    }

    _drawNode(ctx, node, worldMap, now) {
        const pos     = this._toWorld(node.x, node.y);
        const theme   = NODE_COLORS[node.type] || NODE_COLORS.wilds;
        const isCurrent  = node.id === worldMap.currentNodeId;
        const isHovered  = node.id === this.hoveredNodeId;
        const isSelected = node.id === this.selectedNodeId;
        const canTravel  = worldMap.canTravelTo(node.id);

        // Pulse ring for current node
        if (isCurrent) {
            const pulse = 0.55 + 0.45 * Math.sin(now * PULSE_SPEED);
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, NODE_RADIUS + 10, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(255,200,60,${pulse * 0.7})`;
            ctx.lineWidth   = 3;
            ctx.stroke();
        }

        // Reachable glow for travelable nodes
        if (canTravel && !isCurrent) {
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, NODE_RADIUS + 6, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(100,200,255,0.35)';
            ctx.lineWidth   = 2;
            ctx.stroke();
        }

        // Node circle (shadow)
        ctx.beginPath();
        ctx.arc(pos.x + 2, pos.y + 3, NODE_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fill();

        // Node circle (fill)
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, NODE_RADIUS, 0, Math.PI * 2);
        const alpha = node.visited ? 1.0 : 0.7;
        ctx.globalAlpha = alpha;
        ctx.fillStyle   = theme.fill;
        ctx.fill();
        ctx.strokeStyle = isSelected ? '#88ccff' : isHovered ? '#ffffff' : theme.stroke;
        ctx.lineWidth   = isSelected || isHovered ? 2.5 : 1.5;
        ctx.stroke();
        ctx.globalAlpha = 1;

        // Type icon (small letter)
        ctx.font      = 'bold 11px "Courier New", monospace';
        ctx.fillStyle = '#1a1208';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(theme.icon, pos.x, pos.y);
        ctx.textBaseline = 'alphabetic';

        // Label below the node
        const labelAlpha = node.visited ? 1.0 : 0.75;
        ctx.globalAlpha  = labelAlpha;
        ctx.font      = `${node.id === worldMap.currentNodeId ? 'bold ' : ''}10px "Courier New", monospace`;
        ctx.fillStyle = '#f0dca0';
        ctx.textAlign = 'center';

        // Label background
        const metrics = ctx.measureText(node.name);
        const lw = metrics.width + 6;
        const lx = pos.x - lw / 2;
        const ly = pos.y + NODE_RADIUS + 4;
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(lx, ly, lw, 14);

        ctx.fillStyle = isCurrent ? '#ffdd66' : '#ddc880';
        ctx.fillText(node.name, pos.x, ly + 11);
        ctx.globalAlpha = 1;
        ctx.textAlign   = 'left';
    }

    _drawEnemyMarker(ctx, mx, my, enemy, state, alpha, now) {
        const sw = 24;
        const sh = 24;

        const IDLE_PERIOD    = 2600;
        const IDLE_AMP_RAD   = 0.02;
        const WALK_AMP_RAD   = 0.09;
        const BREATHE_PERIOD = 3200;
        const BREATHE_AMP_PX = 1.4;

        // Breathing grow
        const breathPhase = (now / BREATHE_PERIOD) * Math.PI * 2 + Math.PI;
        const growPx = (0.5 - 0.5 * Math.cos(breathPhase)) * BREATHE_AMP_PX;

        let swayRot;
        if (state.isWalking) {
            swayRot = Math.sin(state.walkPhase) * WALK_AMP_RAD;
        } else {
            // Offset phase so enemy doesn't sway in sync with the player
            const idlePhase = (now / IDLE_PERIOD) * Math.PI * 2 + Math.PI;
            swayRot = Math.sin(idlePhase) * IDLE_AMP_RAD;
        }

        const footX = mx;
        const footY = my - NODE_RADIUS + 10;
        const spx   = Math.round(footX - sw / 2);
        const spy   = Math.round(footY - sh / 2);

        const sm  = this.skinManager;
        const img = sm && sm.isActive ? sm.getSprite('entities', enemy.spriteKey) : null;

        // Outer save applies the fade alpha to the entire marker
        ctx.save();
        ctx.globalAlpha = alpha;

        // Apply sway rotation + horizontal flip for walk direction
        ctx.save();
        ctx.translate(footX, footY);
        ctx.rotate(swayRot);
        ctx.translate(-footX, -footY);

        if (img) {
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(img, spx, spy - growPx, sw, sh + growPx);
        } else {
            ctx.beginPath();
            ctx.arc(footX, footY - sh / 2, sw / 2, 0, Math.PI * 2);
            ctx.fillStyle = '#c03030';
            ctx.fill();
        }

        ctx.restore();

        // Label
        ctx.font      = 'bold 9px "Courier New", monospace';
        ctx.textAlign = 'center';
        const labelY  = spy - 2;
        const metrics = ctx.measureText(enemy.name);
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(footX - metrics.width / 2 - 2, labelY - 9, metrics.width + 4, 11);
        ctx.fillStyle = '#ff8888';
        ctx.fillText(enemy.name, footX, labelY);
        ctx.textAlign = 'left';

        // Restore outer alpha
        ctx.restore();
    }

    _drawPlayerMarker(ctx, mx, my, now) {
        // Sprite size mirrors battle-renderer's sw/sh = ts/2 where ts=48
        const sw = 24;
        const sh = 24;

        // Procedural animation constants matching battle-renderer.js exactly
        const IDLE_PERIOD    = 2600;
        const IDLE_AMP_RAD   = 0.02;
        const BREATHE_PERIOD = 3200;
        const BREATHE_AMP_PX = 1.4;
        const WALK_AMP_RAD   = 0.09;

        // Breathing grow (expands sprite height slightly)
        const breathPhase = (now / BREATHE_PERIOD) * Math.PI * 2;
        const growPx = (0.5 - 0.5 * Math.cos(breathPhase)) * BREATHE_AMP_PX;

        // Sway rotation: walk sway or idle sway
        let swayRot = 0;
        if (this._isWalking) {
            swayRot = Math.sin(this._walkPhase) * WALK_AMP_RAD;
        } else {
            const idlePhase = (now / IDLE_PERIOD) * Math.PI * 2;
            swayRot = Math.sin(idlePhase) * IDLE_AMP_RAD;
        }

        // Foot point is above the node circle, centered horizontally
        const footX = mx;
        const footY = my - NODE_RADIUS + 10;

        // Top-left of sprite rect (offset down to sit on the shadow)
        const spx = Math.round(footX - sw / 2);
        const spy = Math.round(footY - sh / 2);

        const sm  = this.skinManager;
        const img = sm && sm.isActive ? sm.getSprite('entities', 'knight') : null;

        // Shadow beneath the sprite (on the node surface)
        if (img) {
            const shadowImg = sm.getSprite('effects', 'shadow');
            if (shadowImg) {
                ctx.save();
                ctx.globalAlpha = 0.5;
                ctx.imageSmoothingEnabled = false;
                ctx.drawImage(shadowImg, spx, footY - sh / 2, sw, sh);
                ctx.restore();
            }
        }

        // Apply sway rotation pivoting around foot point
        ctx.save();
        ctx.translate(footX, footY);
        ctx.rotate(swayRot);
        ctx.translate(-footX, -footY);

        if (img) {
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(img, spx, spy - growPx, sw, sh + growPx);
        } else {
            // Fallback: colored circle if sprites unavailable
            ctx.beginPath();
            ctx.arc(footX, footY - sh / 2, sw / 2, 0, Math.PI * 2);
            ctx.fillStyle = '#4a80d0';
            ctx.fill();
        }

        ctx.restore();
    }

    // Hit-test a canvas-space point against nodes (inverts camera transform)
    nodeAtPoint(screenX, screenY, nodes) {
        // Convert screen coords to world coords
        const wx = (screenX - this.camX) / this.camScale;
        const wy = (screenY - this.camY) / this.camScale;
        for (const node of nodes) {
            if (!node.discovered) continue;
            const pos = this._toWorld(node.x, node.y);
            const dx  = wx - pos.x;
            const dy  = wy - pos.y;
            if (dx * dx + dy * dy <= (NODE_RADIUS + 8) * (NODE_RADIUS + 8)) return node.id;
        }
        return null;
    }

    // Zoom toward a screen-space focal point (used by wheel handler)
    zoomAt(screenX, screenY, delta) {
        const MIN_SCALE = 0.4;
        const MAX_SCALE = 3.0;
        const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, this.camScale * (1 + delta)));
        // Adjust offset so the focal point stays fixed
        const ratio = newScale / this.camScale;
        this.camX = screenX - (screenX - this.camX) * ratio;
        this.camY = screenY - (screenY - this.camY) * ratio;
        this.camScale = newScale;
        this._clampCam();
    }
}
