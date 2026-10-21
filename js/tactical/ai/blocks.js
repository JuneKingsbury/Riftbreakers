// Block catalogue for the scripted-AI layer. One table drives both the
// interpreter (`test` functions) and the editor (labels and param schemas), so
// the two cannot disagree about what a block means.
//
// A condition is { test, params } or { op: 'and'|'or'|'not', args: [...] }.
// Label templates use {param} placeholders, which the editor renders as inputs.
import { getTile } from '../battle-map.js';
import { ABILITIES } from '../data-registry.js';
import * as Q from './queries.js';

export const COMPARATORS = ['<', '<=', '>', '>=', '=='];

export function compare(op, a, b) {
    switch (op) {
        case '<':  return a <  b;
        case '<=': return a <= b;
        case '>':  return a >  b;
        case '>=': return a >= b;
        case '==': return a === b;
        default:   return false;
    }
}

export const TILE_TYPES = ['grass', 'dirt', 'water', 'wall', 'rubble', 'high'];

// Statuses a script may reference: the ones the engine uses plus any an ability can inflict.
export const STATUS_OPTIONS = [...new Set([
    'stun', 'slow', 'defend', 'charging', 'unconscious',
    ...Object.values(ABILITIES).map(a => a.applyStatus).filter(Boolean),
])];

// Pseudo-abilities that choose the best usable ability of a kind at run time.
export const ABILITY_CATEGORIES = {
    best_damage: 'Best damage ability',
    best_heal:   'Best heal',
    best_cure:   'Best cure',
    best_status: 'Best status ability',
    best_buff:   'Best self-buff',
    best_support: 'Best ally buff',
    best_summon: 'Summon',
};

// Which target side an ability choice needs: 'enemy', 'ally' or 'self', or null when the
// ability picks its own tile (summons) or is unknown. The editor uses this to point a
// rule's target at the right side whenever the ability changes.
const CATEGORY_SIDES = { best_damage: 'enemy', best_status: 'enemy', best_heal: 'ally', best_cure: 'ally', best_support: 'ally', best_buff: 'self' };
export function sideForAbility(choice) {
    if (CATEGORY_SIDES[choice]) return CATEGORY_SIDES[choice];
    const ab = ABILITIES[choice];
    if (!ab || ab.isSummon) return null;
    return ['enemy', 'ally', 'self'].includes(ab.targetType) ? ab.targetType : null;
}

// True for abilities a script can use: not passive, and not a tile-targeted ability
// other than a summon (terrain effects are not supported by the AI path yet).
export function scriptUsable(abilityKey) {
    const ab = ABILITIES[abilityKey];
    return !!ab && !ab.passive && (ab.targetType !== 'tile' || !!ab.isSummon);
}

const hp = { name: 'value', type: 'number', default: 50 };
const cmp = { name: 'cmp', type: 'cmp', default: '<' };

