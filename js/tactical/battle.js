import { computeMoveRange, computeMovePath, computeAttackRange, computeAoeArea, computePatternArea, resolveAbility, ABILITIES } from './abilities.js';
import { isDead, isAlive, isConscious, isUnconscious, isStunned, faceToward, setFacing, createUnit } from './units.js';
import { getTile, applyTerrainEffect } from './battle-map.js';
import { moveEntity, moveEntityAlongPath } from '../systems/movement-lerp.js';

export const STATES = {
    ADVANCE_CT:            'ADVANCE_CT',
    PLAYER_TURN:           'PLAYER_TURN',
    SELECT_MOVE:           'SELECT_MOVE',
    SELECT_ABILITY:        'SELECT_ABILITY',
    SELECT_ABILITY_TARGET: 'SELECT_ABILITY_TARGET',
    ANIMATING:             'ANIMATING',
    ENEMY_TURN:            'ENEMY_TURN',
    BATTLE_OVER:           'BATTLE_OVER',
};

const CT_ACT_THRESHOLD = 100;
const CT_TICK_AMOUNT   = 1;

export class TacticalBattle {
    constructor(map, units) {
        this.map   = map;
        this.units = units;
        this.state = STATES.ADVANCE_CT;
        this.activeUnit = null;
        this.selectedAbility = null;
        this.abilityRotation = 0;
        this._lastHoverTile = null;
        this.moveRange = new Set();
        this.abilityRange = new Set();
        this.aoePreview = new Set();
        this.hitPreview = new Set();
        this.log = [];
        this.winner = null;
        this._animEnd = 0;
        this._pendingEnemy = null;
        this.onLogMessage = null;
        this.onStateChange = null;
        this._ctPreSpent = 0;
        // IDs of player-team summons that should be auto-controlled by the AI.
        this._pendingSummons = [];
    }

    get livingUnits() {
        return this.units.filter(u => isAlive(u));
    }

    logMsg(msg) {
        this.log.unshift(msg);
        if (this.log.length > 40) this.log.pop();
        if (this.onLogMessage) this.onLogMessage(msg);
    }

    setState(s) {
        this.state = s;
        if (this.onStateChange) this.onStateChange(s);
    }

    // Advance CT until a unit reaches the threshold. Returns the acting unit.
    advanceCT() {
        const living = this.livingUnits;
        if (living.length === 0) return null;
        for (;;) {
            for (const u of living) {
                const hasteMult = u.status.includes('haste') ? 1.5 : (u.status.includes('slow') ? 0.5 : 1.0);
                u.ct += u.spd * CT_TICK_AMOUNT * hasteMult;
                if (u._charging) u._charging.ct += u.spd * CT_TICK_AMOUNT * hasteMult;
            }
            const ready = living.filter(u => u.ct >= CT_ACT_THRESHOLD);
            if (ready.length > 0) {
                ready.sort((a, b) => b.ct - a.ct || b.spd - a.spd);
                return ready[0];
            }
        }
    }

