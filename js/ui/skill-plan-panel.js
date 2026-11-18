// The skill plan editor (see run/skill-plans.js): pick a starting class and its promotion, turn
// auto-allocate on, and list the skills to learn and upgrade in order, from both classes'
// kits. Shown in the title screen's Settings and, during a run, from the party menu. Every
// change is saved straight away.
import {
    loadPlans, savePlans, sanitizeSteps, describeSteps, stepOptions, planCost, stepLabel, plannableJobs, planPromotions,
} from '../run/skill-plans.js';
import { rankChanges } from '../tactical/data-registry.js';
import { PROMOTION_LEVEL } from '../tactical/loadout.js';
import { esc, jobLabel, abilityTooltip, wireTips, hideTip } from '../run/ui-kit.js';

// width:auto overrides the title screen's large-button rule (#start-screen button).
const SMALL = `width:auto;flex-shrink:0;padding:2px 7px;font-family:inherit;font-size:11px;border-radius:3px;cursor:pointer;
    background:#151528;border:1px solid #447;color:#ccc;`;
const OFF = 'opacity:0.35;cursor:default;';
const SELECT = 'background:#1a1a2e;color:#ccc;border:1px solid #444;padding:3px 4px;font-family:inherit;font-size:11px;border-radius:3px;';
const PROMO = '#fc8';   // promotion-class steps

let lastJob = 'evoker';

// Hover text for a step: what an upgrade changes, or what a skill does.
function stepTip(d) {
    if (d.step.upgrade) return [`${stepLabel(d)}:`, ...rankChanges(d.step.upgrade, d.rank - 1)].join('\n');
    return abilityTooltip(d.step.learn);
}

/**
 * Renders the editor into a container (replacing its contents).
 * @param {HTMLElement} container
 * @param {{ job?: string, storage?: Storage, onChange?: (plans: object) => void }} [opts]
 *   job: the starting class to show first. onChange: called after each saved change.
 */
