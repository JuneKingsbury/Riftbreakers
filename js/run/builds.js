// Build focus: the easy way to spend skill points. Every class has two suggested builds
// (`builds` in its file in js/content/classes/). At the start of a run, and when a recruit
// joins, the player picks one for each member, and the member spends their points on it
// without being asked. When a member can promote, the player picks the promotion class and one
// of its builds, and the member's points go to that build from then on.
//
// A member's choice is saved on the member, so it belongs to the run:
//   member.build = { mode, focus?, promoFocus?, promoAsked? }
//     mode        'focus'  follow the suggested builds (focus, then promoFocus once promoted)
//                 'plan'   follow the player's own skill plan for the class (skill-plans.js),
//                          whether or not that plan has auto-allocate on
//                 'manual' spend points by hand
//     focus       build key of the starting class
//     promoFocus  build key of the promotion class, once promoted
//     promoAsked  the player has been offered promotion (and may have said "not now")
// Members without `build` (runs from before build focus) follow the old rules: the skill
// plan of their class, when it has auto-allocate on.
//
// Spending order in focus mode. Before promotion: the starting build's steps, then the rest of
// the starting class's tree. After promotion: the promotion build's steps, then whatever the
// starting build still lacks, then the rest of both trees (promotion class first). "The rest"
// is learned in tree order, then every skill to rank II, then to rank III, so points are never
// left lying around in a long run. A skill's prerequisite is learned first when needed.
//
// Like a skill plan, a build saves up: when the next purchase costs more than the member has,
// nothing after it is bought either. Skills bought by hand count as done.
import { JOB_DATA } from '../content/jobs.js';
import { MAX_RANK, isUpgradeable, ABILITIES } from '../tactical/data-registry.js';
import {
    isLearned, skillRank, learnableFor, abilitySlot, LOADOUT_SLOTS, learnAbility, upgradeAbility, upgradeCost,
} from '../tactical/loadout.js';
import { autoAllocate as planAllocate, plannedNext, plannedPromotion, planJobFor } from './skill-plans.js';

export const BUILD_MODES = ['focus', 'plan', 'manual'];

/** A class's suggested builds: [{ key, name, desc, steps }]. */
export function buildsFor(job) {
    return JOB_DATA[job]?.builds ?? [];
}

/** One of a class's builds by key, or null. */
export function findBuild(job, key) {
    return buildsFor(job).find(b => b.key === key) ?? null;
}

const parseStep = (s) => (s.endsWith('+') ? { key: s.slice(0, -1), up: true } : { key: s, up: false });

/**
 * Cleans a member's build choice, so damaged or hand-edited saves can't break the game.
 * Returns null when there is nothing usable.
 */
export function sanitizeBuild(member, build) {
    if (!build || typeof build !== 'object' || !BUILD_MODES.includes(build.mode)) return null;
    const base = planJobFor(member);
    const out = { mode: build.mode };
    if (findBuild(base, build.focus)) out.focus = build.focus;
    else if (build.mode === 'focus') out.focus = buildsFor(base)[0]?.key;
    if (member.origin && findBuild(member.job, build.promoFocus)) out.promoFocus = build.promoFocus;
    else if (member.origin && build.mode === 'focus') out.promoFocus = buildsFor(member.job)[0]?.key;
    if (build.promoAsked === true) out.promoAsked = true;
    for (const k of ['focus', 'promoFocus']) if (out[k] === undefined) delete out[k];
    return out;
}

/**
 * The targets a focus member works through, in order: [{ key, rank, slots }]. rank 1 means
 * "learned". slots: a reaction, support or movement skill it learns goes into its slot. Only
 * the build in charge (the promotion's, once promoted) decides slots; leftovers and filler
 * leave the slotted passive alone.
 */