    startTurn(unit) {
        this.activeUnit = unit;

        // Remove defend status at the start of each turn
        unit.status = unit.status.filter(s => s !== 'defend');

        // Consume stun BEFORE timers tick — stun always fires on the very next turn.
        if (isStunned(unit)) {
            unit.status = unit.status.filter(s => s !== 'stun');
            delete (unit.statusTimers || {})['stun'];
            this.logMsg(`${unit.name} is stunned and loses their turn!`);
            this.endTurn(15);
            return;
        }

        // Tick all status timers; remove any that expire
        const timers = unit.statusTimers || {};
        for (const [s, t] of Object.entries(timers)) {
            timers[s] = t - 1;
            if (timers[s] <= 0) {
                delete timers[s];
                unit.status = unit.status.filter(x => x !== s);
                this.logMsg(`${unit.name}'s ${s} wore off.`);
                // frog wears off: remove associated stat debuffs
                if (s === 'frog') {
                    unit.buffs = (unit.buffs || []).filter(b => !b.key.startsWith('frog_'));
                }
            }
        }
        unit.statusTimers = timers;

        // regen_aura passive: heal 5 HP
        if (unit.abilities.includes('regen_aura') && unit.mp > 0) {
            unit.hp = Math.min(unit.maxHp, unit.hp + 5);
            this.logMsg(`${unit.name} regenerates 5 HP from Regen Aura.`);
        }

        // regen status: heal ~8% max HP
        if (unit.status.includes('regen')) {
            const amt = Math.max(1, Math.round(unit.maxHp * 0.08));
            unit.hp = Math.min(unit.maxHp, unit.hp + amt);
            this.logMsg(`${unit.name} regenerates ${amt} HP.`);
        }

        // poison: deal ~6% max HP each turn
        if (unit.status.includes('poison')) {
            const dmg = Math.max(1, Math.round(unit.maxHp * 0.06));
            unit.hp = Math.max(0, unit.hp - dmg);
            this.logMsg(`${unit.name} takes ${dmg} poison damage!`);
            this._spawnFloat(unit, `-${dmg}`, '#88ff44');
            if (unit.hp <= 0) {
                if (!unit.status.includes('unconscious')) unit.status.push('unconscious');
                unit.deathTimer = 3;
            }
        }

        // Decrement timed buffs, remove expired
        unit.buffs = (unit.buffs || []).filter(b => {
            if (b.duration === null) return true;
            return --b.duration > 0;
        });

        if (isUnconscious(unit)) {
            unit.deathTimer = (unit.deathTimer || 0) - 1;
            if (unit.deathTimer <= 0) {
                unit.status = unit.status.filter(s => s !== 'unconscious');
                if (!unit.status.includes('dead')) unit.status.push('dead');
                this.logMsg(`${unit.name} has perished!`);
                this._checkVictory();
            }
            this.endTurn(100);
            return;
        }

        // sleep: skip turn, status removed by taking damage (see resolveAbility)
        if (unit.status.includes('sleep')) {
            this.logMsg(`${unit.name} is asleep!`);
            this.endTurn(15);
            return;
        }

        // berserk: forced auto-attack against nearest enemy, no player control
        if (unit.status.includes('berserk')) {
            const oppTeam = unit.team === 'enemy' ? 'player' : 'enemy';
            const foes = this.livingUnits.filter(u => u.team === oppTeam && isConscious(u));
            if (foes.length > 0) {
                foes.sort((a, b) =>
                    (Math.abs(a.x - unit.x) + Math.abs(a.y - unit.y)) -
                    (Math.abs(b.x - unit.x) + Math.abs(b.y - unit.y))
                );
                const tgt = foes[0];
                this.logMsg(`${unit.name} is berserk and attacks ${tgt.name}!`);
                this.applyEnemyAbility(unit, 'attack', tgt.x, tgt.y);
            }
            this.endTurn(80);
            return;
        }

        // charm: unit fights for the other side this turn (treated as enemy turn by AI)
        if (unit.status.includes('charm')) {
            this.logMsg(`${unit.name} is charmed!`);
            this.setState(unit.team === 'player' ? STATES.ENEMY_TURN : STATES.PLAYER_TURN);
            return;
        }

        if (unit.team === 'enemy') {
            this.setState(STATES.ENEMY_TURN);
        } else {
            this.setState(STATES.PLAYER_TURN);
            this.moveRange = computeMoveRange(unit, this.map, this.livingUnits);
        }
    }

    // Player selects Move action
    enterMoveMode() {
        if (this.state !== STATES.PLAYER_TURN) return;
        this.moveRange = computeMoveRange(this.activeUnit, this.map, this.livingUnits);
        this.abilityRange = new Set();
        this.aoePreview = new Set();
        this.hitPreview = new Set();
        this.setState(STATES.SELECT_MOVE);
    }

    // Player selects an ability to use
    enterAbilityMode(abilityKey) {
        if (this.state !== STATES.PLAYER_TURN) return;
        const ab = ABILITIES[abilityKey];
        if (!ab) return;
        if (ab.passive) return;
        if (ab.mpCost > this.activeUnit.mp) return;
        this.selectedAbility = abilityKey;
        this.abilityRotation = 0;
        this._lastHoverTile = null;
        if (ab.range === 0 && ab.targetType === 'self') {
            this.abilityRange = new Set([`${this.activeUnit.x},${this.activeUnit.y}`]);
        } else {
            const fromTile = new Set([`${this.activeUnit.x},${this.activeUnit.y}`]);
            const requiresLos = ab.requiresLos !== false;
            this.abilityRange = computeAttackRange(fromTile, ab.range, false, requiresLos, this.map);
        }
        this.aoePreview = new Set();
        this.hitPreview = new Set();
        this.setState(STATES.SELECT_ABILITY_TARGET);
    }

