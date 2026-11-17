import { loadMapData, posKey } from './battle-map.js';
import { Sound } from '../audio/sound.js';
import { battleMusic, abilitySound, battleEventSound, battleOpensWithAlert, downSound, downChanges } from '../audio/game-sounds.js';
import { pickRealmMap, realmLook } from '../run/data/realms.js';
import { TacticalBattle, STATES } from './battle.js';
import { BattleView3D, showViewError } from './battle-view3d.js';
import { BattleUI, unitSkillsets, SKILLSET_KEYS } from './battle-ui.js';
import { runAutoTurn } from './ai/executor.js';
import { isEntityMoving } from '../systems/movement-lerp.js';
import { ABILITIES } from './abilities.js';
import { buildUnits } from './build-units.js';
import { viewState } from './view-state.js';
import { attachTouchGestures } from './touch-gestures.js';
import { RealtimeBattle } from './realtime.js';
import { isPortrait } from '../ui/layout.js';

const SPEEDS = { '1': 1, '2': 2, '3': 4 };
const BASE_MS_PER_STEP = 180;


// Settings > General > "Show tactics decisions in the battle log" (saved by core/main.js).
function tacticsLogSetting() {
    try { return JSON.parse(globalThis.localStorage?.getItem('riftbreakers_settings'))?.tacticsLog === true; }
    catch { return false; }
}

