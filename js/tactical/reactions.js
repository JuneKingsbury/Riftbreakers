// Reaction abilities: effects that fire on their own when the owner (or an adjacent
// ally, for 'allyHit') is hit. A unit may have several (its chosen reaction plus any
// from equipment); each gets its chance in turn, and at most one fires per hit. TacticalBattle._applyResult calls
// tryReaction and tryAllyReactions after every resolved hit; the reaction's own
// results go back through _applyResult flagged as reactions, so a counter can
// never trigger another counter.
import { ABILITIES, resolveAbility, inflictStatus, cleanseStatuses, passivesOf, NEGATIVE_STATUSES } from './abilities.js';
import { isConscious, isDead, isUnconscious, createUnit } from './units.js';
import { JOB_STATS } from './data-registry.js';
import { columnCells, posKey } from './battle-map.js';
import { moveEntity } from '../systems/movement-lerp.js';
import { checkHpTriggers, placeNear } from './triggers.js';

const LOW_HP_FRAC = 0.3;

const dist = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

function triggerMatches(rx, hit, d, reactor, result) {
    switch (rx.trigger) {
        case 'physicalHit': return hit.type === 'physical';
        case 'magicHit':    return hit.type === 'magic';
        case 'rangedHit':   return d > 1;
        case 'lowHp':       return reactor.hp < reactor.maxHp * LOW_HP_FRAC;
        case 'statusHit':   return NEGATIVE_STATUSES.includes(result.statusApplied);
        default:            return true; // anyHit
    }
}

// The reactor's own rank of the skill a reaction uses (counterWith, allyCast, selfCast):
// 'long_shot@3' when they have Long Shot III, so a counter or a reflex heal is as strong (and
// costs as little) as the same skill used on their turn. Skills they don't know stay rank I.
function counterKey(reactor, key) {
    return (reactor.abilities ?? []).find(k => k === key || k.startsWith(`${key}@`)) ?? key;
}

// Returns true if `reactor` can use `abKey` right now (MP and silence).
function canCast(reactor, abKey) {
    const ab = ABILITIES[abKey];
    if (!ab || reactor.mp < (ab.mpCost || 0)) return false;
    return !(ab.type === 'magic' && reactor.status.includes('silence'));
}

// Whether a unit is in a state to react at all.
function canReact(reactor, attacker) {
    if (reactor === attacker || reactor.team === attacker.team) return false;
    if (!isConscious(reactor) || reactor.hp <= 0) return false;
    return !['sleep', 'stun', 'charm'].some(s => reactor.status.includes(s));
}

// Free standing cells within `radius` of `around`, best first by `score` (higher wins).
function freeCells(battle, around, radius, score) {
    const taken = new Set(battle.livingUnits.map(posKey));
    const out = [];
    for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
            const d = Math.abs(dx) + Math.abs(dy);
            if (d === 0 || d > radius) continue;
            for (const c of columnCells(battle.map, around.x + dx, around.y + dy)) {
                if (c.passable && !taken.has(posKey(c))) out.push(c);
            }
        }
    }
    return out.sort((a, b) => score(b) - score(a));
}

function castOn(battle, reactor, key, target) {
    reactor.mp = Math.max(0, reactor.mp - (ABILITIES[key].mpCost || 0));
    battle.stats?.use(reactor, key);
    battle.announceCast?.(reactor, key);
    const res = resolveAbility(reactor, target, key, battle.map);
    battle._applyResult(reactor, target, key, res, { isReaction: true });
}

// Deal reaction damage that bypasses the ability system (thorns), credited to `reactor`'s
// reaction `key` in the battle's stats.
function dealDamage(battle, target, amt, reactor, key) {
    const before = target.hp;
    target.hp = Math.max(0, target.hp - amt);
    battle.stats?.damage(reactor, target, before - target.hp, key);
    if (target.hp === 0) battle.stats?.knockout(reactor, target, key, { inert: !!JOB_STATS[target.job]?.inert });
    battle._spawnFloat(target, `-${amt}`, '#f88');
    if (target.hp === 0 && !isUnconscious(target) && !isDead(target)) {
        target.status.push('unconscious');
        target.deathTimer = 3;
        battle.logMsg(`${target.name} is knocked unconscious!`);
        battle._onDown?.(target, reactor);
    }
    checkHpTriggers(battle, target);
}

