// Interpreter for per-character battle scripts. Pure: it reads the battle and
// returns an *intent* describing what the unit should do, and mutates nothing.
// executor.js turns the intent into real moves, animations and CT cost.
//
// Turn model (mirrors the manual game): any number of free actions (one move,
// pivots) followed by at most one ending action (ability, defend, wait). Rules
// are scanned in order. A rule fires when its condition holds and its action is
// feasible. A free action fires and scanning continues from the next rule (with
// the unit at its new tile). An ending action fires and stops the scan.
import { getTile } from '../battle-map.js';
import { ABILITIES } from '../data-registry.js';
import { isConscious, isDead, faceToward } from '../units.js';
import { estimateAbilityEffect } from './estimate.js';
import * as Q from './queries.js';
import { evalCond, describeCond, ACTION_KINDS, MOVE_MODES } from './blocks.js';

export const MAX_RULES = 16;

const DEFAULT_TARGET = { side: 'enemy', pick: 'nearest' };

// Charged spells land later on whoever is on the tile, so rate them lower.
const CHARGE_PENALTY = 0.6;
const KILL_BONUS = 1000;

function elevationAt(map, x, y) {
    return getTile(map, x, y)?.elevation ?? 0;
}

function parseKey(key) {
    const [x, y] = key.split(',').map(Number);
    return { x, y };
}

function passesFilter(f, cand, ctx) {
    switch (f.kind) {
        case 'status':   return Q.hasStatus(cand, f.status) === (f.has !== false);
        case 'hp_below': return Q.hpPct(cand) < f.value;
        case 'hp_above': return Q.hpPct(cand) > f.value;
        case 'job':      return cand.job === f.job;
        case 'within':   return Q.distance(ctx.self, cand) <= f.range;
        default:         return true;
    }
}

function pickFrom(pick, cands, ctx) {
    const me = ctx.self;
    switch (pick) {
        case 'farthest':       return Q.farthest(me, cands);
        case 'lowest_hp':      return Q.lowestHp(cands);
        case 'lowest_hp_pct':  return Q.lowestHpPct(cands);
        case 'highest_hp':     return Q.pickMin(cands, c => -c.hp);
        case 'lowest_def':     return Q.pickMin(cands, c => c.def);
        case 'lowest_mdf':     return Q.pickMin(cands, c => c.mdf);
        case 'most_clustered': {
            const near = c => cands.filter(o => Q.distance(c, o) <= 2).length;
            return Q.pickMin(cands, c => -near(c) * 1000 + Q.distance(me, c));
        }
        case 'last_target':
            return cands.find(c => c.id === me._lastTargetId) ?? Q.nearest(me, cands);
        default:               return Q.nearest(me, cands);
    }
}

// Resolves a target selector { side, pick, filters } to a unit, or null.
export function resolveTarget(sel, ctx) {
    const s = sel ?? DEFAULT_TARGET;
    const filters = s.filters || [];
    let cands;
    if (s.side === 'self') {
        cands = [ctx.self];
    } else if (s.side === 'ally') {
        cands = Q.alliesOf(ctx.self, ctx.units);
        // Unconscious allies are only candidates when the selector asks for them (revive).
        const wantsDown = filters.some(f => f.kind === 'status' && f.status === 'unconscious' && f.has !== false);
        if (!wantsDown) cands = cands.filter(isConscious);
    } else {
        cands = Q.enemiesOf(ctx.self, ctx.units);
    }
    for (const f of filters) cands = cands.filter(c => passesFilter(f, c, ctx));
    if (cands.length === 0) return null;
    return pickFrom(s.pick, cands, ctx);
}

// Chooses a tile out of `keys`. mode 'far' maximizes distance to target, 'near'
// minimizes it. Ties go to the shorter walk, then to the earlier tile.
function bestTile(keys, target, mode, ctx) {
    let best = null;
    let bestScore = Infinity;
    for (const key of keys) {
        const t = parseKey(key);
        const d = Q.distance(t, target);
        const score = (mode === 'far' ? -d : d) * 1000 + Q.distance(t, ctx.self);
        if (score < bestScore) { best = t; bestScore = score; }
    }
    return best;
}

