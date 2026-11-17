// Party menu: each member's level, HP, stats, skills to learn and upgrade with skill points, passive slots,
// equipment and promotion. Works on a RunState and saves it after every change.
import { previewUnit, STATS } from './member-stats.js';
import { GearScreen } from './gear-screen.js';
import { Sound } from '../audio/sound.js';
import { ABILITIES } from '../tactical/data-registry.js';
import { JOB_DATA } from '../tactical/data/jobs.js';
import { EQUIPMENT, EQUIP_FIELDS, equipmentGrants } from '../tactical/data/equipment.js';
import {
    LOADOUT_SLOTS, abilitySlot, isLearned, learnBlocker, memberJobs, equippable, skillRank, canUpgrade,
    upgradeCost, canSpendPoints, canPromote, promotionOptions, buildLoadout, PROMOTION_LEVEL, XP_PER_LEVEL,
} from '../tactical/loadout.js';
import { MAX_RANK, isUpgradeable, rankedKey, rankChanges } from '../tactical/data-registry.js';
import { MAX_PARTY } from './run-state.js';
import {
    BTN, BTN_DISABLED, BTN_GOLD, GLOW, esc, jobLabel, abilityName, abilityTooltip, itemTitle,
    itemSummary, itemIconHtml, portraitHtml, drawSprites, hpBar, xpBar, spBadge, jobDesc, wireTips,
} from './ui-kit.js';

import { loadPlans, plannedNext, activePlans, stepLabel } from './skill-plans.js';
import { renderSkillPlanEditor } from '../ui/skill-plan-panel.js';

const NUMERAL = ['', 'I', 'II', 'III'];

const SLOT_LABEL = { armorKey: 'Armor', helmetKey: 'Helmet', weaponKey: 'Weapon', toolKey: 'Tool', bootsKey: 'Boots', trinketKey: 'Trinket' };
// Kept for anything importing it from here.
export { previewUnit };

export class PartyMenu {
    // modal: a ui-kit Modal. onChange: called after any change (the caller saves the run).
    constructor(modal, run, skinManager, { onChange, onClose } = {}) {
        this.modal = modal;
        this.run = run;
        this.skin = skinManager;
        this.onChange = onChange || (() => {});
        this.onClose = onClose || null;
        this.gear = new GearScreen(modal, run, skinManager, { onChange: () => this._changed() });
    }

    _changed() {
        this.onChange();
    }

    showList() {
        const run = this.run;
        let html = `<div style="color:#ffcc44;font-weight:bold;font-size:15px;margin-bottom:10px;">Party <span style="color:#888;font-size:11px;">(${run.party.length}/${MAX_PARTY})</span></div>`;
        for (const m of run.party) {
            const hp = run.hp(m), max = run.maxHp(m);
            const promo = canPromote(m) ? `<span style="color:#fc6;font-size:10px;"> ★ can promote</span>` : '';
            const spend = canSpendPoints(m);
            html += `<div class="rk-member" data-member="${esc(m.name)}" style="display:flex;gap:10px;align-items:center;margin-bottom:6px;padding:7px 8px;cursor:pointer;background:#0d0d20;border:1px solid #335;border-radius:5px;${spend ? GLOW : ''}">
                ${portraitHtml(m, 32)}
                <div style="flex:1;min-width:0;">
                    <div style="font-weight:bold;color:${m.appearance?.nameColor || '#ccc'};">${esc(m.name)}${promo}</div>
                    <div style="font-size:10px;color:#888;text-transform:uppercase;">${esc(this._jobLine(m))}</div>
                    <div style="font-size:10px;color:#aaa;">Lv ${m.level} · ${hpBar(hp, max, 70)} ${hp}/${max} HP ${spBadge(m, spend)}</div>
                </div>
                <span style="color:#558;">›</span>
            </div>`;
        }
        const body = this.modal.show(html, { width: 440, onClose: this.onClose, view: 'party' });
        drawSprites(body, run.party, this.skin);
        body.querySelectorAll('.rk-member').forEach(el => el.addEventListener('click', () => this.showMember(el.dataset.member)));
    }

    _jobLine(m) {
        return m.origin ? `${jobLabel(m.origin)} → ${jobLabel(m.job)}` : jobLabel(m.job);
    }

