import { WorldMap }         from './world-map.js';
import { WorldMapRenderer } from './world-map-renderer.js';
import { WorldMapUI }       from './world-map-ui.js';
import { BattleScene }      from './battle-scene.js';
import { DeployScene }      from './deploy-scene.js';

export class WorldMapScene {
    constructor() {
        this._worldMap  = null;
        this._renderer  = null;
        this._ui        = null;
        this._canvas    = null;
        this._container = null;
        this._sm        = null;
        this._selectedNodeId = null;
    }

    enter(containerEl, skinManager, sceneManager) {
        this._container  = containerEl;
        this._sm         = sceneManager;
        this._skinManager = skinManager;

        if (!this._worldMap) {
            this._worldMap = new WorldMap();
        }

        // Canvas
        this._canvas = document.createElement('canvas');
        this._canvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;display:block;';
        containerEl.innerHTML = '';
        containerEl.style.position = 'relative';
        containerEl.appendChild(this._canvas);

        this._renderer = new WorldMapRenderer(this._canvas, skinManager);
        this._ui = new WorldMapUI(containerEl);

        this._resize();
        this._resizeHandler = () => this._resize();
        window.addEventListener('resize', this._resizeHandler);

        // Auto-travel queue: array of node IDs to visit in order
        this._travelQueue    = [];
        this._encounterQueue = []; // pending encounter objects to resolve
        this._inEncounter    = false;

        // Drag state
        this._dragging   = false;
        this._dragStartX = 0;
        this._dragStartY = 0;
        this._dragCamX   = 0;
        this._dragCamY   = 0;
        this._didDrag    = false; // suppress click after a drag

        this._canvas.addEventListener('mousedown',  this._onMouseDown   = (e) => this._handleMouseDown(e));
        this._canvas.addEventListener('auxclick',   this._onAuxClick    = (e) => e.preventDefault());
        this._canvas.style.cursor = 'grab';
        this._canvas.addEventListener('mousemove',  this._onMouseMove   = (e) => this._handleMouseMove(e));
        this._canvas.addEventListener('mouseup',    this._onMouseUp     = (e) => this._handleMouseUp(e));
        this._canvas.addEventListener('click',      this._onCanvasClick = (e) => this._handleClick(e));
        this._canvas.addEventListener('wheel',      this._onWheel       = (e) => this._handleWheel(e), { passive: false });

        document.getElementById('game-container')?.classList.add('tactical-mode');

        this._ui.setActionHandler((action, nodeId, questId) => this._handleAction(action, nodeId, questId));
    }

    resume(containerEl, skinManager, sceneManager) {
        this.enter(containerEl, skinManager, sceneManager);
    }

    exit() {
        window.removeEventListener('resize', this._resizeHandler);
        const c = this._canvas;
        if (c) {
            c.removeEventListener('mousedown', this._onMouseDown);
            c.removeEventListener('mousemove', this._onMouseMove);
            c.removeEventListener('mouseup',   this._onMouseUp);
            c.removeEventListener('click',     this._onCanvasClick);
            c.removeEventListener('wheel',     this._onWheel);
            c.removeEventListener('auxclick',  this._onAuxClick);
        }
        this._ui?.destroy();
        document.getElementById('game-container')?.classList.remove('tactical-mode');
    }

    render(now) {
        this._stepTravelQueue();
        this._renderer?.render(this._worldMap, now);
        this._ui?.update(this._worldMap, this._selectedNodeId);
    }

    _afterTravel() {
        // Drain any encounters produced by the last travelTo/rest call
        const encounters = this._worldMap.popEncounters();
        for (const enc of encounters) {
            this._encounterQueue.push(enc);
        }
        this._resolveNextEncounter();
    }

    _resolveNextEncounter() {
        if (this._inEncounter || !this._encounterQueue.length) return;
        this._inEncounter = true;
        // Pause auto-travel while encounter is active
        const savedQueue  = this._travelQueue.slice();
        this._travelQueue = [];

        const enc   = this._encounterQueue.shift();
        const enemy = enc.enemy;
        const flavor = enc.crossed
            ? `Your paths cross on the road. The ${enemy.name} block your way, weapons drawn.`
            : `You arrive to find the ${enemy.name} already here. There is nowhere to run.`;

        this._ui.showEncounter(enemy, flavor, () => {
            this._inEncounter = false;
            // Restore any remaining queued travel after battle result is handled
            this._travelQueue = savedQueue;
            this._startBattle(enemy.battleScenarioId, (won, rewards) => {
                if (won) enemy.defeated = true;
                this._handleBattleRewards(rewards);
                this._ui._lastSidebarKey = null;
                this._resolveNextEncounter();
            });
        });
    }

    _stepTravelQueue() {
        if (!this._travelQueue.length || this._inEncounter) return;
        const r = this._renderer;
        if (!r) return;
        // Wait until the marker has arrived at the current node before stepping
        const dist = Math.hypot(
            r._markerNx - r._markerTargetNx,
            r._markerNy - r._markerTargetNy
        );
        if (dist > 0.003) return;
        const nextId = this._travelQueue.shift();
        if (nextId && this._worldMap.travelTo(nextId)) {
            this._selectedNodeId          = null;
            this._renderer.selectedNodeId = null;
            this._ui._lastSidebarKey      = null;
            this._afterTravel();
        } else {
            // Path blocked (e.g. node became unreachable); abort queue
            this._travelQueue = [];
        }
    }

    _resize() {
        const rect = this._container.getBoundingClientRect();
        const w = rect.width  || window.innerWidth;
        const h = rect.height || window.innerHeight;
        this._renderer?.resize(w, h);
    }

