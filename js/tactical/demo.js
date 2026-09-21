import { createDemoMap } from './battle-map.js';
import { createUnitFromCharData, faceToward } from './units.js';
import { TacticalBattle, STATES } from './battle.js';
import { BattleRenderer } from './battle-renderer.js';
import { BattleUI } from './battle-ui.js';
import { runEnemyTurn } from './enemy-ai.js';
import { isEntityMoving } from '../systems/movement-lerp.js';
import { ABILITIES } from './abilities.js';
import { CHARACTER_DATA } from './data/characters.js';
import { SceneManager } from './scene-manager.js';
import { WorldMapScene } from './world-map-scene.js';

export function startWorldMap(containerEl, skinManager, onExit) {
    containerEl.innerHTML = '';
    containerEl.style.position = 'relative';
    const sm = new SceneManager(containerEl, skinManager, onExit);
    sm.push(new WorldMapScene());
    return () => {
        // Force immediate teardown if the caller needs it
        sm._stop();
        sm.current?.exit();
        if (onExit) onExit();
    };
}

function buildUnits() {
    const units = CHARACTER_DATA.map(charData => createUnitFromCharData(charData));

    // Face each unit toward the centroid of the opposing team.
    const players = units.filter(u => u.team === 'player');
    const enemies = units.filter(u => u.team === 'enemy');
    const avg = (arr, key) => arr.reduce((s, u) => s + u[key], 0) / arr.length;
    const enemyCx = avg(enemies, 'x'), enemyCy = avg(enemies, 'y');
    const playerCx = avg(players, 'x'), playerCy = avg(players, 'y');
    players.forEach(u => faceToward(u, enemyCx, enemyCy));
    enemies.forEach(u => faceToward(u, playerCx, playerCy));

    return units;
}

