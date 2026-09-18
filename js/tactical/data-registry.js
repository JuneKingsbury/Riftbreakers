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

// XP required to reach each level. Index = level, so XP_THRESHOLDS[2] is the
// XP needed for level 2. Level 1 is the starting level (0 XP required).
export const XP_THRESHOLDS = [0, 0, 100, 250, 500, 900, 1400, 2100, 3000];

// Returns the level (1-based) a character has reached in a given job.
export function jobLevel(xpMap, jobKey) {
    const xp = (xpMap || {})[jobKey] || 0;
    let level = 1;
    for (let l = XP_THRESHOLDS.length - 1; l >= 2; l--) {
        if (xp >= XP_THRESHOLDS[l]) { level = l; break; }
    }
    return level;
}

// Returns true if the character's xpMap satisfies all prerequisites for jobKey.
export function meetsPrerequisites(xpMap, jobKey) {
    const prereqs = JOB_DATA[jobKey]?.prerequisites;
    if (!prereqs || prereqs.length === 0) return true;
    return prereqs.every(p => jobLevel(xpMap, p.job) >= p.level);
}

// Returns the subset of a job's abilities that are unlocked at the character's current job level.
// Uses JOB_DATA (raw) so abilityLevels is never lost to inheritance resolution.
export function unlockedAbilities(jobKey, xpMap) {
    const job = JOB_DATA[jobKey];
    if (!job) return [];
    const lv = jobLevel(xpMap, jobKey);
    const levels = job.abilityLevels || {};
    return (job.abilities || []).filter(k => (levels[k] ?? 1) <= lv);
}

// Returns a human-readable string of unmet prerequisites, e.g. "Evoker Lv.3, Warden Lv.3".
export function missingPrerequisites(xpMap, jobKey) {
    const prereqs = JOB_DATA[jobKey]?.prerequisites || [];
    return prereqs
        .filter(p => jobLevel(xpMap, p.job) < p.level)
        .map(p => {
            const label = p.job.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            return `${label} Lv.${p.level}`;
        })
        .join(', ');
}
