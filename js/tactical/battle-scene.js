import { loadMapData } from './battle-map.js';
import { MAP_DATA } from './data/maps.js';
import { createUnitFromCharData, faceToward } from './units.js';
import { TacticalBattle, STATES } from './battle.js';
import { BattleRenderer } from './battle-renderer.js';
import { BattleUI } from './battle-ui.js';
import { runEnemyTurn } from './enemy-ai.js';
import { isEntityMoving } from '../systems/movement-lerp.js';
import { ABILITIES } from './abilities.js';
import { unlockedAbilities } from './data-registry.js';
import { CHARACTER_DATA } from './data/characters.js';
import { equipmentStatBonuses } from './data/equipment.js';
import { BATTLE_SCENARIOS } from './world-map-data.js';

function buildUnits(worldMap, scenarioId, playerSpawns, enemySpawns) {
    const partyData = worldMap?.party ?? CHARACTER_DATA.filter(c => c.team === 'player');

    // Use scenario-specific roster if defined; fall back to CHARACTER_DATA enemies.
    const scenario   = BATTLE_SCENARIOS[scenarioId];
    const rosterDefs = scenario?.roster;
    const enemyData  = rosterDefs
        ? rosterDefs.map((r, i) => ({
            name:          r.name,
            job:           r.job,
            team:          'enemy',
            x:             20, y: 8,   // overwritten by spawn positions below
            ct:            r.ct ?? 0,
            statMods:      r.statMods ?? {},
            extraAbilities: r.extraAbilities ?? [],
            appearance:    r.appearance ?? null,
        }))
        : CHARACTER_DATA.filter(c => c.team === 'enemy');

    const units = [...partyData, ...enemyData].map((charData) => {
        const equipBonuses = equipmentStatBonuses(charData.appearance);
        const mergedMods   = { ...(charData.statMods || {}), };
        for (const [k, v] of Object.entries(equipBonuses)) {
            mergedMods[k] = (mergedMods[k] || 0) + v;
        }
        // Determine spawn position from map data; fall back to charData position if
        // there are fewer spawn tiles than units.
        let spawnX = charData.x;
        let spawnY = charData.y;
        if (charData.team === 'player') {
            const pIdx = partyData.indexOf(charData);
            const spawn = playerSpawns?.[pIdx];
            if (spawn) { spawnX = spawn.x; spawnY = spawn.y; }
        } else {
            const eIdx = enemyData.indexOf(charData);
            const spawn = enemySpawns?.[eIdx];
            if (spawn) { spawnX = spawn.x; spawnY = spawn.y; }
        }
        const unit = createUnitFromCharData({ ...charData, statMods: mergedMods, x: spawnX, y: spawnY });
        // For player units with XP data, restrict abilities to those unlocked at current job level.
        // Cross-job slots (supportSkill, supportPassive) bypass this filter since their
        // eligibility was already validated when the player chose them.
        if (charData.xp) {
            const unlocked    = new Set(unlockedAbilities(charData.job, charData.xp));
            const crossSlots  = new Set([charData.supportSkill, charData.supportPassive].filter(Boolean));
            unit.abilities = unit.abilities.filter(k => unlocked.has(k) || crossSlots.has(k));
        }
        return unit;
    });
    const players = units.filter(u => u.team === 'player');
    const enemies = units.filter(u => u.team === 'enemy');
    const avg = (arr, key) => arr.reduce((s, u) => s + u[key], 0) / arr.length;
    const enemyCx = avg(enemies, 'x'), enemyCy = avg(enemies, 'y');
    const playerCx = avg(players, 'x'), playerCy = avg(players, 'y');
    players.forEach(u => faceToward(u, enemyCx, enemyCy));
    enemies.forEach(u => faceToward(u, playerCx, playerCy));
    return units;
}

