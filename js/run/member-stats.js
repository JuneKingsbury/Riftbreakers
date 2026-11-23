// A party member's battle stats as the menus show them: the unit a battle would build, with
// equipment and relics included. Shared by the party menu and the equipment screen.
import { createUnitFromCharData } from '../tactical/units.js';
import { equipmentStatBonuses } from '../tactical/data/equipment.js';
import { relicStatMods } from './data/relics.js';
import { STATS as STAT_INFO } from '../content/vocab.js';

// The stats the menus list, in order, with their labels.
export const STATS = Object.entries(STAT_INFO).map(([key, s]) => [key, s.short]);

/** A stat's hover tip (a data-tip value): its name, then what it does. */
export const statTip = (key) => STAT_INFO[key] ? `${STAT_INFO[key].short}\n${STAT_INFO[key].desc}` : '';

function addMods(...mods) {
    const out = {};
    for (const m of mods) for (const [k, v] of Object.entries(m || {})) out[k] = (out[k] || 0) + v;
    return out;
}

/** The member as a battle unit would be built (equipment and relics included), for its stats. */
export function previewUnit(run, member) {
    return createUnitFromCharData({
        ...member,
        statMods: addMods(member.statMods, equipmentStatBonuses(member.appearance), relicStatMods(run.relics)),
    });
}

/**
 * How the member's stats change if `key` goes into `field` (null: the slot is emptied):
 * { before, after, delta } keyed by stat, over STATS.
 */
export function equipDelta(run, member, field, key) {
    const before = previewUnit(run, member);
    const after = previewUnit(run, { ...member, appearance: { ...member.appearance, [field]: key || null } });
    const delta = {};
    for (const [s] of STATS) delta[s] = (after[s] ?? 0) - (before[s] ?? 0);
    return { before, after, delta };
}
