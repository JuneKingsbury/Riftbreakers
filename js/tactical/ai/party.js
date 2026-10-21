// A party member's usable abilities, computed the same way BattleScene's
// buildUnits does it, so the editor offers exactly what the character will
// have in battle after any class, support-skill or XP change from the Party menu.
import { JOB_STATS, unlockedAbilities } from '../data-registry.js';

// member: a worldMap.party entry (or CHARACTER_DATA entry) with job, xp,
// extraAbilities, supportSkill, supportPassive.
export function abilitiesForMember(member) {
    const base = JOB_STATS[member.job]?.abilities ?? [];
    const extra = [...(member.extraAbilities ?? [])];
    if (member.supportSkill) extra.push(member.supportSkill);
    if (member.supportPassive) extra.push(member.supportPassive);
    let abilities = [...base, ...extra];

    // With XP data, only abilities unlocked at the current job level count.
    // The two cross-job slots were validated when the player picked them.
    if (member.xp) {
        const unlocked = new Set(unlockedAbilities(member.job, member.xp));
        const crossSlots = new Set([member.supportSkill, member.supportPassive].filter(Boolean));
        abilities = abilities.filter(k => unlocked.has(k) || crossSlots.has(k));
    }
    return abilities;
}