// The unit breaks into weaker copies of itself beside where it fell: same job, kit and look,
// at a fraction of its HP and power, without the ability to split again.
function splitApart(battle, unit, { count, hpFrac, statFrac }) {
    const base = unit.spriteName ?? unit.name;
    const splits = (k) => !!ABILITIES[k]?.splitInto;
    placeNear(battle, unit, count, (cell) => {
        const copy = createUnit(`${base} Fragment`, unit.job, unit.team, cell.x, cell.y, { spriteKey: unit.spriteKey, tint: unit.tint });
        copy.spriteName = base;
        copy.maxHp = copy.hp = Math.max(1, Math.round(unit.maxHp * hpFrac));
        for (const s of ['atk', 'def', 'mat', 'mdf']) copy[s] = Math.max(0, Math.round(unit[s] * statFrac));
        for (const s of ['spd', 'move', 'eva', 'crit']) copy[s] = unit[s];
        copy.maxMp = copy.mp = unit.maxMp;
        copy.abilities = [...unit.abilities];
        copy.skillsets = unit.skillsets;
        copy.reaction = splits(unit.reaction) ? null : unit.reaction;
        copy.support = unit.support;
        copy.movement = unit.movement;
        copy.bonusPassives = (unit.bonusPassives ?? []).filter(k => !splits(k));
        return copy;
    }, 'breaks away');
}

function announce(battle, reactor, rx, key) {
    reactor._reactionsUsed = reactor._reactionsUsed || {};
    reactor._reactionsUsed[key] = true;
    battle.logMsg(`${reactor.name} reacts with ${rx.name}!`);
    battle._spawnFloat(reactor, `${rx.name}!`, '#ffd866');
}

export function tryReaction(battle, reactor, attacker, abKey, result) {
    for (const key of passivesOf(reactor, 'reaction')) {
        if (tryOneReaction(battle, reactor, key, attacker, abKey, result)) return;
    }
}

// Returns true if the reaction fired.
function tryOneReaction(battle, reactor, key, attacker, abKey, result) {
    const rx = ABILITIES[key];
    const hit = ABILITIES[abKey];
    if (!rx || !hit || ['allyHit', 'onDown', 'decoyDown', 'enemyCharge'].includes(rx.trigger)) return false;
    // Status reactions answer any affliction; everything else needs damage.
    if (rx.trigger === 'statusHit' ? !result.statusApplied : !(result.damage > 0)) return false;
    if (!canReact(reactor, attacker)) return false;

    const d = dist(reactor, attacker);
    if (rx.adjacentOnly && d !== 1) return false;
    if (!triggerMatches(rx, hit, d, reactor, result)) return false;
    if (rx.oncePerBattle && reactor._reactionsUsed?.[key]) return false;

    // Check the effect is possible before rolling, so a failed check costs nothing.
    if (rx.counterWith) {
        const ab = ABILITIES[counterKey(reactor, rx.counterWith)];
        if (!isConscious(attacker) || !canCast(reactor, counterKey(reactor, rx.counterWith)) || d > (ab.range || 1)) return false;
    }
    if (rx.selfCast && !canCast(reactor, counterKey(reactor, rx.selfCast))) return false;
    const phaseTo = rx.phaseAway
        ? freeCells(battle, reactor, rx.phaseAway, c => dist(c, attacker) * 10 - dist(c, reactor))[0]
        : null;
    if (rx.phaseAway && !phaseTo) return false;
    const summonAt = rx.summon ? freeCells(battle, reactor, 1, c => -dist(c, attacker))[0] : null;
    if (rx.summon && !summonAt) return false;
    if (Math.random() >= (rx.chance ?? 1)) return false;

    announce(battle, reactor, rx, key);

    if (rx.counterWith) castOn(battle, reactor, counterKey(reactor, rx.counterWith), attacker);
    if (rx.selfCast) castOn(battle, reactor, counterKey(reactor, rx.selfCast), reactor);
    if (rx.selfStatus && !reactor.status.includes(rx.selfStatus)) reactor.status.push(rx.selfStatus);
    if (rx.selfBuff) {
        reactor.buffs = reactor.buffs || [];
        reactor.buffs.push({ key, ...rx.selfBuff });
    }
    if (rx.mpRestoreFrac) {
        const amt = Math.max(1, Math.round(result.damage * rx.mpRestoreFrac));
        reactor.mp = Math.min(reactor.maxMp, reactor.mp + amt);
        battle.logMsg(`${reactor.name} recovers ${amt} MP.`);
        battle._spawnFloat(reactor, `+${amt} MP`, '#88aaff');
    }
    if (rx.attackerStatus && isConscious(attacker)
        && inflictStatus(attacker, rx.attackerStatus.status, rx.attackerStatus.duration, reactor)) {
        battle.logMsg(`${attacker.name} is afflicted with ${rx.attackerStatus.status}!`);
    }
    if (rx.thornsFrac && isConscious(attacker)) {
        const amt = Math.max(1, Math.round(result.damage * rx.thornsFrac));
        battle.logMsg(`${attacker.name} takes ${amt} damage from the thorns.`);
        dealDamage(battle, attacker, amt, reactor, key);
    }
    if (rx.cleanseSelf && cleanseStatuses(reactor).length) battle.logMsg(`${reactor.name} is purified.`);
    if (phaseTo) {
        moveEntity(reactor, phaseTo.x, phaseTo.y, battle.moveMsPerStep, phaseTo.z);
        battle.logMsg(`${reactor.name} phases to (${phaseTo.x}, ${phaseTo.y}).`);
    }
    if (summonAt) {
        battle._resolveSummon(reactor, { summonJob: rx.summon.job, summonName: rx.summon.name }, summonAt.x, summonAt.y, summonAt.z);
    }
    battle._checkVictory();
    return true;
}