    // Update AoE preview when hovering a target tile
    hoverAbilityTarget(tx, ty) {
        if (this.state !== STATES.SELECT_ABILITY_TARGET) return;
        const ab = ABILITIES[this.selectedAbility];
        this._lastHoverTile = { x: tx, y: ty };
        if (ab?.aoePattern) {
            this.aoePreview = computePatternArea(tx, ty, ab.aoePattern, this.abilityRotation);
        } else if (ab?.aoe > 0) {
            this.aoePreview = computeAoeArea(tx, ty, ab.aoe);
        } else {
            this.aoePreview = new Set([`${tx},${ty}`]);
        }

        // Tile-targeting abilities don't highlight character hits.
        if (ab?.targetType === 'tile') { this.hitPreview = new Set(); return; }

        // Compute which tiles in the preview contain a valid hittable target.
        const source = this.activeUnit;
        this.hitPreview = new Set();
        for (const key of this.aoePreview) {
            const hit = this.livingUnits.some(u => {
                if (`${u.x},${u.y}` !== key) return false;
                const sameTeam = u.team === source.team;
                if (ab.targetType === 'ally'  && !sameTeam) return false;
                if (ab.targetType === 'enemy' &&  sameTeam) return false;
                return true;
            });
            if (hit) this.hitPreview.add(key);
        }
    }

    rotateAbility() {
        if (this.state !== STATES.SELECT_ABILITY_TARGET) return;
        const ab = ABILITIES[this.selectedAbility];
        if (!ab?.aoePattern) return;
        this.abilityRotation = (this.abilityRotation + 1) % 4;
        if (this._lastHoverTile) {
            this.hoverAbilityTarget(this._lastHoverTile.x, this._lastHoverTile.y);
        }
    }

    // Player commits a move
    commitMove(tx, ty) {
        if (this.state !== STATES.SELECT_MOVE) return false;
        const key = `${tx},${ty}`;
        if (!this.moveRange.has(key)) return false;
        const unit = this.activeUnit;
        const path = computeMovePath(unit, this.map, this.livingUnits, tx, ty);
        faceToward(unit, tx, ty);
        if (path && path.length > 0) {
            moveEntityAlongPath(unit, path, 180);
        } else {
            moveEntity(unit, tx, ty, 180);
        }
        this.logMsg(`${unit.name} moved to (${tx}, ${ty}).`);
        // Pre-spend move CT so the bar drops immediately on move.
        const moveCost = 20;
        unit.ct = Math.max(0, unit.ct - moveCost);
        this._ctPreSpent += moveCost;
        this.setState(STATES.PLAYER_TURN);
        this.moveRange = new Set();
        this.abilityRange = new Set();
        return true;
    }

