// Relics: party-wide modifiers found during a run. The relics themselves are in
// js/content/relics.js; these helpers add up what a party's relics do.
import { RELICS } from '../../content/relics.js';

export { RELICS };

// Combined statMods of a list of relic keys.
export function relicStatMods(relics) {
    const out = {};
    for (const key of relics || []) {
        for (const [k, v] of Object.entries(RELICS[key]?.statMods || {})) out[k] = (out[k] || 0) + v;
    }
    return out;
}

// Product of a numeric multiplier field across relics (e.g. 'jpMult').
export function relicMult(relics, field) {
    return (relics || []).reduce((m, key) => m * (RELICS[key]?.[field] ?? 1), 1);
}

export function relicsWith(relics, field) {
    return (relics || []).filter(key => RELICS[key]?.[field] != null);
}
