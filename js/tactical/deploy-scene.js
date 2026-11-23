import { loadMapData, posKey } from './battle-map.js';
import { Sound } from '../audio/sound.js';
import { battleMusic } from '../audio/game-sounds.js';
import { MAP_DATA } from './data/maps/index.js';
import { pickRealmMap, realmLook } from '../run/data/realms.js';
import { viewState } from './view-state.js';
import { BattleView3D, showViewError } from './battle-view3d.js';
import { STATES } from './battle.js';
import { CHARACTER_DATA } from './data/characters.js';
import { buildUnits, encounterEnemies } from './build-units.js';
import { Modal, esc } from '../run/ui-kit.js';
import { coachTip } from '../ui/coach.js';
import { AFFIXES, knownAffixes, affixedName } from '../run/data/affixes.js';
import { PartyMenu } from '../run/party-menu.js';
import { attachTouchGestures } from './touch-gestures.js';
import { isPortrait, isTouch } from '../ui/layout.js';

// Minimal battle-like object the renderer can consume without running the CT engine.
class DeployPreview {
    constructor(map, units) {
        this.map          = map;
        this.units        = units;
        this.activeUnit   = null;
        this.state        = STATES.PLAYER_TURN;
        this.hoverTile    = null;
        this.moveRange    = new Set();
        this.abilityRange = new Set();
        this.aoePreview   = new Set();
        this.hitPreview   = new Set();
    }
    getRangeHighlights() {
        return {
            move:    this.moveRange,
            ability: this.abilityRange,
            aoe:     this.aoePreview,
            hit:     this.hitPreview,
        };
    }
}

const BTN = `
    display:block; width:100%; padding:6px 10px; margin-bottom:5px;
    background:#151528; border:1px solid #447; color:#ccc;
    font-family:'Courier New',monospace; font-size:12px;
    cursor:pointer; text-align:left; border-radius:3px;
`;

export class DeployScene {
    // encounter: the fight (see run/data/encounters.js), or null for the default enemies.
    // run: the RunState whose party deploys, or null (harnesses use the default party).
    constructor(encounter, run, skinManager, sceneManager, onLaunch) {
        this._encounter   = encounter;
        this._run         = run;
        this._skinManager = skinManager;
        this._sm          = sceneManager;
        this._onLaunch    = onLaunch;  // (mapDef, customPlayerSpawns, cameraState) => void
        this._stopped     = false;
        this._container   = null;
        this._renderer    = null;
        this._preview     = null;
        this._mapDef      = null;
        this._overlay     = null;
        this._editorUI    = null;

        this._playerSpawns   = [];   // [{x,y}] — player unit positions, index = party index
        this._selectedUnit   = null; // party index currently selected for repositioning
        this._panDrag        = false;
        this._panActive      = false;
        this._panButton      = -1;
        this._panStart       = { x: 0, y: 0 };
        this._PAN_THRESHOLD  = 4;
    }

