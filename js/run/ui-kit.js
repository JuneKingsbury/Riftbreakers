// Shared DOM helpers for the run screens: button styles, a modal with a back
// stack, toasts, labels and sprite drawing.
import { ABILITIES } from '../tactical/data-registry.js';
import { JOB_DATA } from '../tactical/data/jobs.js';
import { EQUIPMENT, EQUIP_STAT_KEYS, itemRarity, itemName } from '../tactical/data/equipment.js';
import { Sound } from '../audio/sound.js';

export const FONT = `'Courier New',monospace`;

export const BTN = `
    display:block; width:100%; padding:6px 10px; margin-bottom:5px;
    background:#151528; border:1px solid #447; color:#ccc;
    font-family:${FONT}; font-size:12px;
    cursor:pointer; text-align:left; border-radius:3px;
`;
export const BTN_DISABLED = 'opacity:0.4;cursor:not-allowed;';
export const BTN_GOOD = 'color:#afa;border-color:#4a8;background:#122012;';
export const BTN_GOLD = 'color:#fc8;border-color:#664;';
export const BTN_DANGER = 'color:#f99;border-color:#744;';

// Highlight for anything the player can act on now (e.g. unspent skill points).
export const GLOW = 'box-shadow:0 0 7px rgba(110,255,110,0.55);border-color:#6f6;';

export const RARITY_COLOR = { common: '#ccc', uncommon: '#7bf', rare: '#fc6' };

export const NODE_INFO = {
    combat:   { label: 'Battle',   icon: '⚔', color: '#d66' },
    elite:    { label: 'Elite',    icon: '☠', color: '#f80' },
    boss:     { label: 'Boss',     icon: '♛', color: '#f44' },
    event:    { label: 'Event',    icon: '?',      color: '#9cf' },
    shop:     { label: 'Shop',     icon: '$',      color: '#fc6' },
    rest:     { label: 'Rest',     icon: '♨', color: '#8d8' },
    treasure: { label: 'Treasure', icon: '✦', color: '#ec4' },
    recruit:  { label: 'Recruit',  icon: '+',      color: '#c9f' },
};

export function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