export function focusTargets(member) {
    const build = member.build ?? {};
    const base = planJobFor(member);
    const promoted = !!member.origin;
    const first = findBuild(base, build.focus) ?? buildsFor(base)[0];
    const second = promoted ? (findBuild(member.job, build.promoFocus) ?? buildsFor(member.job)[0]) : null;
    // Ranks are counted in build order (starting build first), so "skill+" in the promotion
    // build means one rank above what the starting build already takes it to.
    const ranks = {};
    const expand = (b, slots) => {
        const out = [];
        for (const s of b?.steps ?? []) {
            const { key, up } = parseStep(s);
            const rank = up ? (ranks[key] ?? 1) + 1 : 1;
            if (rank > MAX_RANK) continue;
            ranks[key] = Math.max(ranks[key] ?? 1, rank);
            out.push({ key, rank, slots });
        }
        return out;
    };
    const firstSteps = expand(first, !promoted), secondSteps = expand(second, true);
    const fill = (job) => {
        const keys = Object.keys(JOB_DATA[job]?.learnable ?? {});
        const out = keys.map(key => ({ key, rank: 1, slots: false }));
        for (let r = 2; r <= MAX_RANK; r++) for (const key of keys) if (isUpgradeable(key)) out.push({ key, rank: r, slots: false });
        return out;
    };
    return promoted
        ? [...secondSteps, ...firstSteps, ...fill(member.job), ...fill(base)]
        : [...firstSteps, ...fill(base)];
}

// The purchase that moves a member toward a target, or null when the target is done (or out
// of reach: a skill not in the member's trees, or a rank it can't have).
function purchaseFor(member, target) {
    const kit = learnableFor(member);
    if (!Object.hasOwn(kit, target.key)) return null;
    if (!isLearned(member, target.key)) {
        // Learn the first missing link of the prerequisite chain.
        let key = target.key;
        for (let guard = 0; guard < 8; guard++) {
            const req = kit[key]?.requires;
            if (!req || isLearned(member, req) || !Object.hasOwn(kit, req)) break;
            key = req;
        }
        return { learn: key, key, rank: 1, cost: kit[key].sp };
    }
    if (target.rank <= 1 || !isUpgradeable(target.key)) return null;
    const rank = skillRank(member, target.key);
    if (rank >= target.rank || rank >= MAX_RANK) return null;
    return { upgrade: target.key, key: target.key, rank: rank + 1, cost: upgradeCost(member, target.key) };
}

/**
 * A focus member's next purchase: { key, rank, cost, learn? | upgrade?, slots }, or null when
 * everything is bought. rank: the rank it reaches (1 for learning).
 */
export function focusNext(member) {
    for (const t of focusTargets(member)) {
        const p = purchaseFor(member, t);
        if (p) return { ...p, slots: t.slots };
    }
    return null;
}

/** Spends a focus member's skill points. Returns what was bought: [{ key, rank }]. */
export function focusAllocate(member) {
    const bought = [];
    for (let guard = 0; guard < 64; guard++) {
        const next = focusNext(member);
        if (!next || (member.sp || 0) < next.cost) break;
        if (next.learn) {
            const slot = abilitySlot(next.key);
            const before = member.loadout?.[slot] ?? null;
            if (!learnAbility(member, next.key)) break;
            // A skill the build in charge didn't ask for doesn't push out the one in its slot.
            if (!next.slots && LOADOUT_SLOTS.includes(slot) && before) member.loadout = { ...member.loadout, [slot]: before };
        } else if (!upgradeAbility(member, next.key)) break;
        bought.push({ key: next.key, rank: next.rank });
    }
    return bought;
}

// The member's skill plan, treated as switched on (plan mode follows it either way).
function forcedPlans(member, plans) {
    const job = planJobFor(member), plan = plans?.[job];
    return plan ? { [job]: { ...plan, auto: true } } : {};
}

/**
 * What a member's build buys next, for display: { key, rank, cost, step, waitsForPromotion? }
 * (step is a skill-plans step, for stepLabel), or null when there is nothing to buy or the
 * member spends by hand.
 */
export function buildNext(member, plans) {
    const mode = member.build?.mode;
    if (mode === 'focus') {
        const n = focusNext(member);
        return n && { ...n, step: n.learn ? { learn: n.key } : { upgrade: n.key } };
    }
    if (mode === 'plan') {
        const n = plannedNext(member, forcedPlans(member, plans));
        return n && { ...n, key: n.step.learn ?? n.step.upgrade };
    }
    return null;
}

/** The class a plan-mode member's skill plan promotes them into now, or null. */
export function buildPromotion(member, plans) {
    return member.build?.mode === 'plan' ? plannedPromotion(member, forcedPlans(member, plans)) : null;
}

/** Spends a member's points by their build choice. Returns [{ key, rank }]. */
export function buildAllocate(member, plans) {
    const mode = member.build?.mode;
    if (mode === 'focus') return focusAllocate(member);
    if (mode === 'plan') return planAllocate(member, forcedPlans(member, plans));
    return [];
}

