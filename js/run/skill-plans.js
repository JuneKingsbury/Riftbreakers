// Skill plans: for each class, an ordered list of skills to learn and upgrade. When a class's
// plan has auto-allocate on, its members spend skill points on the plan as soon as they can
// afford the next step. Plans belong to the player, not to a run: they are stored in
// localStorage (separate from the run save and profile) and travel with save exports.
//
// A plan is { auto: boolean, steps: Step[] }, where a Step is { learn: key } or
// { upgrade: key }. The n-th upgrade step for a skill takes it to rank n + 1.
//
// Rules (autoAllocate):
// - Strict order. When the next step costs more than the member has, the member saves up:
//   later, cheaper steps wait too.
// - A promoted member first finishes what is left of their starting class's plan, then
//   follows the promoted class's plan. A plan with auto off is passed over.
// - Steps already done (bought by hand, or a recruit's starting skill) count as done.
import { JOB_DATA } from '../tactical/data/jobs.js';
import { MAX_RANK, isUpgradeable, ABILITIES } from '../tactical/data-registry.js';
import { isLearned, skillRank, canLearn, canUpgrade, learnAbility, upgradeAbility } from '../tactical/loadout.js';
import { defaultStorage } from './profile.js';
import { notifySaved } from './save-events.js';

export const PLANS_KEY = 'riftbreak.skillplans.v1';

/** Classes that can have a plan: every job with a skill kit (tier 1 and tier 2). */
export function plannableJobs() {
    return Object.keys(JOB_DATA).filter(j => [1, 2].includes(JOB_DATA[j].tier) && JOB_DATA[j].learnable);
}

const kitOf = (job) => JOB_DATA[job]?.learnable ?? {};

/** SP a step costs at its place in the plan (an upgrade to rank r costs r - 1). */
function stepCosts(job, steps) {
    const kit = kitOf(job), ups = {};
    return steps.map(s => {
        if (s.learn) return kit[s.learn].sp;
        ups[s.upgrade] = (ups[s.upgrade] || 0) + 1;
        return ups[s.upgrade];
    });
}

/**
 * Cleans one class's step list: only skills from that class's kit, each learned once and
 * after its prerequisite, upgrades only after the learn and at most up to MAX_RANK.
 */
export function sanitizeSteps(job, steps) {
    const kit = kitOf(job);
    const learned = new Set(), ups = {}, out = [];
    for (const s of Array.isArray(steps) ? steps : []) {
        if (!s || typeof s !== 'object') continue;
        if (typeof s.learn === 'string' && Object.hasOwn(kit, s.learn)) {
            const def = kit[s.learn];
            if (learned.has(s.learn) || (def.requires && !learned.has(def.requires))) continue;
            learned.add(s.learn);
            out.push({ learn: s.learn });
        } else if (typeof s.upgrade === 'string' && Object.hasOwn(kit, s.upgrade)) {
            const k = s.upgrade;
            if (!learned.has(k) || !isUpgradeable(k) || (ups[k] || 0) >= MAX_RANK - 1) continue;
            ups[k] = (ups[k] || 0) + 1;
            out.push({ upgrade: k });
        }
    }
    return out;
}

/** Cleans a whole plans object, so damaged or hand-edited data can't break the game. */
export function sanitizePlans(raw) {
    const out = {};
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
    for (const job of plannableJobs()) {
        if (!Object.hasOwn(raw, job)) continue;
        const p = raw[job];
        if (!p || typeof p !== 'object') continue;
        const steps = sanitizeSteps(job, p.steps);
        if (steps.length || p.auto === true) out[job] = { auto: p.auto === true, steps };
    }
    return out;
}

export function loadPlans(storage = defaultStorage()) {
    try {
        const raw = storage?.getItem(PLANS_KEY);
        return raw ? sanitizePlans(JSON.parse(raw)) : {};
    } catch { return {}; }
}

/** Saves plans. Returns false (instead of throwing) when storage is missing or full. */
export function savePlans(plans, storage = defaultStorage()) {
    if (!storage) return false;
    try {
        storage.setItem(PLANS_KEY, JSON.stringify(sanitizePlans(plans)));
        notifySaved();
        return true;
    } catch { return false; }
}

/** The number of classes with a non-empty plan. */
export function planCount(plans) {
    return Object.values(plans || {}).filter(p => p.steps.length).length;
}

