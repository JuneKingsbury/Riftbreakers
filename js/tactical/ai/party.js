// A party member's usable abilities, computed the same way BattleScene's
// buildUnits does it, so the editor offers exactly what the character will
// have in battle after any job, loadout or JP change from the Party menu.
import { buildLoadout, isPartyMember } from '../loadout.js';
import { JOB_STATS } from '../data-registry.js';

// member: a run party entry (or CHARACTER_DATA entry). Party members use their
// loadout (learned skills and equipment grants); anything else falls back to the job's fixed list.
export function abilitiesForMember(member) {
    if (isPartyMember(member)) return buildLoadout(member).abilities;
    return [...(JOB_STATS[member.job]?.abilities ?? []), ...(member.extraAbilities ?? [])];
}