    enter(containerEl, skinManager, sceneManager) {
        this._container  = containerEl;
        this._sm         = sceneManager;
        this._stopped    = false;

        // The encounter keeps the map it was first shown on, so backing out of
        // deployment doesn't reroll the battlefield.
        const enc = this._encounter;
        this._mapDef = MAP_DATA.find(m => m.id === (enc?.map ?? enc?.mapId))
            ?? pickRealmMap(enc?.zone ?? enc?.realm);
        if (enc && !enc.map) {
            enc.mapId = this._mapDef.id;
            this._run?.save();
        }
        const map    = loadMapData(this._mapDef);
        map.look     = realmLook(enc?.zone ?? enc?.realm);
        Sound.playMusic(battleMusic(enc, this._run));

        this._playerSpawns = map.playerSpawns.map(s => ({ ...s }));

        const units = this._buildPreviewUnits(map);
        this._preview = new DeployPreview(map, units);

        containerEl.innerHTML = '';
        containerEl.style.position = 'relative';
        document.getElementById('game-container')?.classList.add('tactical-mode');

        try {
            this._renderer = new BattleView3D(containerEl, skinManager);
        } catch (err) {
            this._stopped = true;
            showViewError(containerEl, err, () => this._sm.pop());
            return;
        }
        // The side panel covers the left 220px, so center the map in what is left.
        this._renderer.setInsets(220, 0);
        this._detachTouch = attachTouchGestures(this._renderer.canvas, this._renderer);
        this._renderer.onCenterRequest = () => this._centerOnMap();
        this._renderer.showFreeCameraButton(false);   // nothing to track while deploying

        // The view starts framing the whole map, which is what the deploy screen wants.

        this._buildOverlay(containerEl);
        this._highlightSpawnTiles();

        coachTip('deploy');
        this._renderer.canvas.addEventListener('mousedown',   this._onMouseDown   = e => this._handleMouseDown(e));
        this._renderer.canvas.addEventListener('mousemove',   this._onMouseMove   = e => this._handleMouseMove(e));
        this._renderer.canvas.addEventListener('mouseup',     this._onMouseUp     = e => this._handleMouseUp(e));
        this._renderer.canvas.addEventListener('contextmenu', this._onContextMenu = e => { e.preventDefault(); this._cancelSelect(); });
        this._renderer.canvas.addEventListener('wheel',       this._onWheel       = e => {
            e.preventDefault();
            this._renderer.zoomBy(e.deltaY > 0 ? -2 : 2);
        }, { passive: false });
        document.addEventListener('keydown', this._onKeydown = e => this._handleKeydown(e));
        document.addEventListener('keyup',   this._onKeyup   = e => this._handleKeyup(e));
    }

    exit() {
        this._stopped = true;
        this._removeListeners();
        this._editorUI?.destroy();
        this._editorUI = null;
        this._overlay?.remove();
        this._overlay = null;
        this._renderer?.dispose();
        document.getElementById('game-container')?.classList.remove('tactical-mode');
        this._container.innerHTML = '';
    }

    resume() {}

    /** True while the preview still animates (a camera glide or turn), for Low power when idle. */
    isBusy() {
        if (this._stopped || !this._preview) return false;
        return this._renderer?.isBusy(this._preview.units ?? []) ?? false;
    }

    render(now) {
        if (this._stopped) return;
        // The panel sits on the left in landscape and along the bottom in portrait.
        if (this._renderer && this._overlay) {
            if (isPortrait()) this._renderer.setInsets(0, 0, 0, this._overlay.offsetHeight);
            else this._renderer.setInsets(220, 0);
        }
        this._renderer?.render(this._preview, now);
    }

    // ---- Side panel ----------------------------------------------------------

    _buildOverlay(containerEl) {
        const el = document.createElement('div');
        el.style.cssText = `
            position:absolute; top:0; left:0; width:220px; height:100%;
            background:rgba(8,8,20,0.93); border-right:1px solid #335;
            padding:10px 10px; box-sizing:border-box;
            overflow-y:auto; pointer-events:auto;
            font-family:'Courier New',monospace; font-size:12px; color:#ccc;
            z-index:20;
        `;
        el.className = 'deploy-panel';
        containerEl.appendChild(el);
        this._overlay = el;
        this._rebuildOverlay();
    }

