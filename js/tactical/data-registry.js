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

// ---- Skill ranks ----
// Learned action skills and reactions can be upgraded to rank II and III with skill
// points. Each rank is its own ability entry, keyed `<key>@<rank>` (e.g. 'fire@2'),
// so the battle engine needs nothing special: a unit simply carries the ranked key.
// Per rank: +20% power, -15% MP cost, +10% reaction chance, +25% buff/debuff size,
// and rank III adds a turn to any status it inflicts.
export const MAX_RANK = 3;
const RANK_NUMERAL = ['', 'I', 'II', 'III'];

export function baseKey(key) {
    return typeof key === 'string' ? key.split('@')[0] : key;
}

export function rankOf(key) {
    return Number(String(key).split('@')[1] || 1);
}

export function rankedKey(key, rank = 1) {
    return rank > 1 ? `${baseKey(key)}@${rank}` : baseKey(key);
}

// Can this ability be upgraded? Actions and reactions can; supports and movement can't.
export function isUpgradeable(key) {
    const ab = ABILITIES[baseKey(key)];
    return !!ab && ['action', 'reaction'].includes(ab.slot ?? 'action') && key !== 'attack';
}

function rankedEntry(ab, rank) {
    const step = rank - 1;
    const out = { ...ab, name: `${ab.name} ${RANK_NUMERAL[rank]}`, rank };
    if (ab.basePower) out.basePower = Math.round(ab.basePower * (1 + 0.2 * step) * 100) / 100;
    if (ab.mpCost) out.mpCost = Math.max(1, Math.round(ab.mpCost * (1 - 0.15 * step)));
    if (ab.chance != null) out.chance = Math.min(1, ab.chance + 0.1 * step);
    if (ab.applyStatus && ab.statusDuration && rank === MAX_RANK) out.statusDuration = ab.statusDuration + 1;
    if (ab.buffs) out.buffs = ab.buffs.map(b => ({ ...b, value: Math.round(b.value * (1 + 0.25 * step)) || b.value }));
    return out;
}

for (const [key, ab] of Object.entries({ ...ABILITIES })) {
    if (!isUpgradeable(key)) continue;
    for (let r = 2; r <= MAX_RANK; r++) ABILITIES[rankedKey(key, r)] = rankedEntry(ab, r);
}

// The key a unit actually carries for an ability, whatever its rank (or null if it lacks it).
export function ownKey(unit, key) {
    if (!key || !unit?.abilities) return null;
    if (unit.abilities.includes(key)) return key;
    const base = baseKey(key);
    return unit.abilities.find(k => baseKey(k) === base) ?? null;
}
export const JOB_STATS = buildTable(JOB_DATA);

// Player jobs have a `desc` field; enemy jobs do not.
export function isPlayerJob(jobKey) {
    return !!JOB_DATA[jobKey]?.desc;
}

// Player jobs of a tier (1 = starting roles, 2 = promotions), in JOB_DATA order.
export function jobsOfTier(tier) {
    return Object.keys(JOB_DATA).filter(j => JOB_DATA[j].tier === tier);
}

// Tier 2 job → the Tier 1 jobs that promote into it.
export const PROMOTES_FROM = {};
for (const [key, job] of Object.entries(JOB_DATA)) {
    for (const t2 of job.promotions || []) (PROMOTES_FROM[t2] = PROMOTES_FROM[t2] || []).push(key);
}

// Returns the Set of allowed equipment types for a given slot on a job, or null if unrestricted.
// A Tier 2 job keeps the types of the Tier 1 job it was promoted from (`origin`), or the union of
// every Tier 1 job that promotes into it when no origin is given, plus its equipmentExpansions.
export function allowedEquipTypes(jobKey, slot, origin = null) {
    const job = JOB_DATA[jobKey];
    if (!job) return null;

    if (job.allowedEquipment) {
        const types = new Set(job.allowedEquipment[slot] || []);
        for (const t of (job.equipmentExpansions?.[slot] || [])) types.add(t);
        return types.size > 0 ? types : null;
    }

    const parents = origin ? [origin] : (PROMOTES_FROM[jobKey] || []);
    if (parents.length === 0) return null;   // Novice and enemy jobs are unrestricted
    const union = new Set();
    for (const p of parents) {
        const types = allowedEquipTypes(p, slot);
        if (types === null) return null;
        for (const t of types) union.add(t);
    }
    for (const t of (job.equipmentExpansions?.[slot] || [])) union.add(t);
    return union.size > 0 ? union : null;
}
