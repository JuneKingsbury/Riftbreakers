import { loadMapData } from './battle-map.js';
import { MAP_DATA } from './data/maps.js';
import { createUnitFromCharData, faceToward } from './units.js';
import { BattleRenderer } from './battle-renderer.js';
import { STATES } from './battle.js';
import { CHARACTER_DATA } from './data/characters.js';
import { BATTLE_SCENARIOS } from './world-map-data.js';
import { equipmentStatBonuses } from './data/equipment.js';
import { unlockedAbilities } from './data-registry.js';
import { WorldMapUI } from './world-map-ui.js';

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

function buildPreviewUnits(worldMap, scenarioId, playerSpawns, enemySpawns) {
    const partyData  = worldMap?.party ?? CHARACTER_DATA.filter(c => c.team === 'player');
    const scenario   = BATTLE_SCENARIOS[scenarioId];
    const rosterDefs = scenario?.roster;
    const enemyData  = rosterDefs
        ? rosterDefs.map(r => ({
            name: r.name, job: r.job, team: 'enemy',
            x: 20, y: 8, ct: r.ct ?? 0,
            statMods: r.statMods ?? {},
            extraAbilities: r.extraAbilities ?? [],
            appearance: r.appearance ?? null,
        }))
        : CHARACTER_DATA.filter(c => c.team === 'enemy');

    const units = [...partyData, ...enemyData].map(charData => {
        const equipBonuses = equipmentStatBonuses(charData.appearance);
        const mergedMods   = { ...(charData.statMods || {}) };
        for (const [k, v] of Object.entries(equipBonuses)) {
            mergedMods[k] = (mergedMods[k] || 0) + v;
        }
        let spawnX = charData.x, spawnY = charData.y;
        if (charData.team === 'player') {
            const idx = partyData.indexOf(charData);
            const sp  = playerSpawns?.[idx];
            if (sp) { spawnX = sp.x; spawnY = sp.y; }
        } else {
            const idx = enemyData.indexOf(charData);
            const sp  = enemySpawns?.[idx];
            if (sp) { spawnX = sp.x; spawnY = sp.y; }
        }
        const unit = createUnitFromCharData({ ...charData, statMods: mergedMods, x: spawnX, y: spawnY });
        if (charData.xp) {
            const unlocked   = new Set(unlockedAbilities(charData.job, charData.xp));
            const crossSlots = new Set([charData.supportSkill, charData.supportPassive].filter(Boolean));
            unit.abilities   = unit.abilities.filter(k => unlocked.has(k) || crossSlots.has(k));
        }
        return unit;
    });

    const players  = units.filter(u => u.team === 'player');
    const enemies  = units.filter(u => u.team === 'enemy');
    const avg      = (arr, key) => arr.reduce((s, u) => s + u[key], 0) / (arr.length || 1);
    const enemyCx  = avg(enemies, 'x'), enemyCy = avg(enemies, 'y');
    const playerCx = avg(players, 'x'), playerCy = avg(players, 'y');
    players.forEach(u => faceToward(u, enemyCx, enemyCy));
    enemies.forEach(u => faceToward(u, playerCx, playerCy));
    return units;
}

const BTN = `
    display:block; width:100%; padding:6px 10px; margin-bottom:5px;
    background:#151528; border:1px solid #447; color:#ccc;
    font-family:'Courier New',monospace; font-size:12px;
    cursor:pointer; text-align:left; border-radius:3px;
`;

export class DeployScene {
    constructor(scenarioId, worldMap, skinManager, sceneManager, onLaunch) {
        this._scenarioId  = scenarioId;
        this._worldMap    = worldMap;
        this._skinManager = skinManager;
        this._sm          = sceneManager;
        this._onLaunch    = onLaunch;  // (mapDef, customPlayerSpawns) => void
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
        this._panCam         = { x: 0, y: 0 };
        this._PAN_THRESHOLD  = 4;
    }