    _rebuildOverlay() {
        const el = this._overlay;
        if (!el) return;
        const party    = this._party();
        const roster   = this._encounter?.roster ?? encounterEnemies(null);

        let html = `
            <div style="color:#ffcc44;font-weight:bold;font-size:14px;margin-bottom:2px;">Deploy Party</div>
            <div class="deploy-help" style="color:#888;font-size:10px;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid #335;">
                ${isTouch() ? 'Tap' : 'Select'} a party member, then ${isTouch() ? 'tap' : 'click'} a highlighted tile to move them.
            </div>
        `;

        // Enemy summary
        if (roster.length) {
            html += `<div style="color:#fc8;font-size:10px;text-transform:uppercase;margin-bottom:5px;">Enemy Forces</div>`;
            const counts = {};
            for (const r of roster) {
                const label = (r.name || r.job || '?').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                const name = affixedName(label, r.affixes);
                counts[name] = (counts[name] || 0) + 1;
            }
            for (const [name, n] of Object.entries(counts)) {
                html += `<div class="deploy-enemy" style="color:#f88;font-size:11px;margin-bottom:2px;">&#x2694; ${esc(name)}${n > 1 ? ` ×${n}` : ''}</div>`;
            }
            // Elite affixes, as on the briefing: the name, with what it does on hover or hold.
            for (const k of roster.flatMap(r => knownAffixes(r.affixes))) {
                html += `<div class="deploy-enemy" data-tip="${esc(`${AFFIXES[k].name}\n${AFFIXES[k].desc}`)}" style="font-size:10px;margin:0 0 2px 12px;color:#fb6;cursor:help;">✦ ${esc(AFFIXES[k].name)}</div>`;
            }
            html += `<div class="deploy-gap" style="height:8px;"></div>`;
        }

        // Party members
        html += `<div style="color:#fc8;font-size:10px;text-transform:uppercase;margin-bottom:6px;">Your Party</div>
            <div class="deploy-cards">`;
        for (let i = 0; i < party.length; i++) {
            const member = party[i];
            const a = member.appearance;
            const nameColor = a?.nameColor || '#ccc';
            const jobLabel  = (member.job || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            const isSelected = this._selectedUnit === i;

            html += `
                <div class="deploy-card" data-idx="${i}"
                     style="display:flex;gap:8px;align-items:center;
                            margin-bottom:6px;padding:7px 8px;cursor:pointer;
                            background:${isSelected ? '#0a1830' : '#0d0d20'};
                            border:${isSelected ? '2px solid #7bf' : '1px solid #335'};
                            border-radius:5px;">
                    <canvas class="deploy-portrait" data-member="${member.name}"
                            width="28" height="28"
                            style="image-rendering:pixelated;flex-shrink:0;
                                   border:1px solid #446;border-radius:3px;background:#080818;"></canvas>
                    <div style="flex:1;min-width:0;">
                        <div style="font-size:12px;font-weight:bold;color:${nameColor};
                                    white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                            ${member.name}
                        </div>
                        <div style="font-size:10px;color:#666;">${jobLabel}</div>
                    </div>
                    ${this._run ? `<button class="deploy-edit-btn" data-idx="${i}"
                            style="padding:3px 7px;font-family:inherit;font-size:10px;
                                   background:#0d1220;border:1px solid #447;color:#9cf;
                                   cursor:pointer;border-radius:3px;flex-shrink:0;white-space:nowrap;">
                        Edit
                    </button>` : ''}
                </div>`;
        }
        html += `</div>`;

        html += `
            <div class="deploy-footer" style="margin-top:8px;padding-top:8px;border-top:1px solid #335;">
                <div class="deploy-keys" style="font-size:10px;color:#888;margin-bottom:8px;">
                    ${isTouch() ? 'Drag to pan &bull; Pinch to zoom' : 'Q/E rotate &bull; Drag to pan &bull; Scroll zoom &bull; Enter to begin'}
                </div>
                <button id="deploy-begin"
                        style="${BTN}background:#1a1428;border-color:#74a;color:#daf;
                               text-align:center;font-weight:bold;font-size:13px;padding:9px 10px;">
                    &#x2694; Begin Battle
                </button>
                <button id="deploy-cancel"
                        style="${BTN}color:#666;text-align:center;margin-top:2px;">
                    ‹ Cancel
                </button>
            </div>`;

        el.innerHTML = html;

        // Draw portraits
        if (this._skinManager) {
            el.querySelectorAll('.deploy-portrait').forEach(canvas => {
                const m = party.find(p => p.name === canvas.dataset.member);
                if (!m?.appearance) return;
                const a = m.appearance;
                const img = this._skinManager.getCompositedColonistSprite(
                    'deploy_' + m.name, false,
                    a.race, a.armorKey, a.helmetKey,
                    a.bodyVariant, a.hairVariant, a.shirtVariant,
                    a.nameColor, a.weaponKey, a.toolKey, null, false
                );
                if (!img) return;
                const ctx = canvas.getContext('2d');
                ctx.imageSmoothingEnabled = false;
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            });
        }

        el.querySelectorAll('.deploy-card').forEach(card => {
            card.addEventListener('click', e => {
                if (e.target.closest('.deploy-edit-btn')) return;
                this._toggleSelectUnit(parseInt(card.dataset.idx, 10));
            });
        });

        el.querySelectorAll('.deploy-edit-btn').forEach(btn => {
            btn.addEventListener('click', e => {
                e.stopPropagation();
                this._openMemberEditor(parseInt(btn.dataset.idx, 10));
            });
        });

        el.querySelector('#deploy-begin')?.addEventListener('click',  () => this._launchBattle());
        el.querySelector('#deploy-cancel')?.addEventListener('click', () => this._sm.pop());
    }

    _toggleSelectUnit(idx) {
        this._selectedUnit = (this._selectedUnit === idx) ? null : idx;
        this._rebuildOverlay();
        this._highlightSpawnTiles();
    }

    _cancelSelect() {
        if (this._selectedUnit !== null) {
            this._selectedUnit = null;
            this._rebuildOverlay();
            this._highlightSpawnTiles();
        }
    }

    _highlightSpawnTiles() {
        this._preview.moveRange = new Set(this._playerSpawns.map(posKey));
        this._preview.hoverTile = null;
    }

    // ---- Party member editor -------------------------------------------------

    _party() {
        return this._run?.party ?? CHARACTER_DATA.filter(c => c.team === 'player');
    }

    _buildPreviewUnits(map) {
        return buildUnits({ party: this._run?.party, encounter: this._encounter, relics: this._run?.relics },
            this._playerSpawns, map.enemySpawns);
    }

    _openMemberEditor(idx) {
        const run = this._run;
        const member = run?.party[idx];
        if (!member) return;
        this._closeEditor(false);
        const modal = new Modal(300);
        this._editorUI = modal;
        const menu = new PartyMenu(modal, run, this._skinManager, {
            onChange: () => run.save(),
            onClose: () => this._closeEditor(),
        });
        menu.showMember(member.name);
    }

    _closeEditor(refresh = true) {
        if (this._editorUI) {
            const modal = this._editorUI;
            this._editorUI = null;
            modal.destroy();
        }
        if (!refresh) return;
        // Refresh preview units in case skills or equipment changed.
        this._refreshPreviewUnits();
        this._rebuildOverlay();
        this._highlightSpawnTiles();
    }

    // ---- Canvas input --------------------------------------------------------

    _handleMouseDown(e) {
        if (e.button === 0 || e.button === 1) {
            this._panDrag   = true;
            this._panActive = false;
            this._panButton = e.button;
            this._panStart  = { x: e.clientX, y: e.clientY };
            if (e.button === 1) e.preventDefault();
        }
    }

    _handleMouseMove(e) {
        if (this._panDrag) {
            const dx = e.clientX - this._panStart.x;
            const dy = e.clientY - this._panStart.y;
            if (!this._panActive && Math.sqrt(dx * dx + dy * dy) >= this._PAN_THRESHOLD) {
                this._panActive = true;
                this._renderer.beginPan();
            }
            if (this._panActive) {
                this._renderer.panByPixels(dx, dy);
                return;
            }
        }
        const tile = this._renderer.pickTile(e.clientX, e.clientY, this._preview.map, this._preview.units);
        if (!tile) { this._preview.hoverTile = null; return; }
        this._preview.hoverTile = posKey(tile);
    }

    _handleMouseUp(e) {
        const wasDragging = this._panActive;
        if (e.button === this._panButton) {
            this._panDrag   = false;
            this._panActive = false;
            this._renderer.endPan();
        }

        if (e.button === 0 && !wasDragging) {
            this._handleCanvasTileClick(e.clientX, e.clientY);
        }
    }

    _centerOnMap() {
        this._renderer.fitToMap();
    }

    _handleCanvasTileClick(clientX, clientY) {
        const map  = this._preview.map;
        const tile = this._renderer.pickTile(clientX, clientY, map, this._preview.units);
        if (!tile) { if (this._selectedUnit !== null) this._cancelSelect(); return; }

        if (this._selectedUnit !== null) {
            const tileKey   = posKey(tile);
            const targetIdx = this._playerSpawns.findIndex(s => posKey(s) === tileKey);
            if (targetIdx !== -1) {
                if (targetIdx !== this._selectedUnit) {
                    // Swap the two spawn positions.
                    const tmp = { ...this._playerSpawns[this._selectedUnit] };
                    this._playerSpawns[this._selectedUnit] = { ...this._playerSpawns[targetIdx] };
                    this._playerSpawns[targetIdx] = tmp;
                }
                this._selectedUnit = null;
                this._refreshPreviewUnits();
                this._rebuildOverlay();
                this._highlightSpawnTiles();
            } else {
                // Tapped a non-spawn tile — deselect.
                this._cancelSelect();
            }
            return;
        }

        // No selection: clicking a spawn tile selects the party member there.
        const idx = this._playerSpawns.findIndex(s => posKey(s) === posKey(tile));
        if (idx !== -1) this._toggleSelectUnit(idx);
    }

    _handleKeydown(e) {
        if (this._editorUI) return;   // the member editor has the keyboard
        const ARROW_PAN = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
        const panDir = ARROW_PAN[e.key];
        if (panDir) { this._renderer.setPanKey(panDir, true); e.preventDefault(); return; }
        if (e.key === 'q' || e.key === 'Q') { this._renderer.rotateView(-1); e.preventDefault(); return; }
        if (e.key === 'e' || e.key === 'E') { this._renderer.rotateView( 1); e.preventDefault(); return; }
        if (e.key === 'f' || e.key === 'F') {
            this._centerOnMap();
            e.preventDefault(); return;
        }
        if (e.key === 'Escape')             { this._cancelSelect(); return; }
        if (e.key === 'Enter')              { this._launchBattle(); return; }
    }

    _handleKeyup(e) {
        const ARROW_PAN = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
        const panDir = ARROW_PAN[e.key];
        if (panDir) { this._renderer.setPanKey(panDir, false); return; }
    }

    _removeListeners() {
        this._detachTouch?.();
        const c = this._renderer?.canvas;
        if (c) {
            c.removeEventListener('mousedown',   this._onMouseDown);
            c.removeEventListener('mousemove',   this._onMouseMove);
            c.removeEventListener('mouseup',     this._onMouseUp);
            c.removeEventListener('contextmenu', this._onContextMenu);
            c.removeEventListener('wheel',       this._onWheel);
        }
        document.removeEventListener('keydown', this._onKeydown);
        document.removeEventListener('keyup',   this._onKeyup);
    }

    // ---- Preview refresh -----------------------------------------------------

    _refreshPreviewUnits() {
        const units = this._buildPreviewUnits(this._preview.map);
        // Clear the facing-change transition fields so the renderer draws units
        // at their final facing immediately with no turn animation.
        for (const u of units) {
            viewState(u).prevFacing     = null;
            viewState(u).facingChangeAt = null;
        }
        this._preview.units = units;
    }

    // ---- Launch --------------------------------------------------------------

    _launchBattle() {
        this._closeEditor(false);
        // The battle keeps the camera where the player left it while deploying.
        if (this._onLaunch) this._onLaunch(this._mapDef, this._playerSpawns, this._renderer?.getCameraState() ?? null);
    }
}
