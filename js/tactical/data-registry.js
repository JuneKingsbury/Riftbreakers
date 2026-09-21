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

// Player jobs have a `desc` field; enemy jobs do not.
export function isPlayerJob(jobKey) {
    return !!JOB_DATA[jobKey]?.desc;
}

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

// Returns a merged stat-bonus object for every job the character has mastered (Lv.8).
// Keys are stat names; values are the summed bonuses across all mastered jobs.
export function masteryStatBonus(xpMap) {
    const result = {};
    for (const [jobKey, jobDef] of Object.entries(JOB_DATA)) {
        if (!jobDef.masteryBonus) continue;
        if (jobLevel(xpMap, jobKey) < 8) continue;
        for (const [stat, val] of Object.entries(jobDef.masteryBonus)) {
            result[stat] = (result[stat] || 0) + val;
        }
    }
    return result;
}

// Returns all ability keys the character has unlocked in jobs OTHER than currentJob.
// Used to populate the cross-job skill slot picker.
export function crossJobUnlockedAbilities(xpMap, currentJob) {
    const currentJobAbilities = new Set(JOB_DATA[currentJob]?.abilities || []);
    const result = [];
    for (const jobKey of Object.keys(JOB_DATA)) {
        if (jobKey === currentJob) continue;
        // Only player jobs the character has actually experienced.
        if (!xpMap[jobKey] || xpMap[jobKey] <= 0) continue;
        const abilities = unlockedAbilities(jobKey, xpMap);
        for (const abilityKey of abilities) {
            if (abilityKey === 'attack') continue;
            // Skip abilities that are already part of the current job's kit.
            if (currentJobAbilities.has(abilityKey)) continue;
            if (!result.includes(abilityKey)) result.push(abilityKey);
        }
    }
    return result;
}

// Returns the Set of allowed equipment types for a given slot on a job, or null if unrestricted.
// Tier 2 jobs use the union of both prerequisites' allowed types, plus any equipmentExpansions.
export function allowedEquipTypes(jobKey, slot) {
    const job = JOB_DATA[jobKey];
    if (!job) return null;

    // No allowedEquipment and no prerequisites = unrestricted (Novice, enemy jobs)
    const prereqs = job.prerequisites || [];
    if (!job.allowedEquipment && prereqs.length === 0) return null;

    // Tier 1 (or any job with explicit allowedEquipment): use it directly
    if (job.allowedEquipment) {
        const types = new Set(job.allowedEquipment[slot] || []);
        for (const t of (job.equipmentExpansions?.[slot] || [])) types.add(t);
        return types.size > 0 ? types : null;
    }

    // Tier 2: union of prerequisites
    const union = new Set();
    for (const p of prereqs) {
        const types = allowedEquipTypes(p.job, slot);
        if (types === null) return null; // prereq is unrestricted → so is this
        for (const t of types) union.add(t);
    }
    for (const t of (job.equipmentExpansions?.[slot] || [])) union.add(t);
    return union.size > 0 ? union : null;
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
