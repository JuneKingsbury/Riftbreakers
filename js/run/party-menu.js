// Party menu: each member's level, HP, stats, skills to learn and upgrade with skill points, passive slots,
// equipment and promotion. Works on a RunState and saves it after every change.
import { createUnitFromCharData } from '../tactical/units.js';
import { ABILITIES } from '../tactical/data-registry.js';
import { JOB_DATA } from '../tactical/data/jobs.js';
import { EQUIPMENT, EQUIP_FIELDS, equipmentStatBonuses, equipmentGrants } from '../tactical/data/equipment.js';
import {
    LOADOUT_SLOTS, abilitySlot, isLearned, learnBlocker, memberJobs, equippable, skillRank, canUpgrade,
    upgradeCost, canSpendPoints, canPromote, promotionOptions, buildLoadout, PROMOTION_LEVEL, XP_PER_LEVEL,
} from '../tactical/loadout.js';
import { MAX_RANK, isUpgradeable, rankedKey } from '../tactical/data-registry.js';
import { relicStatMods } from './data/relics.js';
import {
    BTN, BTN_DISABLED, BTN_GOLD, GLOW, esc, jobLabel, abilityName, abilityTooltip, itemTitle,
    itemSummary, itemIconHtml, portraitHtml, drawSprites, hpBar, xpBar, spBadge, jobDesc,
} from './ui-kit.js';

const NUMERAL = ['', 'I', 'II', 'III'];

const SLOT_LABEL = { armorKey: 'Armor', helmetKey: 'Helmet', weaponKey: 'Weapon', toolKey: 'Tool' };
const STATS = [['maxHp', 'HP'], ['maxMp', 'MP'], ['atk', 'ATK'], ['def', 'DEF'], ['mat', 'MAT'], ['mdf', 'MDF'], ['spd', 'SPD'], ['move', 'MOV'], ['eva', 'EVA']];

function addMods(...mods) {
    const out = {};
    for (const m of mods) for (const [k, v] of Object.entries(m || {})) out[k] = (out[k] || 0) + v;
    return out;
}

// The member as a battle unit would be built (equipment and relics included), for its stats.
export function previewUnit(run, member) {
    return createUnitFromCharData({
        ...member,
        statMods: addMods(member.statMods, equipmentStatBonuses(member.appearance), relicStatMods(run.relics)),
    });
}

export class PartyMenu {
    // modal: a ui-kit Modal. onChange: called after any change (the caller saves the run).
    constructor(modal, run, skinManager, { onChange, onClose } = {}) {
        this.modal = modal;
        this.run = run;
        this.skin = skinManager;
        this.onChange = onChange || (() => {});
        this.onClose = onClose || null;
    }

    _changed() {
        this.onChange();
    }

    showList() {
        const run = this.run;
        let html = `<div style="color:#ffcc44;font-weight:bold;font-size:15px;margin-bottom:10px;">Party <span style="color:#888;font-size:11px;">(${run.party.length}/6)</span></div>`;
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
        drawSprites(body, run.party, this.skin);
        body.querySelectorAll('[data-learn]').forEach(b => b.addEventListener('click', () => {
            if (run.learn(m.name, b.dataset.learn)) { this._changed(); this.showMember(m.name); }
        }));
        body.querySelectorAll('[data-upgrade]').forEach(b => b.addEventListener('click', () => {
            if (run.upgrade(m.name, b.dataset.upgrade)) { this._changed(); this.showMember(m.name); }
        }));
        body.querySelectorAll('[data-promote]').forEach(b => b.addEventListener('click', () => {
            if (run.promote(m.name, b.dataset.promote)) { this._changed(); this.showMember(m.name); }
        }));
        body.querySelectorAll('select[data-slot]').forEach(sel => sel.addEventListener('change', () => {
            m.loadout[sel.dataset.slot] = sel.value || null;
            this._changed();
            this.showMember(m.name);
        }));
        body.querySelectorAll('[data-equip-slot]').forEach(b => b.addEventListener('click', () => this.showEquipPicker(m.name, b.dataset.equipSlot)));
    }