    // Player commits an ability on a tile
    commitAbility(tx, ty) {
        if (this.state !== STATES.SELECT_ABILITY_TARGET) return false;
        const ab = ABILITIES[this.selectedAbility];
        if (!ab) return false;
        if (!this.abilityRange.has(`${tx},${ty}`)) return false;

        const source = this.activeUnit;

        if (ab.chargeTime && ab.chargeTime > 0) {
            source.mp = Math.max(0, source.mp - ab.mpCost);
            faceToward(source, tx, ty);
            // Pre-spend action CT so the bar drops immediately.
            const actCost = ab.actionCost ?? 60;
            source.ct = Math.max(0, source.ct - actCost);
            this._ctPreSpent += actCost;
            source._charging = {
                ability: this.selectedAbility,
                rotation: this.abilityRotation,
                targetX: tx,
                targetY: ty,
                ct: 0,
                needed: ab.chargeTime,
            };
            if (!source.status.includes('charging')) source.status.push('charging');
            this.logMsg(`${source.name} begins channeling ${ab.name}!`);
            this.selectedAbility = null;
            this.abilityRotation = 0;
            this.abilityRange = new Set();
            this.aoePreview = new Set();
            this.hitPreview = new Set();
            this.setState(STATES.PLAYER_TURN);
            return true;
        }

        source.mp = Math.max(0, source.mp - ab.mpCost);
        faceToward(source, tx, ty);
        // Pre-spend action CT so the bar drops immediately.
        const actCost = ab.actionCost ?? 60;
        source.ct = Math.max(0, source.ct - actCost);
        this._ctPreSpent += actCost;

        // Summon abilities: place a new creature on the target tile.
        if (ab.isSummon) {
            this._resolveSummon(source, ab, tx, ty);
            this.selectedAbility = null;
            this.abilityRotation = 0;
            this.abilityRange = new Set();
            this.aoePreview = new Set();
            this.hitPreview = new Set();
            this.setState(STATES.PLAYER_TURN);
            return true;
        }

        let affectedTiles;
        if (ab.aoePattern) {
            affectedTiles = computePatternArea(tx, ty, ab.aoePattern, this.abilityRotation);
        } else if (ab.aoe > 0) {
            affectedTiles = computeAoeArea(tx, ty, ab.aoe);
        } else {
            affectedTiles = new Set([`${tx},${ty}`]);
        }

        const targets = this.livingUnits.filter(u => {
            const sameTeam = u.team === source.team;
            if (ab.targetType === 'ally' && !sameTeam) return false;
            if (ab.targetType === 'enemy' && sameTeam) return false;
            return affectedTiles.has(`${u.x},${u.y}`);
        });

        if (targets.length === 0 && !ab.isHeal && !ab.isCure && ab.targetType !== 'tile') {
            this.logMsg(`${source.name} used ${ab.name} but hit nothing!`);
        }

        for (const target of targets) {
            const result = resolveAbility(source, target, this.selectedAbility, this.map);
            if (result.missed) {
                this.logMsg(`${source.name} missed ${target.name}!`);
                this._spawnFloat(target, 'Miss!', '#aaa');
                continue;
            }
            if (result.damage > 0) {
                const highGround = getTile(this.map, source.x, source.y)?.elevation > getTile(this.map, target.x, target.y)?.elevation;
                const suffix = highGround ? ' (high gnd!)' : '';
                this.logMsg(`${source.name} hits ${target.name} for ${result.damage} dmg${suffix}.`);
                this._spawnFloat(target, `-${result.damage}`, '#f88');
            }
            if (result.healing > 0) {
                this.logMsg(`${source.name} heals ${target.name} for ${result.healing} HP.`);
                this._spawnFloat(target, `+${result.healing}`, '#8f8');
            }
            if (result.revived) {
                this.logMsg(`${target.name} is revived!`);
            }
            if (result.reraise) {
                this.logMsg(`${target.name} is saved by Reraise!`);
                this._spawnFloat(target, 'Reraise!', '#ffeeaa');
            }
            if (result.statusApplied) {
                this.logMsg(`${target.name} is afflicted with ${result.statusApplied}!`);
            }
            if (result.silenced) {
                this.logMsg(`${source.name} is silenced and cannot cast!`);
            }
            if (result.killedInstantly) {
                this.logMsg(`${target.name} is slain!`);
            } else if (isUnconscious(target)) {
                this.logMsg(`${target.name} is knocked unconscious!`);
            }
        }

        if (ab.terrainEffect) {
            for (const key of affectedTiles) {
                const [ax, ay] = key.split(',').map(Number);
                applyTerrainEffect(this.map, ax, ay, ab.terrainEffect);
            }
            this.logMsg(`${source.name} reshapes the terrain!`);
        }

        this.selectedAbility = null;
        this.abilityRotation = 0;
        this.abilityRange = new Set();
        this.aoePreview = new Set();
        this.hitPreview = new Set();
        this.setState(STATES.PLAYER_TURN);
        this._checkVictory();
        return true;
    }