const CATEGORY_FILTERS = {
    best_damage: ab => ab.targetType === 'enemy' && !ab.isHeal && !ab.isCure,
    best_heal:   ab => !!ab.isHeal,
    best_cure:   ab => !!ab.isCure,
    best_status: ab => ab.targetType === 'enemy' && !!ab.applyStatus,
    best_buff:   ab => ab.targetType === 'self' && !ab.isHeal && !ab.isCure && !ab.isSummon,
    best_support: ab => ab.targetType === 'ally' && !ab.isHeal && !ab.isCure && !!ab.applyStatus,
    best_summon: ab => !!ab.isSummon,
};

// Statuses a cure can remove (death and the defend stance are not afflictions).
const NOT_AFFLICTIONS = new Set(['dead', 'unconscious', 'defend']);

// Whether using the ability on this target could accomplish anything, so a
// script never wastes a turn healing a full-HP ally or curing a clean one.
function usefulOn(ab, key, target, ctx) {
    if (ab.isHeal) return target.hp < target.maxHp || Q.hasStatus(target, 'unconscious');
    if (ab.isCure) return target.status.some(s => !NOT_AFFLICTIONS.has(s));
    if (ab.targetType === 'ally' && ab.applyStatus) return !Q.hasStatus(target, ab.applyStatus);
    if (ab.targetType === 'self' && !ab.isSummon) {
        if (Q.hasBuff(ctx.self, key)) return false;
        if (ab.applyStatus && Q.hasStatus(ctx.self, ab.applyStatus)) return false;
    }
    return true;
}

function sideAllows(ab, side) {
    if (ab.isSummon) return true;
    // A heal or other ally-targeted ability may be aimed at oneself.
    return ab.targetType === side || (side === 'self' && ab.targetType === 'ally');
}

function abilityCandidates(choice, target, side, ctx) {
    const usable = (ab, key) => sideAllows(ab, side) && usefulOn(ab, key, target, ctx);
    if (CATEGORY_FILTERS[choice]) {
        return Q.usableAbilities(ctx.self, (ab, key) => {
            if (!CATEGORY_FILTERS[choice](ab) || !usable(ab, key)) return false;
            return choice !== 'best_status' || !Q.hasStatus(target, ab.applyStatus);
        });
    }
    const ab = ABILITIES[choice];
    if (!ab || !ctx.self.abilities.includes(choice) || !Q.canUse(ctx.self, choice)) return [];
    // Tile-targeted abilities other than summons need terrain handling the AI path does not provide.
    if (ab.targetType === 'tile' && !ab.isSummon) return [];
    return usable(ab, choice) ? [choice] : [];
}

function scoreAbility(key, choice, target, ctx) {
    if (choice !== 'best_damage' && choice !== 'best_heal') return 0;
    const ab = ABILITIES[key];
    const { damage, healing } = estimateAbilityEffect(ctx.self, target, key, ctx.map);
    const amount = choice === 'best_heal' ? healing : damage;
    const hits = Math.max(1, Q.unitsAffected(ctx.self, key, target.x, target.y, ctx.units).length);
    let score = amount * hits;
    if (choice === 'best_damage' && damage >= target.hp) score += KILL_BONUS;
    if (ab.chargeTime > 0) score *= CHARGE_PENALTY;
    return score;
}