export function renderSkillPlanEditor(container, { job, storage, onChange } = {}) {
    const jobs = plannableJobs();
    let current = jobs.includes(job) ? job : (jobs.includes(lastJob) ? lastJob : jobs[0]);
    let plans = loadPlans(storage);
    let status = '';

    const save = (steps, auto, promotion) => {
        const plan = { auto, steps: sanitizeSteps(current, promotion, steps) };
        if (promotion) plan.promotion = promotion;
        plans = { ...plans, [current]: plan };
        status = savePlans(plans, storage) ? '' : 'Couldn\'t save on this device. Storage may be full or turned off.';
        onChange?.(plans);
        render();
    };

    const render = () => {
        lastJob = current;
        const plan = plans[current] ?? { auto: false, steps: [] };
        const { steps, auto } = plan;
        const promotion = plan.promotion ?? null;
        const rows = describeSteps(current, promotion, steps);
        const options = stepOptions(current, promotion, steps);
        const mark = (j) => (plans[j]?.auto && plans[j].steps.length ? '● ' : '');
        const opt = (value, label, selected) => `<option value="${value}" ${selected ? 'selected' : ''}>${esc(label)}</option>`;

        let html = `<div style="color:#999;font-size:11px;line-height:1.4;margin-bottom:8px;">Plan a class's whole build: the order it learns and upgrades its skills, before and after promotion.
            Turn on auto-allocate and members of that class spend their skill points on the next step as soon as they can afford it,
            and promote into the planned class at level ${PROMOTION_LEVEL}. If a step costs more than they have, or needs a promotion they haven't reached, they save up.
            Skills you buy by hand count as done.</div>
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px;">
                <select data-plan-job aria-label="Class" style="${SELECT}">${jobs.map(j => opt(j, `${mark(j)}${jobLabel(j)}`, j === current)).join('')}</select>
                <span style="color:#999;font-size:11px;">→</span>
                <select data-plan-promotion aria-label="Promotion" style="${SELECT}">
                    ${opt('', 'No promotion', !promotion)}${planPromotions(current).map(p => opt(p, jobLabel(p), p === promotion)).join('')}
                </select>
                <label style="display:flex;gap:5px;align-items:center;color:${auto ? '#afa' : '#aaa'};font-size:11px;cursor:pointer;">
                    <input type="checkbox" data-plan-auto ${auto ? 'checked' : ''}> Auto-allocate skill points
                </label>
            </div>`;

        html += `<div style="border:1px solid #333;border-radius:4px;padding:4px 6px;margin-bottom:8px;min-height:24px;">`;
        if (!rows.length) html += `<div style="color:#666;font-size:11px;padding:4px 0;">No steps yet. Add some below.</div>`;
        const firstPromo = rows.findIndex(r => r.job !== current);
        rows.forEach((r, i) => {
            if (i === firstPromo) {
                html += `<div style="color:${PROMO};font-size:10px;text-transform:uppercase;padding:4px 0 2px;border-bottom:1px solid #332a1a;">
                    ★ Promote to ${esc(jobLabel(promotion))}${auto ? ` <span style="color:#998;text-transform:none;">(automatic at level ${PROMOTION_LEVEL})</span>` : ''}</div>`;
            }
            const promo = r.job !== current;
            const color = promo ? (r.step.learn ? PROMO : '#eb9') : (r.step.learn ? '#ddd' : '#9cf');
            html += `<div style="display:flex;gap:6px;align-items:center;padding:3px 0;border-bottom:1px solid #1a1a2a;" data-tip="${esc(stepTip(r))}">
                <span style="color:#667;font-size:10px;width:18px;text-align:right;">${i + 1}.</span>
                <span style="flex:1;color:${color};font-size:11px;">${esc(stepLabel(r))}</span>
                <span style="color:#8c8;font-size:10px;white-space:nowrap;">${r.cost} SP</span>
                <button data-plan-up="${i}" aria-label="Move up" style="${SMALL}${i === 0 ? OFF : ''}" ${i === 0 ? 'disabled' : ''}>▲</button>
                <button data-plan-down="${i}" aria-label="Move down" style="${SMALL}${i === rows.length - 1 ? OFF : ''}" ${i === rows.length - 1 ? 'disabled' : ''}>▼</button>
                <button data-plan-remove="${i}" aria-label="Remove" style="${SMALL}color:#f99;border-color:#744;">✕</button>
            </div>`;
        });
        html += `</div>`;

        if (options.length) {
            // One group per class, starting class first. data-plan-add indexes into `options`.
            for (const j of [current, promotion].filter(Boolean)) {
                const group = options.map((o, i) => [o, i]).filter(([o]) => o.job === j);
                if (!group.length) continue;
                html += `<div style="color:${j === current ? '#fc8' : PROMO};font-size:10px;text-transform:uppercase;margin-bottom:4px;">Add a ${esc(jobLabel(j))} step${j === current ? '' : ' (after promoting)'}</div>
                    <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px;">`;
                for (const [o, i] of group) {
                    const c = j === current ? (o.step.learn ? '' : 'color:#9cf;') : `color:${o.step.learn ? PROMO : '#eb9'};border-color:#654;`;
                    html += `<button data-plan-add="${i}" data-tip="${esc(stepTip(o))}" style="${SMALL}${c}">+ ${esc(stepLabel(o))} · ${o.cost}</button>`;
                }
                html += `</div>`;
            }
        } else if (rows.length) {
            html += `<div style="color:#6a6;font-size:11px;margin-bottom:8px;">Every skill in this build is planned.</div>`;
        }

        html += `<div style="display:flex;justify-content:space-between;align-items:center;">
                <span style="color:#999;font-size:11px;">${rows.length} step${rows.length === 1 ? '' : 's'} · ${planCost(current, promotion, steps)} SP in total</span>
                <button data-plan-clear style="${SMALL}color:#f99;border-color:#744;${rows.length ? '' : OFF}" ${rows.length ? '' : 'disabled'}>Clear plan</button>
            </div>`;
        if (status) html += `<div role="status" style="color:#f88;font-size:11px;margin-top:6px;">${esc(status)}</div>`;
        hideTip();
        container.innerHTML = html;
        wireTips(container);

        const on = (sel, fn) => container.querySelectorAll(sel).forEach(el => el.addEventListener('click', () => fn(el)));
        container.querySelector('[data-plan-job]').addEventListener('change', (e) => { current = e.target.value; status = ''; render(); });
        container.querySelector('[data-plan-auto]').addEventListener('change', (e) => save(steps, e.target.checked, promotion));
        container.querySelector('[data-plan-promotion]').addEventListener('change', (e) => {
            const next = e.target.value || null;
            // Switching away drops the old promotion's steps (sanitizeSteps), so ask first.
            const lost = rows.filter(r => r.job !== current).length;
            if (lost && !window.confirm(`Switching promotion removes ${lost} ${jobLabel(promotion)} step${lost === 1 ? '' : 's'} from this plan. Continue?`)) {
                e.target.value = promotion ?? '';
                return;
            }
            save(steps, auto, next);
        });
        const move = (i, d) => { const s = [...steps]; [s[i], s[i + d]] = [s[i + d], s[i]]; save(s, auto, promotion); };
        on('[data-plan-up]', el => move(+el.dataset.planUp, -1));
        on('[data-plan-down]', el => move(+el.dataset.planDown, 1));
        // Removing or moving a step drops any later steps it made invalid (e.g. a skill whose
        // prerequisite now comes after it): see sanitizeSteps.
        on('[data-plan-remove]', el => save(steps.filter((_, i) => i !== +el.dataset.planRemove), auto, promotion));
        on('[data-plan-add]', el => save([...steps, options[+el.dataset.planAdd].step], auto, promotion));
        on('[data-plan-clear]', () => save([], auto, promotion));
    };

    render();
}
