// Build focus pickers (see run/builds.js). The run start and each recruit get a setup screen
// picking every new member's build; a member who can promote gets a screen picking the class
// and its build (or "not now"); and the Party menu reuses the choice buttons to change a build.
import { buildChoices, buildValue, buildFromValue, buildPreview, buildsFor } from '../run/builds.js';
import { loadPlans } from '../run/skill-plans.js';
import { promotionOptions } from '../tactical/loadout.js';
import { Sound } from '../audio/sound.js';
import { BTN, BTN_GOOD, BTN_GOLD, esc, jobLabel, jobDesc, portraitHtml, drawSprites, wireTips } from '../run/ui-kit.js';

const CHOICE = (on) => `padding:4px 9px;font-family:inherit;font-size:11px;border-radius:3px;cursor:pointer;
    background:${on ? '#1a2a14' : '#111122'};border:1px solid ${on ? '#8c6' : '#335'};color:${on ? '#cfa' : '#aab'};
    ${on ? 'box-shadow:0 0 6px rgba(140,200,100,0.45);' : ''}`;

/**
 * The choice buttons for one member (data-build-choice = value) and what the selected one does.
 * @param {object} member
 * @param {object} plans     loadPlans() result
 * @param {string} selected  a buildChoices value
 */
export function buildChoiceHtml(member, plans, selected) {
    const choices = buildChoices(member, plans);
    const pick = choices.find(c => c.value === selected) ?? choices[0];
    const buttons = choices.map(c => `<button data-build-choice="${esc(c.value)}" data-build-member="${esc(member.name)}"
        style="${CHOICE(c.value === pick.value)}">${c.mode === 'focus' ? '◆ ' : ''}${esc(c.name)}</button>`).join('');
    const preview = pick.steps ? `<div style="color:#8a9;font-size:10px;margin-top:2px;">First: ${esc(buildPreview(pick.steps))}</div>` : '';
    return `<div style="display:flex;flex-wrap:wrap;gap:4px;margin:4px 0;">${buttons}</div>
        <div style="color:#999;font-size:11px;line-height:1.4;">${esc(pick.desc)}</div>${preview}`;
}

/** The default choice for a member who has none yet: their class's first build. */
export function defaultChoice(member) {
    const first = buildsFor(member.job)[0];
    return buildValue(member) ?? (first ? `focus:${first.key}` : 'manual');
}

/**
 * The setup screen for members joining without a build: the starting party, or a recruit.
 * Nothing is spent until the player confirms (the modal can't be dismissed).
 * @param {import('../run/ui-kit.js').Modal} modal
 * @param {import('../run/run-state.js').RunState} run
 * @param {object[]} members  the members to set up
 * @param {{ skin?: object, onDone: () => void }} opts
 */
export function showBuildSetup(modal, run, members, { skin, onDone }) {
    const plans = loadPlans();
    const picks = Object.fromEntries(members.map(m => [m.name, defaultChoice(m)]));
    const start = members.length === run.party.length;
    const render = () => {
        let html = `<div style="color:#ffcc44;font-weight:bold;font-size:16px;margin-bottom:4px;">${start ? 'Choose your builds' : `${esc(members[0].name)} joins the party`}</div>
            <div style="color:#999;font-size:11px;line-height:1.45;margin-bottom:10px;">
                Pick a focus and skill points are spent for you after every battle.
                When someone reaches level 5 you'll choose their promotion and its focus.
                You can change any of this later from the Party menu.</div>`;
        for (const m of members) {
            html += `<div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:8px;padding:8px;background:#0c0c1c;border:1px solid #2a2a44;border-radius:5px;">
                ${portraitHtml(m, 36)}
                <div style="flex:1;min-width:0;">
                    <div><span style="font-weight:bold;color:${m.appearance?.nameColor || '#ccc'};">${esc(m.name)}</span>
                        <span style="color:#888;font-size:10px;text-transform:uppercase;">${esc(jobLabel(m.job))}</span></div>
                    ${buildChoiceHtml(m, plans, picks[m.name])}
                </div>
            </div>`;
        }
        html += `<button data-build-done style="${BTN}${BTN_GOOD}text-align:center;padding:9px;">${start ? 'Begin' : 'Done'}</button>`;
        const body = modal.show(html, { dismissible: false, width: 540, view: 'build-setup' });
        drawSprites(body, run.party, skin);
        wireTips(body);
        body.querySelectorAll('[data-build-choice]').forEach(b => b.addEventListener('click', () => {
            picks[b.dataset.buildMember] = b.dataset.buildChoice;
            render();
        }));
        body.querySelector('[data-build-done]').addEventListener('click', () => {
            for (const m of members) run.setBuild(m.name, buildFromValue(m, picks[m.name]));
            onDone();
        });
    };
    render();
}

/**
 * The screen for a member who can promote: each promotion class with its builds (or just the
 * class, for a member who spends by hand or by skill plan), and "Not now".
 * @param {{ skin?: object, onDone: () => void }} opts
 */
export function showPromotionChoice(modal, run, member, { skin, onDone }) {
    const focus = member.build?.mode === 'focus';
    let html = `<div style="display:flex;gap:10px;align-items:center;margin-bottom:8px;">
            ${portraitHtml(member, 40)}
            <div><div style="color:#ffcc44;font-weight:bold;font-size:16px;">${esc(member.name)} can promote!</div>
            <div style="color:#999;font-size:11px;">Level ${member.level} ${esc(jobLabel(member.job))}. Every learned skill carries over.</div></div>
        </div>
        <div style="color:#999;font-size:11px;line-height:1.45;margin-bottom:8px;">${focus
            ? 'Pick a Tier 2 class and the focus to follow from now on. Skill points go to that build first.'
            : 'Pick a Tier 2 class.'}</div>`;
    for (const job of promotionOptions(member)) {
        html += `<div style="margin-bottom:8px;padding:8px;background:#0c0c1c;border:1px solid #443a22;border-radius:5px;">
            <div style="color:#fc8;font-weight:bold;">★ ${esc(jobLabel(job))}</div>
            <div style="color:#888;font-size:10px;line-height:1.4;margin-bottom:4px;">${esc(jobDesc(job))}</div>`;
        if (focus) {
            for (const b of buildsFor(job)) {
                html += `<button data-promote="${esc(job)}" data-focus="${esc(b.key)}" style="${BTN}${BTN_GOLD}margin-top:4px;">
                    ◆ ${esc(b.name)}<div style="color:#999;font-size:10px;line-height:1.35;margin-top:2px;">${esc(b.desc)}</div>
                    <div style="color:#8a9;font-size:10px;">First: ${esc(buildPreview(b.steps))}</div></button>`;
            }
        } else {
            html += `<button data-promote="${esc(job)}" style="${BTN}${BTN_GOLD}">Promote to ${esc(jobLabel(job))}</button>`;
        }
        html += `</div>`;
    }
    html += `<button data-not-now style="${BTN}text-align:center;color:#aaa;">Not now <span style="color:#777;font-size:10px;">(promote later from the Party menu)</span></button>`;
    const body = modal.show(html, { dismissible: false, width: 520, view: `promote:${member.name}` });
    drawSprites(body, run.party, skin);
    body.querySelectorAll('[data-promote]').forEach(b => b.addEventListener('click', () => {
        if (run.promoteWithBuild(member.name, b.dataset.promote, b.dataset.focus ?? null)) Sound.playSfx('promote');
        onDone();
    }));
    body.querySelector('[data-not-now]').addEventListener('click', () => {
        run.declinePromotion(member.name);
        onDone();
    });
}
