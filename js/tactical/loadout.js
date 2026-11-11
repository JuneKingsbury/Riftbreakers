// Job points and ability loadouts (FFT-style). Pure functions over a party
// member record, shared by the Party menu, unit building and the script editor.
//
// Member fields:
//   job      string   Current job; its skillset is always Ability slot 1
//   jp       object   jobKey → total JP earned (drives job level, never decreases)
//   jpSpent  object   jobKey → JP spent learning that job's abilities
//   learned  string[] Ability keys learned in any job
//   loadout  { secondary, reaction, support, movement }
//            secondary: jobKey whose skillset fills Ability slot 2
import { ABILITIES, meetsPrerequisites, JP_THRESHOLDS } from './data-registry.js';
import { JOB_DATA } from './data/jobs.js';

export const LOADOUT_SLOTS = ['reaction', 'support', 'movement'];

export function abilitySlot(key) {
    return ABILITIES[key]?.slot ?? 'action';
}

export function availableJp(member, job) {
    return ((member.jp || {})[job] || 0) - ((member.jpSpent || {})[job] || 0);
}

export function isLearned(member, key) {
    return (member.learned || []).includes(key);
}

export function canLearn(member, job, key) {
    const cost = JOB_DATA[job]?.learnable?.[key];
    if (cost == null || isLearned(member, key)) return false;
    if (!meetsPrerequisites(member.jp, job)) return false;
    return availableJp(member, job) >= cost;
}

// Spends `job`'s JP to learn `key`. Returns false if it can't be learned.
export function learnAbility(member, job, key) {
    if (!canLearn(member, job, key)) return false;
    member.jpSpent = member.jpSpent || {};
    member.jpSpent[job] = (member.jpSpent[job] || 0) + JOB_DATA[job].learnable[key];
    member.learned = [...(member.learned || []), key];
    return true;
}

// The learned action abilities in a job's skillset, in the job's listed order.
export function skillsetFor(member, job) {
    return Object.keys(JOB_DATA[job]?.learnable || {})
        .filter(k => abilitySlot(k) === 'action' && isLearned(member, k));
}

// Options for a loadout slot. For 'secondary': unlocked jobs other than the current
// one with at least one learned action ability (learning is shared across jobs, so
// Fire learned as a Novice also counts toward Evocation). Otherwise: learned
// abilities of that slot.
export function equippable(member, slot) {
    if (slot === 'secondary') {
        return Object.keys(JOB_DATA)
            .filter(j => JOB_DATA[j].skillsetName && j !== member.job
                && meetsPrerequisites(member.jp, j) && skillsetFor(member, j).length > 0);
    }
    return (member.learned || []).filter(k => abilitySlot(k) === slot);
}

// Drops loadout entries that are no longer valid (e.g. after a job change).
export function sanitizeLoadout(member) {
    const lo = member.loadout = { secondary: null, reaction: null, support: null, movement: null, ...(member.loadout || {}) };
    if (lo.secondary && !equippable(member, 'secondary').includes(lo.secondary)) lo.secondary = null;
    for (const slot of LOADOUT_SLOTS) {
        if (lo[slot] && !equippable(member, slot).includes(lo[slot])) lo[slot] = null;
    }
    return lo;
}

// Everything a unit built from this member fights with.
export function buildLoadout(member) {
    const lo = member.loadout || {};
    const skillsets = [member.job, lo.secondary]
        .filter(j => j && JOB_DATA[j]?.skillsetName)
        .filter((j, i, arr) => arr.indexOf(j) === i)
        .map(j => ({ job: j, name: JOB_DATA[j].skillsetName, abilities: skillsetFor(member, j) }));
    const abilities = ['attack'];
    for (const s of skillsets) {
        for (const k of s.abilities) if (!abilities.includes(k)) abilities.push(k);
    }
    for (const k of member.extraAbilities || []) if (!abilities.includes(k)) abilities.push(k);
    const slotted = (slot) => (lo[slot] && isLearned(member, lo[slot]) && abilitySlot(lo[slot]) === slot) ? lo[slot] : null;
    return {
        abilities,
        skillsets,
        reaction: slotted('reaction'),
        support:  slotted('support'),
        movement: slotted('movement'),
    };
}

// Loadout for a non-party unit (e.g. an enemy) using a player job at job level
// `level`. It gets the JP a player would have earned in that job by that level
// (at least the 100 the party starts with) and spends it like a player would:
// cheapest action abilities first, then reaction/support/movement. Like the
// party's starting ability, the cheapest action is free. Each slot gets the
// strongest (most expensive) ability it learned.
export function scaledLoadout(job, level = 1) {
    const learnable = JOB_DATA[job]?.learnable || {};
    const lv = Math.max(1, Math.min(level, JP_THRESHOLDS.length - 1));
    let budget = Math.max(100, JP_THRESHOLDS[lv]);
    const byCost = (keys) => keys.sort((a, b) => learnable[a] - learnable[b]);
    const keys = Object.keys(learnable);
    const order = [
        ...byCost(keys.filter(k => abilitySlot(k) === 'action')),
        ...byCost(keys.filter(k => abilitySlot(k) !== 'action')),
    ];
    const learned = order.length ? [order.shift()] : [];
    for (const k of order) {
        if (learnable[k] > budget) continue;
        budget -= learnable[k];
        learned.push(k);
    }
    const loadout = { secondary: null, reaction: null, support: null, movement: null };
    for (const k of learned) {
        const slot = abilitySlot(k);
        if (slot !== 'action' && (!loadout[slot] || learnable[k] > learnable[loadout[slot]])) loadout[slot] = k;
    }
    return buildLoadout({ job, learned, loadout });
}

// JP a unit earns for one action in its current job.
export function jpPerAction(jobLv) {
    return 8 + 2 * jobLv;
}

// Fraction of an action's JP shared with every other party member in that job.
export const JP_SPILLOVER = 0.25;