/** Steps with their costs and target ranks: [{ step, cost, rank }]. */
export function describeSteps(job, steps) {
    const costs = stepCosts(job, steps), ups = {};
    return steps.map((step, i) => {
        let rank = 1;
        if (step.upgrade) rank = (ups[step.upgrade] = (ups[step.upgrade] || 1) + 1);
        return { step, cost: costs[i], rank };
    });
}

/** Total SP a plan costs. */
export function planCost(job, steps) {
    return stepCosts(job, steps).reduce((a, b) => a + b, 0);
}

/** Steps that may be added to the end of a plan next: [{ step, cost, rank }]. */
export function stepOptions(job, steps) {
    const kit = kitOf(job), out = [];
    const learned = new Set(steps.filter(s => s.learn).map(s => s.learn));
    const ups = {};
    for (const s of steps) if (s.upgrade) ups[s.upgrade] = (ups[s.upgrade] || 0) + 1;
    for (const [key, def] of Object.entries(kit)) {
        if (!learned.has(key) && (!def.requires || learned.has(def.requires))) out.push({ step: { learn: key }, cost: def.sp, rank: 1 });
    }
    for (const key of Object.keys(kit)) {
        const n = ups[key] || 0;
        if (learned.has(key) && isUpgradeable(key) && n < MAX_RANK - 1) out.push({ step: { upgrade: key }, cost: n + 1, rank: n + 2 });
    }
    return out;
}

/** Whether a member has already done a step (rank: the rank that step reaches). */
function stepDone(member, step, rank) {
    return step.learn ? isLearned(member, step.learn) : skillRank(member, step.upgrade) >= rank;
}

/** The member's next undone step in a plan, as { step, cost, rank }, or null when finished. */
export function nextStep(member, job, plan) {
    if (!plan) return null;
    return describeSteps(job, plan.steps).find(d => !stepDone(member, d.step, d.rank)) ?? null;
}

/** The plans a member follows, in order: [[job, plan]]. */
export function activePlans(member, plans) {
    const jobs = member.origin ? [member.origin, member.job] : [member.job];
    return jobs.map(j => [j, plans?.[j]]).filter(([, p]) => p?.auto && p.steps.length);
}

/** The step a member's plans will buy next, as { job, step, cost, rank }, or null. */
export function plannedNext(member, plans) {
    for (const [job, plan] of activePlans(member, plans)) {
        const next = nextStep(member, job, plan);
        if (next) return { job, ...next };
    }
    return null;
}

/**
 * Spends a member's skill points on their plans. Returns what was bought: [{ key, rank }]
 * (rank 1 for a newly learned skill).
 */
export function autoAllocate(member, plans) {
    const bought = [];
    for (let guard = 0; guard < 64; guard++) {
        const next = plannedNext(member, plans);
        if (!next) break;
        const { step, rank } = next;
        // A step that can't be bought yet (not enough SP) holds up everything after it.
        const ok = step.learn
            ? canLearn(member, step.learn) && learnAbility(member, step.learn)
            : canUpgrade(member, step.upgrade) && skillRank(member, step.upgrade) === rank - 1 && upgradeAbility(member, step.upgrade);
        if (!ok) break;
        bought.push({ key: step.learn ?? step.upgrade, rank });
    }
    return bought;
}

const NUMERAL = ['', 'I', 'II', 'III'];
const skillName = (key) => ABILITIES[key]?.name ?? key;

/** A step for display: "Learn Ice" or "Upgrade Fire → II". */
export function stepLabel({ step, rank }) {
    return step.learn ? `Learn ${skillName(step.learn)}` : `Upgrade ${skillName(step.upgrade)} → ${NUMERAL[rank]}`;
}

/** RunState.autoAllocate purchases as one line: "Kael learned Ice · Mira upgraded Ward → II". */
export function describePurchases(bought) {
    const byName = new Map();
    for (const b of bought) {
        const text = b.rank > 1 ? `upgraded ${skillName(b.key)} → ${NUMERAL[b.rank]}` : `learned ${skillName(b.key)}`;
        byName.set(b.name, [...(byName.get(b.name) || []), text]);
    }
    return [...byName].map(([name, list]) => `${name} ${list.join(', ')}`).join(' · ');
}