// needsTarget: the test inspects the rule's resolved target and is false without one.
export const CONDITIONS = {
    always: {
        group: 'General', label: 'Always', params: [],
        test: () => true,
    },
    first_turn: {
        group: 'General', label: 'This is my first turn', params: [],
        test: (p, ctx) => (ctx.self._turnsTaken || 0) === 0,
    },

    self_hp_pct: {
        group: 'Self', label: 'My HP% {cmp} {value}', params: [cmp, hp],
        test: (p, ctx) => compare(p.cmp, Q.hpPct(ctx.self), p.value),
    },
    self_mp: {
        group: 'Self', label: 'My MP {cmp} {value}', params: [cmp, { name: 'value', type: 'number', default: 10 }],
        test: (p, ctx) => compare(p.cmp, ctx.self.mp, p.value),
    },
    self_mp_pct: {
        group: 'Self', label: 'My MP% {cmp} {value}', params: [cmp, hp],
        test: (p, ctx) => compare(p.cmp, Q.mpPct(ctx.self), p.value),
    },
    self_has_status: {
        group: 'Self', label: 'I have status {status}', params: [{ name: 'status', type: 'status', default: 'slow' }],
        test: (p, ctx) => Q.hasStatus(ctx.self, p.status),
    },
    self_lacks_status: {
        group: 'Self', label: 'I lack status {status}', params: [{ name: 'status', type: 'status', default: 'defend' }],
        test: (p, ctx) => !Q.hasStatus(ctx.self, p.status),
    },
    can_afford: {
        group: 'Self', label: 'I can use {ability}', params: [{ name: 'ability', type: 'ability', default: 'attack' }],
        test: (p, ctx) => ctx.self.abilities.includes(p.ability) && Q.canUse(ctx.self, p.ability),
    },
    self_buffed: {
        group: 'Self', label: 'My {ability} buff is active', params: [{ name: 'ability', type: 'ability', default: 'attack' }],
        test: (p, ctx) => Q.hasBuff(ctx.self, p.ability) || Q.hasStatus(ctx.self, p.ability),
    },
    standing_on: {
        group: 'Self', label: 'I am standing on {tile}', params: [{ name: 'tile', type: 'tile', default: 'high' }],
        test: (p, ctx) => getTile(ctx.map, ctx.self.x, ctx.self.y)?.type === p.tile,
    },
    self_threatened: {
        group: 'Self', label: 'An enemy could hit me next turn', params: [],
        test: (p, ctx) => Q.isThreatenedAt(ctx.self, ctx.self.x, ctx.self.y, ctx.map, ctx.units),
    },

    enemy_exists: {
        group: 'Enemies', label: 'An enemy exists', params: [],
        test: (p, ctx) => Q.enemiesOf(ctx.self, ctx.units).length > 0,
    },
    enemy_within: {
        group: 'Enemies', label: 'An enemy is within {range} tiles', params: [{ name: 'range', type: 'number', default: 2 }],
        test: (p, ctx) => Q.enemiesOf(ctx.self, ctx.units).some(e => Q.distance(ctx.self, e) <= p.range),
    },
    enemy_count_within: {
        group: 'Enemies', label: 'Enemies within {range} tiles {cmp} {value}',
        params: [{ name: 'range', type: 'number', default: 3 }, { name: 'cmp', type: 'cmp', default: '>=' }, { name: 'value', type: 'number', default: 2 }],
        test: (p, ctx) => compare(p.cmp, Q.enemiesOf(ctx.self, ctx.units).filter(e => Q.distance(ctx.self, e) <= p.range).length, p.value),
    },
    team_advantage: {
        group: 'Enemies', label: 'My conscious team minus enemies {cmp} {value}',
        params: [{ name: 'cmp', type: 'cmp', default: '<' }, { name: 'value', type: 'number', default: 2 }],
        test: (p, ctx) => {
            const mine = 1 + Q.alliesOf(ctx.self, ctx.units).filter(a => !Q.hasStatus(a, 'unconscious')).length;
            return compare(p.cmp, mine - Q.enemiesOf(ctx.self, ctx.units).length, p.value);
        },
    },
    outnumbered: {
        group: 'Enemies', label: 'My team is outnumbered', params: [],
        test: (p, ctx) => 1 + Q.alliesOf(ctx.self, ctx.units).filter(a => !Q.hasStatus(a, 'unconscious')).length
            < Q.enemiesOf(ctx.self, ctx.units).length,
    },

    ally_exists: {
        group: 'Allies', label: 'A conscious ally exists', params: [],
        test: (p, ctx) => Q.alliesOf(ctx.self, ctx.units).some(a => !Q.hasStatus(a, 'unconscious')),
    },
    ally_hp_below: {
        group: 'Allies', label: 'An ally has HP% below {value}', params: [hp],
        test: (p, ctx) => Q.alliesOf(ctx.self, ctx.units).some(a => !Q.hasStatus(a, 'unconscious') && Q.hpPct(a) < p.value),
    },
    ally_unconscious: {
        group: 'Allies', label: 'An ally is unconscious', params: [],
        test: (p, ctx) => Q.alliesOf(ctx.self, ctx.units).some(a => Q.hasStatus(a, 'unconscious')),
    },
    ally_has_status: {
        group: 'Allies', label: 'An ally has status {status}', params: [{ name: 'status', type: 'status', default: 'slow' }],
        test: (p, ctx) => Q.alliesOf(ctx.self, ctx.units).some(a => Q.hasStatus(a, p.status)),
    },

    target_in_range: {
        group: 'Target', label: 'Target is in range of {ability}', needsTarget: true,
        params: [{ name: 'ability', type: 'ability', default: 'attack' }],
        test: (p, ctx) => Q.inAbilityRange(ctx.self, ctx.target, p.ability, ctx.map),
    },
    target_within: {
        group: 'Target', label: 'Target is within {range} tiles', needsTarget: true,
        params: [{ name: 'range', type: 'number', default: 2 }],
        test: (p, ctx) => Q.distance(ctx.self, ctx.target) <= p.range,
    },
    target_hp_pct: {
        group: 'Target', label: 'Target HP% {cmp} {value}', needsTarget: true, params: [cmp, hp],
        test: (p, ctx) => compare(p.cmp, Q.hpPct(ctx.target), p.value),
    },
    target_has_status: {
        group: 'Target', label: 'Target has status {status}', needsTarget: true,
        params: [{ name: 'status', type: 'status', default: 'slow' }],
        test: (p, ctx) => Q.hasStatus(ctx.target, p.status),
    },
    target_lacks_status: {
        group: 'Target', label: 'Target lacks status {status}', needsTarget: true,
        params: [{ name: 'status', type: 'status', default: 'slow' }],
        test: (p, ctx) => !Q.hasStatus(ctx.target, p.status),
    },
    target_is_charging: {
        group: 'Target', label: 'Target is charging a spell', needsTarget: true, params: [],
        test: (p, ctx) => Q.hasStatus(ctx.target, 'charging'),
    },
    self_above_target: {
        group: 'Target', label: 'I am on higher ground than the target', needsTarget: true, params: [],
        test: (p, ctx) => (getTile(ctx.map, ctx.self.x, ctx.self.y)?.elevation ?? 0) > (getTile(ctx.map, ctx.target.x, ctx.target.y)?.elevation ?? 0),
    },
    aoe_hit_count: {
        group: 'Target', label: '{ability} centred on target hits {cmp} {value} units', needsTarget: true,
        params: [{ name: 'ability', type: 'ability', default: 'fire' }, { name: 'cmp', type: 'cmp', default: '>=' }, { name: 'value', type: 'number', default: 2 }],
        test: (p, ctx) => compare(p.cmp, Q.unitsAffected(ctx.self, p.ability, ctx.target.x, ctx.target.y, ctx.units).length, p.value),
    },
};

