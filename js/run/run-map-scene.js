// The run's home scene: the act map, a sidebar with the party, gold and relics,
// and the screen for whatever is pending at the current node. Battles are pushed
// on top (DeployScene → BattleScene) and come back here when they end.
import { RunMapRenderer } from './run-map-renderer.js';
import { NodeScreens } from './node-screens.js';
import { PartyMenu } from './party-menu.js';
import { RunState } from './run-state.js';
import { RELICS } from './data/relics.js';
import { ENCOUNTERS } from './data/encounters.js';
import { loadProfile, saveProfile, recordRun } from './profile.js';
import { Modal, Toast, BTN, BTN_DANGER, GLOW, RARITY_COLOR, NODE_INFO, FONT, esc, jobLabel, hpBar, portraitHtml, drawSprites } from './ui-kit.js';
import { DeployScene } from '../tactical/deploy-scene.js';
import { BattleScene } from '../tactical/battle-scene.js';
import { openScriptEditor } from '../tactical/ai/script-editor.js';
import { setScriptBacking } from '../tactical/ai/script-store.js';
import { canPromote, canSpendPoints } from '../tactical/loadout.js';

const SIDEBAR_W = 230;

export class RunMapScene {
    constructor(run) {
        this.run = run;
    }

    enter(containerEl, skinManager, sceneManager) {
        this._container = containerEl;
        this._skin = skinManager;
        this._sm = sceneManager;
        setScriptBacking(this.run.scripts);

        containerEl.innerHTML = '';
        containerEl.style.position = 'relative';
        this._canvas = document.createElement('canvas');
        this._canvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;display:block;';
        containerEl.appendChild(this._canvas);
        this._renderer = new RunMapRenderer(this._canvas);

        this._sidebar = document.createElement('div');
        this._sidebar.style.cssText = `
            position:absolute; top:0; right:0; width:${SIDEBAR_W}px; height:100%; box-sizing:border-box;
            background:rgba(8,8,20,0.94); border-left:1px solid #335; padding:10px 9px; overflow-y:auto;
            font-family:${FONT}; font-size:12px; color:#ccc; z-index:10;
        `;
        containerEl.appendChild(this._sidebar);
        this._sidebar.addEventListener('click', (e) => this._onSidebarClick(e));

        this._modal = new Modal(300);
        this._toast = new Toast();
        this._party = new PartyMenu(this._modal, this.run, skinManager, { onChange: () => this._changed() });
        this._screens = new NodeScreens(this._modal, this.run, skinManager, {
            fight: () => this._startBattle(),
            leave: () => this._leaveNode(),
            openParty: (onClose) => this._openParty(onClose),
            changed: () => this._changed(),
            finish: () => this._finish(),
        });

        this._resize();
        window.addEventListener('resize', this._onResize = () => this._resize());
        this._canvas.addEventListener('mousemove', this._onMove = (e) => this._handleMove(e));
        this._canvas.addEventListener('click', this._onClick = (e) => this._handleClick(e));
        this._canvas.addEventListener('wheel', this._onWheel = (e) => { e.preventDefault(); this._renderer.scrollBy(-e.deltaY); }, { passive: false });
        document.addEventListener('keydown', this._onKey = (e) => {
            if (this._modal.isOpen) return;
            if (e.key === 'p' || e.key === 'P') this._openParty();
            if (e.key === 't' || e.key === 'T') this._openTactics();
        });

        this._renderer.focusFloor((this.run.currentNode?.floor ?? 0) + 1);
        this._sidebarKey = null;
        this._afterChange();
    }

    resume(containerEl, skinManager, sceneManager) {
        this.enter(containerEl, skinManager, sceneManager);
    }

    exit() {
        window.removeEventListener('resize', this._onResize);
        document.removeEventListener('keydown', this._onKey);
        this._canvas?.removeEventListener('mousemove', this._onMove);
        this._canvas?.removeEventListener('click', this._onClick);
        this._canvas?.removeEventListener('wheel', this._onWheel);
        this._modal?.destroy();
        this._toast?.destroy();
        this._container.innerHTML = '';
    }

    render(now) {
        this._renderer.render(this.run, now);
        this._updateSidebar();
    }