export class BattleScene {
    // encounter              — the fight (see run/data/encounters.js); null for the default enemies
    // run                    — the RunState whose party fights and which receives the result; null in harnesses
    // onComplete(won, reward) — called after the player leaves the result screen
    // opts.mapDef           — pre-selected map definition (from DeployScene); random if omitted
    // opts.customPlayerSpawns — [{x,y}] array overriding map.playerSpawns order
    // opts.manualControl    — let the player command their own units by hand. By
    //                         default every player unit acts from its script.
    constructor(encounter, run, onComplete, opts = {}) {
        this._encounter         = encounter;
        this._run               = run;
        this._onComplete        = onComplete || null;
        this._presetMapDef      = opts.mapDef            || null;
        this._customPlayerSpawns = opts.customPlayerSpawns || null;
        this._manualControl      = opts.manualControl === true;
        // Camera from the deploy screen (BattleView3D.getCameraState), kept instead of reframing.
        this._cameraState        = opts.camera ?? null;
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

        const mapDef = this._presetMapDef ?? pickRealmMap(this._encounter?.zone ?? this._encounter?.realm);
        const map    = loadMapData(mapDef);
        map.look     = realmLook(this._encounter?.zone ?? this._encounter?.realm);
        const playerSpawns = this._customPlayerSpawns ?? map.playerSpawns;
        const units  = buildUnits({ party: this._run?.party, encounter: this._encounter, relics: this._run?.relics },
            playerSpawns, map.enemySpawns);

        this._battle = new TacticalBattle(map, units);
        this._battle.logTactics = tacticsLogSetting();
        this._applySpeed();
        // What happens in the fight drives sounds and effects. Hits from an ability that is
        // still in flight (an arrow, a spell, a swing mid-lunge) wait until it lands.
        this._impactDelayMs = 0;
        this._battle.onEvent = (type, data) => {
            const play = () => {
                if (this._stopped) return;
                const sfx = battleEventSound(type, data);
                if (sfx) Sound.playSfx(sfx);
                this._renderer?.fxEvent(type, data);
            };
            if (this._chargeEvents) this._chargeEvents.push(play);
            else if (this._impactDelayMs > 0) setTimeout(play, this._impactDelayMs);
            else play();
        };
        this._downIds = downChanges(units).down;
        Sound.playMusic(battleMusic(this._encounter, this._run));
        const alert = battleOpensWithAlert(this._encounter);
        if (alert) Sound.playSfx('battle_alert');

        containerEl.innerHTML = '';
        containerEl.style.position = 'relative';
        document.getElementById('game-container')?.classList.add('tactical-mode');

        try {
            this._renderer = new BattleView3D(containerEl, skinManager);
            this._renderer.setTimeScale(this._speed);
            if (this._cameraState) this._renderer.setCameraState(this._cameraState);
            if (alert) this._renderer.fxAlert(this._encounter?.kind === 'boss' ? 0.2 : 0.12);
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

        // Input listeners. Touch screens also get one-finger pan and pinch zoom.
        this._detachTouch = attachTouchGestures(this._renderer.canvas, this._renderer);
        this._updateInsets();
        // Frame the whole map, unless the camera came over from the deploy screen.
        if (!this._cameraState) this._renderer.fitToMap?.();
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
        this._abilityFromSkillMenu = null;
        this._pendingRewards = null;
        this._settled = false;

        if (this._manualControl) {
            // Commanding units by hand keeps the turn-by-turn flow.
            this._scheduleNextTurn();
        } else {
            // Automatic battles run in real time: render() drives the clock.
            this._lastFrame = null;
            this._lastTrackAt = 0;
            this._realtime = new RealtimeBattle(this._battle, {
                onAbility: (u, x, y, key) => this._playAbilityAnimation(u, x, y, key),
                beforeCharges: () => { this._chargeEvents = []; },
                onCharge: (fired) => this._playCharges(fired),
                afterCharges: () => { if (this._chargeEvents) this._playCharges([]); },
                onTurn: (u) => this._followActor(u),
            });
        }
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

    // The HUD covers the right side in landscape and the bottom in portrait.
    _updateInsets() {
        if (!this._renderer || !this._ui) return;
        if (isPortrait()) this._renderer.setInsets(0, 0, 0, this._ui.bottomInset());
        else this._renderer.setInsets(0, 190);
    }

    // With the tracking camera on, glide toward whoever just started a turn, at most once a second.
    _followActor(unit) {
        if (this._renderer.freeCamera) return;
        const t = performance.now();
        if (t - this._lastTrackAt < 1000) return;
        this._lastTrackAt = t;
        this._renderer.centerOn(unit.x, unit.y);
    }

    render(now) {
        if (this._stopped) return;
        if (this._realtime) {
            // Battle time runs at the playback speed and stops while paused. A long gap
            // (e.g. the tab was hidden) counts as one short step.
            const dt = this._lastFrame == null ? 0 : Math.min(100, now - this._lastFrame);
            this._lastFrame = now;
            if (!this._paused) this._realtime.update(dt * this._speed);
        }
        this._updateInsets();
        this._renderer?.render(this._battle, now);
        // Settle the battle with the run once, when it first ends
        this._soundDowns();
        if (this._battle.state === STATES.BATTLE_OVER && !this._settled) {
            this._settled = true;
            this._won = this._battle.winner === 'player';
            this._renderer?.fxCheer(this._battle.winner, this._battle.units);
            if (this._won) Sound.playSfx('loot');
            else Sound.stopMusic(1500);
            this._pendingRewards = this._run
                ? this._run.completeBattle(this._won)
                : null;
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
        if (this._onComplete) this._onComplete(this._won ?? false, this._pendingRewards);
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
        this._renderer?.setTimeScale(this._speed);
    }

    _resetTurn() {
        this._turnHasMoved = false;
        this._turnHasActed = false;
        this._abilityFromSkillMenu = null;
    }

    // A unit that has just gone down, from any cause (a hit, poison, doom), sounds once.
    _soundDowns() {
        const { down, fresh } = downChanges(this._battle.units, this._downIds);
        for (const u of fresh) { Sound.playSfx(downSound(u)); this._renderer?.fxDown(u); }
        this._downIds = down;
    }

    // Charged spells resolve before they are animated, so their events were buffered: play the
    // animations, then release the events when the spells land. Returns the longest animation.
    _playCharges(fired) {
        const events = this._chargeEvents ?? [];
        this._chargeEvents = null;
        let longest = 0, landsAfter = 0;
        for (const fc of fired) {
            longest = Math.max(longest, this._playAbilityAnimation(fc.unit, fc.targetX, fc.targetY, fc.ability));
            landsAfter = Math.max(landsAfter, this._impactDelayMs);
        }
        for (const play of events) landsAfter > 0 ? setTimeout(play, landsAfter) : play();
        return longest;
    }

    // The ability resolves right after its animation starts (executor.finishIntent), and its
    // events fire as it does: hold their effects for `ms`, then go back to playing at once.
    _holdImpacts(ms) {
        this._impactDelayMs = ms;
        queueMicrotask(() => { this._impactDelayMs = 0; });
    }

    _playAbilityAnimation(source, targetX, targetY, abilityKey, targetZ = null) {
        const ab = ABILITIES[abilityKey];
        if (!ab) return 0;
        const sfx = abilitySound(abilityKey);
        if (sfx) Sound.playSfx(sfx);
        const animType = ab.animType || 'slash';
        const rawDx = targetX - source.x;
        const rawDy = targetY - source.y;
        const len = Math.sqrt(rawDx * rawDx + rawDy * rawDy) || 1;
        // Durations are written for 1x. The returned wait stays in 1x milliseconds because _later
        // divides by the speed itself, while the visuals below are shortened to match.
        const speed      = this._speed;
        const baseAnimMs = animType === 'slash' ? 280 : 350;
        viewState(source).anim = { type: animType, dx: rawDx / len, dy: rawDy / len, startMs: performance.now(), durationMs: baseAnimMs / speed };
        this._renderer?.fxAbility(source, { x: targetX, y: targetY, z: targetZ }, abilityKey);
        const onSelf = targetX === source.x && targetY === source.y;
        if ((animType === 'shot' || animType === 'cast') && !onSelf) {
            const color      = ab.projectileColor || '#ffffff';
            const projDelay  = animType === 'shot' ? 180 : 200;
            const projFlight = 420;
            setTimeout(() => { if (this._stopped) return; this._renderer.spawnProjectile(source, { x: targetX, y: targetY, z: targetZ }, color, projFlight / speed, abilityKey); }, projDelay / speed);
            this._holdImpacts((projDelay + projFlight) / speed);
            return projDelay + projFlight;
        }
        // A swing connects partway through the lunge (Rifthold: at t = 0.45).
        if (animType === 'slash') this._holdImpacts((baseAnimMs * 0.45) / speed);
        return baseAnimMs;
    }

    _scheduleNextTurn() {
        if (this._stopped || this._battle.state === STATES.BATTLE_OVER) return;
        this._resetTurn();

        this._chargeEvents = [];
        const firedCharges = this._battle.checkAndFireCharges();
        // Register any summons created by charged abilities.
        for (const id of this._battle._pendingSummons) this._autoUnits.add(id);
        this._battle._pendingSummons = [];
        const chargeMs = this._playCharges(firedCharges);

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
        // Index of the skillset menu the ability was picked from, or null.
        const fromMenu = this._abilityFromSkillMenu;
        this._abilityFromSkillMenu = null;
        this._battle.cancelAction();
        if (fromMenu !== null && fromMenu !== undefined) this._ui.openSkillMenu(fromMenu);
    }

    _handleAction(action, abilityKey) {
        if (!this._manualControl) return;
        if (this._battle.state !== STATES.PLAYER_TURN) return;
        if (action === 'auto') {
            const unit = this._battle.activeUnit;
            if (!unit) return;
            this._autoUnits.add(unit.id);
            this._battle.logMsg(`${unit.name} will act on their own from now on.`);
            const cost = this._turnHasMoved ? 80 : 60;
            this._battle.endTurn(cost);
            this._scheduleNextTurn();
            return;
        }
        if (action === 'move') {
            if (!this._turnHasMoved) this._battle.enterMoveMode();
        } else if (action === 'ability') {
            if (!this._turnHasActed) {
                this._abilityFromSkillMenu = this._ui._openSkillset;
                this._battle.enterAbilityMode(abilityKey);
                const ab = ABILITIES[abilityKey];
                if (ab?.aoePattern) this._battle.logMsg(`${ab.name} is ready. Press R to rotate the area.`);
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
        if (this._battle.state === STATES.SELECT_ABILITY_TARGET) this._battle.hoverAbilityTarget(tile.x, tile.y, tile.z);
        this._battle.hoverTile = posKey(tile);
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
            const clicked = this._battle.units.find(u => posKey(u) === posKey(tile) && !u.status.includes('dead'));
            this._ui.inspectUnit(clicked || null);
        }

        // Scripted battles take no commands from the board, only inspection.
        if (!this._manualControl) return;

        if (state === STATES.SELECT_MOVE) {
            if (this._battle.commitMove(tile.x, tile.y, tile.z)) {
                this._turnHasMoved = true;
                this._battle.moveRange = new Set();
            }
        } else if (state === STATES.PLAYER_TURN && !this._turnHasMoved) {
            if (this._battle.moveRange.has(posKey(tile))) {
                this._battle.enterMoveMode();
                if (this._battle.commitMove(tile.x, tile.y, tile.z)) {
                    this._turnHasMoved = true;
                    this._battle.moveRange = new Set();
                }
            }
        } else if (state === STATES.SELECT_ABILITY_TARGET) {
            const abilityKey = this._battle.selectedAbility;
            const source     = this._battle.activeUnit;
            if (this._battle.commitAbility(tile.x, tile.y, tile.z)) {
                this._turnHasActed = true;
                this._abilityFromSkillMenu = null;
                // Register any newly summoned player-team units as auto-controlled.
                for (const id of this._battle._pendingSummons) this._autoUnits.add(id);
                this._battle._pendingSummons = [];
                const isCharged = ABILITIES[abilityKey]?.chargeTime > 0;
                const animMs = (source && !isCharged) ? this._playAbilityAnimation(source, tile.x, tile.y, abilityKey, tile.z) : 0;
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
            const setIdx = SKILLSET_KEYS.indexOf(e.key.toUpperCase());
            if (setIdx >= 0) {
                const sets = unitSkillsets(this._battle.activeUnit);
                if (this._ui._skillMenuOpen) { this._ui.closeSkillMenu(); return; }
                if (!this._turnHasActed && sets[setIdx]) { this._ui.openSkillMenu(setIdx); return; }
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
                const openIdx = this._ui._openSkillset;
                const skillAbs = unit ? (unitSkillsets(unit)[openIdx]?.abilities ?? []) : [];
                const chosen = skillAbs[digit - 1];
                if (chosen) {
                    this._ui.closeSkillMenu();
                    this._abilityFromSkillMenu = openIdx;
                    this._battle.enterAbilityMode(chosen);
                    if (ABILITIES[chosen]?.aoePattern) this._battle.logMsg(`${ABILITIES[chosen].name} is ready. Press R to rotate the area.`);
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
        this._detachTouch?.();
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