    showMember(name) {
        const run = this.run;
        const m = run.member(name);
        if (!m) return this.showList();
        const unit = previewUnit(run, m);
        const hp = run.hp(m), max = run.maxHp(m);
        let html = `<div style="display:flex;gap:12px;align-items:center;margin-bottom:10px;">
            ${portraitHtml(m, 48)}
            <div style="flex:1;">
                <div style="font-weight:bold;font-size:15px;color:${m.appearance?.nameColor || '#ccc'};">${esc(m.name)}</div>
                <div style="font-size:11px;color:#888;text-transform:uppercase;">${esc(this._jobLine(m))}</div>
                <div style="font-size:11px;color:#aaa;margin-top:2px;">${hpBar(hp, max, 110)} ${hp}/${max} HP</div>
                <div style="font-size:11px;margin-top:2px;">Level ${m.level} ${xpBar(m.xp, XP_PER_LEVEL, 80)} <span style="color:#666;">${m.xp}/${XP_PER_LEVEL} XP</span></div>
                <div style="font-size:11px;margin-top:2px;">${spBadge(m, canSpendPoints(m), true)}</div>
            </div>
        </div>`;

        html += `<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:2px 6px;font-size:10px;margin-bottom:10px;padding:6px;background:#0a0a18;border:1px solid #223;border-radius:4px;">`;
        for (const [k, label] of STATS) html += `<div><span style="color:#778;">${label}</span> <span style="color:#ddd;">${unit[k]}</span></div>`;
        html += `</div>`;

        html += this._promotionHtml(m);
        html += this._skillsHtml(m);
        html += this._slotsHtml(m);
        html += this._equipmentHtml(m);

        const body = this.modal.show(html, { width: 520, onBack: () => this.showList(), onClose: this.onClose, view: `member:${name}` });
        wireTips(body);
        drawSprites(body, run.party, this.skin);
        body.querySelectorAll('[data-learn]').forEach(b => b.addEventListener('click', () => {
            if (run.learn(m.name, b.dataset.learn)) { Sound.playSfx('skill_learned'); this._changed(); this.showMember(m.name); }
        }));
        body.querySelectorAll('[data-upgrade]').forEach(b => b.addEventListener('click', () => {
            if (run.upgrade(m.name, b.dataset.upgrade)) { Sound.playSfx('skill_learned', { semitones: 2 }); this._changed(); this.showMember(m.name); }
        }));
        body.querySelectorAll('[data-promote]').forEach(b => b.addEventListener('click', () => {
            if (run.promote(m.name, b.dataset.promote)) { Sound.playSfx('promote'); this._changed(); this.showMember(m.name); }
        }));
        body.querySelectorAll('select[data-slot]').forEach(sel => sel.addEventListener('change', () => {
            m.loadout[sel.dataset.slot] = sel.value || null;
            this._changed();
            this.showMember(m.name);
        }));
        body.querySelectorAll('[data-equip-slot]').forEach(b => b.addEventListener('click', () => this.showEquipPicker(m.name, b.dataset.equipSlot)));
        body.querySelector('[data-edit-plan]')?.addEventListener('click', () => this.showPlanEditor(m.name));
    }

    // The skill plan editor for this member's class (the same one as in Settings). Going back
    // applies the plan at once (onChange auto-spends), so the member view is current.
    showPlanEditor(name) {
        const m = this.run.member(name);
        if (!m) return this.showList();
        const job = plannedNext(m, loadPlans())?.job ?? m.job;
        const body = this.modal.show(`<div style="color:#ffcc44;font-weight:bold;font-size:15px;margin-bottom:8px;">Skill Plan</div><div data-plan-host></div>`,
            { width: 520, onBack: () => { this._changed(); this.showMember(name); }, onClose: this.onClose, view: `plan:${name}`, returnTo: `member:${name}` });
        renderSkillPlanEditor(body.querySelector('[data-plan-host]'), { job });
    }

    // One line on the member's skill plan: what it buys next, or that there is none.
    _planHtml(m) {
        const plans = loadPlans();
        const next = plannedNext(m, plans);
        let text;
        if (next) text = `<span style="color:#afa;">Next in plan:</span> ${esc(stepLabel(next))} · ${next.cost} SP`;
        else if (activePlans(m, plans).length) text = `<span style="color:#6a6;">Skill plan complete</span>`;
        else text = `<span style="color:#777;">No auto skill plan for this class</span>`;
        return `<div style="display:flex;gap:8px;align-items:center;justify-content:space-between;margin:8px 0 2px;font-size:11px;">
            <span>${text}</span>
            <button data-edit-plan style="padding:2px 8px;font-family:inherit;font-size:10px;border-radius:3px;background:#151528;border:1px solid #447;color:#ccc;cursor:pointer;white-space:nowrap;">Edit skill plan</button>
        </div>`;
    }