// Places a summon on a free passable tile within the ability's range of the
// caster, as close as possible to the nearest enemy (same rule as the enemy AI).
function planSummon(key, ctx) {
    const ab = ABILITIES[key];
    const foe = Q.nearest(ctx.self, Q.enemiesOf(ctx.self, ctx.units));
    if (!foe) return null;
    const occupied = new Set(ctx.units.filter(u => !isDead(u)).map(u => `${u.x},${u.y}`));
    const reach = ab.range ?? 2;
    let best = null;
    let bestDist = Infinity;
    for (let dx = -reach; dx <= reach; dx++) {
        for (let dy = -reach; dy <= reach; dy++) {
            if (Math.abs(dx) + Math.abs(dy) > reach || (dx === 0 && dy === 0)) continue;
            const x = ctx.self.x + dx;
            const y = ctx.self.y + dy;
            if (occupied.has(`${x},${y}`) || !getTile(ctx.map, x, y)?.passable) continue;
            const d = Math.abs(x - foe.x) + Math.abs(y - foe.y);
            if (d < bestDist) { best = { x, y }; bestDist = d; }
        }
    }
    return best && { kind: 'ability', ability: key, dest: null, x: best.x, y: best.y, target: null };
}

// Plans { kind: 'ability', ... } or, when the target can't be reached this
// turn but `approach` is set, a { kind: 'move', approach: true } closing in.
function planAbility(action, target, ctx) {
    const choice = action.ability;
    // Summons need no target unit, only somewhere to put the creature.
    if (choice === 'best_summon' || ABILITIES[choice]?.isSummon) {
        const key = abilityCandidates(choice, ctx.self, 'self', ctx)[0];
        return key ? planSummon(key, ctx) : null;
    }
    if (!target) return null;
    const side = action.target?.side ?? DEFAULT_TARGET.side;
    const approach = action.approach !== false;
    const cands = abilityCandidates(choice, target, side, ctx);
    if (cands.length === 0) return null;

    let best = null;
    for (const key of cands) {
        let dest = null;
        if (!Q.inAbilityRange(ctx.self, target, key, ctx.map)) {
            if (!approach || ctx.hasMoved) continue;
            const tiles = Q.tilesToUseFrom(ctx.self, target, key, ctx.map, ctx.units);
            if (tiles.size === 0) continue;
            dest = bestTile(tiles, target, 'far', ctx);
        }
        const score = scoreAbility(key, choice, target, ctx);
        if (!best || score > best.score) best = { key, dest, score };
    }

    if (best) {
        return { kind: 'ability', ability: best.key, dest: best.dest, x: target.x, y: target.y, target };
    }
    if (approach && !ctx.hasMoved) return planMove({ mode: 'toward' }, target, ctx, true);
    return null;
}

function planMove(action, target, ctx, approach = false) {
    if (ctx.hasMoved) return null;
    const mode = action.mode ?? 'toward';
    const here = ctx.self;
    const tiles = [...Q.reachableTiles(here, ctx.map, ctx.units)].map(parseKey);
    const hereElev = elevationAt(ctx.map, here.x, here.y);
    let best = null;
    let bestScore = Infinity;
    let hereScore;

    const consider = (t, score) => {
        if (score < bestScore) { best = t; bestScore = score; }
    };

    if (mode === 'high_ground') {
        hereScore = -hereElev * 1000;
        for (const t of tiles) {
            consider(t, -elevationAt(ctx.map, t.x, t.y) * 1000 + (target ? Q.distance(t, target) : Q.distance(t, here)));
        }
        if (elevationAt(ctx.map, best?.x, best?.y) <= hereElev) return null;
    } else {
        if (!target) return null;
        const wanted = action.range ?? 3;
        // Walking distance (not straight-line) so a pond or cliff in the way doesn't trap the unit.
        const field = Q.walkCostField(ctx.map, target.x, target.y);
        const walk = t => field.get(`${t.x},${t.y}`) ?? 1000 + Q.distance(t, target);
        const score = {
            toward:     walk,
            away:       t => -walk(t),
            keep_range: t => Math.abs(Q.distance(t, target) - wanted) * 10 - Q.distance(t, target),
        }[mode];
        if (!score) return null;
        hereScore = score(here);
        for (const t of tiles) consider(t, score(t) * 1000 + Q.distance(t, here));
        // Strictly better than staying put, otherwise the move would be a no-op.
        if (!best || bestScore / 1000 >= hereScore) return null;
    }
    if (!best || (best.x === here.x && best.y === here.y)) return null;
    return { kind: 'move', dest: best, approach };
}

