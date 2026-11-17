// The skill plan editor (see run/skill-plans.js): pick a class, turn auto-allocate on, and
// list the skills to learn and upgrade in order. Shown in the title screen's Settings and,
// during a run, from the party menu. Every change is saved straight away.
import {
    loadPlans, savePlans, sanitizeSteps, describeSteps, stepOptions, planCost, stepLabel, plannableJobs,
} from '../run/skill-plans.js';
import { JOB_DATA } from '../tactical/data/jobs.js';
import { esc, jobLabel, abilityTooltip } from '../run/ui-kit.js';

// width:auto overrides the title screen's large-button rule (#start-screen button).
const SMALL = `width:auto;flex-shrink:0;padding:2px 7px;font-family:inherit;font-size:11px;border-radius:3px;cursor:pointer;
    background:#151528;border:1px solid #447;color:#ccc;`;
const OFF = 'opacity:0.35;cursor:default;';

// The starting classes a promoted class can come from.
function originsOf(job) {
    return plannableJobs().filter(j => JOB_DATA[j].tier === 1 && (JOB_DATA[j].promotions || []).includes(job));
}

let lastJob = 'evoker';

/**
 * Renders the editor into a container (replacing its contents).
 * @param {HTMLElement} container
 * @param {{ job?: string, storage?: Storage, onChange?: (plans: object) => void }} [opts]
 *   job: the class to show first. onChange: called after each saved change.
 */
