// The equipment screen: one character at a time on a paper doll (their sprite with the four
// gear slots around it and their stats below), beside the party's shared bag. Tabs switch
// characters without leaving the screen, so the same bag can kit out the whole party.
//
// Hovering a bag item (or a first tap on touch screens) previews it: the doll wears it and
// the stats show what would change. Clicking it (or a second tap) equips it, and whatever was
// in that slot goes back to the bag. Clicking a worn item takes it off (back into the bag) and
// shows the bag for that slot. Clicking an empty slot just shows the bag for that slot.
import { Sound } from '../audio/sound.js';
import { EQUIPMENT, EQUIP_FIELDS } from '../tactical/data/equipment.js';
import { STATS, equipDelta, previewUnit } from './member-stats.js';
import { BTN, esc, jobLabel, titleCase, abilityName, itemTitle, itemSummary, itemIconHtml, portraitHtml, drawSprites, drawPortrait, FONT } from './ui-kit.js';

const SLOT_LABEL = { weaponKey: 'Weapon', armorKey: 'Armor', helmetKey: 'Helmet', toolKey: 'Tool', bootsKey: 'Boots', trinketKey: 'Trinket' };
const fieldOf = (key) => `${EQUIPMENT[key]?.slot}Key`;
const CHIP = `padding:3px 8px;font-family:${FONT};font-size:11px;border-radius:3px;cursor:pointer;width:auto;`;
const UP = '#7e7', DOWN = '#f77';

function deltaText(delta) {
    const bits = STATS.filter(([s]) => delta[s]).map(([s, label]) => {
        const v = delta[s];
        return `<span style="color:${v > 0 ? UP : DOWN};">${label} ${v > 0 ? '+' : '−'}${Math.abs(v)}</span>`;
    });
    return bits.length ? bits.join(' ') : '<span style="color:#667;">no stat change</span>';
}

export class GearScreen {
    // modal: a ui-kit Modal. onChange: called after any change (the caller saves the run).
    constructor(modal, run, skinManager, { onChange } = {}) {
        this.modal = modal;
        this.run = run;
        this.skin = skinManager;
        this.onChange = onChange || (() => {});
        this._onKey = (e) => {
            if (!this.modal.isOpen || this.modal._opts?.view !== 'gear') return;
            if (e.key === 'ArrowLeft') { e.preventDefault(); this._step(-1); }
            if (e.key === 'ArrowRight') { e.preventDefault(); this._step(1); }
        };
    }

    /**
     * Opens the screen on a member.
     * @param {string} [name]  The member to show (default: the first).
     * @param {{ slot?: string, onBack?: () => void, onClose?: () => void }} [opts]
     *   slot: an EQUIP_FIELDS name to filter the bag to. onBack: a Back button returns there.
     */
    show(name, { slot = null, onBack = null, onClose = null } = {}) {
        this._name = name ?? this.run.party[0]?.name;
        this._filter = slot;
        this._onBack = onBack;
        this._onCloseCb = onClose;
        this._armed = null;
        document.removeEventListener('keydown', this._onKey);
        document.addEventListener('keydown', this._onKey);
        this._render();
    }

    _step(d) {
        const party = this.run.party;
        const i = party.findIndex(m => m.name === this._name);
        this._name = party[(i + d + party.length) % party.length].name;
        this._armed = null;
        this._render();
    }