    _canvasPoint(e) {
        const rect   = this._canvas.getBoundingClientRect();
        const scaleX = this._canvas.width  / rect.width;
        const scaleY = this._canvas.height / rect.height;
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top)  * scaleY,
        };
    }

    _handleMouseDown(e) {
        // Left-click (0) or middle-click (1) both pan
        if (e.button !== 0 && e.button !== 1) return;
        if (e.button === 1) e.preventDefault(); // stop middle-click scroll
        const p = this._canvasPoint(e);
        this._dragging     = true;
        this._dragButton   = e.button;
        this._didDrag      = false;
        this._dragStartX   = p.x;
        this._dragStartY   = p.y;
        this._dragCamX     = this._renderer.camX;
        this._dragCamY     = this._renderer.camY;
        this._canvas.style.cursor = 'grabbing';
    }

    _handleMouseMove(e) {
        const p = this._canvasPoint(e);

        if (this._dragging) {
            const dx = p.x - this._dragStartX;
            const dy = p.y - this._dragStartY;
            if (Math.abs(dx) > 3 || Math.abs(dy) > 3) this._didDrag = true;
            this._renderer.camX = this._dragCamX + dx;
            this._renderer.camY = this._dragCamY + dy;
            this._renderer._clampCam();
            this._canvas.style.cursor = 'grabbing';
            return;
        }

        const hit = this._renderer.nodeAtPoint(p.x, p.y, this._worldMap.nodes);
        this._renderer.hoveredNodeId = hit;
        this._canvas.style.cursor = hit ? 'pointer' : 'grab';
    }

    _handleMouseUp(e) {
        if (e.button !== 0 && e.button !== 1) return;
        this._dragging = false;
        const p   = this._canvasPoint(e);
        const hit = this._renderer.nodeAtPoint(p.x, p.y, this._worldMap.nodes);
        this._canvas.style.cursor = hit ? 'pointer' : 'grab';
    }

    _handleClick(e) {
        if (this._didDrag) { this._didDrag = false; return; }
        const p   = this._canvasPoint(e);
        const hit = this._renderer.nodeAtPoint(p.x, p.y, this._worldMap.nodes);
        if (hit) {
            this._selectedNodeId = hit;
            this._renderer.selectedNodeId = hit;
        }
    }

    _handleWheel(e) {
        e.preventDefault();
        const p     = this._canvasPoint(e);
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        this._renderer.zoomAt(p.x, p.y, delta);
    }

    _handleAction(action, nodeId, questId) {
        const wm = this._worldMap;
        switch (action) {
            case 'travel': {
                const id = nodeId || this._selectedNodeId;
                if (id && wm.travelTo(id)) {
                    this._selectedNodeId          = null;
                    this._renderer.selectedNodeId = null;
                    this._afterTravel();
                }
                break;
            }
            case 'route': {
                const id = nodeId || this._selectedNodeId;
                if (!id) break;
                const path = wm.findPath(wm.currentNodeId, id);
                if (path && path.length) {
                    this._travelQueue = path;
                    this._ui._lastSidebarKey = null;
                }
                break;
            }
            case 'shop':
                this._ui.showShop(wm, this._skinManager, null);
                break;
            case 'inventory':
                this._ui.showInventory(wm, this._skinManager);
                break;
            case 'questboard':
                this._ui.showQuestBoard(wm, null);
                break;
            case 'event': {
                const ev = wm.drawRandomEvent();
                this._ui.showEvent(ev, wm, (outcome, eff) => {
                    if (eff.triggerBattle) this._startBattle(eff.triggerBattle);
                });
                break;
            }
            case 'rest':
                wm.rest();
                this._ui.notify('You make camp. The party rests for the night.');
                this._afterTravel();
                break;
            case 'battle': {
                const scenarioId = wm.currentNode.battleScenarioId;
                if (scenarioId) this._startBattle(scenarioId, (won, rewards) => {
                    this._handleBattleRewards(rewards);
                    this._ui._lastSidebarKey = null;
                });
                break;
            }
            case 'party':
                this._ui.showParty(wm, this._skinManager);
                break;
            case 'turnin': {
                if (!questId) break;
                const quest = wm.activeQuests.find(q => q.id === questId);
                if (!quest) break;
                this._ui.showQuestTurnIn(quest, () => {
                    wm.turnInQuest(questId);
                    // Invalidate sidebar cache so the turned-in quest disappears
                    this._ui._lastSidebarKey = null;
                });
                break;
            }
        }
    }

    _startBattle(scenarioId, onComplete) {
        const deployScene = new DeployScene(
            scenarioId,
            this._worldMap,
            this._skinManager,
            this._sm,
            (mapDef, customPlayerSpawns) => {
                // DeployScene calls this when the player hits Begin Battle.
                // Replace the deploy scene with the real battle.
                const battleScene = new BattleScene(
                    scenarioId, this._worldMap, onComplete || null,
                    { mapDef, customPlayerSpawns }
                );
                this._sm.replace(battleScene);
            }
        );
        this._sm.push(deployScene);
    }

    _handleBattleRewards(rewards) {
        if (!rewards?.won) return;
        const wm = this._worldMap;
        for (const q of (rewards.questsCompleted || [])) {
            // Turn in quest and notify. turnInQuest handles _battleCompleted quests.
            const turned = wm.turnInQuest(q.id);
            if (turned) {
                this._ui.notify(`Quest complete: "${q.title}" — rewards claimed!`, 5000);
            } else {
                // Quest marked completed but may need manual turn-in at node
                this._ui.notify(`Quest updated: "${q.title}"`, 4000);
            }
        }
    }
}
