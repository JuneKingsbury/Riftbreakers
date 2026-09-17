// Resolves `extends` inheritance chains and exports the final lookup tables
// that the rest of the engine consumes.
//
// Both ABILITY_DATA and JOB_DATA entries may include an `extends` key pointing
// to another entry in the same table. Inheritance is single-parent and shallow:
// the child's explicit fields take priority; the parent fills in everything else.
// Chains are resolved recursively up to 10 levels deep.

import { ABILITY_DATA } from './data/abilities.js';
import { JOB_DATA }     from './data/jobs.js';

function resolveEntry(key, table, depth = 0) {
    if (depth > 10) throw new Error(`data-registry: inheritance chain too deep at "${key}"`);
    const entry = table[key];
    if (!entry) throw new Error(`data-registry: unknown key "${key}"`);
    if (!entry.extends) return { ...entry };
    const parent = resolveEntry(entry.extends, table, depth + 1);
    const { extends: _, ...rest } = entry;
    // Arrays (like `abilities`) from the child fully replace the parent's array.
    return { ...parent, ...rest };
}

function buildTable(rawData) {
    const result = {};
    for (const key of Object.keys(rawData)) {
        result[key] = resolveEntry(key, rawData);
    }
    return result;
}

export const ABILITIES = buildTable(ABILITY_DATA);
export const JOB_STATS = buildTable(JOB_DATA);