// ctx = { self, units, map, hasMoved, target }
export function evalCond(cond, ctx) {
    if (!cond) return true;
    if (cond.op === 'and') return (cond.args || []).every(c => evalCond(c, ctx));
    if (cond.op === 'or')  return (cond.args || []).some(c => evalCond(c, ctx));
    if (cond.op === 'not') return !evalCond((cond.args || [])[0], ctx);
    const def = CONDITIONS[cond.test];
    if (!def) return false;
    if (def.needsTarget && !ctx.target) return false;
    const params = {};
    for (const p of def.params) params[p.name] = cond.params?.[p.name] ?? p.default;
    return def.test(params, ctx);
}

// Human-readable text for a condition, used for rule labels and validation messages.
export function describeCond(cond) {
    if (!cond) return 'Always';
    if (cond.op === 'and' || cond.op === 'or') {
        return (cond.args || []).map(describeCond).join(cond.op === 'and' ? ' AND ' : ' OR ');
    }
    if (cond.op === 'not') return `NOT (${describeCond((cond.args || [])[0])})`;
    const def = CONDITIONS[cond.test];
    if (!def) return `unknown test "${cond.test}"`;
    return def.label.replace(/\{(\w+)\}/g, (_, name) => {
        const spec = def.params.find(p => p.name === name);
        return String(cond.params?.[name] ?? spec?.default ?? '?');
    });
}

export const SIDES = ['enemy', 'ally', 'self'];

export const PICKS = {
    nearest:        'nearest',
    farthest:       'farthest',
    lowest_hp:      'lowest HP',
    lowest_hp_pct:  'lowest HP%',
    highest_hp:     'highest HP',
    lowest_def:     'lowest DEF',
    lowest_mdf:     'lowest MDF',
    most_clustered: 'most clustered',
    last_target:    'my last target',
};

export const FILTER_KINDS = {
    status:   { label: 'status',        params: [{ name: 'status', type: 'status', default: 'slow' }, { name: 'has', type: 'bool', default: true }] },
    hp_below: { label: 'HP% below',     params: [{ name: 'value', type: 'number', default: 50 }] },
    hp_above: { label: 'HP% above',     params: [{ name: 'value', type: 'number', default: 50 }] },
    job:      { label: 'job',           params: [{ name: 'job', type: 'job', default: 'mage' }] },
    within:   { label: 'within tiles',  params: [{ name: 'range', type: 'number', default: 3 }] },
};

export const MOVE_MODES = {
    toward:      'Move toward target',
    away:        'Move away from target',
    keep_range:  'Move to keep a set distance',
    high_ground: 'Move to higher ground',
};

export const ACTION_KINDS = {
    ability: 'Use ability',
    move:    'Move',
    pivot:   'Turn to face',
    defend:  'Defend',
    wait:    'Wait',
};

export const FACINGS = ['toward_target', 'north', 'south', 'east', 'west'];