    // Check and fire any ready charges. Returns array of fired charges for animation.
    checkAndFireCharges() {
        const fired = [];
        for (const unit of this.livingUnits) {
            if (!unit._charging) continue;
            if (unit._charging.ct < unit._charging.needed) continue;

            const { ability, rotation, targetX, targetY } = unit._charging;
            const ab = ABILITIES[ability];
            unit.status = unit.status.filter(s => s !== 'charging');
            unit._charging = null;

            if (ab) {
                this.logMsg(`${unit.name}'s ${ab.name} fires!`);

                if (ab.isSummon) {
                    this._resolveSummon(unit, ab, targetX, targetY);
                    fired.push({ unit, targetX, targetY, ability });
                    continue;
                }

                let affectedTiles;
                if (ab.aoePattern) {
                    affectedTiles = computePatternArea(targetX, targetY, ab.aoePattern, rotation ?? 0);
                } else if (ab.aoe > 0) {
                    affectedTiles = computeAoeArea(targetX, targetY, ab.aoe);
                } else {
                    affectedTiles = new Set([`${targetX},${targetY}`]);
                }
                const targets = this.livingUnits.filter(u => {
                    const sameTeam = u.team === unit.team;
                    if (ab.targetType === 'ally' && !sameTeam) return false;
                    if (ab.targetType === 'enemy' && sameTeam) return false;
                    return affectedTiles.has(`${u.x},${u.y}`);
                });

                for (const target of targets) {
                    const result = resolveAbility(unit, target, ability, this.map);
                    if (result.missed) {
                        this.logMsg(`${unit.name} missed ${target.name}!`);
                        this._spawnFloat(target, 'Miss!', '#aaa');
                        continue;
                    }
                    if (result.damage > 0) {
                        this.logMsg(`${unit.name} hits ${target.name} for ${result.damage} dmg.`);
                        this._spawnFloat(target, `-${result.damage}`, '#f88');
                    }
                    if (result.healing > 0) {
                        this.logMsg(`${unit.name} heals ${target.name} for ${result.healing} HP.`);
                        this._spawnFloat(target, `+${result.healing}`, '#8f8');
                    }
                    if (result.revived) {
                        this.logMsg(`${target.name} is revived!`);
                    }
                    if (result.reraise) {
                        this.logMsg(`${target.name} is saved by Reraise!`);
                        this._spawnFloat(target, 'Reraise!', '#ffeeaa');
                    }
                    if (result.statusApplied) {
                        this.logMsg(`${target.name} is afflicted with ${result.statusApplied}!`);
                    }
                    if (result.killedInstantly) {
                        this.logMsg(`${target.name} is slain!`);
                    } else if (isUnconscious(target)) {
                        this.logMsg(`${target.name} is knocked unconscious!`);
                    }
                }

                if (ab.terrainEffect) {
                    for (const key of affectedTiles) {
                        const [ax, ay] = key.split(',').map(Number);
                        applyTerrainEffect(this.map, ax, ay, ab.terrainEffect);
                    }
                    this.logMsg(`${unit.name} reshapes the terrain!`);
                }
            }

            fired.push({ unit, targetX, targetY, ability });
        }

        if (fired.length > 0) this._checkVictory();
        return fired;
    }

    // Apply an ability directly for enemy AI, bypassing the player-input state guards.
    applyEnemyAbility(unit, abilityKey, tx, ty) {
        const ab = ABILITIES[abilityKey];
        if (!ab || ab.passive) return;

        unit.mp = Math.max(0, unit.mp - ab.mpCost);

        if (ab.chargeTime && ab.chargeTime > 0) {
            unit._charging = { ability: abilityKey, targetX: tx, targetY: ty, ct: 0, needed: ab.chargeTime };
            if (!unit.status.includes('charging')) unit.status.push('charging');
            this.logMsg(`${unit.name} begins channeling ${ab.name}!`);
            return;
        }

        if (ab.isSummon) {
            this._resolveSummon(unit, ab, tx, ty);
            return;
        }

        const affectedTiles = ab.aoe > 0 ? computeAoeArea(tx, ty, ab.aoe) : new Set([`${tx},${ty}`]);
        const targets = this.livingUnits.filter(u => {
            const sameTeam = u.team === unit.team;
            if (ab.targetType === 'ally' && !sameTeam) return false;
            if (ab.targetType === 'enemy' && sameTeam) return false;
            return affectedTiles.has(`${u.x},${u.y}`);
        });

        for (const target of targets) {
            const result = resolveAbility(unit, target, abilityKey, this.map);
            if (result.missed) {
                this.logMsg(`${unit.name} missed ${target.name}!`);
                this._spawnFloat(target, 'Miss!', '#aaa');
                continue;
            }
            if (result.damage > 0) {
                this.logMsg(`${unit.name} hits ${target.name} for ${result.damage} dmg.`);
                this._spawnFloat(target, `-${result.damage}`, '#f88');
            }
            if (result.healing > 0) {
                this.logMsg(`${unit.name} heals ${target.name} for ${result.healing} HP.`);
                this._spawnFloat(target, `+${result.healing}`, '#8f8');
            }
            if (result.revived) this.logMsg(`${target.name} is revived!`);
            if (result.killedInstantly) {
                this.logMsg(`${target.name} is slain!`);
            } else if (isUnconscious(target)) {
                this.logMsg(`${target.name} is knocked unconscious!`);
            }
        }

        this._checkVictory();
    }

    enterDefendMode() {
        if (this.state !== STATES.PLAYER_TURN) return false;
        if (!this.activeUnit.status.includes('defend')) {
            this.activeUnit.status.push('defend');
        }
        this.logMsg(`${this.activeUnit.name} takes a defensive stance.`);
        return true;
    }

