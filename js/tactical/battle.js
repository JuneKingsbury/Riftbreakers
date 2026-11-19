import { activeSupports, computeMoveRange, computeMovePath, computeAttackRange, computeAoeArea, computePatternArea, resolveAbility, ABILITIES, supportOf, passivesOf, inflictStatus, cleanseStatuses, abilityAffects, abilityStrikes, isHelpful, summonCapped } from './abilities.js';
import { JOB_STATS } from './data-registry.js';
import { viewState } from './view-state.js';
import { isDead, isAlive, isConscious, isUnconscious, isStunned, faceToward, setFacing, createUnit } from './units.js';
import { getCell, applyTerrainEffect, settleZ, posKey, parseKey, cellKey, columnCells } from './battle-map.js';
import { moveEntity, moveEntityAlongPath } from '../systems/movement-lerp.js';
import { tryReaction, tryAllyReactions, tryDownReactions, tryChargeReactions } from './reactions.js';
import { BattleStats } from './battle-stats.js';
import { onUnitDown, checkHpTriggers } from './triggers.js';

// A boss whose Doom runs out loses this fraction of its max HP instead of falling.
export const DOOM_BOSS_FRAC = 0.25;

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
        settleZ(map, units);
        // Milliseconds a unit takes per tile when walking. The scene lowers this at higher
        // playback speeds so movement keeps pace with the rest of the battle.
        this.moveMsPerStep = 180;
        // Log which tactics rules each scripted unit followed (a setting, for script writers).
        this.logTactics = false;
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
        // Optional listener for what happens in the fight, for presentation (sound): called
        // as onEvent(type, data) with the types listed at _emit. Never affects the rules.
        this.onEvent = null;
        this._animEnd = 0;
        this._pendingEnemy = null;
        this.onLogMessage = null;
        this.onStateChange = null;
        this._ctPreSpent = 0;
        // IDs of player-team summons that should be auto-controlled by the AI.
        this._pendingSummons = [];
        // For the run score (partyResult): the party members who started the fight (summons
        // join later and don't count) and how many turns they have taken.
        this._partyIds = new Set(units.filter(u => u.team === 'player' && u.summonerId == null).map(u => u.id));
        this.partyTurns = 0;
        // What each unit did, for the breakdown on the result screen (battle-stats.js).
        this.stats = new BattleStats();
        this.stats.track(units);
    }

    _unitById(id) {
        return id == null ? null : this.units.find(u => u.id === id) ?? null;
    }

    // Records one resolved ability in the stats from the HP each side actually lost or
    // gained (resolveAbility's targetHpChange and sourceHpChange).
    _recordResult(source, target, abKey, result) {
        const inert = u => !!JOB_STATS[u.job]?.inert;
        const dt = result.targetHpChange ?? 0, ds = result.sourceHpChange ?? 0;
        if (dt < 0) {
            this.stats.damage(source, target, -dt, abKey);
            if (target.hp === 0) this.stats.knockout(source, target, abKey, { inert: inert(target) });
        } else if (dt > 0) this.stats.heal(source, target, dt, abKey);
        // A reflected spell hurts its caster (credited to the reflector); a drain heals it.
        if (ds < 0) {
            this.stats.damage(target, source, -ds, abKey);
            if (source.hp === 0) this.stats.knockout(target, source, abKey, { inert: inert(source) });
        } else if (ds > 0) this.stats.heal(source, source, ds, abKey);
    }

    /**
     * How the party did, for the run score: { partySize, survivors, rounds }. Survivors are the
     * starting members still conscious; rounds are the party's turns per member, rounded up.
     */
    partyResult() {
        const members = this.units.filter(u => this._partyIds.has(u.id));
        const partySize = members.length;
        return {
            partySize,
            survivors: members.filter(u => isConscious(u)).length,
            rounds: partySize ? Math.max(1, Math.ceil(this.partyTurns / partySize)) : 0,
        };
    }

    // Charge time after the caster's support (Swiftcast halves it).
    _chargeTime(unit, ab) {
        return Math.round(ab.chargeTime * (supportOf(unit)?.chargeMult ?? 1));
    }

    _adjacent(unit, filter) {
        return this.livingUnits.filter(u => u !== unit && isConscious(u) && filter(u)
            && Math.abs(u.x - unit.x) + Math.abs(u.y - unit.y) === 1);
    }

    // Called after any unit finishes a move (player, script or enemy AI) with the
    // path it walked. Applies the after-move effects of every Movement passive it has
    // (its chosen one and any from equipment).
    afterMove(unit, path) {
        const tiles = path?.length ?? 0;
        if (tiles === 0) return;
        unit._movedThisTurn = true;
        for (const key of passivesOf(unit, 'movement')) this._movementEffects(unit, key, tiles);
    }

    _movementEffects(unit, key, tiles) {
        const mv = ABILITIES[key];
        if (mv.momentumPct) unit._momentumMult = Math.max(unit._momentumMult ?? 1, 1 + Math.min(5, tiles) * mv.momentumPct);
        const fx = mv.onMove;
        if (!fx) return;
        const heal = (u, pct) => {
            const amt = Math.min(u.maxHp - u.hp, Math.max(1, Math.round(u.maxHp * pct)));
            if (amt <= 0) return;
            u.hp += amt;
            this.stats.heal(u, u, amt, key);
            this._spawnFloat(u, `+${amt}`, '#8f8');
        };
        if (fx.hpPct) heal(unit, fx.hpPct);
        if (fx.mpPct) {
            const amt = Math.min(unit.maxMp - unit.mp, Math.max(1, Math.round(unit.maxMp * fx.mpPct)));
            if (amt > 0) { unit.mp += amt; this._spawnFloat(unit, `+${amt} MP`, '#88aaff'); }
        }
        if (fx.cleanse && cleanseStatuses(unit).length) this.logMsg(`${unit.name} walks off their afflictions.`);
        if (fx.selfBuff) {
            unit.buffs = unit.buffs || [];
            unit.buffs.push({ key, ...fx.selfBuff });
        }
        const allies = [unit, ...this._adjacent(unit, u => u.team === unit.team)];
        if (fx.alliesHealPct) for (const a of allies) heal(a, fx.alliesHealPct);
        if (fx.alliesBuff) {
            for (const a of allies) {
                a.buffs = a.buffs || [];
                a.buffs.push({ key, ...fx.alliesBuff });
            }
        }
        const foes = this._adjacent(unit, u => u.team !== unit.team);
        if (fx.enemiesStatus) {
            for (const f of foes) {
                if (inflictStatus(f, fx.enemiesStatus.status, fx.enemiesStatus.duration, unit)) {
                    this.logMsg(`${f.name} is afflicted with ${fx.enemiesStatus.status}!`);
                }
            }
        }
        if (fx.enemiesCt) {
            for (const f of foes) {
                f.ct = Math.max(0, f.ct + fx.enemiesCt);
                this._spawnFloat(f, `${fx.enemiesCt} CT`, '#cc88cc');
            }
        }
        if (foes.length || fx.alliesHealPct || fx.alliesBuff) this.logMsg(`${unit.name}'s ${mv.name} takes effect.`);
    }

    // Log and float one resolved hit, then give the target a chance to react.
    // Event types, each with the ability key that caused it: hit { source, target, damage },
    // miss { source, target }, heal and revive { source, target, amount },
    // buff { source, target }, status { source, target, status }; summon { source, unit };
    // and area { source, cells: ["x,y,z"], center } when an area ability resolves.
    _emit(type, data) {
        if (!this.onEvent) return;
        try { this.onEvent(type, data); } catch { /* a listener must not break the fight */ }
    }

    _applyResult(source, target, abKey, result, { isReaction = false } = {}) {
        this._recordResult(source, target, abKey, result);
        if (result.silenced) {
            this.logMsg(`${source.name} is silenced and cannot cast!`);
            return;
        }
        if (result.missed) {
            this._emit('miss', { source, target, ability: abKey });
            this.logMsg(`${source.name} misses ${target.name}.`);
            this._spawnFloat(target, 'Miss!', '#aaa');
            return;
        }
        if (result.damage > 0) {
            this._emit('hit', { source, target, damage: result.damage, ability: abKey, crit: !!result.crit });
            const highGround = (source.z ?? 0) > (target.z ?? 0);
            const suffix = highGround ? ' from the high ground' : '';
            if (result.crit) {
                this.logMsg(`${source.name} lands a critical hit on ${target.name} for ${result.damage} damage${suffix}!`);
                this._spawnFloat(target, `Critical! -${result.damage}`, '#ffd24a');
            } else {
                this.logMsg(`${source.name} hits ${target.name} for ${result.damage} damage${suffix}.`);
                this._spawnFloat(target, `-${result.damage}`, '#f88');
            }
        }
        if (result.healing > 0) {
            this._emit(result.revived ? 'revive' : 'heal', { source, target, amount: result.healing, ability: abKey });
            this.logMsg(`${source.name} heals ${target.name} for ${result.healing} HP.`);
            this._spawnFloat(target, `+${result.healing}`, '#8f8');
        }
        if (result.floatingText) this._spawnFloat(target, result.floatingText, '#ccf');
        const ab = ABILITIES[abKey];
        if (ab?.buffs?.every(b => b.value > 0) && !result.damage && !result.healing && !result.statusApplied) {
            this._emit('buff', { source, target, ability: abKey });
        }
        if (result.drained > 0) {
            this.logMsg(`${source.name} drains ${result.drained} HP.`);
            this._spawnFloat(source, `+${result.drained}`, '#8f8');
        }
        if (result.revived) {
            this.logMsg(`${target.name} is revived!`);
        }
        if (result.providence) {
            this.logMsg(`${target.name} refuses this fate and survives at 1 HP!`);
            this._spawnFloat(target, 'Providence!', '#ffeeaa');
        }
        if (result.reraise) {
            this.logMsg(`${target.name} is saved by Reraise!`);
            this._spawnFloat(target, 'Reraise!', '#ffeeaa');
        }
        if (result.statusApplied) {
            this._emit('status', { source, target, status: result.statusApplied, ability: abKey });
            this.logMsg(`${target.name} is afflicted with ${result.statusApplied}!`);
        }
        if (result.killedInstantly) {
            this.logMsg(`${target.name} is slain!`);
        } else if (isUnconscious(target)) {
            this.logMsg(`${target.name} is knocked unconscious!`);
        }
        if (result.damage > 0 && target.hp === 0) this._onDown(target, source);
        // Relic (and boss) triggers on falling below an HP threshold (triggers.js).
        if ((result.targetHpChange ?? 0) < 0) checkHpTriggers(this, target);
        if ((result.sourceHpChange ?? 0) < 0) checkHpTriggers(this, source);
        if (!isReaction) {
            tryReaction(this, target, source, abKey, result);
            tryAllyReactions(this, target, source, abKey, result);
        }
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
        if (this._partyIds.has(unit.id)) this.partyTurns += 1;
        unit._movedThisTurn = false;
        unit._momentumMult = null;

        // Every unit with an MP pool recovers a little at the start of each of its turns
        // (stunned or not), so casters aren't cut off for the rest of a long fight: 3 MP, plus
        // any MP regen from gear (unit.mpRegen, see units.js).
        const regen = unit.mpRegen ?? 0;
        if (regen > 0 && unit.maxMp > 0 && unit.hp > 0 && unit.mp < unit.maxMp) unit.mp = Math.min(unit.maxMp, unit.mp + regen);

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
                // doom runs out on a boss: it takes a heavy blow instead of falling outright
                if (s === 'doom' && unit.hp > 0 && unit.isBoss) {
                    const doomer = this._unitById(unit._statusBy?.doom);
                    const amt = Math.min(unit.hp, Math.max(1, Math.round(unit.maxHp * DOOM_BOSS_FRAC)));
                    unit.hp -= amt;
                    this.stats.damage(doomer, unit, amt, 'status:doom');
                    this.logMsg(`${unit.name}'s doom comes to pass, but they endure it! (${amt} damage)`);
                    this._spawnFloat(unit, `Doom -${amt}`, '#c06');
                    if (unit.hp <= 0) {
                        this.stats.knockout(doomer, unit, 'status:doom', { inert: false });
                        if (!unit.status.includes('unconscious')) unit.status.push('unconscious');
                        unit.deathTimer = 3;
                        this._onDown(unit, null);
                        this._checkVictory();
                    }
                // doom runs out: the unit falls
                } else if (s === 'doom' && unit.hp > 0) {
                    const doomer = this._unitById(unit._statusBy?.doom);
                    this.stats.damage(doomer, unit, unit.hp, 'status:doom');
                    this.stats.knockout(doomer, unit, 'status:doom', { inert: !!JOB_STATS[unit.job]?.inert });
                    unit.hp = 0;
                    if (!unit.status.includes('unconscious')) unit.status.push('unconscious');
                    unit.deathTimer = 3;
                    this.logMsg(`${unit.name}'s doom comes to pass!`);
                    this._spawnFloat(unit, 'Doom', '#c06');
                    this._onDown(unit, null);
                    this._checkVictory();
                }
            }
        }
        unit.statusTimers = timers;

        // Support start-of-turn healing (Regen Aura)
        const regenHp = supportOf(unit)?.turnRegenHp;
        if (regenHp && unit.hp > 0) {
            const before = unit.hp;
            unit.hp = Math.min(unit.maxHp, unit.hp + regenHp);
            this.stats.heal(unit, unit, unit.hp - before, activeSupports(unit).find(k => ABILITIES[k]?.turnRegenHp) ?? null);
            this.logMsg(`${unit.name} regenerates ${regenHp} HP from ${supportOf(unit).name}.`);
        }

        // regen status: heal ~8% max HP
        if (unit.status.includes('regen')) {
            const amt = Math.max(1, Math.round(unit.maxHp * 0.08));
            const before = unit.hp;
            unit.hp = Math.min(unit.maxHp, unit.hp + amt);
            // Credited to whoever cast it; Regen from a relic is the unit's own.
            this.stats.heal(this._unitById(unit._statusBy?.regen) ?? unit, unit, unit.hp - before, 'status:regen');
            this.logMsg(`${unit.name} regenerates ${amt} HP.`);
        }

        // poison: deal ~6% max HP each turn
        if (unit.status.includes('poison')) {
            const dmg = Math.max(1, Math.round(unit.maxHp * 0.06));
            const before = unit.hp;
            unit.hp = Math.max(0, unit.hp - dmg);
            const poisoner = this._unitById(unit._statusBy?.poison);
            this.stats.damage(poisoner, unit, before - unit.hp, 'status:poison');
            if (unit.hp === 0) this.stats.knockout(poisoner, unit, 'status:poison', { inert: !!JOB_STATS[unit.job]?.inert });
            this.logMsg(`${unit.name} takes ${dmg} poison damage!`);
            this._spawnFloat(unit, `-${dmg}`, '#88ff44');
            checkHpTriggers(this, unit);
            if (unit.hp <= 0) {
                if (!unit.status.includes('unconscious')) unit.status.push('unconscious');
                unit.deathTimer = 3;
                this._onDown(unit, null);
            }
        }

        // Decrement timed buffs, remove expired
        unit.buffs = (unit.buffs || []).filter(b => {
            if (b.duration === null) return true;
            return --b.duration > 0;
        });

        // Iron Discipline (and Commanding): the unit and adjacent allies brace for the coming
        // turn. Given after the unit's own buffs count down, or its share would expire at once,
        // and refreshed rather than stacked, since it comes again every turn.
        const turnBuffs = isConscious(unit) ? supportOf(unit)?.turnAlliesBuff : null;
        if (turnBuffs) {
            for (const a of [unit, ...this._adjacent(unit, u => u.team === unit.team && isConscious(u))]) {
                a.buffs = (a.buffs || []).filter(b => b.key !== 'iron_discipline');
                for (const b of turnBuffs) a.buffs.push({ key: 'iron_discipline', ...b });
            }
        }

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
                this.applyEnemyAbility(unit, 'attack', tgt.x, tgt.y, tgt.z);
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
        if (ab.mpCost > this.activeUnit.mp || summonCapped(this.activeUnit, abilityKey)) return;
        this.selectedAbility = abilityKey;
        this.abilityRotation = 0;
        this._lastHoverTile = null;
        if (ab.range === 0 && ab.targetType === 'self') {
            this.abilityRange = new Set([posKey(this.activeUnit)]);
        } else {
            const fromTile = new Set([posKey(this.activeUnit)]);
            const requiresLos = ab.requiresLos !== false;
            this.abilityRange = computeAttackRange(fromTile, ab.range, false, requiresLos, this.map);
        }
        this.aoePreview = new Set();
        this.hitPreview = new Set();
        this.setState(STATES.SELECT_ABILITY_TARGET);
    }

    // Which level of column (tx, ty) a click or hover means: tz when given, else the level
    // in `keys` (a range set) nearest the active unit, else the column's standing cell.
    _resolveZ(keys, tx, ty, tz) {
        if (tz !== null && tz !== undefined) return tz;
        const near = this.activeUnit?.z ?? 0;
        let best = null;
        for (const key of keys) {
            const p = parseKey(key);
            if (p.x !== tx || p.y !== ty) continue;
            if (best === null || Math.abs(p.z - near) < Math.abs(best - near)) best = p.z;
        }
        return best ?? getCell(this.map, tx, ty)?.z ?? 0;
    }

    // Cells an ability centred on (tx, ty, tz) touches.
    _affectedCells(ab, tx, ty, tz, rotation) {
        const center = { x: tx, y: ty, z: tz };
        if (ab.aoePattern) return computePatternArea(this.map, center, ab.aoePattern, rotation ?? 0);
        if (ab.aoe > 0) return computeAoeArea(this.map, center, ab.aoe);
        return new Set([posKey(center)]);
    }

    // Reshape the terrain of affected cells. Cells with someone standing on them are left
    // alone so nobody ends up inside a raised block.
    _applyTerrain(ab, affectedTiles) {
        const occupied = new Set(this.units.filter(u => !isDead(u)).map(posKey));
        for (const key of affectedTiles) {
            if (ab.terrainEffect.raise && occupied.has(key)) continue;
            const p = parseKey(key);
            applyTerrainEffect(this.map, getCell(this.map, p.x, p.y, p.z), ab.terrainEffect);
        }
    }

    // Update AoE preview when hovering a target tile
    hoverAbilityTarget(tx, ty, tz = null) {
        if (this.state !== STATES.SELECT_ABILITY_TARGET) return;
        const ab = ABILITIES[this.selectedAbility];
        tz = this._resolveZ(this.abilityRange, tx, ty, tz);
        this._lastHoverTile = { x: tx, y: ty, z: tz };
        this.aoePreview = ab ? this._affectedCells(ab, tx, ty, tz, this.abilityRotation) : new Set([cellKey(tx, ty, tz)]);

        // Tile-targeting abilities don't highlight character hits.
        if (ab?.targetType === 'tile') { this.hitPreview = new Set(); return; }

        // Compute which tiles in the preview contain a valid hittable target.
        const source = this.activeUnit;
        this.hitPreview = new Set();
        for (const key of this.aoePreview) {
            const hit = ab.targetType === 'corpse'
                ? this._bodiesIn(source, new Set([key])).length > 0
                : this.livingUnits.some(u => posKey(u) === key && abilityStrikes(source, ab, u));
            if (hit) this.hitPreview.add(key);
        }
    }

    rotateAbility() {
        if (this.state !== STATES.SELECT_ABILITY_TARGET) return;
        const ab = ABILITIES[this.selectedAbility];
        if (!ab?.aoePattern) return;
        this.abilityRotation = (this.abilityRotation + 1) % 4;
        if (this._lastHoverTile) {
            this.hoverAbilityTarget(this._lastHoverTile.x, this._lastHoverTile.y, this._lastHoverTile.z);
        }
    }

    // Player commits a move
    commitMove(tx, ty, tz = null) {
        if (this.state !== STATES.SELECT_MOVE) return false;
        tz = this._resolveZ(this.moveRange, tx, ty, tz);
        const key = cellKey(tx, ty, tz);
        if (!this.moveRange.has(key)) return false;
        const unit = this.activeUnit;
        const path = computeMovePath(unit, this.map, this.livingUnits, tx, ty, tz);
        faceToward(unit, tx, ty);
        if (path && path.length > 0) {
            moveEntityAlongPath(unit, path, this.moveMsPerStep);
        } else {
            moveEntity(unit, tx, ty, this.moveMsPerStep, tz);
        }
        this.logMsg(`${unit.name} moves to (${tx}, ${ty}).`);
        this.afterMove(unit, path);
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
    commitAbility(tx, ty, tz = null) {
        if (this.state !== STATES.SELECT_ABILITY_TARGET) return false;
        const ab = ABILITIES[this.selectedAbility];
        if (!ab) return false;
        tz = this._resolveZ(this.abilityRange, tx, ty, tz);
        if (!this.abilityRange.has(cellKey(tx, ty, tz))) return false;

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
                targetZ: tz,
                targetId: this._chargeTargetId(source, ab, tx, ty, tz),
                ct: 0,
                needed: this._chargeTime(source, ab),
            };
            if (!source.status.includes('charging')) source.status.push('charging');
            this.logMsg(`${source.name} begins channeling ${ab.name}!`);
            this._revealOnAct(source);
            tryChargeReactions(this, source);
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
        this._revealOnAct(source);

        // Summon abilities: place a new creature on the target tile.
        if (ab.isSummon) {
            this._resolveSummon(source, ab, tx, ty, tz);
            this.selectedAbility = null;
            this.abilityRotation = 0;
            this.abilityRange = new Set();
            this.aoePreview = new Set();
            this.hitPreview = new Set();
            this.setState(STATES.PLAYER_TURN);
            return true;
        }

        if (ab.targetType === 'corpse') {
            this._resolveCorpse(source, this.selectedAbility, tx, ty, tz);
            this.selectedAbility = null;
            this.abilityRotation = 0;
            this.abilityRange = new Set();
            this.aoePreview = new Set();
            this.hitPreview = new Set();
            this.setState(STATES.PLAYER_TURN);
            this._checkVictory();
            return true;
        }

        const affectedTiles = this._affectedCells(ab, tx, ty, tz, this.abilityRotation);
        const targets = this._targetsIn(source, ab, affectedTiles);
        this._emitArea(source, this.selectedAbility, affectedTiles, { x: tx, y: ty, z: tz });

        if (targets.length === 0 && !ab.isHeal && !ab.isCure && ab.targetType !== 'tile') {
            this.logMsg(`${source.name}'s ${ab.name} hits nothing.`);
        }

        this.stats.use(source, this.selectedAbility);
        for (const target of targets) {
            const result = resolveAbility(source, target, this.selectedAbility, this.map);
            this._applyResult(source, target, this.selectedAbility, result);
        }

        if (ab.terrainEffect) {
            this._applyTerrain(ab, affectedTiles);
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

            const charge = unit._charging;
            const { ability, rotation } = charge;
            const ab = ABILITIES[ability];
            // Where it goes off (see _aimCharge); the view animates toward it.
            let targetX = charge.targetX, targetY = charge.targetY;
            unit.status = unit.status.filter(s => s !== 'charging');
            unit._charging = null;

            if (ab) {
                const aimedZ = charge.targetZ ?? getCell(this.map, charge.targetX, charge.targetY)?.z ?? 0;
                const aim = this._aimCharge(unit, ab, { ...charge, targetZ: aimedZ });
                if (!aim) {
                    // No foe left in reach: the spell fizzles and its MP comes back.
                    unit.mp = Math.min(unit.maxMp, unit.mp + (ab.mpCost || 0));
                    this.logMsg(`${unit.name}'s ${ab.name} fizzles with no target in reach.`);
                    this._spawnFloat(unit, 'Fizzle', '#aaa');
                    continue;
                }
                const targetZ = aim.z;
                targetX = aim.x;
                targetY = aim.y;
                if (targetX !== charge.targetX || targetY !== charge.targetY) {
                    faceToward(unit, targetX, targetY);
                    const now = this.livingUnits.find(u => posKey(u) === cellKey(targetX, targetY, targetZ));
                    if (now && now.id !== charge.targetId) this.logMsg(`${unit.name} turns ${ab.name} on ${now.name}!`);
                }
                this.logMsg(`${unit.name}'s ${ab.name} fires!`);

                if (ab.isSummon) {
                    this._resolveSummon(unit, ab, targetX, targetY, targetZ);
                    fired.push({ unit, targetX, targetY, ability });
                    continue;
                }

                if (ab.targetType === 'corpse') {
                    this._resolveCorpse(unit, ability, targetX, targetY, targetZ);
                    fired.push({ unit, targetX, targetY, ability });
                    continue;
                }
                const affectedTiles = this._affectedCells(ab, targetX, targetY, targetZ, rotation);
                const targets = this._targetsIn(unit, ab, affectedTiles);
                this._emitArea(unit, ability, affectedTiles, { x: targetX, y: targetY, z: targetZ });

                this.stats.use(unit, ability);
                for (const target of targets) {
                    const result = resolveAbility(unit, target, ability, this.map);
                    this._applyResult(unit, target, ability, result);
                }

                if (ab.terrainEffect) {
                    this._applyTerrain(ab, affectedTiles);
                    this.logMsg(`${unit.name} reshapes the terrain!`);
                }
            }

            fired.push({ unit, targetX, targetY, ability });
        }

        if (fired.length > 0) this._checkVictory();
        return fired;
    }

    // Apply an ability directly for enemy AI, bypassing the player-input state guards.
    // tz is the target's level; left out, the column's standing cell.
    applyEnemyAbility(unit, abilityKey, tx, ty, tz = null) {
        const ab = ABILITIES[abilityKey];
        if (!ab || ab.passive) return;
        if (tz === null || tz === undefined) tz = getCell(this.map, tx, ty)?.z ?? 0;

        unit.mp = Math.max(0, unit.mp - ab.mpCost);

        if (ab.chargeTime && ab.chargeTime > 0) {
            unit._charging = { ability: abilityKey, targetX: tx, targetY: ty, targetZ: tz, ct: 0, needed: this._chargeTime(unit, ab),
                targetId: this._chargeTargetId(unit, ab, tx, ty, tz) };
            if (!unit.status.includes('charging')) unit.status.push('charging');
            this.logMsg(`${unit.name} begins channeling ${ab.name}!`);
            this._revealOnAct(unit);
            tryChargeReactions(this, unit);
            return;
        }
        this._revealOnAct(unit);

        if (ab.isSummon) {
            this._resolveSummon(unit, ab, tx, ty, tz);
            return;
        }

        if (ab.targetType === 'corpse') {
            this._resolveCorpse(unit, abilityKey, tx, ty, tz);
            this._checkVictory();
            return;
        }
        const affectedTiles = ab.aoe > 0 ? computeAoeArea(this.map, { x: tx, y: ty, z: tz }, ab.aoe) : new Set([cellKey(tx, ty, tz)]);
        const targets = this._targetsIn(unit, ab, affectedTiles);
        this._emitArea(unit, abilityKey, affectedTiles, { x: tx, y: ty, z: tz });

        this.stats.use(unit, abilityKey);
        for (const target of targets) {
            const result = resolveAbility(unit, target, abilityKey, this.map);
            this._applyResult(unit, target, abilityKey, result);
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

            // Support upkeep: each active support with an MP cost drains it
            const upkeep = supportOf(this.activeUnit)?.passiveMpCost ?? 0;
            if (upkeep > 0) this.activeUnit.mp = Math.max(0, this.activeUnit.mp - upkeep);

            // Take Root: heal at the end of a turn spent standing still
            const rooted = Math.max(0, ...passivesOf(this.activeUnit, 'movement').map(k => ABILITIES[k].rootedHealPct ?? 0));
            const u = this.activeUnit;
            if (rooted && !u._movedThisTurn && isConscious(u) && u.hp < u.maxHp) {
                const amt = Math.min(u.maxHp - u.hp, Math.max(1, Math.round(u.maxHp * rooted)));
                u.hp += amt;
                this.stats.heal(u, u, amt, passivesOf(u, 'movement').find(k => ABILITIES[k].rootedHealPct) ?? null);
                this.logMsg(`${u.name} draws ${amt} HP from the soil.`);
                this._spawnFloat(u, `+${amt}`, '#8f8');
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

    // Spawn a summoned creature on (tx, ty, tz) for the given source unit's team.
    // Returns the new unit, or null if the tile was occupied or impassable.
    _resolveSummon(source, ab, tx, ty, tz = null) {
        const tile = getCell(this.map, tx, ty, tz);
        const occupied = tile && this.units.some(u => !isDead(u) && posKey(u) === posKey(tile));
        if (occupied || !tile || !tile.passable) {
            this.logMsg(`${source.name}'s summon fizzles. There's no room for it!`);
            return null;
        }

        const summon = createUnit(ab.summonName, ab.summonJob, source.team, tx, ty, { ct: 0, z: tile.z });
        summon.summonerId = source.id;
        // For summonLimit (see summonCapped): the summoner's creatures, by kind.
        source.summoned = source.summoned || {};
        source.summoned[ab.summonJob] = [...(source.summoned[ab.summonJob] ?? []), summon];
        // summonScale: a summoned creature weaker (or stronger) than one of its kind met in the
        // wild, e.g. Call Wolf's wolf against the Pack Wolves enemies field.
        if (ab.summonScale != null) {
            for (const k of ['maxHp', 'atk', 'mat']) summon[k] = Math.max(1, Math.round(summon[k] * ab.summonScale));
            summon.hp = summon.maxHp;
        }
        // summonMods: flat stat changes for the summoned creature (e.g. a slower wolf).
        for (const [k, v] of Object.entries(ab.summonMods ?? {})) if (typeof summon[k] === 'number') summon[k] = Math.max(k === 'move' || k === 'spd' ? 1 : 0, summon[k] + v);
        if (ab.summonMods?.maxHp) summon.hp = summon.maxHp;
        // summonLure: how much enemies want to attack it (negative: less than its stats suggest).
        if (ab.summonLure != null) summon.lure = ab.summonLure;
        // Spirit Pact: the summoner's support strengthens the creature.
        const boost = supportOf(source)?.summonBoost;
        if (boost) {
            for (const k of ['maxHp', 'atk', 'mat']) summon[k] = Math.round(summon[k] * (1 + boost));
            summon.hp = summon.maxHp;
        }
        faceToward(summon, source.x, source.y);
        this.units.push(summon);
        this.stats.track([summon]);
        this.logMsg(`${source.name} summons a ${ab.summonName}!`);
        this._emit('summon', { source, unit: summon });

        // Player-team summons are tracked so battle-scene can add them to _autoUnits.
        if (source.team === 'player') this._pendingSummons.push(summon.id);
        // Hall of Mirrors: more than one at a time, on free cells next to the first.
        for (let i = 1; i < (ab.summonCount ?? 1); i++) {
            const free = this._freeCellsAround(summon, 1)[0];
            if (free) this._resolveSummon(source, { ...ab, summonCount: 1 }, free.x, free.y, free.z);
        }
        return summon;
    }

    // Standing cells within `radius` of a unit that nobody occupies, nearest first.
    _freeCellsAround(around, radius) {
        const taken = new Set(this.units.filter(u => !isDead(u)).map(posKey));
        const out = [];
        for (let dx = -radius; dx <= radius; dx++) {
            for (let dy = -radius; dy <= radius; dy++) {
                const d = Math.abs(dx) + Math.abs(dy);
                if (d === 0 || d > radius) continue;
                for (const c of columnCells(this.map, around.x + dx, around.y + dy)) {
                    if (c.passable && !taken.has(posKey(c)) && Math.abs(c.z - (around.z ?? 0)) <= 1) out.push({ ...c, d });
                }
            }
        }
        return out.sort((a, b) => a.d - b.d);
    }

    // Tells the presentation which cells an area ability covered, so it can play out on each
    // ("x,y,z" keys, and the center it was aimed at). Single-target abilities send nothing.
    _emitArea(source, key, cells, center) {
        const ab = ABILITIES[key];
        if (!ab || !(ab.aoe > 0 || ab.aoePattern) || !cells?.size) return;
        this._emit('area', { source, ability: key, cells: [...cells], center: { x: center.x, y: center.y, z: center.z ?? 0 } });
    }

    // ---- Targets ---------------------------------------------------------------------

    // The units an ability touches inside its affected cells (see abilityStrikes).
    _targetsIn(source, ab, affectedTiles) {
        return this.livingUnits.filter(u => affectedTiles.has(posKey(u)) && abilityStrikes(source, ab, u));
    }

    // The unit a charge is aimed at: whoever it would land on at the target cell, standing
    // units first. Null when aimed at an empty cell (an area spell placed between foes).
    _chargeTargetId(source, ab, tx, ty, tz) {
        const key = cellKey(tx, ty, tz);
        const here = this.livingUnits.filter(u => posKey(u) === key && abilityAffects(source, ab, u));
        return (here.find(u => isConscious(u)) ?? here[0])?.id ?? null;
    }

    /**
     * Where a charged ability goes off, decided when it fires rather than when it began.
     * It follows the unit it was aimed at, if that unit can still be struck and is in range.
     * A harmful one that has lost its target keeps its cell if a standing foe is there,
     * and otherwise turns to the standing foe in range nearest that cell. Returns the cell
     * {x, y, z}, or null when a harmful ability has no foe in range at all (it fizzles).
     * Helpful ones, and ones aimed at the ground or the caster, keep their cell.
     */
    _aimCharge(unit, ab, charge) {
        const cell = { x: charge.targetX, y: charge.targetY, z: charge.targetZ };
        if (ab.isSummon || ab.targetType === 'corpse' || ab.targetType === 'tile' || ab.targetType === 'self' || ab.terrainEffect) return cell;
        const reach = computeAttackRange(new Set([posKey(unit)]), ab.range, false, ab.requiresLos !== false, this.map);
        const canStrike = u => abilityStrikes(unit, ab, u) && reach.has(posKey(u));
        const at = u => ({ x: u.x, y: u.y, z: u.z ?? 0 });

        const target = this._unitById(charge.targetId);
        if (target && !isDead(target) && canStrike(target)) return at(target);
        if (isHelpful(ab)) return cell;

        const foe = u => u.team !== unit.team && isConscious(u);
        const area = this._affectedCells(ab, cell.x, cell.y, cell.z, charge.rotation);
        if (this._targetsIn(unit, ab, area).some(foe)) return cell;
        const dist = u => Math.abs(u.x - cell.x) + Math.abs(u.y - cell.y);
        const next = this.livingUnits.filter(u => foe(u) && canStrike(u))
            .sort((a, b) => dist(a) - dist(b) || a.hp - b.hp || a.id - b.id)[0];
        return next ? at(next) : null;
    }

    // Knocked-out enemies of `source` lying in the given cells: the bodies corpse abilities use.
    _bodiesIn(source, cells) {
        return this.units.filter(u => u.team !== source.team && isUnconscious(u) && cells.has(posKey(u)));
    }

    // A body is used up: the knocked-out unit is gone for good.
    _consumeBody(body) {
        body.status = body.status.filter(s => s !== 'unconscious');
        if (!body.status.includes('dead')) body.status.push('dead');
        body._consumed = true;
    }

    /**
     * Corpse abilities (the Gravecaller line) act through knocked-out enemies at the target:
     *   raise  up to corpseCount bodies rise as summons (summonJob) for the caster
     *   burst  one body explodes, hitting the caster's enemies around it
     *   ward   one body becomes a barricade: the caster's allies around it gain applyStatus
     * The bodies are used up. With no body there, the ability fizzles.
     */
    _resolveCorpse(source, key, tx, ty, tz) {
        const ab = ABILITIES[key];
        this.stats.use(source, key);
        const center = { x: tx, y: ty, z: tz ?? 0 };
        const area = ab.aoe > 0 ? computeAoeArea(this.map, center, ab.aoe) : new Set([cellKey(tx, ty, center.z)]);
        // The body on the target cell goes first.
        const bodies = this._bodiesIn(source, area).sort((a, b) => (posKey(a) === cellKey(tx, ty, center.z) ? -1 : 0) - (posKey(b) === cellKey(tx, ty, center.z) ? -1 : 0));
        if (bodies.length === 0) {
            this.logMsg(`${source.name}'s ${ab.name} finds no fallen body and fizzles.`);
            return;
        }
        if (ab.corpseEffect === 'raise') {
            for (const body of bodies.slice(0, ab.corpseCount ?? 1)) {
                this._consumeBody(body);
                this.logMsg(`${body.name} rises again for ${source.name}!`);
                this._resolveSummon(source, ab, body.x, body.y, body.z);
            }
            return;
        }
        const body = bodies[0];
        this._consumeBody(body);
        const around = computeAoeArea(this.map, body, Math.max(1, ab.aoe));
        this._emitArea(source, key, around, body);
        if (ab.corpseEffect === 'burst') {
            this.logMsg(`${body.name}'s body bursts!`);
            for (const target of this.livingUnits.filter(u => u.team !== source.team && isConscious(u) && around.has(posKey(u)))) {
                this._applyResult(source, target, key, resolveAbility(source, target, key, this.map));
            }
        } else if (ab.corpseEffect === 'ward') {
            this.logMsg(`${source.name} raises a ward of bone from ${body.name}.`);
            for (const ally of this.livingUnits.filter(u => u.team === source.team && isConscious(u) && around.has(posKey(u)))) {
                if (ab.applyStatus && inflictStatus(ally, ab.applyStatus, ab.statusDuration ?? 2, source)) {
                    this._emit('status', { source, target: ally, status: ab.applyStatus, ability: key });
                }
            }
        }
    }

    // A hidden unit (Vanish) shows itself the moment it acts.
    _revealOnAct(unit) {
        if (!unit.status.includes('hidden')) return;
        unit.status = unit.status.filter(s => s !== 'hidden');
        delete (unit.statusTimers || {}).hidden;
        this.logMsg(`${unit.name} steps out of hiding.`);
    }

    /**
     * Called whenever a unit drops to 0 HP, from any cause (`source` may be null, e.g. poison).
     * Its own knockout reactions (Lingering Spite, Phylactery) and everyone's fall effects
     * (Soul Harvest, Shattered Image) happen here.
     */
    _onDown(unit, source = null) {
        // Relic (and boss) triggers on someone going down (triggers.js), while it's still a
        // knockout: before a copy shatters or a Phylactery brings it back.
        if (isUnconscious(unit)) onUnitDown(this, unit, source);
        // A copy (Mirror Image) shatters: there is no body to revive or raise.
        if (JOB_STATS[unit.job]?.inert && !isDead(unit)) {
            unit.status = unit.status.filter(s => s !== 'unconscious');
            unit.status.push('dead');
            this.logMsg(`${unit.name} shatters!`);
        }
        tryDownReactions(this, unit, source);
        for (const u of this.livingUnits) {
            const mp = isConscious(u) ? supportOf(u)?.mpOnFall : 0;
            if (mp && u.mp < u.maxMp) {
                const amt = Math.min(u.maxMp - u.mp, mp);
                u.mp += amt;
                this._spawnFloat(u, `+${amt} MP`, '#88aaff');
            }
        }
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
        viewState(unit).floats.push({ text, color, age: 0, maxAge: 1200 });
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
