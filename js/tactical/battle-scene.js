import { loadMapData } from './battle-map.js';
import { MAP_DATA } from './data/maps.js';
import { TacticalBattle, STATES } from './battle.js';
import { BattleView3D, showViewError } from './battle-view3d.js';
import { BattleUI } from './battle-ui.js';
import { runAutoTurn } from './ai/executor.js';
import { isEntityMoving } from '../systems/movement-lerp.js';
import { ABILITIES } from './abilities.js';
import { buildUnits } from './build-units.js';
import { viewState } from './view-state.js';

const SPEEDS = { '1': 1, '2': 2, '3': 4 };
const BASE_MS_PER_STEP = 180;

export class BattleScene {
    // opts.mapDef           — pre-selected map definition (from DeployScene); random if omitted
    // opts.customPlayerSpawns — [{x,y}] array overriding map.playerSpawns order
    // opts.manualControl    — let the player command their own units by hand. By
    //                         default every player unit acts from its script.
    constructor(scenarioId, worldMap, onComplete, opts = {}) {
        this._scenarioId        = scenarioId;
        this._worldMap          = worldMap;
        this._onComplete        = onComplete || null;
        this._presetMapDef      = opts.mapDef            || null;
        this._customPlayerSpawns = opts.customPlayerSpawns || null;
        this._manualControl      = opts.manualControl === true;
        this._paused             = false;
        this._speed              = 1;
        this._battle     = null;
        this._renderer   = null;
        this._ui         = null;
        this._stopped    = false;
        this._turnHasMoved = false;
        this._turnHasActed = false;
        this._enemyTimer   = null;
        this._sm           = null;
        this._autoUnits    = new Set();
    }

    enter(containerEl, skinManager, sceneManager) {
        this._container = containerEl;
        this._sm        = sceneManager;
        this._stopped   = false;

        const mapDef = this._presetMapDef ?? MAP_DATA[Math.floor(Math.random() * MAP_DATA.length)];
        const map    = loadMapData(mapDef);
        const playerSpawns = this._customPlayerSpawns ?? map.playerSpawns;
        const units  = buildUnits(this._worldMap, this._scenarioId, playerSpawns, map.enemySpawns);

        this._battle = new TacticalBattle(map, units);
        this._applySpeed();

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
        this._renderer.onCenterRequest = () => this._centerOnActiveUnit();
        this._ui       = new BattleUI(containerEl, this._battle, this._renderer, { fullAuto: !this._manualControl });

        this._ui.setActionHandler((action, key) => this._handleAction(action, key));
        this._ui.setPlaybackHandler((ctl, value) => this._handlePlayback(ctl, value));

        // Without manual control every player unit is auto-controlled from the start.
        if (!this._manualControl) {
            for (const u of units) if (u.team === 'player') this._autoUnits.add(u.id);
        }

        // Input listeners
        this._renderer.canvas.addEventListener('mousedown',    this._onMouseDown   = (e) => this._handleMouseDown(e));
        this._renderer.canvas.addEventListener('mousemove',    this._onMouseMove   = (e) => this._handleMouseMove(e));
        this._renderer.canvas.addEventListener('mouseup',      this._onMouseUp     = (e) => this._handleMouseUp(e));
        this._renderer.canvas.addEventListener('click',        this._onCanvasClick = (e) => this._handleCanvasClick(e));
        this._renderer.canvas.addEventListener('contextmenu',  this._onContextMenu = (e) => { e.preventDefault(); if (this._ui._skillMenuOpen) { this._ui.closeSkillMenu(); return; } this._cancelTargeting(); });
        this._renderer.canvas.addEventListener('wheel',        this._onWheel       = (e) => { e.preventDefault(); this._renderer.zoomBy(e.deltaY > 0 ? -2 : 2); }, { passive: false });
        document.addEventListener('keydown', this._onKeydown = (e) => this._handleKeydown(e));
        document.addEventListener('keyup',   this._onKeyup   = (e) => this._handleKeyup(e));

        this._panDrag   = false;
        this._panActive = false;
        this._panButton = -1;
        this._panStart  = { x: 0, y: 0 };
        this._suppressClick = false;
        this._PAN_THRESHOLD = 4;
        this._abilityFromSkillMenu = false;
        this._pendingRewards = null;

        this._scheduleNextTurn();
    }