    _promotionHtml(m) {
        if (m.origin || JOB_DATA[m.job]?.tier !== 1) return '';
        const ready = canPromote(m);
        const here = this.run.canPromoteHere();
        let html = `<div style="margin-bottom:10px;padding:8px;border:1px solid ${ready ? '#664' : '#223'};border-radius:4px;background:#0c0c18;">
            <div style="color:#fc8;font-size:10px;text-transform:uppercase;margin-bottom:4px;">Promotion</div>`;
        if (!ready) {
            html += `<div style="color:#888;font-size:11px;">Reach level ${PROMOTION_LEVEL} (now ${m.level}) to promote into a Tier 2 job. You keep every skill you know.</div>`;
        } else if (!here) {
            html += `<div style="color:#aaa;font-size:11px;">Ready! Promote at a rest site or after defeating a boss.</div>`;
        }
        for (const job of promotionOptions(m)) {
            const kit = Object.keys(JOB_DATA[job].learnable).map(abilityName).join(', ');
            html += `<div style="margin-top:6px;">
                <button data-promote="${job}" style="${BTN}${ready && here ? BTN_GOLD : BTN_DISABLED}margin-bottom:2px;" ${ready && here ? '' : 'disabled'}>★ ${jobLabel(job)}</button>
                <div style="color:#888;font-size:10px;line-height:1.4;">${esc(jobDesc(job))}<br><span style="color:#99a;">Skills: ${esc(kit)}</span></div>
            </div>`;
        }
        return html + `</div>`;
    }

    // The member's skill trees: learn new skills (prerequisites first) and upgrade
    // learned ones. Anything affordable right now glows.
    _skillsHtml(m) {
        const btn = (attr, label, on) => `<button ${attr} style="padding:2px 8px;font-family:inherit;font-size:10px;border-radius:3px;white-space:nowrap;
            background:${on ? '#122012' : '#111'};border:1px solid ${on ? '#6f6' : '#333'};color:${on ? '#afa' : '#555'};cursor:${on ? 'pointer' : 'not-allowed'};${on ? GLOW : ''}" ${on ? '' : 'disabled'}>${label}</button>`;
        let html = '';
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
                    right = btn(`data-upgrade="${key}"`, `Upgrade → ${NUMERAL[rank + 1]} · ${upgradeCost(m, key)} SP`, canUpgrade(m, key));
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
        html += `<div style="color:#556;font-size:10px;margin-top:4px;">Upgrades: +20% power and -15% MP per rank; reactions trigger more often.</div>`;
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
            html += `<div style="color:#7bf;font-size:10px;text-transform:uppercase;margin:8px 0 4px;">From equipment (always on)</div>`;
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

    showEquipPicker(name, field) {
        const run = this.run;
        const m = run.member(name);
        const slot = field.replace('Key', '');
        const keys = Object.keys(run.inventory).filter(k => EQUIPMENT[k]?.slot === slot);
        let html = `<div style="color:#ffcc44;font-weight:bold;font-size:14px;margin-bottom:8px;">${esc(m.name)}: ${SLOT_LABEL[field]}</div>`;
        const cur = m.appearance?.[field];
        if (cur) {
            html += `<div style="color:#888;font-size:10px;margin-bottom:6px;">Equipped: ${itemTitle(cur)}<br>${esc(itemSummary(cur))}</div>
                <button data-pick="" style="${BTN}">Unequip</button>`;
        }
        if (!keys.length) html += `<div style="color:#666;margin:8px 0;">No ${slot} items in the bag.</div>`;
        for (const k of keys) {
            const ok = run.canEquip(m, k);
            html += `<button data-pick="${k}" style="${BTN}${ok ? '' : BTN_DISABLED}display:flex;gap:8px;align-items:center;" ${ok ? '' : 'disabled'}>
                ${itemIconHtml(k)}
                <span style="flex:1;">${itemTitle(k)} <span style="color:#888;">×${run.inventory[k]}</span><br>
                <span style="color:#889;font-size:10px;">${esc(itemSummary(k))}${ok ? '' : ` · ${jobLabel(m.job)} can't use this`}</span></span>
            </button>`;
        }
        const body = this.modal.show(html, { width: 460, onBack: () => this.showMember(name), onClose: this.onClose, view: `equip:${name}:${field}`, returnTo: `member:${name}` });
        drawSprites(body, run.party, this.skin);
        body.querySelectorAll('[data-pick]').forEach(b => b.addEventListener('click', () => {
            if (run.equip(name, field, b.dataset.pick || null)) this._changed();
            this.showMember(name);
        }));
    }
}