    _promotionHtml(m) {
        if (m.origin || JOB_DATA[m.job]?.tier !== 1) return '';
        const ready = canPromote(m) && this.run.status === 'active';
        let html = `<div style="margin-bottom:10px;padding:8px;border:1px solid ${ready ? '#664' : '#223'};border-radius:4px;background:#0c0c18;">
            <div style="color:#fc8;font-size:10px;text-transform:uppercase;margin-bottom:4px;">Promotion</div>`;
        if (!ready) {
            html += `<div style="color:#888;font-size:11px;">Promotes into a Tier 2 class at level ${PROMOTION_LEVEL}. Currently level ${m.level}. Every learned skill carries over.</div>`;
        } else {
            html += `<div style="color:#fc6;font-size:11px;">Ready to promote! Pick a Tier 2 class. Every learned skill carries over.</div>`;
        }
        for (const job of promotionOptions(m)) {
            const kit = Object.keys(JOB_DATA[job].learnable).map(abilityName).join(', ');
            html += `<div style="margin-top:6px;">
                <button data-promote="${job}" style="${BTN}${ready ? BTN_GOLD : BTN_DISABLED}margin-bottom:2px;" ${ready ? '' : 'disabled'}>★ ${jobLabel(job)}</button>
                <div style="color:#888;font-size:10px;line-height:1.4;">${esc(jobDesc(job))}<br><span style="color:#99a;">Skills: ${esc(kit)}</span></div>
            </div>`;
        }
        return html + `</div>`;
    }

    // The member's skill trees: learn new skills (prerequisites first) and upgrade
    // learned ones. Anything affordable right now glows.
    _skillsHtml(m) {
        const btn = (attr, label, on) => `<button ${attr} style="padding:2px 8px;font-family:inherit;font-size:10px;border-radius:3px;white-space:nowrap;
            background:${on ? '#122012' : '#111'};border:1px solid ${on ? '#6f6' : '#333'};color:${on ? '#afa' : '#555'};cursor:${on ? 'pointer' : 'not-allowed'};${on ? GLOW : 'pointer-events:none;'}" ${on ? '' : 'disabled'}>${label}</button>`;
        let html = this._planHtml(m);
        for (const job of memberJobs(m)) {
            const def = JOB_DATA[job];
            html += `<div style="color:#fc8;font-size:10px;text-transform:uppercase;margin:10px 0 4px;">${esc(def.skillsetName)} <span style="color:#666;">(${jobLabel(job)})</span></div>`;
            for (const [key, skill] of Object.entries(def.learnable)) {
                const learned = isLearned(m, key);
                const rank = skillRank(m, key);
                const slot = abilitySlot(key);
                const tag = slot === 'action' ? '' : `<span style="color:#a8f;font-size:9px;text-transform:uppercase;"> ${slot}</span>`;
                const shown = learned ? rankedKey(key, rank) : key;
                const indent = skill.requires ? 'padding-left:14px;' : '';
                let right;
                if (!learned) {
                    const why = learnBlocker(m, key);
                    right = btn(`data-learn="${key}"`, why === null ? `Learn · ${skill.sp} SP` : esc(why), why === null);
                } else if (isUpgradeable(key) && rank < MAX_RANK) {
                    // Hovering shows what the next rank changes. The wrapper holds the tooltip, so
                    // it shows even while the button is disabled (disabled buttons get no hover).
                    const tip = [`${abilityName(rankedKey(key, rank + 1))}:`, ...rankChanges(key, rank)].join('\n');
                    right = `<span data-tip="${esc(tip)}" style="display:inline-block;">${btn(`data-upgrade="${key}"`, `Upgrade → ${NUMERAL[rank + 1]} · ${upgradeCost(m, key)} SP`, canUpgrade(m, key))}</span>`;
                } else {
                    right = `<span style="color:#6a6;font-size:10px;">✓ ${isUpgradeable(key) ? 'max rank' : 'learned'}</span>`;
                }
                const req = skill.requires && !learned ? `<span style="color:#666;font-size:9px;"> ↳ after ${esc(abilityName(skill.requires))}</span>` : '';
                html += `<div style="display:flex;gap:8px;align-items:flex-start;padding:4px 0;border-bottom:1px solid #1a1a2a;${indent}">
                    <div style="flex:1;">
                        <div style="color:${learned ? '#ddd' : '#999'};">${skill.requires ? '<span style="color:#446;">↳ </span>' : ''}${esc(abilityName(shown))}${tag}${req}</div>
                        <div style="color:#667;font-size:10px;line-height:1.4;">${esc(abilityTooltip(shown))}</div>
                    </div>
                    <div style="flex-shrink:0;">${right}</div>
                </div>`;
            }
        }
        html += `<div style="color:#556;font-size:10px;margin-top:4px;">Each upgrade rank adds 20% power, cuts the MP cost by 15% and makes buffs and debuffs 25% stronger. Reactions trigger more often, and rank III adds a turn to any status the skill inflicts.</div>`;
        const grants = equipmentGrants(m.appearance);
        if (grants.actions.length) {
            html += `<div style="color:#7bf;font-size:10px;text-transform:uppercase;margin:8px 0 4px;">From equipment</div>`;
            for (const key of grants.actions) {
                html += `<div style="padding:3px 0;"><span style="color:#ddd;">${esc(abilityName(key))}</span>
                    <div style="color:#667;font-size:10px;">${esc(abilityTooltip(key))}</div></div>`;
            }
        }
        return html;
    }