    exit() {
        this._stopped = true;
        clearTimeout(this._enemyTimer);
        this._removeListeners();
        this._ui?.destroy();
        this._renderer?.dispose();
        document.getElementById('game-container')?.classList.remove('tactical-mode');
        this._container.innerHTML = '';
    }

    // Called when SceneManager restores this scene from the stack (not used here)
    resume() {}

    render(now) {
        if (this._stopped) return;
        this._renderer?.render(this._battle, now);
        // Compute rewards once when battle first ends
        if (this._battle.state === STATES.BATTLE_OVER && !this._pendingRewards) {
            const won = this._battle.winner === 'player';
            this._pendingRewards = this._worldMap
                ? this._worldMap.completeBattle(this._scenarioId, won)
                : { won };
        }
        this._ui?.update(this._battle, () => this._onBattleExit(), {
            hasMoved: this._turnHasMoved,
            hasActed: this._turnHasActed,
            rewards: this._pendingRewards,
            autoUnits: this._autoUnits,
            manualControl: this._manualControl,
        }, { paused: this._paused, speed: this._speed });
    }

    _onBattleExit() {
        // Rewards were already computed and applied in render(); just exit.
        this._sm.pop();
        if (this._onComplete) this._onComplete(
            this._pendingRewards?.won ?? false,
            this._pendingRewards
        );
    }

    // Schedules `fn` after `ms` of battle time. Honours speed and pause so the
    // player, who now only watches, can control the pace.
    _later(ms, fn) {
        this._enemyTimer = setTimeout(() => this._whenRunning(fn), ms / this._speed);
    }

    _whenRunning(fn) {
        if (this._stopped) return;
        if (this._paused) {
            this._enemyTimer = setTimeout(() => this._whenRunning(fn), 100);
            return;
        }
        fn();
    }

    _handlePlayback(ctl, value) {
        if (ctl === 'pause') this._paused = !this._paused;
        else if (ctl === 'speed' && value > 0) {
            this._speed = value;
            this._applySpeed();
        }
    }

    // Playback speed also shortens walking, so units do not crawl while everything else races.
    _applySpeed() {
        if (this._battle) this._battle.moveMsPerStep = BASE_MS_PER_STEP / this._speed;
    }

    _resetTurn() {
        this._turnHasMoved = false;
        this._turnHasActed = false;
        this._abilityFromSkillMenu = false;
    }

    _playAbilityAnimation(source, targetX, targetY, abilityKey) {
        const ab = ABILITIES[abilityKey];
        if (!ab) return 0;
        const animType = ab.animType || 'slash';
        const rawDx = targetX - source.x;
        const rawDy = targetY - source.y;
        const len = Math.sqrt(rawDx * rawDx + rawDy * rawDy) || 1;
        // Durations are written for 1x. The returned wait stays in 1x milliseconds because _later
        // divides by the speed itself, while the visuals below are shortened to match.
        const speed      = this._speed;
        const baseAnimMs = animType === 'slash' ? 280 : 350;
        viewState(source).anim = { type: animType, dx: rawDx / len, dy: rawDy / len, startMs: performance.now(), durationMs: baseAnimMs / speed };
        if (animType === 'shot' || animType === 'cast') {
            const color      = ab.projectileColor || '#ffffff';
            const projDelay  = animType === 'shot' ? 180 : 200;
            const projFlight = 420;
            setTimeout(() => { if (this._stopped) return; this._renderer.spawnProjectile(source.x, source.y, targetX, targetY, color, projFlight / speed); }, projDelay / speed);
            return projDelay + projFlight;
        }
        return baseAnimMs;
    }

