// Levels, skill points and ability loadouts. Pure functions over a party member
// record, shared by the Party menu, unit building and the script editor.
//
// Member fields:
//   job       string   Current job: a Tier 1 role, or the Tier 2 job it promoted into
//   origin    string|null  The Tier 1 job a promoted member came from (null before promotion)
//   level     number   Character level (1+). Each level gives a skill point and a little HP/MP
//   xp        number   XP toward the next level (XP_PER_LEVEL per level)
//   sp        number   Unspent skill points
//   learned   string[] Ability keys learned with skill points (base keys, no rank)
//   ranks     object   ability key → rank (2..MAX_RANK) for upgraded skills; absent = rank I
//   loadout   { reaction, support, movement } (base keys)
//   appearance  Equipped items (armorKey, ...) also grant abilities, see data/equipment.js:
//               actions join the skill list, passives are active on top of the chosen slots
import { ABILITIES, MAX_RANK, rankedKey, isUpgradeable } from './data-registry.js';
import { JOB_DATA } from './data/jobs.js';
import { equipmentGrants } from './data/equipment.js';

export const LOADOUT_SLOTS = ['reaction', 'support', 'movement'];

export const XP_PER_LEVEL = 100;

// Level a Tier 1 member must reach before promoting.
export const PROMOTION_LEVEL = 5;

// Stat growth from levels, on top of the job's base stats.
export function levelStatMods(level = 1) {
    const n = Math.max(0, level - 1);
    return n ? { maxHp: 2 * n, maxMp: n } : {};
}

// Adds XP; every XP_PER_LEVEL levels the member up and grants a skill point.
// Returns the number of levels gained.
export function addXp(member, amount) {
    member.level = member.level || 1;
    member.xp = (member.xp || 0) + Math.max(0, Math.round(amount));
    let gained = 0;
    while (member.xp >= XP_PER_LEVEL) {
        member.xp -= XP_PER_LEVEL;
        member.level += 1;
        member.sp = (member.sp || 0) + 1;
        gained += 1;
    }
    return gained;
}

export function abilitySlot(key) {
    return ABILITIES[key]?.slot ?? 'action';
}

export function isLearned(member, key) {
    return (member.learned || []).includes(key);
}

// The jobs whose skillsets a member draws from: [origin, job] once promoted, else [job].
export function memberJobs(member) {
    return [member.origin, member.job].filter(j => j && JOB_DATA[j]?.learnable);
}

// Everything the member could learn: ability key → { sp, requires }.
export function learnableFor(member) {
    const out = {};
    for (const j of memberJobs(member)) Object.assign(out, JOB_DATA[j].learnable);
    return out;
}

// Why a skill can't be learned yet: null when it can, else a short reason.
export function learnBlocker(member, key) {
    const def = learnableFor(member)[key];
    if (!def) return 'not in this kit';
    if (isLearned(member, key)) return 'learned';
    if (def.requires && !isLearned(member, def.requires)) return `needs ${ABILITIES[def.requires]?.name ?? def.requires}`;
    if ((member.sp || 0) < def.sp) return `${def.sp} SP`;
    return null;
}

export function canLearn(member, key) {
    return learnBlocker(member, key) === null;
}

// Spends skill points to learn `key`. Returns false if it can't be learned.
export function learnAbility(member, key) {
    if (!canLearn(member, key)) return false;
    member.sp -= learnableFor(member)[key].sp;
    member.learned = [...(member.learned || []), key];
    return true;
}

export function skillRank(member, key) {
    return member.ranks?.[key] ?? 1;
}

// SP to take a learned skill to its next rank: 1 for rank II, 2 for rank III.
export function upgradeCost(member, key) {
    return skillRank(member, key);
}

export function canUpgrade(member, key) {
    return isLearned(member, key) && isUpgradeable(key) && skillRank(member, key) < MAX_RANK
        && (member.sp || 0) >= upgradeCost(member, key);
}

export function upgradeAbility(member, key) {
    if (!canUpgrade(member, key)) return false;
    member.sp -= upgradeCost(member, key);
    member.ranks = { ...(member.ranks || {}), [key]: skillRank(member, key) + 1 };
    return true;
}

// Anything this member could spend skill points on right now.
export function canSpendPoints(member) {
    if (!(member.sp > 0)) return false;
    return Object.keys(learnableFor(member)).some(k => canLearn(member, k) || canUpgrade(member, k));
}

