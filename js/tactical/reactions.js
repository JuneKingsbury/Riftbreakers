// Reaction-slot abilities: effects that fire on their own when the owner (or an
// adjacent ally, for 'allyHit') is hit. TacticalBattle._applyResult calls
// tryReaction and tryAllyReactions after every resolved hit; the reaction's own
// results go back through _applyResult flagged as reactions, so a counter can
// never trigger another counter.
import { ABILITIES, resolveAbility, inflictStatus, cleanseStatuses, NEGATIVE_STATUSES } from './abilities.js';
import { isConscious, isDead, isUnconscious } from './units.js';
import { columnCells, posKey } from './battle-map.js';
import { moveEntity } from '../systems/movement-lerp.js';

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
    const res = resolveAbility(reactor, target, key, battle.map);
    battle._applyResult(reactor, target, key, res, { isReaction: true });
}

// Deal reaction damage that bypasses the ability system (thorns).
function dealDamage(battle, target, amt) {
    target.hp = Math.max(0, target.hp - amt);
    battle._spawnFloat(target, `-${amt}`, '#f88');
    if (target.hp === 0 && !isUnconscious(target) && !isDead(target)) {
        target.status.push('unconscious');
        target.deathTimer = 3;
        battle.logMsg(`${target.name} is knocked unconscious!`);
    }
}

function announce(battle, reactor, rx) {
    reactor._reactionsUsed = reactor._reactionsUsed || {};
    reactor._reactionsUsed[reactor.reaction] = true;
    battle.logMsg(`${reactor.name} reacts: ${rx.name}!`);
    battle._spawnFloat(reactor, `${rx.name}!`, '#ffd866');
}

export function tryReaction(battle, reactor, attacker, abKey, result) {
    const rx = ABILITIES[reactor.reaction];
    const hit = ABILITIES[abKey];
    if (!rx || !hit || rx.trigger === 'allyHit') return;
    // Status reactions answer any affliction; everything else needs damage.
    if (rx.trigger === 'statusHit' ? !result.statusApplied : !(result.damage > 0)) return;
    if (!canReact(reactor, attacker)) return;

    const d = dist(reactor, attacker);
    if (rx.adjacentOnly && d !== 1) return;
    if (!triggerMatches(rx, hit, d, reactor, result)) return;
    if (rx.oncePerBattle && reactor._reactionsUsed?.[reactor.reaction]) return;

    // Check the effect is possible before rolling, so a failed check costs nothing.
    if (rx.counterWith) {
        const ab = ABILITIES[rx.counterWith];
        if (!isConscious(attacker) || !canCast(reactor, rx.counterWith) || d > (ab.range || 1)) return;
    }
    if (rx.selfCast && !canCast(reactor, rx.selfCast)) return;
    const phaseTo = rx.phaseAway
        ? freeCells(battle, reactor, rx.phaseAway, c => dist(c, attacker) * 10 - dist(c, reactor))[0]
        : null;
    if (rx.phaseAway && !phaseTo) return;
    const summonAt = rx.summon ? freeCells(battle, reactor, 1, c => -dist(c, attacker))[0] : null;
    if (rx.summon && !summonAt) return;
    if (Math.random() >= (rx.chance ?? 1)) return;

    announce(battle, reactor, rx);

    if (rx.counterWith) castOn(battle, reactor, rx.counterWith, attacker);
    if (rx.selfCast) castOn(battle, reactor, rx.selfCast, reactor);
    if (rx.selfStatus && !reactor.status.includes(rx.selfStatus)) reactor.status.push(rx.selfStatus);
    if (rx.selfBuff) {
        reactor.buffs = reactor.buffs || [];
        reactor.buffs.push({ key: reactor.reaction, ...rx.selfBuff });
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
        dealDamage(battle, attacker, amt);
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
}

// 'allyHit' reactions: units adjacent to the victim, on the victim's side.
export function tryAllyReactions(battle, victim, attacker, abKey, result) {
    if (!(result.damage > 0) || isDead(victim)) return;
    for (const reactor of battle.livingUnits) {
        const rx = ABILITIES[reactor.reaction];
        if (rx?.trigger !== 'allyHit' || reactor === victim || reactor.team !== victim.team) continue;
        if (dist(reactor, victim) !== 1 || !canReact(reactor, attacker)) continue;
        if (rx.allyCast && !canCast(reactor, rx.allyCast)) continue;
        const share = rx.shareDamageFrac ? Math.min(reactor.hp - 1, Math.round(result.damage * rx.shareDamageFrac)) : 0;
        if (rx.shareDamageFrac && share <= 0) continue;
        if (Math.random() >= (rx.chance ?? 1)) continue;

        announce(battle, reactor, rx);
        if (rx.allyCast) castOn(battle, reactor, rx.allyCast, victim);
        if (share > 0) {
            reactor.hp -= share;
            victim.hp = Math.min(victim.maxHp, victim.hp + share);
            if (isUnconscious(victim) && victim.hp > 0) victim.status = victim.status.filter(s => s !== 'unconscious');
            battle.logMsg(`${reactor.name} takes ${share} of the blow meant for ${victim.name}.`);
            battle._spawnFloat(reactor, `-${share}`, '#f88');
            battle._spawnFloat(victim, `+${share}`, '#8f8');
        }
    }
}