export function titleCase(key) {
    return String(key || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function jobLabel(job) {
    return titleCase(job);
}

export function abilityName(key) {
    return ABILITIES[key]?.name || titleCase(key);
}

export function itemLabel(key) {
    return itemName(key);
}

// "ATK +8, DEF -1" for an item's stat bonuses.
export function itemStats(key) {
    const item = EQUIPMENT[key];
    if (!item) return '';
    const label = { maxHp: 'HP', maxMp: 'MP' };
    return EQUIP_STAT_KEYS.filter(s => item[s])
        .map(s => `${(label[s] || s).toUpperCase()} ${item[s] > 0 ? '+' : ''}${item[s]}`).join(', ');
}

// One-line description of an item: stats, then any ability it grants.
export function itemSummary(key) {
    const item = EQUIPMENT[key];
    if (!item) return '';
    const parts = [itemStats(key)];
    for (const a of item.grants || []) parts.push(`grants ${abilityName(a)}`);
    for (const a of item.grantsPassive || []) parts.push(`+${abilityName(a)}, always-on ${ABILITIES[a]?.slot ?? 'passive'}`);
    return parts.filter(Boolean).join(' · ');
}

export function itemTitle(key) {
    const rarity = itemRarity(key);
    const item = EQUIPMENT[key];
    // Enchanted items get a violet "+N" after their rarity-coloured base name.
    const lv = item?.enchant || 0;
    const name = lv ? esc(itemLabel(key).replace(/ \+\d$/, '')) + ` <span style="color:#d9a6ff;font-weight:bold;">+${lv}</span>` : esc(itemLabel(key));
    return `<span style="color:${RARITY_COLOR[rarity]};">${name}</span>`
        // Boots and trinkets have no sub-type, so just the slot ("boots", not "boots · Boots").
        + ` <span style="color:#667;font-size:10px;">${esc(item?.slot)}${item?.type && item.type !== item.slot ? ` · ${esc(titleCase(item.type))}` : ''}</span>`;
}

export function abilityTooltip(key) {
    const ab = ABILITIES[key];
    if (!ab) return '';
    const bits = [];
    if ((ab.slot ?? 'action') === 'action') {
        if (ab.mpCost) bits.push(`${ab.mpCost} MP`);
        if (ab.range != null) bits.push(`range ${ab.range}`);
        if (ab.aoe) bits.push(`area ${ab.aoe}`);
    }
    return `${bits.length ? `[${bits.join(', ')}] ` : ''}${ab.desc || ''}`;
}

export function jobDesc(job) {
    return JOB_DATA[job]?.desc || '';
}

export function hpBar(hp, max, width = 100) {
    const frac = Math.max(0, Math.min(1, hp / max));
    const color = frac > 0.6 ? '#4c4' : frac > 0.3 ? '#cc4' : '#d44';
    return `<div style="width:${width}px;height:6px;background:#222;border:1px solid #333;border-radius:2px;overflow:hidden;display:inline-block;vertical-align:middle;">
        <div style="width:${Math.round(frac * 100)}%;height:100%;background:${color};"></div></div>`;
}

export function xpBar(xp, perLevel, width = 80) {
    const frac = Math.max(0, Math.min(1, xp / perLevel));
    return `<div style="width:${width}px;height:5px;background:#222;border:1px solid #333;border-radius:2px;overflow:hidden;display:inline-block;vertical-align:middle;">
        <div style="width:${Math.round(frac * 100)}%;height:100%;background:#7bf;"></div></div>`;
}

// Unspent skill points; glowing when something can be bought with them.
export function spBadge(member, canSpend, long = false) {
    const sp = member.sp || 0;
    if (!sp) return long ? '<span style="color:#666;">No skill points</span>' : '';
    const label = long ? `${sp} skill point${sp > 1 ? 's' : ''} to spend` : `${sp} SP`;
    return canSpend
        ? `<span style="color:#afa;font-weight:bold;padding:0 5px;border:1px solid #6f6;border-radius:3px;${GLOW}">● ${label}</span>`
        : `<span style="color:#8a8;">${label}</span>`;
}

export function drawPortrait(canvas, member, skinManager) {
    const a = member?.appearance;
    if (!a || !skinManager) return;
    const img = skinManager.getCompositedColonistSprite(
        'run_' + member.name, false,
        a.race, a.armorKey, a.helmetKey,
        a.bodyVariant, a.hairVariant, a.shirtVariant,
        a.nameColor, a.weaponKey, a.toolKey, null, false,
    );
    if (!img) return;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
}

// Draws every <canvas class="rk-portrait" data-member> and <canvas class="rk-item" data-item> under root.
export function drawSprites(root, party, skinManager) {
    if (!skinManager) return;
    root.querySelectorAll('canvas.rk-portrait').forEach(c => {
        drawPortrait(c, party.find(m => m.name === c.dataset.member), skinManager);
    });
    root.querySelectorAll('canvas.rk-item').forEach(c => {
        const sprite = skinManager.getItemSprite(c.dataset.item);
        if (!sprite) return;
        const ctx = c.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(sprite, 0, 0, c.width, c.height);
    });
}

export function portraitHtml(member, size = 32) {
    return `<canvas class="rk-portrait" data-member="${esc(member.name)}" width="${size}" height="${size}"
        style="image-rendering:pixelated;flex-shrink:0;border:1px solid #446;border-radius:3px;background:#080818;"></canvas>`;
}

export function itemIconHtml(key, size = 20) {
    return key ? `<canvas class="rk-item" data-item="${esc(key)}" width="${size}" height="${size}"
        style="image-rendering:pixelated;flex-shrink:0;vertical-align:middle;"></canvas>` : '';
}

// A centred modal panel. show() replaces its content; Esc, the backdrop and the
// Close button call back(), which runs the current onBack (or closes).
//   opts.dismissible  false: Esc/backdrop do nothing and there is no Close button
//   opts.onBack       Called instead of closing (e.g. return to a parent view)
//   opts.width        Panel max width in px
//   opts.view         Name of the view shown. Re-showing the same view (e.g. after buying
//                     something) keeps the scroll position, as does going back to opts.returnTo.
//   opts.returnTo     The view this one was opened from
export class Modal {
    constructor(zIndex = 300) {
        this.el = document.createElement('div');
        this.el.style.cssText = `
            display:none; position:fixed; inset:0; z-index:${zIndex};
            background:rgba(0,0,0,0.7); align-items:center; justify-content:center;
            pointer-events:auto; font-family:${FONT}; font-size:12px; color:#ccc;
        `;
        document.body.appendChild(this.el);
        this.el.addEventListener('click', (e) => { if (e.target === this.el) this.back(); });
        this._onKey = (e) => {
            if (e.key === 'Escape' && this.isOpen) { e.preventDefault(); this.back(); }
        };
        document.addEventListener('keydown', this._onKey);
        this._opts = {};
        this._scrolls = {};
    }

    get isOpen() {
        return this.el.style.display !== 'none';
    }

    get body() {
        return this.el.querySelector('.rk-modal-body');
    }

    show(html, opts = {}) {
        const prev = this._opts;
        const prevScroll = this.isOpen ? (this.body?.scrollTop ?? 0) : 0;
        if (prev.view) this._scrolls[prev.view] = prevScroll;
        const restore = opts.view && this.isOpen && (opts.view === prev.view || opts.view === prev.returnTo)
            ? this._scrolls[opts.view] ?? 0
            : 0;
        this._opts = opts;
        hideTip();   // the content it pointed at is about to be replaced
        const dismissible = opts.dismissible !== false;
        if (!this.isOpen) Sound.playSfx('panel');
        this.el.innerHTML = `
            <div class="rk-modal-body" style="background:#0d0d1e;border:1px solid #447;border-radius:8px;
                        padding:18px 22px;max-width:${opts.width || 460}px;width:92%;max-height:84vh;
                        overflow-y:auto;overflow-x:hidden;box-sizing:border-box;position:relative;">
                ${html}
                ${dismissible ? `<button class="rk-close" style="${BTN}margin-top:12px;color:#888;text-align:center;">${opts.onBack ? '‹ Back' : 'Close'}</button>` : ''}
            </div>`;
        this.el.style.display = 'flex';
        this.el.querySelector('.rk-close')?.addEventListener('click', () => this.back());
        this.body.scrollTop = restore;
        return this.body;
    }

    back() {
        if (this._opts.dismissible === false) return;
        const fn = this._opts.onBack;
        if (fn) { fn(); return; }
        this.close();
    }

    close() {
        if (!this.isOpen) return;
        hideTip();
        Sound.playSfx('panel');
        this.el.style.display = 'none';
        this.el.innerHTML = '';
        const done = this._opts.onClose;
        this._opts = {};
        done?.();
    }

    destroy() {
        document.removeEventListener('keydown', this._onKey);
        this.el.remove();
    }
}

// ---- Hover tips ----
// Any element inside `root` with a data-tip attribute shows a styled tip: on hover with a
// mouse, or on tap with touch (where hovering doesn't exist). The text may have line breaks;
// the first line is shown as a heading. Disabled buttons get no pointer events, so put the
// data-tip on a wrapper around them (with pointer-events:none on the button).
let tipEl = null, tipTimer = 0;
function tipBox() {
    if (tipEl?.isConnected) return tipEl;
    tipEl = document.createElement('div');
    tipEl.style.cssText = `position:fixed; z-index:2000; display:none; pointer-events:none;
        background:rgba(8,8,24,0.97); border:1px solid #559; border-radius:5px; padding:7px 10px;
        font-family:${FONT}; font-size:11px; color:#ccc; line-height:1.5; max-width:240px;
        box-shadow:0 4px 16px rgba(0,0,0,0.7);`;
    document.body.appendChild(tipEl);
    return tipEl;
}
function placeTip(x, y) {
    const el = tipBox(), pad = 12;
    const w = el.offsetWidth, h = el.offsetHeight;
    el.style.left = `${Math.max(4, Math.min(window.innerWidth - w - 4, x + pad))}px`;
    el.style.top = `${y + pad + h > window.innerHeight ? Math.max(4, y - h - pad) : y + pad}px`;
}
function showTip(text, x, y) {
    const el = tipBox();
    const [head, ...rest] = String(text).split('\n');
    el.innerHTML = `<div style="color:#fc8;font-weight:bold;">${esc(head)}</div>${rest.map(l => `<div>${esc(l)}</div>`).join('')}`;
    el.style.display = 'block';
    placeTip(x, y);
}
export function hideTip() {
    clearTimeout(tipTimer);
    if (tipEl) tipEl.style.display = 'none';
}
export function wireTips(root) {
    if (!root || root._tipsWired) return;
    root._tipsWired = true;
    const target = (e) => e.target.closest?.('[data-tip]');
    root.addEventListener('pointerover', (e) => {
        if (e.pointerType === 'touch') return;
        const t = target(e);
        if (t) showTip(t.dataset.tip, e.clientX, e.clientY);
    });
    root.addEventListener('pointermove', (e) => {
        if (e.pointerType === 'touch') return;
        if (target(e)) placeTip(e.clientX, e.clientY); else hideTip();
    });
    root.addEventListener('pointerout', (e) => {
        if (!e.relatedTarget || !target({ target: e.relatedTarget })) hideTip();
    });
    // Touch: a tap shows the tip for a few seconds (and still presses the button).
    root.addEventListener('pointerdown', (e) => {
        const t = target(e);
        if (e.pointerType !== 'touch') { hideTip(); return; }
        if (!t) return;
        showTip(t.dataset.tip, e.clientX, e.clientY - 40);
        clearTimeout(tipTimer);
        tipTimer = setTimeout(hideTip, 3000);
    });
}

export class Toast {
    constructor() {
        this.el = document.createElement('div');
        this.el.style.cssText = `
            display:none; position:fixed; bottom:60px; left:50%; transform:translateX(-50%);
            background:rgba(8,8,28,0.95); border:1px solid #557; border-radius:5px;
            padding:8px 20px; font-family:${FONT}; font-size:12px; color:#ddc; z-index:450;
            transition:opacity 0.4s; pointer-events:none;
        `;
        document.body.appendChild(this.el);
    }

    show(text, ms = 2800) {
        Sound.playSfx('notify');
        this.el.textContent = text;
        this.el.style.display = 'block';
        this.el.style.opacity = '1';
        clearTimeout(this._t);
        this._t = setTimeout(() => {
            this.el.style.opacity = '0';
            setTimeout(() => { this.el.style.display = 'none'; }, 400);
        }, ms);
    }

    destroy() {
        clearTimeout(this._t);
        this.el.remove();
    }
}