    // ---- State ----

    _changed() {
        if (this.run.status === 'active') this.run.save();
        this._sidebarKey = null;
    }

    // Saves, then shows whatever is pending (or the end of the run).
    _afterChange() {
        this._changed();
        if (this.run.status !== 'active') return this._endRun();
        this._screens.show();
    }

    _leaveNode() {
        const wasBoss = this.run.currentNode?.type === 'boss';
        const act = this.run.act;
        this.run.leaveNode();
        this._modal.close();
        // Keep the next choices in view.
        this._renderer.focusFloor((this.run.currentNode?.floor ?? 0) + 1);
        if (wasBoss && this.run.status === 'active' && this.run.act !== act) {
            this._toast.show(`Act ${this.run.act}: ${ENCOUNTERS[this.run.act].name}`, 4000);
        }
        this._afterChange();
    }

    _endRun() {
        if (this.run.renownEarned == null) {
            const profile = loadProfile();
            this.run.renownEarned = recordRun(profile, this.run);
            saveProfile(profile);
            RunState.clearSave();
        }
        this._screens.runOver();
    }

    _finish() {
        this._modal.close();
        this._sm.pop();
    }

    // ---- Battle ----

    _startBattle() {
        const run = this.run;
        const encounter = run.pending.encounter;
        const deploy = new DeployScene(encounter, run, this._skin, this._sm, (mapDef, spawns) => {
            this._sm.replace(new BattleScene(encounter, run, () => this._afterChange(), { mapDef, customPlayerSpawns: spawns }));
        });
        this._sm.push(deploy);
    }

    // ---- Menus ----

    _openParty(onClose = null) {
        this._party.onClose = onClose ? () => { this._party.onClose = null; onClose(); } : null;
        this._party.showList();
    }

    _openTactics() {
        openScriptEditor(this.run.party, {
            onSaved: (name) => { this._changed(); this._toast.show(`${name}'s tactics saved.`); },
        });
    }

    _onSidebarClick(e) {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        switch (btn.dataset.action) {
            case 'party': this._openParty(this.run.pending ? () => this._screens.show() : null); break;
            case 'member':
                this._openParty(this.run.pending ? () => this._screens.show() : null);
                this._party.showMember(btn.dataset.member);
                break;
            case 'tactics': this._openTactics(); break;
            case 'resume': this._screens.show(); break;
            case 'abandon':
                if (window.confirm('Abandon this run? It will count as a defeat.')) {
                    this.run.status = 'lost';
                    this._modal.close();
                    this._endRun();
                }
                break;
            case 'quit':
                this._modal.close();
                this._sm.pop();
                break;
        }
    }