    _render() {
        const run = this.run;
        const m = run.member(this._name) ?? run.party[0];
        this._name = m.name;

        let html = `<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
            <div style="color:#ffcc44;font-weight:bold;font-size:15px;flex:1;">Equipment</div>
            <span style="color:#556;font-size:10px;">← → to switch</span></div>`;

        // Character tabs.
        html += `<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:10px;">
            <button data-gear-step="-1" aria-label="Previous character" style="${CHIP}background:#151528;border:1px solid #447;color:#ccc;">‹</button>`;
        for (const p of run.party) {
            const on = p.name === m.name;
            html += `<button data-gear-member="${esc(p.name)}" style="${CHIP}display:flex;gap:5px;align-items:center;
                background:${on ? '#1e2244' : '#11111f'};border:1px solid ${on ? '#99f' : '#335'};color:${on ? '#fff' : '#aab'};">
                ${portraitHtml(p, 18)}<span>${esc(p.name)}</span></button>`;
        }
        html += `<button data-gear-step="1" aria-label="Next character" style="${CHIP}background:#151528;border:1px solid #447;color:#ccc;">›</button></div>`;

        html += `<div style="display:flex;flex-wrap:wrap;gap:12px;align-items:flex-start;">`;
        html += `<div style="flex:1 1 280px;min-width:0;">${this._dollHtml(m)}</div>`;
        html += `<div style="flex:1 1 300px;min-width:0;">${this._bagHtml(m)}</div>`;
        html += `</div>`;

        const body = this.modal.show(html, {
            width: 860, view: 'gear',
            onBack: this._onBack ?? undefined,
            onClose: () => { document.removeEventListener('keydown', this._onKey); this._onCloseCb?.(); },
        });
        drawSprites(body, run.party, this.skin);
        this._body = body;
        this._drawDoll(m, m.appearance);
        this._wire(body, m);
        this._idle(m);
    }

    _slotHtml(m, field) {
        const key = m.appearance?.[field];
        const on = this._filter === field;
        return `<button data-gear-slot="${field}" style="${BTN}margin:0;padding:5px;text-align:center;
            ${on ? 'border-color:#99f;background:#1e2244;' : ''}">
            <div style="color:#778;font-size:9px;text-transform:uppercase;">${SLOT_LABEL[field]}</div>
            <div style="height:30px;display:flex;align-items:center;justify-content:center;">${key ? itemIconHtml(key, 28) : '<span style="color:#444;">·</span>'}</div>
            <div data-gear-slotname="${field}" style="font-size:10px;line-height:1.3;min-height:26px;">${key ? itemTitle(key).replace(/<span style="color:#667;font-size:10px;">.*?<\/span>/, '') : '<span style="color:#555;">empty</span>'}</div>
        </button>`;
    }

    _dollHtml(m) {
        const unit = previewUnit(this.run, m);
        const origin = m.origin ? `${jobLabel(m.origin)} → ` : '';
        let html = `<div style="background:#0a0a18;border:1px solid #223;border-radius:6px;padding:10px;">
            <div style="font-weight:bold;color:${m.appearance?.nameColor || '#ccc'};">${esc(m.name)}
                <span style="color:#889;font-size:10px;font-weight:normal;text-transform:uppercase;">· Lv ${m.level} ${esc(origin)}${esc(jobLabel(m.job))}</span></div>
            <div style="display:grid;grid-template-columns:1fr 96px 1fr;grid-template-rows:auto auto auto;gap:6px;align-items:center;margin-top:8px;">
                <div></div>${this._slotHtml(m, 'helmetKey')}<div></div>
                ${this._slotHtml(m, 'weaponKey')}
                <canvas class="gear-doll" width="96" height="96" style="image-rendering:pixelated;width:96px;height:96px;background:#080818;border:1px solid #335;border-radius:4px;"></canvas>
                ${this._slotHtml(m, 'toolKey')}
                ${this._slotHtml(m, 'trinketKey')}${this._slotHtml(m, 'armorKey')}${this._slotHtml(m, 'bootsKey')}
            </div>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:3px 8px;font-size:11px;margin-top:10px;padding-top:8px;border-top:1px solid #223;">`;
        for (const [s, label] of STATS) {
            html += `<div><span style="color:#778;">${label}</span> <span style="color:#ddd;">${unit[s]}</span><span data-gear-delta="${s}"></span></div>`;
        }
        html += `</div><div data-gear-hint style="color:#667;font-size:10px;margin-top:6px;min-height:14px;">Hover gear to compare.</div></div>`;
        return html;
    }

