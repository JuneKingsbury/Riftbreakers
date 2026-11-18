// Skill plans: for each starting class, an ordered list of skills to learn and upgrade from the
// start of a run to its end, including the skills of one chosen promotion. When a plan has
// auto-allocate on, members of that class spend skill points on the plan as soon as they can
// afford the next step, and promote into the plan's class once they are eligible. Plans belong
// to the player, not to a run: they are stored in localStorage (separate from the run save and
// profile) and travel with save exports.
//
// A plan is { auto: boolean, promotion?: job, steps: Step[] }, keyed by a Tier 1 job. A Step is
// { learn: key } or { upgrade: key }, from the starting class's kit or (when `promotion` is set)
// the promotion's kit. The n-th upgrade step for a skill takes it to rank n + 1.
//
// Rules (autoAllocate):
// - Strict order. When the next step costs more than the member has, the member saves up:
//   later, cheaper steps wait too.
// - A promotion-class step waits the same way until the member has promoted. With auto on, a
//   member promotes into the plan's class as soon as they can (RunState.autoAllocate).
// - A member who promoted into the other class by hand skips the plan's promotion steps and
//   keeps following its starting-class steps.
// - Steps already done (bought by hand, or a recruit's starting skill) count as done.
//
// Older saves kept a separate plan per promoted class; sanitizePlans folds those into their
// starting class's plan (see mergeLegacy).
import { JOB_DATA } from '../content/jobs.js';
import { MAX_RANK, isUpgradeable, ABILITIES } from '../tactical/data-registry.js';
import { isLearned, skillRank, canLearn, canUpgrade, learnAbility, upgradeAbility, canPromote, promotionOptions } from '../tactical/loadout.js';
import { defaultStorage } from './profile.js';
import { notifySaved } from './save-events.js';

export const PLANS_KEY = 'riftbreak.skillplans.v1';

/** Classes that can have a plan: every starting (Tier 1) job with a skill kit. */
export function plannableJobs() {
    return Object.keys(JOB_DATA).filter(j => JOB_DATA[j].tier === 1 && JOB_DATA[j].learnable);
}

/** The promotions a starting class's plan may target. */
export function planPromotions(job) {
    return (JOB_DATA[job]?.promotions || []).filter(p => JOB_DATA[p]?.learnable);
}

/** The starting class whose plan a member follows (their origin once promoted). */
export function planJobFor(member) {
    return member.origin ?? member.job;
}

const validPromotion = (job, promotion) => (planPromotions(job).includes(promotion) ? promotion : null);

/** Every skill a plan may use: key → { sp, requires?, job }. */
function kitOf(job, promotion) {
    const out = {};
    for (const j of [job, validPromotion(job, promotion)]) {
        if (!j) continue;
        for (const [key, def] of Object.entries(JOB_DATA[j]?.learnable ?? {})) out[key] = { ...def, job: j };
    }
    return out;
}

const stepKey = (s) => s.learn ?? s.upgrade;

/** SP a step costs at its place in the plan (an upgrade to rank r costs r - 1). */
function stepCosts(kit, steps) {
    const ups = {};
    return steps.map(s => {
        if (s.learn) return kit[s.learn].sp;
        ups[s.upgrade] = (ups[s.upgrade] || 0) + 1;
        return ups[s.upgrade];
    });
}

/**
 * Cleans one plan's step list: only skills from the starting class's kit or its promotion's,
 * each learned once and after its prerequisite, upgrades only after the learn and at most up
 * to MAX_RANK.
 */
