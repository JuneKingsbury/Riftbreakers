// Unit triggers: "when this happens, do that to this unit". A unit's `triggers` come from
// the party's relics (build-units.js) and, later, from boss phases. Each is plain data:
//
//   on       'allyDown'   another unit of its side (not a summon or copy) is knocked out
//            'enemyDown'  a unit of the other side (not a summon or copy) is knocked out
//            'kill'       this unit knocked out a foe (not a summon or copy)
//            'hpBelow'    this unit's HP falls below `pct` of its max (once per battle)
//   pct      for hpBelow: the threshold, 0-1
//   once     fire at most once per battle (hpBelow always is)
//   status   { status, duration } given to the unit
//   healPct  heal the unit this fraction of its max HP
//   mp       MP restored
//   buffs    [{ stat, value, duration }] for the unit, refreshed rather than stacked
//   text     floating text (default: the label)
//   label    who it comes from, for the log and the battle breakdown (e.g. the relic's name)
//   id       unique per unit, so `once` can be tracked
// Boss phases (an encounter's `phases`, attached by build-units.js) add:
//   say      announced in the log and over the holder, with an alert
//   cleanse  the holder sheds its harmful statuses
//   allies   { status, buffs, healPct } for the holder's conscious allies
//   summon   [character entries] reinforcements placed near the holder (full units of its
//            side, not summons: they count as enemies in their own right)
//
// A relic gives every member the same trigger, each affecting only its holder. Triggers
// fire only for conscious holders.
import { inflictStatus, cleanseStatuses } from './abilities.js';
import { isConscious, createUnitFromCharData, faceToward } from './units.js';
import { JOB_STATS } from './data-registry.js';
import { getCell, posKey } from './battle-map.js';

// A copy (Mirror Image) or a summoned creature falling doesn't count as a unit going down.
function counts(unit) {
    return unit.summonerId == null && !JOB_STATS[unit.job]?.inert;
}

// The status, healing, MP and buffs of an effect, on one unit.
function applyEffects(battle, unit, t, fx, key) {
    if (fx.status && inflictStatus(unit, fx.status.status, fx.status.duration ?? 3)) {
        battle._emit?.('status', { source: unit, target: unit, status: fx.status.status, ability: null });
    }
    if (fx.healPct) {
        const amt = Math.min(unit.maxHp - unit.hp, Math.max(1, Math.round(unit.maxHp * fx.healPct)));
        if (amt > 0) {
            unit.hp += amt;
            battle.stats?.heal(unit, unit, amt, key);
            battle._spawnFloat?.(unit, `+${amt}`, '#8f8');
        }
    }
    if (fx.mp) unit.mp = Math.min(unit.maxMp, unit.mp + fx.mp);
    if (fx.buffs?.length) {
        const tag = `trigger:${t.id}`;
        unit.buffs = (unit.buffs || []).filter(b => b.key !== tag);
        for (const b of fx.buffs) unit.buffs.push({ key: tag, ...b });
    }
}

// Free standing cells near `unit`, nearest first.
function freeCellsNear(battle, unit, radius = 3) {
    const taken = new Set(battle.units.filter(u => !u.status.includes('dead')).map(posKey));
    const out = [];
    for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
            const d = Math.abs(dx) + Math.abs(dy);
            if (d === 0 || d > radius) continue;
            const cell = getCell(battle.map, unit.x + dx, unit.y + dy);
            if (cell?.passable && !taken.has(posKey(cell))) out.push({ cell, d });
        }
    }
    return out.sort((a, b) => a.d - b.d || a.cell.y - b.cell.y || a.cell.x - b.cell.x).map(c => c.cell);
}

/**
 * Puts new units into the battle on free cells near `near`, nearest first: each made by
 * `make(cell)`. They are full units (not summons). Returns the units placed; fewer than asked
 * when there is no room.
 */
export function placeNear(battle, near, count, make, verb = 'joins the fight') {
    const cells = freeCellsNear(battle, near);
    const placed = [];
    for (let i = 0; i < count; i++) {
        const cell = cells.shift();
        if (!cell) break;
        const u = make(cell);
        u.z = cell.z;
        faceToward(u, near.x, near.y);
        battle.units.push(u);
        battle.stats?.track([u]);
        battle.logMsg?.(`${u.name} ${verb}!`);
        battle._emit?.('summon', { source: near, unit: u, ability: null });
        placed.push(u);
    }
    return placed;
}

// Reinforcements: full units of the holder's side, placed near it.
function callReinforcements(battle, holder, entries) {
    let i = 0;
    placeNear(battle, holder, entries.length, (cell) => {
        const entry = entries[i++];
        const u = createUnitFromCharData({ ...entry, team: holder.team, x: cell.x, y: cell.y, ct: entry.ct ?? 0 });
        if (entry.baseName) u.spriteName = entry.baseName;
        return u;
    });
}

/**
 * Applies one trigger's effects to its holder (and, for a boss phase, its allies).
 * @param {import('./battle.js').TacticalBattle} battle
 */
export function fireTrigger(battle, unit, t) {
    unit._triggered = unit._triggered || new Set();
    if ((t.once || t.on === 'hpBelow') && unit._triggered.has(t.id)) return false;
    unit._triggered.add(t.id);
    const key = `fx:${t.label}`;
    if (t.say) {
        battle.logMsg?.(t.say);
        battle._emit?.('phase', { source: unit, text: t.say });
    }
    if (t.cleanse) cleanseStatuses(unit);
    applyEffects(battle, unit, t, t, key);
    if (t.allies) {
        for (const a of battle.livingUnits) {
            if (a !== unit && a.team === unit.team && isConscious(a)) applyEffects(battle, a, t, t.allies, key);
        }
    }
    if (t.summon?.length) callReinforcements(battle, unit, t.summon);
    if (!t.say) battle.logMsg?.(`${unit.name}: ${t.label}!`);
    battle._spawnFloat?.(unit, t.text ?? t.label, '#ffd866');
    return true;
}

/** A unit was knocked out by `source` (null: no one, e.g. Doom). Fires down and kill triggers. */
export function onUnitDown(battle, fallen, source) {
    if (!counts(fallen)) return;
    for (const u of battle.livingUnits) {
        if (!u.triggers?.length || !isConscious(u)) continue;
        for (const t of u.triggers) {
            if ((t.on === 'allyDown' && u.team === fallen.team && u !== fallen)
                || (t.on === 'enemyDown' && u.team !== fallen.team)
                || (t.on === 'kill' && u === source && u.team !== fallen.team)) {
                fireTrigger(battle, u, t);
            }
        }
    }
}

/** A unit lost HP: fires its hpBelow triggers whose threshold it has now fallen under. */
export function checkHpTriggers(battle, unit) {
    if (!unit?.triggers?.length || !isConscious(unit)) return;
    for (const t of unit.triggers) {
        if (t.on === 'hpBelow' && unit.hp < unit.maxHp * t.pct) fireTrigger(battle, unit, t);
    }
}