    _bagHtml(m) {
        const run = this.run;
        const bag = Object.keys(run.inventory).filter(k => EQUIPMENT[k] && run.inventory[k] > 0);
        const count = (field) => bag.filter(k => fieldOf(k) === field).reduce((n, k) => n + run.inventory[k], 0);
        const total = bag.reduce((n, k) => n + run.inventory[k], 0);

        const chip = (field, label, n) => {
            const on = this._filter === field;
            return `<button data-gear-filter="${field ?? ''}" style="${CHIP}background:${on ? '#1e2244' : '#11111f'};border:1px solid ${on ? '#99f' : '#335'};color:${on ? '#fff' : '#aab'};">${label} <span style="color:#667;">${n}</span></button>`;
        };
        let html = `<div style="color:#fc8;font-size:10px;text-transform:uppercase;margin-bottom:5px;">Bag</div>
            <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:8px;">${chip(null, 'All', total)}${EQUIP_FIELDS.map(f => chip(f, SLOT_LABEL[f], count(f))).join('')}</div>`;


        const shown = bag.filter(k => !this._filter || fieldOf(k) === this._filter);
        // Usable gear first, best improvement first, then everything this character can't use.
        const rows = shown.map(k => {
            const ok = run.canEquip(m, k);
            const d = ok ? equipDelta(run, m, fieldOf(k), k) : null;
            const gain = d ? Object.values(d.delta).reduce((a, b) => a + b, 0) : -Infinity;
            return { k, ok, d, gain };
        }).sort((a, b) => (b.ok - a.ok) || (b.gain - a.gain) || a.k.localeCompare(b.k));

        if (!rows.length) {
            html += `<div style="color:#666;font-size:11px;padding:8px 0;">${total ? 'Nothing in the bag for this slot.' : 'The bag is empty. Gear from battles and shops lands here.'}</div>`;
        }
        html += `<div style="display:flex;flex-direction:column;gap:4px;">`;
        for (const { k, ok, d } of rows) {
            const n = run.inventory[k];
            const reason = ok ? '' : `${jobLabel(m.job)} can't use ${titleCase(EQUIPMENT[k].type).toLowerCase()} gear`;
            html += `<button data-gear-item="${esc(k)}" ${ok ? '' : 'disabled'} style="${BTN}margin:0;display:flex;gap:8px;align-items:center;${ok ? '' : 'opacity:0.45;cursor:not-allowed;'}">
                ${itemIconHtml(k, 24)}
                <span style="flex:1;min-width:0;">${itemTitle(k)}${n > 1 ? ` <span style="color:#888;">×${n}</span>` : ''}
                    <div style="color:#889;font-size:10px;">${esc(itemSummary(k))}</div>
                    <div style="font-size:10px;margin-top:1px;">${ok ? deltaText(d.delta) : `<span style="color:#a77;">${esc(reason)}</span>`}</div>
                </span>
            </button>`;
        }
        html += `</div>`;
        return html;
    }

    _drawDoll(m, appearance) {
        const c = this._body?.querySelector('canvas.gear-doll');
        if (c) drawPortrait(c, { ...m, appearance }, this.skin);
    }

    // Shows (key) or clears (null) a preview of wearing an item.
    _preview(m, key) {
        const body = this._body;
        if (!body) return;
        const field = key ? fieldOf(key) : null;
        const d = key ? equipDelta(this.run, m, field, key) : null;
        for (const [s] of STATS) {
            const el = body.querySelector(`[data-gear-delta="${s}"]`);
            const v = d?.delta[s] ?? 0;
            el.innerHTML = v ? ` <span style="color:${v > 0 ? UP : DOWN};">→ ${d.after[s]}</span>` : '';
        }
        body.querySelectorAll('[data-gear-slot]').forEach(b => {
            b.style.outline = field && b.dataset.gearSlot === field ? '1px solid #fc8' : '';
        });
        const hint = body.querySelector('[data-gear-hint]');
        if (hint) {
            const cur = field ? m.appearance?.[field] : null;
            hint.innerHTML = key
                ? `${esc(EQUIPMENT[key].name)}${cur ? ` replaces ${esc(EQUIPMENT[cur].name)}` : ` goes in the empty ${SLOT_LABEL[field].toLowerCase()} slot`}. ${this._armed === key ? 'Tap again to equip.' : 'Click to equip.'}`
                : 'Hover gear to compare.';
        }
        this._drawDoll(m, key ? { ...m.appearance, [field]: key } : m.appearance);
    }