// 'allyHit' reactions: units adjacent to the victim, on the victim's side.
export function tryAllyReactions(battle, victim, attacker, abKey, result) {
    // Nobody shields or patches up a copy (Mirror Image): it isn't really there.
    if (!(result.damage > 0) || isDead(victim) || JOB_STATS[victim.job]?.inert) return;
    for (const reactor of battle.livingUnits) {
        if (reactor === victim || reactor.team !== victim.team) continue;
        if (dist(reactor, victim) !== 1 || !canReact(reactor, attacker)) continue;
        for (const key of passivesOf(reactor, 'reaction')) {
            if (tryAllyReaction(battle, reactor, key, victim, result, attacker)) break;
        }
    }
}

// Returns true if the reaction fired.
function tryAllyReaction(battle, reactor, key, victim, result, attacker) {
    const rx = ABILITIES[key];
    if (rx?.trigger !== 'allyHit') return false;
    if (rx.allyCast && !canCast(reactor, counterKey(reactor, rx.allyCast))) return false;
    // Triage: only for an ally left badly hurt (but still standing).
    if (rx.whenAllyBelow != null && !(victim.hp > 0 && victim.hp < victim.maxHp * rx.whenAllyBelow)) return false;
    // Death Ward: only for an ally the blow knocked out.
    if (rx.saveFromDown && !isUnconscious(victim)) return false;
    // Hold the Line: strike back at the attacker, if it is in reach. The reactor stands beside the
    // ally and the attacker beside the ally, so they are 2 apart: counterReach lets it lunge in.
    if (rx.counterWith) {
        const ab = ABILITIES[counterKey(reactor, rx.counterWith)];
        const reach = rx.counterReach ?? (ab.range || 1);
        if (!attacker || !isConscious(attacker) || !canCast(reactor, counterKey(reactor, rx.counterWith)) || dist(reactor, attacker) > reach) return false;
    }
    const share = rx.shareDamageFrac ? Math.min(reactor.hp - 1, Math.round(result.damage * rx.shareDamageFrac)) : 0;
    if (rx.shareDamageFrac && share <= 0) return false;
    if (Math.random() >= (rx.chance ?? 1)) return false;

    announce(battle, reactor, rx, key);
    if (rx.allyCast) castOn(battle, reactor, counterKey(reactor, rx.allyCast), victim);
    if (rx.counterWith) castOn(battle, reactor, counterKey(reactor, rx.counterWith), attacker);
    if (rx.saveFromDown) {
        battle.stats?.heal(reactor, victim, 1 - victim.hp, key);
        victim.hp = 1;
        victim.status = victim.status.filter(s => s !== 'unconscious');
        battle.logMsg(`${reactor.name} holds ${victim.name}'s soul in place!`);
        battle._spawnFloat(victim, 'Saved!', '#bbffcc');
    }
    if (share > 0) {
        reactor.hp -= share;
        victim.hp = Math.min(victim.maxHp, victim.hp + share);
        // The blow is the attacker's either way; the reactor took part of it instead.
        battle.stats?.shiftTaken(victim, reactor, share);
        if (isUnconscious(victim) && victim.hp > 0) victim.status = victim.status.filter(s => s !== 'unconscious');
        battle.logMsg(`${reactor.name} takes ${share} of the blow meant for ${victim.name}.`);
        battle._spawnFloat(reactor, `-${share}`, '#f88');
        battle._spawnFloat(victim, `+${share}`, '#8f8');
    }
    return true;
}