function planPivot(action, target, ctx) {
    let facing = action.facing ?? 'toward_target';
    if (facing === 'toward_target') {
        if (!target) return null;
        const probe = { x: ctx.self.x, y: ctx.self.y, facing: ctx.self.facing };
        faceToward(probe, target.x, target.y);
        facing = probe.facing;
    }
    return facing === ctx.self.facing ? null : { kind: 'pivot', facing };
}

function planAction(action, target, ctx) {
    switch (action.do) {
        case 'ability': return planAbility(action, target, ctx);
        case 'move':    return planMove(action, target, ctx);
        case 'pivot':   return planPivot(action, target, ctx);
        case 'defend':  return { kind: 'defend' };
        case 'wait':    return { kind: 'wait' };
        default:        return null;
    }
}

export function describeAction(action) {
    if (!action) return '';
    const who = action.target ? `${action.target.pick ?? 'nearest'} ${action.target.side ?? 'enemy'}` : '';
    switch (action.do) {
        case 'ability': return `${ABILITIES[action.ability]?.name ?? action.ability ?? '?'} on ${who || 'nearest enemy'}`;
        case 'move':    return `${MOVE_MODES[action.mode] ?? 'Move'}${who ? ` (${who})` : ''}`;
        default:        return ACTION_KINDS[action.do] ?? String(action.do);
    }
}

function withPosition(unit, x, y, facing) {
    return { ...unit, x, y, facing };
}

// Runs a script for `unit` and returns the intent:
//   { move: {x,y}|null, pivot: facing|null, act: ability|defend|wait|null, trace: [...] }
// `units` is the list of non-dead units, `map` the battle map.
export function runScript(script, unit, units, map) {
    const intent = { move: null, pivot: null, act: null, trace: [] };
    const rules = (script?.rules ?? []).slice(0, MAX_RULES);

    let self = unit;
    let list = units;
    let hasMoved = false;
    const moveSelf = (x, y, facing) => {
        self = withPosition(unit, x, y, facing);
        list = units.map(u => (u === unit ? self : u));
    };

    for (const rule of rules) {
        if (rule.enabled === false || !rule.then) continue;
        const ctx = { self, units: list, map, hasMoved, target: null };
        if (rule.then.target) ctx.target = resolveTarget(rule.then.target, ctx);
        else if (rule.then.do === 'ability' || rule.then.do === 'move' || rule.then.do === 'pivot') {
            ctx.target = resolveTarget(DEFAULT_TARGET, ctx);
        }
        if (!evalCond(rule.when, ctx)) continue;
        const plan = planAction(rule.then, ctx.target, ctx);
        if (!plan) continue;

        const entry = {
            ruleId: rule.id,
            label: rule.label || `${describeCond(rule.when)} -> ${describeAction(rule.then)}`,
            kind: plan.kind,
        };

        if (plan.kind === 'move') {
            intent.move = { x: plan.dest.x, y: plan.dest.y };
            hasMoved = true;
            moveSelf(plan.dest.x, plan.dest.y, self.facing);
            intent.trace.push(entry);
            continue;
        }
        if (plan.kind === 'pivot') {
            intent.pivot = plan.facing;
            self = { ...self, facing: plan.facing };
            list = units.map(u => (u === unit ? self : u));
            intent.trace.push(entry);
            continue;
        }

        if (plan.kind === 'ability') {
            if (plan.dest && !hasMoved) {
                intent.move = { x: plan.dest.x, y: plan.dest.y };
                hasMoved = true;
            }
            intent.act = {
                kind: 'ability', ability: plan.ability, x: plan.x, y: plan.y,
                targetId: plan.target?.id ?? null, targetName: plan.target?.name ?? null,
            };
        } else {
            intent.act = { kind: plan.kind };
        }
        intent.trace.push(entry);
        break;
    }

    if (!intent.act) intent.act = { kind: 'wait' };
    intent.moved = !!intent.move;
    return intent;
}