    _scheduleNextTurn() {
        if (this._stopped || this._battle.state === STATES.BATTLE_OVER) return;
        this._resetTurn();

        const firedCharges = this._battle.checkAndFireCharges();
        // Register any summons created by charged abilities.
        for (const id of this._battle._pendingSummons) this._autoUnits.add(id);
        this._battle._pendingSummons = [];
        let chargeMs = 0;
        for (const fc of firedCharges) {
            chargeMs = Math.max(chargeMs, this._playAbilityAnimation(fc.unit, fc.targetX, fc.targetY, fc.ability));
        }

        const MOVE_POLL_MS = 40;
        const waitForMovement = (then) => {
            if (this._stopped) return;
            if (this._battle.units.some(u => isEntityMoving(u))) {
                this._enemyTimer = setTimeout(() => waitForMovement(then), MOVE_POLL_MS);
            } else {
                then();
            }
        };

        const proceed = () => {
            if (this._stopped || this._battle.state === STATES.BATTLE_OVER) return;
            // Wait for any in-progress walk animations before starting the next
            // turn so _autoCenterNext fires after movement-follow has stopped.
            waitForMovement(() => {
                if (this._stopped || this._battle.state === STATES.BATTLE_OVER) return;
                const unit = this._battle.advanceCT();
                if (!unit) return;
                this._renderer.requestAutoCenter();
                this._battle.startTurn(unit);

                const state = this._battle.state;
                // Without manual control nobody waits for input: a charmed enemy that the
                // game would normally hand to the player is simply run by the AI.
                const autoTurn = state === STATES.ENEMY_TURN
                    || (state === STATES.PLAYER_TURN && (!this._manualControl || this._autoUnits.has(unit.id)));
                if (state === STATES.ADVANCE_CT) {
                    this._later(200, () => this._scheduleNextTurn());
                } else if (autoTurn) {
                    this._later(600, () => {
                        const animMs = runAutoTurn(unit, this._battle, this._playAbilityAnimation.bind(this));
                        const wait = typeof animMs === 'number' ? animMs + 150 : 150;
                        this._later(wait, () => {
                            if (this._battle.state !== STATES.BATTLE_OVER) this._scheduleNextTurn();
                        });
                    });
                }
            });
        };

        if (chargeMs > 0) {
            // Center on the first unit whose charge fired so the player can watch.
            const first = firedCharges[0];
            if (first) this._renderer.trackAt(first.unit.x, first.unit.y);
            this._later(chargeMs + 800, proceed);
        } else {
            proceed();
        }
    }

    _cancelTargeting() {
        const fromMenu = this._abilityFromSkillMenu;
        this._abilityFromSkillMenu = false;
        this._battle.cancelAction();
        if (fromMenu) this._ui._skillMenuOpen = true;
    }

    _handleAction(action, abilityKey) {
        if (!this._manualControl) return;
        if (this._battle.state !== STATES.PLAYER_TURN) return;
        if (action === 'auto') {
            const unit = this._battle.activeUnit;
            if (!unit) return;
            this._autoUnits.add(unit.id);
            this._battle.logMsg(`${unit.name} is now acting automatically.`);
            const cost = this._turnHasMoved ? 80 : 60;
            this._battle.endTurn(cost);
            this._scheduleNextTurn();
            return;
        }
        if (action === 'move') {
            if (!this._turnHasMoved) this._battle.enterMoveMode();
        } else if (action === 'ability') {
            if (!this._turnHasActed) {
                this._abilityFromSkillMenu = true;
                this._battle.enterAbilityMode(abilityKey);
                const ab = ABILITIES[abilityKey];
                if (ab?.aoePattern) this._battle.logMsg(`${ab.name} ready — press R to rotate.`);
            }
        } else if (action === 'defend') {
            if (!this._turnHasActed) {
                this._battle.enterDefendMode();
                this._battle.endTurn(this._turnHasMoved ? 100 : 80);
                this._scheduleNextTurn();
            }
        } else if (action === 'pivot') {
            this._battle.pivotUnit();
        } else if (action === 'wait') {
            const cost = this._turnHasMoved ? 80 : 60;
            this._battle.endTurn(cost);
            this._scheduleNextTurn();
        }
    }