// Reactions to a unit dropping to 0 HP (TacticalBattle._onDown). The fallen unit's own
// 'onDown' reactions (Lingering Spite bursts at adjacent enemies, Phylactery revives it),
// then, if it was a copy (an inert summon), its summoner's 'decoyDown' reactions against
// whoever broke it (Shattered Image).
export function tryDownReactions(battle, unit, source) {
    // Splitting (an affix) happens on top of any other knockout reaction.
    if (isUnconscious(unit) && !isDead(unit)) {
        for (const key of passivesOf(unit, 'reaction')) {
            const rx = ABILITIES[key];
            if (rx?.trigger !== 'onDown' || !rx.splitInto || unit._reactionsUsed?.[key]) continue;
            announce(battle, unit, rx, key);
            splitApart(battle, unit, rx.splitInto);
        }
    }
    if (isUnconscious(unit) && !isDead(unit)) {
        for (const key of passivesOf(unit, 'reaction')) {
            const rx = ABILITIES[key];
            if (rx?.trigger !== 'onDown') continue;
            if (rx.oncePerBattle && unit._reactionsUsed?.[key]) continue;
            if (Math.random() >= (rx.chance ?? 1)) continue;
            announce(battle, unit, rx, key);
            if (rx.downBurst) {
                for (const foe of battle.livingUnits.filter(u => u.team !== unit.team && isConscious(u) && dist(u, unit) === 1)) {
                    const res = resolveAbility(unit, foe, rx.downBurst, battle.map);
                    battle._applyResult(unit, foe, rx.downBurst, res, { isReaction: true });
                }
            }
            if (rx.reviveFrac) {
                unit.hp = Math.max(1, Math.round(unit.maxHp * rx.reviveFrac));
                battle.stats?.heal(unit, unit, unit.hp, key);
                unit.status = unit.status.filter(s => s !== 'unconscious');
                battle.logMsg(`${unit.name} rises again!`);
                battle._spawnFloat(unit, `+${unit.hp}`, '#8f8');
                battle._emit?.('revive', { source: unit, target: unit, amount: unit.hp, ability: key });
            }
            break;
        }
    }
    if (!JOB_STATS[unit.job]?.inert || unit.summonerId == null || !source || !isConscious(source)) return;
    const summoner = battle.livingUnits.find(u => u.id === unit.summonerId);
    if (!summoner || !isConscious(summoner)) return;
    for (const key of passivesOf(summoner, 'reaction')) {
        const rx = ABILITIES[key];
        if (rx?.trigger !== 'decoyDown' || Math.random() >= (rx.chance ?? 1)) continue;
        announce(battle, summoner, rx, key);
        if (rx.attackerStatus && inflictStatus(source, rx.attackerStatus.status, rx.attackerStatus.duration, summoner)) {
            battle.logMsg(`${source.name} is afflicted with ${rx.attackerStatus.status}!`);
        }
        break;
    }
}

// 'enemyCharge' reactions (Read the Battle): when `charger` starts channeling a spell, opponents
// within the reaction's chargeRange may disrupt it, so it needs delayCharge more to go off.
export function tryChargeReactions(battle, charger) {
    if (!charger._charging) return;
    for (const reactor of battle.livingUnits) {
        if (reactor.team === charger.team || !isConscious(reactor)) continue;
        if (['sleep', 'stun', 'charm'].some(s => reactor.status.includes(s))) continue;
        for (const key of passivesOf(reactor, 'reaction')) {
            const rx = ABILITIES[key];
            if (rx?.trigger !== 'enemyCharge' || dist(reactor, charger) > (rx.chargeRange ?? 4)) continue;
            if (Math.random() >= (rx.chance ?? 1)) continue;
            announce(battle, reactor, rx, key);
            // The charge has only just begun, so lengthen it rather than set its progress back.
            charger._charging.needed += rx.delayCharge ?? 30;
            battle._spawnFloat(charger, 'Disrupted!', '#cc88cc');
            return;
        }
    }
}