export class BattleScene {
    // opts.mapDef           — pre-selected map definition (from DeployScene); random if omitted
    // opts.customPlayerSpawns — [{x,y}] array overriding map.playerSpawns order
    constructor(scenarioId, worldMap, onComplete, opts = {}) {
        this._scenarioId        = scenarioId;
        this._worldMap          = worldMap;
        this._onComplete        = onComplete || null;
        this._presetMapDef      = opts.mapDef            || null;
        this._customPlayerSpawns = opts.customPlayerSpawns || null;
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

        containerEl.innerHTML = '';
        containerEl.style.position = 'relative';
        document.getElementById('game-container')?.classList.add('tactical-mode');

        this._renderer = new BattleRenderer(containerEl, skinManager);
        this._ui       = new BattleUI(containerEl, this._battle, this._renderer);

        this._ui.setActionHandler((action, key) => this._handleAction(action, key));

        // Input listeners
        this._renderer.canvas.addEventListener('mousedown',    this._onMouseDown   = (e) => this._handleMouseDown(e));
        this._renderer.canvas.addEventListener('mousemove',    this._onMouseMove   = (e) => this._handleMouseMove(e));
        this._renderer.canvas.addEventListener('mouseup',      this._onMouseUp     = (e) => this._handleMouseUp(e));
        this._renderer.canvas.addEventListener('click',        this._onCanvasClick = (e) => this._handleCanvasClick(e));
        this._renderer.canvas.addEventListener('contextmenu',  this._onContextMenu = (e) => { e.preventDefault(); if (this._ui._skillMenuOpen) { this._ui.closeSkillMenu(); return; } this._cancelTargeting(); });
        this._renderer.canvas.addEventListener('wheel',        this._onWheel       = (e) => { e.preventDefault(); const d = e.deltaY > 0 ? -2 : 2; this._renderer.tileSize = Math.max(24, Math.min(80, this._renderer.tileSize + d)); }, { passive: false });
        document.addEventListener('keydown', this._onKeydown = (e) => this._handleKeydown(e));
        document.addEventListener('keyup',   this._onKeyup   = (e) => this._handleKeyup(e));

        this._panDrag   = false;
        this._panActive = false;
        this._panButton = -1;
        this._panStart  = { x: 0, y: 0 };
        this._panCam    = { x: 0, y: 0 };
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
        });
    }

    _onBattleExit() {
        // Rewards were already computed and applied in render(); just exit.
        this._sm.pop();
        if (this._onComplete) this._onComplete(
            this._pendingRewards?.won ?? false,
            this._pendingRewards
        );
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
        source._anim = { type: animType, dx: rawDx / len, dy: rawDy / len, startMs: performance.now(), durationMs: animType === 'slash' ? 280 : 350 };
        if (animType === 'shot' || animType === 'cast') {
            const color      = ab.projectileColor || '#ffffff';
            const projDelay  = animType === 'shot' ? 180 : 200;
            const projFlight = 420;
            setTimeout(() => { this._renderer.spawnProjectile(source.x, source.y, targetX, targetY, color, projFlight); }, projDelay);
            return projDelay + projFlight;
        }
        return source._anim.durationMs;
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
                this._renderer._autoCenterNext = true;
                this._battle.startTurn(unit);

                if (this._battle.state === STATES.ADVANCE_CT) {
                    this._enemyTimer = setTimeout(() => { if (!this._stopped) this._scheduleNextTurn(); }, 200);
                } else if (this._battle.state === STATES.ENEMY_TURN || (this._battle.state === STATES.PLAYER_TURN && this._autoUnits.has(unit.id))) {
                    this._enemyTimer = setTimeout(() => {
                        if (this._stopped) return;
                        const animMs = runEnemyTurn(unit, this._battle, this._playAbilityAnimation.bind(this));
                        const wait = typeof animMs === 'number' ? animMs + 150 : 150;
                        this._enemyTimer = setTimeout(() => {
                            if (!this._stopped && this._battle.state !== STATES.BATTLE_OVER) this._scheduleNextTurn();
                        }, wait);
                    }, 600);
                }
            });
        };

        if (chargeMs > 0) {
            // Center on the first unit whose charge fired so the player can watch.
            const first = firedCharges[0];
            if (first) this._renderer.centerOn(first.unit.x, first.unit.y, this._battle.map.width, this._battle.map.height);
            this._enemyTimer = setTimeout(proceed, chargeMs + 800);
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
                this._renderer._clampCam(this._battle.map.width, this._battle.map.height);
                return;
            }
        }
        const rect = this._renderer.canvas.getBoundingClientRect();
        const sx   = (e.clientX - rect.left) * (this._renderer.canvas.width  / rect.width);
        const sy   = (e.clientY - rect.top)  * (this._renderer.canvas.height / rect.height);
        const tile = this._renderer.screenToTile(sx, sy, this._battle.map, this._battle.units);
        if (this._battle.state === STATES.SELECT_ABILITY_TARGET) this._battle.hoverAbilityTarget(tile.x, tile.y);
        this._battle.hoverTile = `${tile.x},${tile.y}`;
    }

    _handleMouseUp(e) {
        if (e.button === this._panButton) {
            this._panDrag   = false;
            this._panActive = false;
        }
    }

    _handleCanvasClick(e) {
        if (this._panActive || e.button !== 0) return;
        const rect = this._renderer.canvas.getBoundingClientRect();
        const sx   = (e.clientX - rect.left) * (this._renderer.canvas.width  / rect.width);
        const sy   = (e.clientY - rect.top)  * (this._renderer.canvas.height / rect.height);

        for (const btn of (this._renderer._rotateBtns || [])) {
            if (sx >= btn.x && sx <= btn.x + btn.w && sy >= btn.y && sy <= btn.y + btn.h) {
                this._renderer.rotateView(btn.delta);
                return;
            }
        }
        const cb = this._renderer._centerBtn;
        if (cb && sx >= cb.x && sx <= cb.x + cb.w && sy >= cb.y && sy <= cb.y + cb.h) {
            const u = this._battle.activeUnit;
            if (u) this._renderer.centerOn(u.x, u.y, this._battle.map.width, this._battle.map.height);
            return;
        }

        const map  = this._battle.map;
        const tile = this._renderer.screenToTile(sx, sy, map, this._battle.units);
        const state = this._battle.state;

        // Idle click: inspect the unit on this tile (or clear if empty ground).
        if (state === STATES.PLAYER_TURN || state === STATES.ADVANCE_CT || state === STATES.ENEMY_TURN) {
            const clicked = this._battle.units.find(u => u.x === tile.x && u.y === tile.y && !u.status.includes('dead'));
            this._ui.inspectUnit(clicked || null);
        }

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
                    }, animMs + 150);
                }
            }
        }
    }

    _handleKeydown(e) {
        const ARROW_PAN = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
        const panDir = ARROW_PAN[e.key];
        if (panDir) { this._renderer._panKeys[panDir] = true; e.preventDefault(); return; }

        if (e.key === 'f' || e.key === 'F') {
            const u = this._battle.activeUnit;
            if (u) this._renderer.centerOn(u.x, u.y, this._battle.map.width, this._battle.map.height);
            e.preventDefault(); return;
        }
        if (e.key === 'q' || e.key === 'Q') { this._renderer.rotateView(-1); e.preventDefault(); return; }
        if (e.key === 'e' || e.key === 'E') { this._renderer.rotateView( 1); e.preventDefault(); return; }
        if (e.key === 'r' || e.key === 'R') { this._battle.rotateAbility(); return; }
        if (e.key === 'Escape') {
            if (this._ui._skillMenuOpen) { this._ui.closeSkillMenu(); return; }
            this._cancelTargeting(); return;
        }

        if (this._battle.state === STATES.PLAYER_TURN) {
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
        if (panDir) { this._renderer._panKeys[panDir] = false; return; }
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