/** Whether the player has a non-empty skill plan for this member's starting class. */
export function hasPlan(member, plans) {
    return !!plans?.[planJobFor(member)]?.steps?.length;
}

/**
 * The choices offered for a member now (their class, or their promotion once promoted):
 * [{ value, mode, focus?, name, desc }]. value: 'focus:<key>', 'plan' or 'manual'.
 */
export function buildChoices(member, plans) {
    const out = buildsFor(member.job).map(b => ({ value: `focus:${b.key}`, mode: 'focus', focus: b.key, name: b.name, desc: b.desc, steps: b.steps }));
    if (hasPlan(member, plans)) out.push({ value: 'plan', mode: 'plan', name: 'My skill plan', desc: 'Follow the skill plan you made for this class.' });
    out.push({ value: 'manual', mode: 'manual', name: 'Manual', desc: 'Spend skill points yourself from the Party menu.' });
    return out;
}

/** The value of a member's current choice (see buildChoices). */
export function buildValue(member) {
    const b = member.build;
    if (!b) return null;
    if (b.mode !== 'focus') return b.mode;
    return `focus:${member.origin ? b.promoFocus : b.focus}`;
}

/**
 * The build a choice value sets, keeping what still applies from the old one (the starting
 * focus after promotion, promoAsked).
 */
export function buildFromValue(member, value) {
    const old = member.build ?? {};
    const [mode, key] = String(value).split(':');
    const build = { ...old, mode };
    if (mode === 'focus') {
        if (member.origin) build.promoFocus = key;
        else build.focus = key;
    }
    return sanitizeBuild(member, build);
}

const skillName = (key) => ABILITIES[key]?.name ?? key;
const NUMERAL = ['', 'I', 'II', 'III'];

/** A build's first few purchases as text: "Return Fire, Long Shot II, Rune Arrow …". */
export function buildPreview(steps, count = 4) {
    const ranks = {};
    const parts = steps.slice(0, count).map(s => {
        const { key, up } = parseStep(s);
        if (!up) return skillName(key);
        ranks[key] = (ranks[key] ?? 1) + 1;
        return `${skillName(key)} ${NUMERAL[Math.min(ranks[key], MAX_RANK)]}`;
    });
    return parts.join(', ') + (steps.length > count ? ' …' : '');
}

/** A member's build in a few words: "Retaliation", "Retaliation → Marksman", "Manual". */
export function buildSummary(member) {
    const b = member.build;
    if (!b) return null;
    if (b.mode === 'manual') return 'Manual';
    if (b.mode === 'plan') return 'My skill plan';
    const base = planJobFor(member);
    const first = findBuild(base, b.focus)?.name ?? '?';
    return member.origin ? `${first} → ${findBuild(member.job, b.promoFocus)?.name ?? '?'}` : first;
}

/**
 * A suggested build as skill plan steps ([{ learn } | { upgrade }]), for loading into the plan
 * editor: the starting build, then (with a promotion) the promotion build, with prerequisites
 * learned where needed and ranks capped at MAX_RANK.
 */
export function suggestedPlanSteps(job, focus, promotion = null, promoFocus = null) {
    const kit = { ...(JOB_DATA[job]?.learnable ?? {}), ...(promotion ? JOB_DATA[promotion]?.learnable ?? {} : {}) };
    // Plans list the starting skill too (sanitizeSteps wants every prerequisite as a step).
    const learned = new Set(), ranks = {}, out = [];
    const learn = (key) => {
        if (learned.has(key) || !Object.hasOwn(kit, key)) return;
        if (kit[key].requires) learn(kit[key].requires);
        learned.add(key);
        out.push({ learn: key });
    };
    const lists = [findBuild(job, focus)?.steps ?? [], promotion ? findBuild(promotion, promoFocus)?.steps ?? [] : []];
    const starter = Object.keys(JOB_DATA[job]?.learnable ?? {})[0];
    if (starter) learn(starter);
    for (const s of lists.flat()) {
        const { key, up } = parseStep(s);
        learn(key);
        if (up && isUpgradeable(key) && (ranks[key] ?? 1) < MAX_RANK) {
            ranks[key] = (ranks[key] ?? 1) + 1;
            out.push({ upgrade: key });
        }
    }
    return out;
}