    enter(containerEl, skinManager, sceneManager) {
        this._container  = containerEl;
        this._sm         = sceneManager;
        this._stopped    = false;

        this._mapDef = MAP_DATA[Math.floor(Math.random() * MAP_DATA.length)];
        const map    = loadMapData(this._mapDef);

        this._playerSpawns = map.playerSpawns.map(s => ({ ...s }));

        const units = buildPreviewUnits(this._worldMap, this._scenarioId, this._playerSpawns, map.enemySpawns);
        this._preview = new DeployPreview(map, units);

        containerEl.innerHTML = '';
        containerEl.style.position = 'relative';
        document.getElementById('game-container')?.classList.add('tactical-mode');

        this._renderer = new BattleRenderer(containerEl, skinManager);
        this._renderer.tileSize = 40;

        // Center on the map's midpoint immediately (no lerp).
        const mx = Math.floor(map.width  / 2);
        const my = Math.floor(map.height / 2);
        this._renderer.centerOn(mx, my, map.width, map.height);
        this._renderer.camX = this._renderer._camTargetX ?? this._renderer.camX;
        this._renderer.camY = this._renderer._camTargetY ?? this._renderer.camY;
        this._renderer._camTargetX = null;
        this._renderer._camTargetY = null;

        this._buildOverlay(containerEl);
        this._highlightSpawnTiles();

        this._renderer.canvas.addEventListener('mousedown',   this._onMouseDown   = e => this._handleMouseDown(e));
        this._renderer.canvas.addEventListener('mousemove',   this._onMouseMove   = e => this._handleMouseMove(e));
        this._renderer.canvas.addEventListener('mouseup',     this._onMouseUp     = e => this._handleMouseUp(e));
        this._renderer.canvas.addEventListener('contextmenu', this._onContextMenu = e => { e.preventDefault(); this._cancelSelect(); });
        this._renderer.canvas.addEventListener('wheel',       this._onWheel       = e => {
            e.preventDefault();
            const d = e.deltaY > 0 ? -2 : 2;
            this._renderer.tileSize = Math.max(24, Math.min(80, this._renderer.tileSize + d));
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
        document.getElementById('game-container')?.classList.remove('tactical-mode');
        this._container.innerHTML = '';
    }

    resume() {}

    render(now) {
        if (this._stopped) return;
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
        containerEl.appendChild(el);
        this._overlay = el;
        this._rebuildOverlay();
    }

    _rebuildOverlay() {
        const el = this._overlay;
        if (!el) return;
        const party    = this._worldMap?.party ?? CHARACTER_DATA.filter(c => c.team === 'player');
        const scenario = BATTLE_SCENARIOS[this._scenarioId];

        let html = `
            <div style="color:#ffcc44;font-weight:bold;font-size:14px;margin-bottom:2px;">Deploy Party</div>
            <div style="color:#888;font-size:10px;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid #335;">
                Select a party member then click a green tile to reposition them.
            </div>
        `;

        // Enemy summary
        if (scenario?.roster?.length) {
            html += `<div style="color:#fc8;font-size:10px;text-transform:uppercase;margin-bottom:5px;">Enemy Forces</div>`;
            const counts = {};
            for (const r of scenario.roster) {
                const label = (r.name || r.job || '?').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                counts[label] = (counts[label] || 0) + 1;
            }
            for (const [name, n] of Object.entries(counts)) {
                html += `<div style="color:#f88;font-size:11px;margin-bottom:2px;">&#x2694; ${name}${n > 1 ? ` ×${n}` : ''}</div>`;
            }
            html += `<div style="height:8px;"></div>`;
        }

        // Party members
        html += `<div style="color:#fc8;font-size:10px;text-transform:uppercase;margin-bottom:6px;">Your Party</div>`;
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
                    <button class="deploy-edit-btn" data-idx="${i}"
                            style="padding:3px 7px;font-family:inherit;font-size:10px;
                                   background:#0d1220;border:1px solid #447;color:#9cf;
                                   cursor:pointer;border-radius:3px;flex-shrink:0;white-space:nowrap;">
                        Edit
                    </button>
                </div>`;
        }

        html += `
            <div style="margin-top:8px;padding-top:8px;border-top:1px solid #335;">
                <div style="font-size:10px;color:#888;margin-bottom:8px;">
                    Q/E rotate &bull; Drag to pan &bull; Scroll zoom &bull; Enter to begin
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
        this._preview.moveRange = new Set(this._playerSpawns.map(s => `${s.x},${s.y}`));
        this._preview.hoverTile = null;
    }

    // ---- Party member editor -------------------------------------------------

    _openMemberEditor(idx) {
        const wm = this._worldMap;
        if (!wm) return;
        const member = wm.party[idx];
        if (!member) return;

        // Clean up any previous editor.
        if (this._editorUI) { this._editorUI.destroy(); this._editorUI = null; }

        const ui = new WorldMapUI(document.body);
        this._editorUI = ui;
        ui.setActionHandler(() => {});

        // Hide the sidebar — we only want the modal for party editing.
        if (ui._sidebar) ui._sidebar.style.display = 'none';

        // Show party list first, then drill into this member.
        ui.showParty(wm, this._skinManager);
        ui._showPartyMember(member, wm, this._skinManager);

        // When the player presses "‹ Back to Party" inside the member editor,
        // go back to the party list. Closing the party list exits the editor.
        ui._modalBackFn = () => {
            ui.showParty(wm, this._skinManager);
            // Override: closing the party list should exit the editor entirely.
            ui._modalBackFn = () => this._closeEditor();
        };

        // Intercept the close button on the party list level.
        const origBack = ui._modalBack.bind(ui);
        ui._modalBack = () => {
            if (!ui._modalDismissible) return;
            if (ui._modalBackFn) {
                const fn = ui._modalBackFn;
                ui._modalBackFn = null;
                fn();
            } else {
                this._closeEditor();
            }
        };
    }

    _closeEditor() {
        if (this._editorUI) {
            this._editorUI.destroy();
            this._editorUI = null;
        }
        // Refresh preview units in case jobs/equipment changed.
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
            this._panCam    = { x: this._renderer.camX, y: this._renderer.camY };
            if (e.button === 1) e.preventDefault();
        }
    }

    _handleMouseMove(e) {
        if (this._panDrag) {
            const dx = e.clientX - this._panStart.x;
            const dy = e.clientY - this._panStart.y;
            if (!this._panActive && Math.sqrt(dx * dx + dy * dy) >= this._PAN_THRESHOLD) {
                this._panActive = true;
            }
            if (this._panActive) {
                this._renderer.camX = this._panCam.x + dx;
                this._renderer.camY = this._panCam.y + dy;
                this._renderer._camTargetX = null;
                this._renderer._camTargetY = null;
                this._renderer._clampCam(this._preview.map.width, this._preview.map.height);
                return;
            }
        }
        const rect = this._renderer.canvas.getBoundingClientRect();
        const sx   = (e.clientX - rect.left) * (this._renderer.canvas.width  / rect.width);
        const sy   = (e.clientY - rect.top)  * (this._renderer.canvas.height / rect.height);
        const tile = this._renderer.screenToTile(sx, sy, this._preview.map, this._preview.units);
        this._preview.hoverTile = `${tile.x},${tile.y}`;
    }

    _handleMouseUp(e) {
        const wasDragging = this._panActive;
        if (e.button === this._panButton) {
            this._panDrag   = false;
            this._panActive = false;
        }

        if (e.button === 0 && !wasDragging) {
            const rect = this._renderer.canvas.getBoundingClientRect();
            const sx   = (e.clientX - rect.left) * (this._renderer.canvas.width  / rect.width);
            const sy   = (e.clientY - rect.top)  * (this._renderer.canvas.height / rect.height);
            this._handleCanvasTileClick(sx, sy);
        }
    }

    _handleCanvasTileClick(sx, sy) {
        // Check rotate / center buttons drawn by the renderer first.
        for (const btn of (this._renderer._rotateBtns || [])) {
            if (sx >= btn.x && sx <= btn.x + btn.w && sy >= btn.y && sy <= btn.y + btn.h) {
                this._renderer.rotateView(btn.delta);
                return;
            }
        }
        const cb = this._renderer._centerBtn;
        if (cb && sx >= cb.x && sx <= cb.x + cb.w && sy >= cb.y && sy <= cb.y + cb.h) {
            const map = this._preview.map;
            this._renderer.centerOn(Math.floor(map.width / 2), Math.floor(map.height / 2), map.width, map.height);
            return;
        }

        const map  = this._preview.map;
        const tile = this._renderer.screenToTile(sx, sy, map, this._preview.units);

        if (this._selectedUnit !== null) {
            const tileKey   = `${tile.x},${tile.y}`;
            const targetIdx = this._playerSpawns.findIndex(s => `${s.x},${s.y}` === tileKey);
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
        const idx = this._playerSpawns.findIndex(s => s.x === tile.x && s.y === tile.y);
        if (idx !== -1) this._toggleSelectUnit(idx);
    }

    _handleKeydown(e) {
        const ARROW_PAN = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
        const panDir = ARROW_PAN[e.key];
        if (panDir) { this._renderer._panKeys[panDir] = true; e.preventDefault(); return; }
        if (e.key === 'q' || e.key === 'Q') { this._renderer.rotateView(-1); e.preventDefault(); return; }
        if (e.key === 'e' || e.key === 'E') { this._renderer.rotateView( 1); e.preventDefault(); return; }
        if (e.key === 'f' || e.key === 'F') {
            const map = this._preview.map;
            this._renderer.centerOn(Math.floor(map.width / 2), Math.floor(map.height / 2), map.width, map.height);
            e.preventDefault(); return;
        }
        if (e.key === 'Escape')             { this._cancelSelect(); return; }
        if (e.key === 'Enter')              { this._launchBattle(); return; }
    }

    _handleKeyup(e) {
        const ARROW_PAN = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
        const panDir = ARROW_PAN[e.key];
        if (panDir) { this._renderer._panKeys[panDir] = false; return; }
    }

    _removeListeners() {
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
        const map   = this._preview.map;
        const units = buildPreviewUnits(
            this._worldMap, this._scenarioId,
            this._playerSpawns, map.enemySpawns
        );
        // Clear the facing-change transition fields so the renderer draws units
        // at their final facing immediately with no turn animation.
        for (const u of units) {
            u._prevFacing     = null;
            u._facingChangeAt = null;
        }
        this._preview.units = units;
    }

    // ---- Launch --------------------------------------------------------------

    _launchBattle() {
        if (this._editorUI) { this._editorUI.destroy(); this._editorUI = null; }
        if (this._onLaunch) this._onLaunch(this._mapDef, this._playerSpawns);
    }
}