    pivotUnit() {
        if (this.state !== STATES.PLAYER_TURN) return false;
        const order = ['north', 'east', 'south', 'west'];
        const idx = order.indexOf(this.activeUnit.facing);
        setFacing(this.activeUnit, order[(idx + 1) % 4]);
        this.logMsg(`${this.activeUnit.name} pivots to face ${this.activeUnit.facing}.`);
        return true;
    }

    endTurn(ctCost) {
        const cost = ctCost ?? 20;
        if (this.activeUnit) {
            // Only deduct whatever hasn't been pre-spent by commitMove/commitAbility.
            const remaining = Math.max(0, cost - this._ctPreSpent);
            this.activeUnit.ct -= remaining;
            if (this.activeUnit.ct < 0) this.activeUnit.ct = 0;

            // Passive MP drain
            for (const key of this.activeUnit.abilities) {
                const ab = ABILITIES[key];
                if (ab && ab.passive && ab.passiveMpCost > 0) {
                    this.activeUnit.mp = Math.max(0, this.activeUnit.mp - ab.passiveMpCost);
                }
            }
        }
        this.activeUnit = null;
        this._ctPreSpent = 0;
        this.moveRange = new Set();
        this.abilityRange = new Set();
        this.aoePreview = new Set();
        this.hitPreview = new Set();
        this.selectedAbility = null;
        this.abilityRotation = 0;
        if (this.state !== STATES.BATTLE_OVER) {
            this.setState(STATES.ADVANCE_CT);
        }
    }

    cancelAction() {
        if (this.state === STATES.SELECT_MOVE || this.state === STATES.SELECT_ABILITY || this.state === STATES.SELECT_ABILITY_TARGET) {
            this.selectedAbility = null;
            this.abilityRotation = 0;
            this.abilityRange = new Set();
            this.aoePreview = new Set();
            this.hitPreview = new Set();
            this.moveRange = computeMoveRange(this.activeUnit, this.map, this.livingUnits);
            this.setState(STATES.PLAYER_TURN);
        }
    }

    // Spawn a summoned creature on (tx, ty) for the given source unit's team.
    // Returns the new unit, or null if the tile was occupied or impassable.
    _resolveSummon(source, ab, tx, ty) {
        const occupied = this.units.some(u => !isDead(u) && u.x === tx && u.y === ty);
        const tile = getTile(this.map, tx, ty);
        if (occupied || !tile || !tile.passable) {
            this.logMsg(`${source.name}'s summon fizzles — no space!`);
            return null;
        }

        const summon = createUnit(ab.summonName, ab.summonJob, source.team, tx, ty, { ct: 0 });
        faceToward(summon, source.x, source.y);
        this.units.push(summon);
        this.logMsg(`${source.name} summons a ${ab.summonName}!`);

        // Player-team summons are tracked so battle-scene can add them to _autoUnits.
        if (source.team === 'player') this._pendingSummons.push(summon.id);
        return summon;
    }

    _checkVictory() {
        const playerConscious = this.livingUnits.some(u => u.team === 'player' && isConscious(u));
        const enemyConscious  = this.livingUnits.some(u => u.team === 'enemy' && isConscious(u));
        if (!enemyConscious) { this.winner = 'player'; this.setState(STATES.BATTLE_OVER); }
        else if (!playerConscious) { this.winner = 'enemy'; this.setState(STATES.BATTLE_OVER); }
    }

    // Simulate N turns ahead to show initiative queue (non-destructive)
    previewTurnOrder(n = 8) {
        const living = this.livingUnits;
        if (living.length === 0) return [];
        const sim = living.map(u => ({ unit: u, ct: u.ct }));
        const order = [];
        let iters = 0;
        while (order.length < n && iters < 2000) {
            iters++;
            for (const s of sim) s.ct += s.unit.spd;
            const ready = sim.filter(s => s.ct >= CT_ACT_THRESHOLD);
            if (ready.length > 0) {
                ready.sort((a, b) => b.ct - a.ct || b.unit.spd - a.unit.spd);
                for (const r of ready) {
                    if (order.length >= n) break;
                    order.push(r.unit);
                    r.ct -= CT_ACT_THRESHOLD;
                }
            }
        }
        return order;
    }

    _spawnFloat(unit, text, color) {
        unit._floats = unit._floats || [];
        unit._floats.push({ text, color, age: 0, maxAge: 1200 });
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