    // Shows (field) or clears (null) what the item worn in a slot gives: the same comparison
    // as for bag items, against wearing nothing there.
    _slotInfo(m, field) {
        const body = this._body;
        const key = field ? m.appearance?.[field] : null;
        if (!body) return;
        if (!key) { this._preview(m, null); return; }
        const { delta } = equipDelta(this.run, m, field, null);
        const gives = {};
        for (const [s] of STATS) gives[s] = -delta[s];
        for (const [s] of STATS) {
            const v = gives[s];
            body.querySelector(`[data-gear-delta="${s}"]`).innerHTML = v
                ? ` <span style="color:${v > 0 ? UP : DOWN};">(${v > 0 ? '+' : '−'}${Math.abs(v)})</span>` : '';
        }
        body.querySelectorAll('[data-gear-slot]').forEach(b => { b.style.outline = b.dataset.gearSlot === field ? '1px solid #fc8' : ''; });
        const hint = body.querySelector('[data-gear-hint]');
        if (hint) {
            const item = EQUIPMENT[key];
            const skills = [...(item.grants || []), ...(item.grantsPassive || [])].map(abilityName);
            const also = skills.length ? ` and ${esc(skills.join(', '))}` : '';
            const next = 'Click to take it off and see what could replace it.';
            hint.innerHTML = `${esc(item.name)} gives ${deltaText(gives)}${also}. ${next}`;
        }
        this._drawDoll(m, m.appearance);
    }

    // With nothing hovered: the selected slot's breakdown, if a slot is selected.
    _idle(m) {
        if (this._filter && m.appearance?.[this._filter]) this._slotInfo(m, this._filter);
        else this._preview(m, null);
    }

    _equip(m, field, key) {
        if (!this.run.equip(m.name, field, key)) return;
        Sound.playSfx('equip');
        this._armed = null;
        this.onChange();
        this._render();
    }

    _wire(body, m) {
        const on = (sel, fn) => body.querySelectorAll(sel).forEach(el => el.addEventListener('click', () => fn(el)));
        on('[data-gear-member]', el => { this._name = el.dataset.gearMember; this._armed = null; this._render(); });
        on('[data-gear-step]', el => this._step(Number(el.dataset.gearStep)));
        on('[data-gear-filter]', el => { this._filter = el.dataset.gearFilter || null; this._render(); });
        on('[data-gear-slot]', el => {
            const field = el.dataset.gearSlot;
            this._filter = field;
            if (m.appearance?.[field]) this._equip(m, field, null);   // re-renders
            else this._render();
        });
        // A click anywhere that isn't a control (empty space, the doll, the stats) drops the
        // selected slot and any tapped-but-not-equipped item, so the highlight and numbers clear.
        body.addEventListener('click', (e) => {
            if (e.target.closest('button, select, input, a')) return;
            if (!this._filter && !this._armed) return;
            this._filter = null;
            this._armed = null;
            this._render();
        });
        body.querySelectorAll('[data-gear-slot]').forEach(el => {
            el.addEventListener('pointerenter', (e) => { if (e.pointerType !== 'touch') this._slotInfo(m, el.dataset.gearSlot); });
            el.addEventListener('pointerleave', (e) => { if (e.pointerType !== 'touch') this._idle(m); });
        });

        let pointer = 'mouse';
        body.querySelectorAll('[data-gear-item]:not([disabled])').forEach(el => {
            const key = el.dataset.gearItem;
            el.addEventListener('pointerdown', (e) => { pointer = e.pointerType; });
            el.addEventListener('pointerenter', (e) => { if (e.pointerType !== 'touch') this._preview(m, key); });
            el.addEventListener('pointerleave', (e) => { if (e.pointerType !== 'touch' && !this._armed) this._idle(m); });
            el.addEventListener('click', () => {
                // Touch screens can't hover: the first tap previews, the second equips.
                if (pointer === 'touch' && this._armed !== key) {
                    this._armed = key;
                    body.querySelectorAll('[data-gear-item]').forEach(b => { b.style.borderColor = b === el ? '#fc8' : ''; });
                    this._preview(m, key);
                    return;
                }
                this._equip(m, fieldOf(key), key);
            });
        });
    }
}
