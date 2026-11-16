// Draws an act map: floors bottom to top, edges, node icons, the route taken so
// far and the nodes the party can move to. Scrolls vertically.
import { LANES, BOSS_FLOOR } from './map-gen.js';
import { NODE_INFO, FONT } from './ui-kit.js';

const ROW_H = 74;
const MARGIN_Y = 70;

// Small deterministic offset per node so the grid doesn't look rigid.
function jitter(id, salt) {
    let h = 2166136261 ^ salt;
    for (const c of id) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    return ((h >>> 0) % 1000) / 1000 - 0.5;
}

export class RunMapRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.mapWidth = 600;      // drawable width (canvas minus a side panel)
        this.insets = { top: 0, bottom: 0, right: 0 };
        this.scrollY = 0;         // 0 = bottom of the map in view
        this.hoveredId = null;
    }

    // insets: pixels the HUD covers on each side ({ top, bottom, right }).
    resize(w, h, insets = {}) {
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = Math.round(w * dpr);
        this.canvas.height = Math.round(h * dpr);
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.w = w;
        this.h = h;
        this.insets = { top: 0, bottom: 0, right: 0, ...insets };
        this.mapWidth = Math.max(240, w - this.insets.right);
        this._clamp();
    }

    // Height of the part of the canvas the HUD leaves visible.
    get viewHeight() {
        return Math.max(100, this.h - this.insets.top - this.insets.bottom);
    }

    get contentHeight() {
        return MARGIN_Y * 2 + (BOSS_FLOOR - 1) * ROW_H;
    }

    _clamp() {
        const max = Math.max(0, this.contentHeight - this.viewHeight);
        this.scrollY = Math.max(0, Math.min(max, this.scrollY));
    }

    scrollBy(dy) {
        this.scrollY += dy;
        this._clamp();
    }

    // Scroll so `floor` sits about a third of the way up the screen.
    focusFloor(floor) {
        this.scrollY = (floor - 1) * ROW_H + MARGIN_Y - this.viewHeight * 0.35;
        this._clamp();
    }

    nodePos(node) {
        const colW = Math.min(110, (this.mapWidth - 30) / LANES);
        const left = (this.mapWidth - colW * LANES) / 2;
        const boss = node.type === 'boss';
        const x = left + (node.lane + 0.5) * colW + (boss ? 0 : jitter(node.id, 1) * colW * 0.35);
        const y = this.h - this.insets.bottom - MARGIN_Y - (node.floor - 1) * ROW_H + this.scrollY + (boss ? -10 : jitter(node.id, 2) * ROW_H * 0.3);
        // Narrow screens get smaller nodes so neighbouring lanes don't overlap.
        const r = Math.min(boss ? 26 : 15, Math.max(boss ? 18 : 11, colW * 0.3));
        return { x, y, r: boss ? Math.max(r, 20) : r };
    }

    nodeAt(run, px, py) {
        for (const n of Object.values(run.map.nodes)) {
            const p = this.nodePos(n);
            if (Math.hypot(px - p.x, py - p.y) <= p.r + 4) return n.id;
        }
        return null;
    }

    render(run, now) {
        const { ctx } = this;
        const map = run.map;
        ctx.fillStyle = '#0b0b16';
        ctx.fillRect(0, 0, this.w, this.h);

        // Faint floor bands
        ctx.fillStyle = 'rgba(255,255,255,0.02)';
        for (let f = 1; f <= BOSS_FLOOR; f += 2) {
            const y = this.h - this.insets.bottom - MARGIN_Y - (f - 1) * ROW_H + this.scrollY;
            ctx.fillRect(0, y - ROW_H / 2, this.mapWidth, ROW_H);
        }

        const visited = new Set(run.visited);
        const routeEdges = new Set();
        for (let i = 1; i < run.visited.length; i++) routeEdges.add(`${run.visited[i - 1]}>${run.visited[i]}`);
        const reachable = new Set(run.reachable());

        // Edges
        for (const n of Object.values(map.nodes)) {
            const a = this.nodePos(n);
            for (const id of n.next) {
                const b = this.nodePos(map.nodes[id]);
                const onRoute = routeEdges.has(`${n.id}>${id}`);
                const live = n.id === run.currentNodeId && reachable.has(id);
                ctx.strokeStyle = onRoute ? '#ccb070' : live ? '#7bf' : 'rgba(120,120,170,0.35)';
                ctx.lineWidth = onRoute || live ? 3 : 1.5;
                ctx.setLineDash(onRoute || live ? [] : [4, 5]);
                ctx.beginPath();
                ctx.moveTo(a.x, a.y);
                ctx.lineTo(b.x, b.y);
                ctx.stroke();
            }
        }
        ctx.setLineDash([]);

        // Nodes
        const pulse = 0.5 + 0.5 * Math.sin(now / 250);
        for (const n of Object.values(map.nodes)) {
            const p = this.nodePos(n);
            if (p.y < -40 || p.y > this.h + 40) continue;
            const info = NODE_INFO[n.type] || NODE_INFO.combat;
            const isCurrent = n.id === run.currentNodeId;
            const canGo = reachable.has(n.id);
            const done = visited.has(n.id) && !isCurrent;
            const past = !canGo && !isCurrent && !done && run.currentNodeId && n.floor <= (run.currentNode?.floor ?? 0);

            if (canGo) {
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r + 5 + pulse * 3, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(120,190,255,${0.15 + pulse * 0.2})`;
                ctx.fill();
            }
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = done ? '#2a2618' : '#15152a';
            ctx.fill();
            ctx.lineWidth = isCurrent ? 3 : n.id === this.hoveredId ? 2.5 : 1.5;
            ctx.strokeStyle = isCurrent ? '#fff' : done ? '#ccb070' : info.color;
            ctx.globalAlpha = past ? 0.3 : 1;
            ctx.stroke();

            ctx.fillStyle = done ? '#a98' : info.color;
            ctx.font = `bold ${Math.round(p.r * (n.type === 'boss' ? 1 : 1.07))}px ${FONT}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(info.icon, p.x, p.y + 1);
            ctx.globalAlpha = 1;
        }

        // Hover label
        const hov = this.hoveredId && map.nodes[this.hoveredId];
        if (hov) {
            const p = this.nodePos(hov);
            const label = (NODE_INFO[hov.type] || NODE_INFO.combat).label;
            ctx.font = `12px ${FONT}`;
            const w = ctx.measureText(label).width + 14;
            ctx.fillStyle = 'rgba(8,8,24,0.95)';
            ctx.fillRect(p.x - w / 2, p.y - p.r - 26, w, 18);
            ctx.strokeStyle = '#557';
            ctx.lineWidth = 1;
            ctx.strokeRect(p.x - w / 2, p.y - p.r - 26, w, 18);
            ctx.fillStyle = '#ddd';
            ctx.fillText(label, p.x, p.y - p.r - 17);
        }
    }
}