    _slotsHtml(m) {
        let html = `<div style="color:#fc8;font-size:10px;text-transform:uppercase;margin:10px 0 4px;">Passive slots</div>`;
        for (const slot of LOADOUT_SLOTS) {
            const opts = equippable(m, slot);
            const cur = m.loadout?.[slot] || '';
            html += `<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
                <span style="width:70px;color:#a8f;font-size:10px;text-transform:uppercase;">${slot}</span>
                <select data-slot="${slot}" style="flex:1;background:#151528;color:#ccc;border:1px solid #447;padding:3px;font-family:inherit;font-size:11px;border-radius:3px;">
                    <option value="">${opts.length ? '— none —' : '— none learned —'}</option>
                    ${opts.map(k => `<option value="${k}" ${k === cur ? 'selected' : ''}>${esc(abilityName(rankedKey(k, skillRank(m, k))))}</option>`).join('')}
                </select>
            </div>`;
            if (cur) html += `<div style="color:#667;font-size:10px;margin:-2px 0 6px 78px;">${esc(ABILITIES[cur]?.desc || '')}</div>`;
        }
        // Gear passives don't use a slot: they work on top of the chosen ones.
        const bonus = buildLoadout(m).bonusPassives;
        if (bonus.length) {
            html += `<div style="color:#7bf;font-size:10px;text-transform:uppercase;margin:8px 0 4px;">From equipment · always on</div>`;
            for (const k of bonus) {
                html += `<div style="padding:2px 0;"><span style="color:#ddd;">${esc(abilityName(k))}</span>
                    <span style="color:#a8f;font-size:9px;text-transform:uppercase;"> ${esc(ABILITIES[k]?.slot)}</span>
                    <div style="color:#667;font-size:10px;">${esc(ABILITIES[k]?.desc || '')}</div></div>`;
            }
        }
        return html;
    }

    _equipmentHtml(m) {
        let html = `<div style="color:#fc8;font-size:10px;text-transform:uppercase;margin:10px 0 4px;">Equipment</div>`;
        for (const field of EQUIP_FIELDS) {
            const key = m.appearance?.[field];
            html += `<div style="display:flex;gap:8px;align-items:center;padding:4px 0;border-bottom:1px solid #1a1a2a;">
                <span style="width:52px;color:#778;font-size:10px;text-transform:uppercase;">${SLOT_LABEL[field]}</span>
                ${itemIconHtml(key)}
                <div style="flex:1;min-width:0;">
                    <div>${key ? itemTitle(key) : '<span style="color:#555;">empty</span>'}</div>
                    ${key ? `<div style="color:#778;font-size:10px;">${esc(itemSummary(key))}</div>` : ''}
                </div>
                <button data-equip-slot="${field}" style="padding:2px 8px;font-family:inherit;font-size:10px;background:#151528;border:1px solid #447;color:#9cf;border-radius:3px;cursor:pointer;">Change</button>
            </div>`;
        }
        return html;
    }

    // The equipment screen, on this member with the bag filtered to the slot. Back returns here.
    showEquipPicker(name, field) {
        this.gear.show(name, { slot: field, onBack: () => this.showMember(name), onClose: this.onClose });
    }
}