export function sanitizeSteps(job, promotion, steps) {
    const kit = kitOf(job, promotion);
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

/** One clean plan, or null when there is nothing worth keeping. */
export function sanitizePlan(job, p) {
    if (!p || typeof p !== 'object') return null;
    const promotion = validPromotion(job, p.promotion);
    const steps = sanitizeSteps(job, promotion, p.steps);
    if (!steps.length && p.auto !== true && !promotion) return null;
    return promotion ? { auto: p.auto === true, promotion, steps } : { auto: p.auto === true, steps };
}

/**
 * Older saves had a plan per promoted class, followed after the starting class's plan. Folds
 * one of them into each starting class's plan: its steps go after the starting steps and it
 * becomes the plan's promotion. When both promotions had a plan, the one with auto on wins
 * (then the first listed). A plan that already names a promotion is left alone.
 */
function mergeLegacy(raw, job) {
    const base = raw[job] && typeof raw[job] === 'object' ? raw[job] : null;
    if (base?.promotion !== undefined) return base;
    const legacy = planPromotions(job)
        .filter(p => Object.hasOwn(raw, p) && Array.isArray(raw[p]?.steps) && raw[p].steps.length)
        .sort((a, b) => (raw[b].auto === true) - (raw[a].auto === true))[0];
    if (!legacy) return base;
    return {
        auto: base?.auto === true || raw[legacy].auto === true,
        promotion: legacy,
        steps: [...(Array.isArray(base?.steps) ? base.steps : []), ...raw[legacy].steps],
    };
}

/** Cleans a whole plans object, so damaged, hand-edited or older data can't break the game. */
export function sanitizePlans(raw) {
    const out = {};
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
    for (const job of plannableJobs()) {
        const plan = sanitizePlan(job, mergeLegacy(raw, job));
        if (plan) out[job] = plan;
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

/**
 * Steps with their costs, target ranks and the class each comes from:
 * [{ step, cost, rank, job }]. `job` is the promotion for its skills, else the starting class.
 */
export function describeSteps(job, promotion, steps) {
    const kit = kitOf(job, promotion);
    const costs = stepCosts(kit, steps), ups = {};
    return steps.map((step, i) => {
        let rank = 1;
        if (step.upgrade) rank = (ups[step.upgrade] = (ups[step.upgrade] || 1) + 1);
        return { step, cost: costs[i], rank, job: kit[stepKey(step)].job };
    });
}

/** Total SP a plan's steps cost. */
export function planCost(job, promotion, steps) {
    return stepCosts(kitOf(job, promotion), steps).reduce((a, b) => a + b, 0);
}

/** Steps that may be added to the end of a plan next: [{ step, cost, rank, job }]. */
export function stepOptions(job, promotion, steps) {
    const kit = kitOf(job, promotion), out = [];
    const learned = new Set(steps.filter(s => s.learn).map(s => s.learn));
    const ups = {};
    for (const s of steps) if (s.upgrade) ups[s.upgrade] = (ups[s.upgrade] || 0) + 1;
    for (const [key, def] of Object.entries(kit)) {
        if (!learned.has(key) && (!def.requires || learned.has(def.requires))) out.push({ step: { learn: key }, cost: def.sp, rank: 1, job: def.job });
    }
    for (const [key, def] of Object.entries(kit)) {
        const n = ups[key] || 0;
        if (learned.has(key) && isUpgradeable(key) && n < MAX_RANK - 1) out.push({ step: { upgrade: key }, cost: n + 1, rank: n + 2, job: def.job });
    }
    return out;
}

/** Whether a member has already done a step (rank: the rank that step reaches). */
function stepDone(member, step, rank) {
    return step.learn ? isLearned(member, step.learn) : skillRank(member, step.upgrade) >= rank;
}

/** The plan a member follows, as [job, plan], or null when auto is off or the plan is empty. */
export function memberPlan(member, plans) {
    const job = planJobFor(member), plan = plans?.[job];
    return plan?.auto && plan.steps.length ? [job, plan] : null;
}

/**
 * The member's next undone step in their plan, as { job, step, cost, rank, waitsForPromotion },
 * or null when the plan is finished, off or missing. `job` is the class the step comes from.
 * waitsForPromotion: the step is a promotion skill and the member hasn't promoted yet.
 * Steps for a promotion the member didn't take are passed over.
 */
export function plannedNext(member, plans) {
    const mp = memberPlan(member, plans);
    if (!mp) return null;
    const [base, plan] = mp;
    const promoted = !!member.origin;
    for (const d of describeSteps(base, plan.promotion, plan.steps)) {
        const fromPromotion = d.job !== base;
        if (fromPromotion && promoted && member.job !== d.job) continue;
        if (stepDone(member, d.step, d.rank)) continue;
        return { ...d, waitsForPromotion: fromPromotion && !promoted };
    }
    return null;
}

/** The class a member's plan will promote them into now, or null (auto off, not ready, ...). */
export function plannedPromotion(member, plans) {
    const plan = plans?.[planJobFor(member)];
    if (!plan?.auto || !plan.promotion) return null;
    return canPromote(member) && promotionOptions(member).includes(plan.promotion) ? plan.promotion : null;
}

/**
 * Spends a member's skill points on their plan. Returns what was bought: [{ key, rank }]
 * (rank 1 for a newly learned skill). Promoting is RunState.autoAllocate's job (it also fixes
 * HP and the loadout), so call this after that.
 */
export function autoAllocate(member, plans) {
    const bought = [];
    for (let guard = 0; guard < 64; guard++) {
        const next = plannedNext(member, plans);
        // A step that can't be bought yet (not promoted, or not enough SP) holds up everything after it.
        if (!next || next.waitsForPromotion) break;
        const { step, rank } = next;
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
// Same as ui-kit's jobLabel, kept here so this module doesn't pull in UI and audio code.
const jobName = (job) => String(job).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

/** A step for display: "Learn Ice" or "Upgrade Fire → II". */
export function stepLabel({ step, rank }) {
    return step.learn ? `Learn ${skillName(step.learn)}` : `Upgrade ${skillName(step.upgrade)} → ${NUMERAL[rank]}`;
}

/**
 * RunState.autoAllocate results as one line:
 * "Kael promoted to Battlemage, learned Arcane Strike · Mira upgraded Ward → II".
 */
export function describePurchases(bought) {
    const byName = new Map();
    for (const b of bought) {
        let text;
        if (b.promoted) text = `promoted to ${jobName(b.promoted)}`;
        else text = b.rank > 1 ? `upgraded ${skillName(b.key)} → ${NUMERAL[b.rank]}` : `learned ${skillName(b.key)}`;
        byName.set(b.name, [...(byName.get(b.name) || []), text]);
    }
    return [...byName].map(([name, list]) => `${name} ${list.join(', ')}`).join(' · ');
}
