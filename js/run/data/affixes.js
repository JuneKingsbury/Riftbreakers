// Elite affixes (js/content/affixes.js): which ones an elite fight's leader gets, and what
// they do to it in battle.
import { AFFIXES } from '../../content/affixes.js';
import { Rng } from '../rng.js';

export { AFFIXES };

/**
 * How many affixes a fight's leader gets: elites 1 in Acts 1 and 2, 2 in Acts 3 and 4, and
 * one more at Rift Tier VI.
 */
export function affixCount(kind, act, tier = 0) {
    if (kind !== 'elite') return 0;
    return (act >= 3 ? 2 : 1) + (tier >= 6 ? 1 : 0);
}

/**
 * The affixes for one fight, from its own stream of the run's seed (`index` tells the run's
 * fights apart), so rolling them never shifts the run's other rolls. Distinct, in roll order.
 * @returns {string[]} Affix keys; empty for normal and boss fights.
 */
export function rollAffixes(seed, index, kind, act, tier = 0) {
    const count = affixCount(kind, act, tier);
    if (count === 0) return [];
    const rng = new Rng(((seed ^ 0xAF1C5) + Math.imul(index + 1, 0x9E3779B1)) >>> 0);
    const pool = Object.keys(AFFIXES).filter(k => !AFFIXES[k].acts || AFFIXES[k].acts.includes(act));
    const out = [];
    while (out.length < count && pool.length) out.push(pool.splice(rng.int(pool.length), 1)[0]);
    return out;
}

/** Known affixes only (a save may name one that has since been removed). */
export function knownAffixes(keys) {
    return (keys ?? []).filter(k => Object.hasOwn(AFFIXES, k));
}

/** The leader's name with its affixes before it: "Thorned Hasted Bandit Captain". */
export function affixedName(name, keys) {
    const words = knownAffixes(keys).map(k => AFFIXES[k].name);
    return words.length ? `${words.join(' ')} ${name}` : name;
}