    _updateSidebar() {
        const run = this.run;
        const key = JSON.stringify([run.gold, run.act, run.currentNodeId, run.relics, run.status, !!run.pending,
            run.party.map(m => [m.name, m.job, m.hp, m.level, m.xp, m.sp, m.learned.length, JSON.stringify(m.ranks), m.loadout?.support, m.appearance?.armorKey, m.appearance?.weaponKey, m.appearance?.helmetKey, m.appearance?.toolKey])]);
        if (key === this._sidebarKey) return;
        this._sidebarKey = key;

        const floor = run.currentNode?.floor ?? 0;
        let html = `<div style="color:#ffcc44;font-weight:bold;font-size:13px;">Act ${run.act}: ${esc(ENCOUNTERS[run.act].name)}</div>
            <div style="color:#888;font-size:10px;margin-bottom:8px;">Floor ${floor} of 15</div>
            <div style="display:flex;justify-content:space-between;margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid #335;">
                <span style="color:#fc8;">★ ${run.gold} gold</span><span style="color:#888;">${Object.values(run.inventory).reduce((s, n) => s + n, 0)} in bag</span>
            </div>`;

        html += `<div style="color:#fc8;font-size:10px;text-transform:uppercase;margin-bottom:5px;">Party (${run.party.length}/6)</div>`;
        for (const m of run.party) {
            const hp = run.hp(m), max = run.maxHp(m);
            const spend = canSpendPoints(m);
            html += `<div data-action="member" data-member="${esc(m.name)}" title="Open ${esc(m.name)}" style="display:flex;gap:7px;align-items:center;margin-bottom:5px;padding:3px;border:1px solid ${spend ? '#6f6' : 'transparent'};border-radius:4px;cursor:pointer;${spend ? GLOW : ''}">
                ${portraitHtml(m, 26)}
                <div style="flex:1;min-width:0;">
                    <div style="color:${m.appearance?.nameColor || '#ccc'};font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(m.name)}${canPromote(m) ? ' <span style="color:#fc6;">★</span>' : ''}</div>
                    <div style="font-size:9px;color:#777;text-transform:uppercase;">Lv ${m.level} ${jobLabel(m.job)} ${spend ? `<span style="color:#afa;font-weight:bold;">● ${m.sp} SP</span>` : ''}</div>
                    <div style="font-size:9px;color:#999;">${hpBar(hp, max, 70)} ${hp}/${max}</div>
                </div>
            </div>`;
        }

        html += `<div style="height:6px;"></div>
            <button data-action="party" style="${BTN}color:#adf;border-color:#448;${run.party.some(canSpendPoints) ? GLOW : ''}">☰ Party <span style="color:#666;font-size:10px;">(P)</span>${run.party.some(canSpendPoints) ? ' <span style="color:#afa;font-size:10px;">● skill points!</span>' : ''}</button>
            <button data-action="tactics" style="${BTN}color:#cf9;border-color:#575;">⚙ Tactics <span style="color:#666;font-size:10px;">(T, optional)</span></button>`;
        if (run.pending && run.status === 'active') {
            html += `<button data-action="resume" style="${BTN}color:#fc8;border-color:#664;">› Return to ${esc(NODE_INFO[run.currentNode?.type]?.label ?? 'node')}</button>`;
        }

        html += `<div style="color:#fc8;font-size:10px;text-transform:uppercase;margin:10px 0 5px;">Relics</div>`;
        if (!run.relics.length) html += `<div style="color:#555;font-size:10px;">None yet</div>`;
        for (const k of run.relics) {
            const r = RELICS[k];
            html += `<div title="${esc(r.desc)}" style="font-size:11px;color:${RARITY_COLOR[r.rarity]};margin-bottom:2px;cursor:help;">◆ ${esc(r.name)}</div>`;
        }

        html += `<div style="color:#fc8;font-size:10px;text-transform:uppercase;margin:12px 0 5px;">Legend</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:2px;font-size:10px;">
            ${Object.values(NODE_INFO).map(i => `<span><span style="color:${i.color};">${i.icon}</span> ${i.label}</span>`).join('')}</div>
            <div style="color:#666;font-size:10px;margin-top:6px;">Click a glowing node to travel. Scroll to look ahead.</div>
            <div style="margin-top:14px;border-top:1px solid #223;padding-top:8px;">
                <button data-action="quit" style="${BTN}color:#888;">Save &amp; quit to title</button>
                <button data-action="abandon" style="${BTN}${BTN_DANGER}">Abandon run</button>
            </div>`;
        this._sidebar.innerHTML = html;
        drawSprites(this._sidebar, run.party, this._skin);
    }

    // ---- Map input ----

    _resize() {
        const rect = this._container.getBoundingClientRect();
        this._renderer.resize(rect.width || window.innerWidth, rect.height || window.innerHeight, SIDEBAR_W);
    }

    _point(e) {
        const r = this._canvas.getBoundingClientRect();
        return { x: e.clientX - r.left, y: e.clientY - r.top };
    }

    _handleMove(e) {
        const p = this._point(e);
        const id = this._renderer.nodeAt(this.run, p.x, p.y);
        this._renderer.hoveredId = id;
        this._canvas.style.cursor = id && this.run.reachable().includes(id) ? 'pointer' : 'default';
    }

    _handleClick(e) {
        if (this._modal.isOpen) return;
        const p = this._point(e);
        const id = this._renderer.nodeAt(this.run, p.x, p.y);
        if (!id) return;
        if (!this.run.reachable().includes(id)) {
            if (this.run.pending) this._screens.show();
            return;
        }
        this.run.enterNode(id);
        this._afterChange();
    }
}