export function canPromote(member) {
    return !member.origin && JOB_DATA[member.job]?.tier === 1 && (member.level || 1) >= PROMOTION_LEVEL;
}

export function promotionOptions(member) {
    return member.origin ? [] : [...(JOB_DATA[member.job]?.promotions || [])];
}

// Promotes a Tier 1 member into one of its Tier 2 jobs. Learned skills are kept.
export function promote(member, job) {
    if (!canPromote(member) || !promotionOptions(member).includes(job)) return false;
    member.origin = member.job;
    member.job = job;
    return true;
}

// The learned action abilities in a job's skillset, in the job's listed order, at their ranks.
export function skillsetFor(member, job) {
    return Object.keys(JOB_DATA[job]?.learnable || {})
        .filter(k => abilitySlot(k) === 'action' && isLearned(member, k))
        .map(k => rankedKey(k, skillRank(member, k)));
}

// Options for a loadout slot: the learned abilities of that slot. (Passives granted by
// equipment don't take a slot: they are active on top, see buildLoadout.)
export function equippable(member, slot) {
    return (member.learned || []).filter(k => abilitySlot(k) === slot);
}

// Drops loadout entries that are no longer valid.
export function sanitizeLoadout(member) {
    const lo = member.loadout = { reaction: null, support: null, movement: null, ...(member.loadout || {}) };
    for (const slot of LOADOUT_SLOTS) {
        if (lo[slot] && !equippable(member, slot).includes(lo[slot])) lo[slot] = null;
    }
    return lo;
}

// Everything a unit built from this member fights with. Upgraded skills appear at their rank.
export function buildLoadout(member) {
    const lo = member.loadout || {};
    const skillsets = memberJobs(member)
        .map(j => ({ job: j, name: JOB_DATA[j].skillsetName, abilities: skillsetFor(member, j) }));
    const grants = equipmentGrants(member.appearance);
    const abilities = ['attack'];
    const add = (k) => { if (!abilities.some(a => a.split('@')[0] === k.split('@')[0])) abilities.push(k); };
    for (const s of skillsets) s.abilities.forEach(add);
    grants.actions.forEach(add);
    (member.extraAbilities || []).forEach(add);
    const slotted = (slot) => {
        const k = lo[slot];
        if (!k || !equippable(member, slot).includes(k)) return null;
        return rankedKey(k, skillRank(member, k));
    };
    const reaction = slotted('reaction'), support = slotted('support'), movement = slotted('movement');
    // Equipment passives are always on, on top of the chosen slots (a skill already in its
    // slot isn't counted twice).
    const chosen = [reaction, support, movement].filter(Boolean).map(k => k.split('@')[0]);
    const bonusPassives = grants.passives.filter(k => !chosen.includes(k));
    return { abilities, skillsets, reaction, support, movement, bonusPassives };
}

// Loadout for a non-party unit (e.g. an enemy) using a player job at `level`. Like a
// recruit it knows the job's first skill, and spends level - 1 skill points the way a
// player might: cheapest skills first, in kit order, honouring prerequisites. Each
// slot gets the most expensive passive it learned.
export function scaledLoadout(job, level = 1) {
    const learnable = JOB_DATA[job]?.learnable || {};
    const keys = Object.keys(learnable);
    const learned = keys.length ? [keys[0]] : [];
    let budget = Math.max(0, level - 1);
    const order = [
        ...keys.filter(k => abilitySlot(k) === 'action'),
        ...keys.filter(k => abilitySlot(k) !== 'action'),
    ].sort((a, b) => learnable[a].sp - learnable[b].sp);
    for (let progress = true; progress;) {
        progress = false;
        for (const k of order) {
            const def = learnable[k];
            if (learned.includes(k) || def.sp > budget) continue;
            if (def.requires && !learned.includes(def.requires)) continue;
            budget -= def.sp;
            learned.push(k);
            progress = true;
        }
    }
    const loadout = { reaction: null, support: null, movement: null };
    for (const k of learned) {
        const slot = abilitySlot(k);
        if (slot !== 'action' && (!loadout[slot] || learnable[k].sp > learnable[loadout[slot]].sp)) loadout[slot] = k;
    }
    return buildLoadout({ job, learned, loadout });
}

// True for a party-member record (it has a learned list), as opposed to a fixed-kit character.
export function isPartyMember(charData) {
    return Array.isArray(charData?.learned);
}