export function startDemoBattle(containerEl, skinManager, onExit) {
    const map    = createDemoMap();
    const units  = buildUnits();
    const battle = new TacticalBattle(map, units);

    containerEl.innerHTML = '';
    containerEl.style.position = 'relative';
    document.getElementById('game-container')?.classList.add('tactical-mode');

    const renderer = new BattleRenderer(containerEl, skinManager);
    const ui       = new BattleUI(containerEl, battle, renderer);

    let rafId            = null;
    let stopped          = false;
    let enemyTimerHandle = null;

    // Per-turn action tracking (FFT-style: move then act, ability ends turn)
    let turnHasMoved = false;
    let turnHasActed = false;

    function resetTurnState() {
        turnHasMoved = false;
        turnHasActed = false;
    }

    function handleExit() {
        stopped = true;
        if (rafId) cancelAnimationFrame(rafId);
        if (enemyTimerHandle) clearTimeout(enemyTimerHandle);
        renderer.canvas.removeEventListener('mousedown', onMouseDown);
        renderer.canvas.removeEventListener('mousemove', onMouseMove);
        renderer.canvas.removeEventListener('mouseup', onMouseUp);
        renderer.canvas.removeEventListener('click', onCanvasClick);
        renderer.canvas.removeEventListener('contextmenu', onContextMenu);
        renderer.canvas.removeEventListener('wheel', onWheel);
        document.removeEventListener('keydown', onKeydown);
        document.removeEventListener('keyup', onKeyup);
        document.getElementById('game-container')?.classList.remove('tactical-mode');
        ui.destroy();
        containerEl.innerHTML = '';
        if (onExit) onExit();
    }

    function checkVictory() {
        return battle.state === STATES.BATTLE_OVER;
    }

    // Trigger the attacker sprite animation and spawn a projectile if the
    // ability has a ranged/magic anim type.
    // Returns the total ms the caller should wait before advancing the turn.
    function playAbilityAnimation(source, targetX, targetY, abilityKey) {
        const ab = ABILITIES[abilityKey];
        if (!ab) return 0;

        const animType = ab.animType || 'slash';

        const rawDx = targetX - source.x;
        const rawDy = targetY - source.y;
        const len   = Math.sqrt(rawDx * rawDx + rawDy * rawDy) || 1;
        const dx    = rawDx / len;
        const dy    = rawDy / len;

        const spriteDuration = animType === 'slash' ? 280 : 350;
        source._anim = {
            type: animType, dx, dy,
            startMs:    performance.now(),
            durationMs: spriteDuration,
        };

        if (animType === 'shot' || animType === 'cast') {
            const color      = ab.projectileColor || '#ffffff';
            const projDelay  = animType === 'shot' ? 180 : 200;
            const projFlight = 420;
            setTimeout(() => {
                renderer.spawnProjectile(source.x, source.y, targetX, targetY, color, projFlight);
            }, projDelay);
            return projDelay + projFlight;
        }

        return spriteDuration;
    }

    function scheduleNextTurn() {
        if (stopped || battle.state === STATES.BATTLE_OVER) return;

        resetTurnState();

        const firedCharges = battle.checkAndFireCharges();
        let chargeAnimMs = 0;
        for (const fc of firedCharges) {
            chargeAnimMs = Math.max(chargeAnimMs, playAbilityAnimation(fc.unit, fc.targetX, fc.targetY, fc.ability));
        }

        // Poll until all visual walk animations finish, then call `then`.
        // This ensures _autoCenterNext fires only after the render loop's
        // movement-follow code has stopped overriding the camera target.
        const MOVE_POLL_MS = 40;
        const waitForMovement = (then) => {
            if (stopped) return;
            if (battle.units.some(u => isEntityMoving(u))) {
                enemyTimerHandle = setTimeout(() => waitForMovement(then), MOVE_POLL_MS);
            } else {
                then();
            }
        };

        const proceed = () => {
            if (stopped || battle.state === STATES.BATTLE_OVER) return;

            // Always wait for any in-progress walk animations to finish before
            // starting the next turn so _autoCenterNext lands on the right unit.
            waitForMovement(() => {
                if (stopped || battle.state === STATES.BATTLE_OVER) return;

                const unit = battle.advanceCT();
                if (!unit) return;
                renderer._autoCenterNext = true;
                battle.startTurn(unit);

                if (battle.state === STATES.ADVANCE_CT) {
                    enemyTimerHandle = setTimeout(() => {
                        if (stopped) return;
                        scheduleNextTurn();
                    }, 200);
                } else if (battle.state === STATES.ENEMY_TURN) {
                    enemyTimerHandle = setTimeout(() => {
                        if (stopped) return;
                        const animMs = runEnemyTurn(unit, battle, playAbilityAnimation);
                        const wait   = typeof animMs === 'number' ? animMs + 150 : 150;
                        enemyTimerHandle = setTimeout(() => {
                            if (stopped) return;
                            if (!checkVictory()) scheduleNextTurn();
                        }, wait);
                    }, 600);
                }
            });
        };

        if (chargeAnimMs > 0) {
            enemyTimerHandle = setTimeout(proceed, chargeAnimMs + 150);
        } else {
            proceed();
        }
    }

    function handleAction(action, abilityKey) {
        if (battle.state !== STATES.PLAYER_TURN) return;
        if (action === 'move') {
            if (!turnHasMoved) battle.enterMoveMode();
        } else if (action === 'ability') {
            if (!turnHasActed) battle.enterAbilityMode(abilityKey);
        } else if (action === 'defend') {
            if (!turnHasActed) {
                battle.enterDefendMode();
                battle.endTurn(turnHasMoved ? 100 : 80);
                scheduleNextTurn();
            }
        } else if (action === 'pivot') {
            battle.pivotUnit();
        } else if (action === 'wait') {
            // FFT-style CT retention: skip nothing = keep 40 CT (cost 60),
            // moved only = keep 20 CT (cost 80), full action = cost 100 (via ability path).
            const waitCost = turnHasMoved ? 80 : 60;
            battle.endTurn(waitCost);
            scheduleNextTurn();
        }
    }

    ui.setActionHandler(handleAction);

    // ---- Canvas pan (left-click drag or middle-mouse drag) ----
    let panDrag = false;
    let panButton = -1;
    let panStartX = 0, panStartY = 0;
    let panCamX  = 0, panCamY  = 0;
    // How many pixels the pointer must move before a mousedown becomes a drag
    // (prevents a tiny jitter from swallowing a click).
    const PAN_THRESHOLD = 4;
    let panActive = false; // true once threshold crossed

    function onMouseDown(e) {
        if (e.button === 0 || e.button === 1) {
            panDrag   = true;
            panActive = false;
            panButton = e.button;
            panStartX = e.clientX;
            panStartY = e.clientY;
            panCamX   = renderer.camX;
            panCamY   = renderer.camY;
            if (e.button === 1) e.preventDefault();
        }
    }

    function onMouseMove(e) {
        if (panDrag) {
            const dx = e.clientX - panStartX;
            const dy = e.clientY - panStartY;
            if (!panActive && Math.sqrt(dx * dx + dy * dy) >= PAN_THRESHOLD) {
                panActive = true;
            }
            if (panActive) {
                renderer.camX = panCamX + dx;
                renderer.camY = panCamY + dy;
                renderer._camTargetX = null;
                renderer._camTargetY = null;
                renderer._clampCam(map.width, map.height);
                return;
            }
        }
        const rect = renderer.canvas.getBoundingClientRect();
        const sx   = (e.clientX - rect.left) * (renderer.canvas.width  / rect.width);
        const sy   = (e.clientY - rect.top)  * (renderer.canvas.height / rect.height);
        const tile = renderer.screenToTile(sx, sy, map, battle.units);
        if (battle.state === STATES.SELECT_ABILITY_TARGET) {
            battle.hoverAbilityTarget(tile.x, tile.y);
        }
        battle.hoverTile = `${tile.x},${tile.y}`;
    }

    function onMouseUp(e) {
        if (e.button === panButton) {
            panDrag   = false;
            panActive = false;
        }
    }

    function onContextMenu(e) {
        e.preventDefault();
        if (ui._skillMenuOpen) { ui.closeSkillMenu(); return; }
        battle.cancelAction();
    }

    function onCanvasClick(e) {
        if (panActive) return;
        if (e.button !== 0) return;

        const rect  = renderer.canvas.getBoundingClientRect();
        const sx    = (e.clientX - rect.left) * (renderer.canvas.width  / rect.width);
        const sy    = (e.clientY - rect.top)  * (renderer.canvas.height / rect.height);

        // Rotate buttons take priority over tile clicks.
        for (const btn of (renderer._rotateBtns || [])) {
            if (sx >= btn.x && sx <= btn.x + btn.w && sy >= btn.y && sy <= btn.y + btn.h) {
                renderer.rotateView(btn.delta);
                return;
            }
        }

        // Center button: re-center camera on active unit.
        const cb = renderer._centerBtn;
        if (cb && sx >= cb.x && sx <= cb.x + cb.w && sy >= cb.y && sy <= cb.y + cb.h) {
            const u = battle.activeUnit;
            if (u) renderer.centerOn(u.x, u.y, map.width, map.height);
            return;
        }

        const tile  = renderer.screenToTile(sx, sy, map, battle.units);
        const state = battle.state;

        // Idle click (no action selected): inspect the unit on the tile, or clear.
        if (state === STATES.PLAYER_TURN || state === STATES.ADVANCE_CT || state === STATES.ENEMY_TURN) {
            const clicked = battle.units.find(u => u.x === tile.x && u.y === tile.y && !u.status.includes('dead'));
            ui.inspectUnit(clicked || null);
        }

        if (state === STATES.SELECT_MOVE) {
            if (battle.commitMove(tile.x, tile.y)) {
                turnHasMoved = true;
                battle.moveRange = new Set();
            }
        } else if (state === STATES.PLAYER_TURN && !turnHasMoved) {
            // Clicking a move-range tile directly from the action menu enters move
            // mode and commits in one step so the player can skip the Move button.
            const key = `${tile.x},${tile.y}`;
            if (battle.moveRange.has(key)) {
                battle.enterMoveMode();
                if (battle.commitMove(tile.x, tile.y)) {
                    turnHasMoved = true;
                    battle.moveRange = new Set();
                }
            }
        } else if (state === STATES.SELECT_ABILITY_TARGET) {
            const abilityKey = battle.selectedAbility;
            const source     = battle.activeUnit;
            if (battle.commitAbility(tile.x, tile.y)) {
                turnHasActed = true;
                const isCharged = ABILITIES[abilityKey]?.chargeTime > 0;
                const animMs = (source && !isCharged)
                    ? playAbilityAnimation(source, tile.x, tile.y, abilityKey)
                    : 0;
                const cost = turnHasMoved ? 100 : 80;
                // For charged abilities the turn ends immediately (unit is now channeling).
                // For instant abilities wait for the animation to finish before advancing.
                if (isCharged) {
                    battle.endTurn(cost);
                    if (!checkVictory()) scheduleNextTurn();
                } else {
                    battle.endTurn(cost);
                    enemyTimerHandle = setTimeout(() => {
                        if (stopped) return;
                        if (!checkVictory()) scheduleNextTurn();
                    }, animMs + 150);
                }
            }
        }
    }

    function onWheel(e) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -2 : 2;
        renderer.tileSize = Math.max(24, Math.min(80, renderer.tileSize + delta));
    }

    // Arrow keys pan the camera; WASD are reserved for battle actions
    const ARROW_PAN = {
        ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
    };

    function onKeydown(e) {
        const panDir = ARROW_PAN[e.key];
        if (panDir) {
            renderer._panKeys[panDir] = true;
            e.preventDefault();
            return;
        }

        // Center camera on active unit
        if (e.key === 'f' || e.key === 'F') {
            const u = battle.activeUnit;
            if (u) renderer.centerOn(u.x, u.y, map.width, map.height);
            e.preventDefault();
            return;
        }

        // Camera rotation (always available regardless of battle state)
        if (e.key === 'q' || e.key === 'Q') { renderer.rotateView(-1); e.preventDefault(); return; }
        if (e.key === 'e' || e.key === 'E') { renderer.rotateView( 1); e.preventDefault(); return; }

        // Escape and right-click both close skill submenu first; if not open, cancel action
        if (e.key === 'Escape') {
            if (ui._skillMenuOpen) { ui.closeSkillMenu(); return; }
            battle.cancelAction();
            return;
        }

        if (battle.state === STATES.PLAYER_TURN) {
            if (e.key === 'm' || e.key === 'M') { if (!turnHasMoved) battle.enterMoveMode(); return; }
            if (e.key === 'a' || e.key === 'A') {
                if (ui._skillMenuOpen) { ui.closeSkillMenu(); return; }
                if (!turnHasActed) battle.enterAbilityMode('attack');
                return;
            }
            if (e.key === 's' || e.key === 'S') {
                if (!turnHasActed && !ui._skillMenuOpen) { ui._skillMenuOpen = true; return; }
                if (ui._skillMenuOpen) { ui.closeSkillMenu(); return; }
            }
            if (e.key === 'd' || e.key === 'D') {
                if (!turnHasActed) {
                    battle.enterDefendMode();
                    battle.endTurn(turnHasMoved ? 100 : 80);
                    scheduleNextTurn();
                }
                return;
            }
            if (e.key === 'p' || e.key === 'P') {
                battle.pivotUnit();
                return;
            }
            if (e.key === 'w' || e.key === 'W') {
                if (ui._skillMenuOpen) { ui.closeSkillMenu(); return; }
                const waitCost = turnHasMoved ? 80 : 60;
                battle.endTurn(waitCost);
                scheduleNextTurn();
                return;
            }
            // Number keys select skills from the skill submenu
            const digit = parseInt(e.key, 10);
            if (!isNaN(digit) && digit >= 1 && ui._skillMenuOpen && !turnHasActed) {
                const unit = battle.activeUnit;
                const skillAbs = unit?.abilities.filter(k => k !== 'attack' && ABILITIES[k] && !ABILITIES[k].passive) || [];
                const chosen = skillAbs[digit - 1];
                if (chosen) {
                    ui.closeSkillMenu();
                    battle.enterAbilityMode(chosen);
                }
                return;
            }
        }
    }

    function onKeyup(e) {
        const panDir = ARROW_PAN[e.key];
        if (panDir) { renderer._panKeys[panDir] = false; return; }
    }

    renderer.canvas.addEventListener('mousedown', onMouseDown);
    renderer.canvas.addEventListener('mousemove', onMouseMove);
    renderer.canvas.addEventListener('mouseup',   onMouseUp);
    renderer.canvas.addEventListener('click',     onCanvasClick);
    renderer.canvas.addEventListener('contextmenu', onContextMenu);
    renderer.canvas.addEventListener('wheel', onWheel, { passive: false });
    document.addEventListener('keydown', onKeydown);
    document.addEventListener('keyup',   onKeyup);

    // Start first turn
    scheduleNextTurn();

    // Render loop
    function loop(now) {
        if (stopped) return;
        renderer.render(battle, now);
        ui.update(battle, handleExit, { hasMoved: turnHasMoved, hasActed: turnHasActed });
        rafId = requestAnimationFrame(loop);
    }
    rafId = requestAnimationFrame(loop);

    return handleExit;
}