export function renderSkillPlanEditor(container, { job, storage, onChange } = {}) {
    const jobs = plannableJobs();
    let current = jobs.includes(job) ? job : (jobs.includes(lastJob) ? lastJob : jobs[0]);
    let plans = loadPlans(storage);
    let status = '';

    const save = (steps, auto) => {
        const plan = { auto, steps: sanitizeSteps(current, steps) };
        plans = { ...plans, [current]: plan };
        status = savePlans(plans, storage) ? '' : 'Couldn\'t save on this device (storage may be full or disabled).';
        onChange?.(plans);
        render();
    };

    const render = () => {
        lastJob = current;
        const plan = plans[current] ?? { auto: false, steps: [] };
        const steps = plan.steps;
        const rows = describeSteps(current, steps);
        const options = stepOptions(current, steps);
        const tier2 = JOB_DATA[current].tier === 2;
        const mark = (j) => (plans[j]?.auto && plans[j].steps.length ? '● ' : '');
        const opt = (j, label) => `<option value="${j}" ${j === current ? 'selected' : ''}>${mark(j)}${esc(label)}</option>`;
        const t1 = jobs.filter(j => JOB_DATA[j].tier === 1), t2 = jobs.filter(j => JOB_DATA[j].tier === 2);

        let html = `<div style="color:#999;font-size:11px;line-height:1.4;margin-bottom:8px;">Plan the order a class learns and upgrades its skills.
            With auto-allocate on, members of that class spend their skill points on the next step as soon as they can afford it,
            saving up when it costs more than they have. Skills bought by hand count as done.</div>
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px;">
                <select data-plan-job style="background:#1a1a2e;color:#ccc;border:1px solid #444;padding:3px 4px;font-family:inherit;font-size:11px;border-radius:3px;">
                    <optgroup label="Starting classes">${t1.map(j => opt(j, jobLabel(j))).join('')}</optgroup>
                    <optgroup label="Promoted classes">${t2.map(j => opt(j, `${jobLabel(j)} (from ${originsOf(j).map(jobLabel).join(' / ')})`)).join('')}</optgroup>
                </select>
                <label style="display:flex;gap:5px;align-items:center;color:${plan.auto ? '#afa' : '#aaa'};font-size:11px;cursor:pointer;">
                    <input type="checkbox" data-plan-auto ${plan.auto ? 'checked' : ''}> Auto-allocate skill points
                </label>
            </div>`;
        if (tier2) {
            html += `<div style="color:#889;font-size:10px;margin-bottom:6px;">A promoted member follows this plan once their ${originsOf(current).map(jobLabel).join(' or ')} plan is finished (or off).</div>`;
        }

        html += `<div style="border:1px solid #333;border-radius:4px;padding:4px 6px;margin-bottom:8px;min-height:24px;">`;
        if (!rows.length) html += `<div style="color:#666;font-size:11px;padding:4px 0;">No steps yet. Add some below.</div>`;
        rows.forEach((r, i) => {
            const key = r.step.learn ?? r.step.upgrade;
            html += `<div style="display:flex;gap:6px;align-items:center;padding:3px 0;border-bottom:1px solid #1a1a2a;" title="${esc(abilityTooltip(key))}">
                <span style="color:#667;font-size:10px;width:18px;text-align:right;">${i + 1}.</span>
                <span style="flex:1;color:${r.step.learn ? '#ddd' : '#9cf'};font-size:11px;">${esc(stepLabel(r))}</span>
                <span style="color:#8c8;font-size:10px;white-space:nowrap;">${r.cost} SP</span>
                <button data-plan-up="${i}" aria-label="Move up" style="${SMALL}${i === 0 ? OFF : ''}" ${i === 0 ? 'disabled' : ''}>▲</button>
                <button data-plan-down="${i}" aria-label="Move down" style="${SMALL}${i === rows.length - 1 ? OFF : ''}" ${i === rows.length - 1 ? 'disabled' : ''}>▼</button>
                <button data-plan-remove="${i}" aria-label="Remove" style="${SMALL}color:#f99;border-color:#744;">✕</button>
            </div>`;
        });
        html += `</div>`;

        if (options.length) {
            html += `<div style="color:#fc8;font-size:10px;text-transform:uppercase;margin-bottom:4px;">Add a step</div>
                <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px;">`;
            options.forEach((o, i) => {
                const key = o.step.learn ?? o.step.upgrade;
                html += `<button data-plan-add="${i}" title="${esc(abilityTooltip(key))}" style="${SMALL}${o.step.learn ? '' : 'color:#9cf;'}">+ ${esc(stepLabel(o))} · ${o.cost}</button>`;
            });
            html += `</div>`;
        } else if (rows.length) {
            html += `<div style="color:#6a6;font-size:11px;margin-bottom:8px;">Everything in this class's kit is planned.</div>`;
        }

        html += `<div style="display:flex;justify-content:space-between;align-items:center;">
                <span style="color:#999;font-size:11px;">${rows.length} step${rows.length === 1 ? '' : 's'} · ${planCost(current, steps)} SP in total</span>
                <button data-plan-clear style="${SMALL}color:#f99;border-color:#744;${rows.length ? '' : OFF}" ${rows.length ? '' : 'disabled'}>Clear plan</button>
            </div>`;
        if (status) html += `<div role="status" style="color:#f88;font-size:11px;margin-top:6px;">${esc(status)}</div>`;
        container.innerHTML = html;

        const on = (sel, fn) => container.querySelectorAll(sel).forEach(el => el.addEventListener('click', () => fn(el)));
        container.querySelector('[data-plan-job]').addEventListener('change', (e) => { current = e.target.value; status = ''; render(); });
        container.querySelector('[data-plan-auto]').addEventListener('change', (e) => save(steps, e.target.checked));
        const move = (i, d) => { const s = [...steps]; [s[i], s[i + d]] = [s[i + d], s[i]]; save(s, plan.auto); };
        on('[data-plan-up]', el => move(+el.dataset.planUp, -1));
        on('[data-plan-down]', el => move(+el.dataset.planDown, 1));
        // Removing or moving a step drops any later steps it made invalid (e.g. a skill whose
        // prerequisite now comes after it): see sanitizeSteps.
        on('[data-plan-remove]', el => save(steps.filter((_, i) => i !== +el.dataset.planRemove), plan.auto));
        on('[data-plan-add]', el => save([...steps, options[+el.dataset.planAdd].step], plan.auto));
        on('[data-plan-clear]', () => save([], plan.auto));
    };

    render();
}