    _centerOnActiveUnit() {
        const u = this._battle.activeUnit;
        if (u) this._renderer.centerOn(u.x, u.y);
    }

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
        const tile = this._renderer.pickTile(e.clientX, e.clientY, this._battle.map, this._battle.units);
        if (!tile) {
            this._battle.hoverTile = null;
            // Off the map: drop the stale area-of-effect preview.
            if (this._battle.state === STATES.SELECT_ABILITY_TARGET) this._battle.hoverAbilityTarget(-1, -1);
            return;
        }
        if (this._battle.state === STATES.SELECT_ABILITY_TARGET) this._battle.hoverAbilityTarget(tile.x, tile.y);
        this._battle.hoverTile = `${tile.x},${tile.y}`;
    }

    _handleMouseUp(e) {
        if (e.button === this._panButton) {
            // The browser fires click after mouseup, so remember that this release ended a drag.
            this._suppressClick = this._panActive;
            this._panDrag   = false;
            this._panActive = false;
            this._renderer.endPan();
        }
    }

    _handleCanvasClick(e) {
        if (this._suppressClick) { this._suppressClick = false; return; }
        if (this._panActive || e.button !== 0) return;
        const map  = this._battle.map;
        const tile = this._renderer.pickTile(e.clientX, e.clientY, map, this._battle.units);
        if (!tile) return;
        const state = this._battle.state;

        // Idle click: inspect the unit on this tile (or clear if empty ground).
        if (state === STATES.PLAYER_TURN || state === STATES.ADVANCE_CT || state === STATES.ENEMY_TURN) {
            const clicked = this._battle.units.find(u => u.x === tile.x && u.y === tile.y && !u.status.includes('dead'));
            this._ui.inspectUnit(clicked || null);
        }

        // Scripted battles take no commands from the board, only inspection.
        if (!this._manualControl) return;

        if (state === STATES.SELECT_MOVE) {
            if (this._battle.commitMove(tile.x, tile.y)) {
                this._turnHasMoved = true;
                this._battle.moveRange = new Set();
            }
        } else if (state === STATES.PLAYER_TURN && !this._turnHasMoved) {
            const key = `${tile.x},${tile.y}`;
            if (this._battle.moveRange.has(key)) {
                this._battle.enterMoveMode();
                if (this._battle.commitMove(tile.x, tile.y)) {
                    this._turnHasMoved = true;
                    this._battle.moveRange = new Set();
                }
            }
        } else if (state === STATES.SELECT_ABILITY_TARGET) {
            const abilityKey = this._battle.selectedAbility;
            const source     = this._battle.activeUnit;
            if (this._battle.commitAbility(tile.x, tile.y)) {
                this._turnHasActed = true;
                this._abilityFromSkillMenu = false;
                // Register any newly summoned player-team units as auto-controlled.
                for (const id of this._battle._pendingSummons) this._autoUnits.add(id);
                this._battle._pendingSummons = [];
                const isCharged = ABILITIES[abilityKey]?.chargeTime > 0;
                const animMs = (source && !isCharged) ? this._playAbilityAnimation(source, tile.x, tile.y, abilityKey) : 0;
                const cost = this._turnHasMoved ? 100 : 80;
                if (isCharged) {
                    this._battle.endTurn(cost);
                    if (this._battle.state !== STATES.BATTLE_OVER) this._scheduleNextTurn();
                } else {
                    this._battle.endTurn(cost);
                    this._enemyTimer = setTimeout(() => {
                        if (!this._stopped && this._battle.state !== STATES.BATTLE_OVER) this._scheduleNextTurn();
                    }, (animMs + 150) / this._speed);
                }
            }
        }
    }

    _handleKeydown(e) {
        const ARROW_PAN = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
        const panDir = ARROW_PAN[e.key];
        if (panDir) { this._renderer.setPanKey(panDir, true); e.preventDefault(); return; }

        if (e.key === 'f' || e.key === 'F') {
            this._centerOnActiveUnit();
            e.preventDefault(); return;
        }
        if (e.key === 'v' || e.key === 'V') { this._renderer.setFreeCamera(!this._renderer.freeCamera); e.preventDefault(); return; }
        if (e.key === 'q' || e.key === 'Q') { this._renderer.rotateView(-1); e.preventDefault(); return; }
        if (e.key === 'e' || e.key === 'E') { this._renderer.rotateView( 1); e.preventDefault(); return; }
        if (e.key === 'r' || e.key === 'R') { this._battle.rotateAbility(); return; }
        if (e.key === 'Escape') {
            if (this._ui._skillMenuOpen) { this._ui.closeSkillMenu(); return; }
            this._cancelTargeting(); return;
        }

        if (e.key === ' ') { this._handlePlayback('pause'); e.preventDefault(); return; }
        if (!this._manualControl && SPEEDS[e.key]) { this._handlePlayback('speed', SPEEDS[e.key]); return; }

        if (this._manualControl && this._battle.state === STATES.PLAYER_TURN) {
            if (e.key === 'm' || e.key === 'M') { if (!this._turnHasMoved) this._battle.enterMoveMode(); return; }
            if (e.key === 'a' || e.key === 'A') {
                if (this._ui._skillMenuOpen) { this._ui.closeSkillMenu(); return; }
                if (!this._turnHasActed) this._battle.enterAbilityMode('attack'); return;
            }
            if (e.key === 's' || e.key === 'S') {
                if (!this._turnHasActed && !this._ui._skillMenuOpen) { this._ui._skillMenuOpen = true; return; }
                if (this._ui._skillMenuOpen) { this._ui.closeSkillMenu(); return; }
            }
            if (e.key === 'd' || e.key === 'D') {
                if (!this._turnHasActed) {
                    this._battle.enterDefendMode();
                    this._battle.endTurn(this._turnHasMoved ? 100 : 80);
                    this._scheduleNextTurn();
                } return;
            }
            if (e.key === 'p' || e.key === 'P') { this._battle.pivotUnit(); return; }
            if (e.key === 'u' || e.key === 'U') {
                this._handleAction('auto', null); return;
            }
            if (e.key === 'w' || e.key === 'W') {
                if (this._ui._skillMenuOpen) { this._ui.closeSkillMenu(); return; }
                const cost = this._turnHasMoved ? 80 : 60;
                this._battle.endTurn(cost);
                this._scheduleNextTurn(); return;
            }
            const digit = parseInt(e.key, 10);
            if (!isNaN(digit) && digit >= 1 && this._ui._skillMenuOpen && !this._turnHasActed) {
                const unit = this._battle.activeUnit;
                const skillAbs = unit?.abilities.filter(k => k !== 'attack' && ABILITIES[k] && !ABILITIES[k].passive) || [];
                const chosen = skillAbs[digit - 1];
                if (chosen) {
                    this._ui.closeSkillMenu();
                    this._abilityFromSkillMenu = true;
                    this._battle.enterAbilityMode(chosen);
                    if (ABILITIES[chosen]?.aoePattern) this._battle.logMsg(`${ABILITIES[chosen].name} ready — press R to rotate.`);
                }
                return;
            }
        }
    }

    _handleKeyup(e) {
        const ARROW_PAN = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
        const panDir = ARROW_PAN[e.key];
        if (panDir) { this._renderer.setPanKey(panDir, false); return; }
    }

    _removeListeners() {
        const c = this._renderer?.canvas;
        if (c) {
            c.removeEventListener('mousedown',   this._onMouseDown);
            c.removeEventListener('mousemove',   this._onMouseMove);
            c.removeEventListener('mouseup',     this._onMouseUp);
            c.removeEventListener('click',       this._onCanvasClick);
            c.removeEventListener('contextmenu', this._onContextMenu);
            c.removeEventListener('wheel',       this._onWheel);
        }
        document.removeEventListener('keydown', this._onKeydown);
        document.removeEventListener('keyup',   this._onKeyup);
    }
}
