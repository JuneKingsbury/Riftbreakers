// The battle breakdown on the result screen: per unit, damage dealt, damage taken, healing
// done and knockouts (from TacticalBattle.stats, battle-stats.js). Allies show by default and
// a toggle switches to enemies. Clicking a row opens that unit's split by ability.
//
// Each measure is its own small bar chart, scaled to the largest value in that column, so a
// healer's bars stay readable next to a damage dealer's. Bar colors were checked with the
// dataviz palette validator against the panel's surface (#14141f, dark, all pairs pass).
import { ABILITIES } from './abilities.js';
import { STATUSES } from '../content/vocab.js';

const SURFACE = '#14141f';
/** The bar measures, in column order: field, header, bar color. */
export const MEASURES = [
    { field: 'dealt',  label: 'Damage',  color: '#d95926' },
    { field: 'taken',  label: 'Taken',   color: '#3987e5' },
    { field: 'healed', label: 'Healing', color: '#199e70' },
];
const INK = '#d8d8e4', INK_DIM = '#8a8aa0', INK_MUTED = '#5c5c70';

function esc(text) {
    return String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

/** A display name for an ability key, or for a status's ticks ('status:poison' → Poison). */
export function sourceName(key) {
    if (key?.startsWith('status:')) return STATUSES[key.slice(7)]?.name ?? key.slice(7);
    if (key?.startsWith('fx:')) return key.slice(3);   // a relic's (or boss's) trigger, by name
    return ABILITIES[key]?.name ?? key;
}

// One unit's ability split: what each ability did and its share of the unit's total.
function abilityTable(row) {
    if (row.abilities.length === 0) {
        return `<div style="color:${INK_MUTED};font-size:10px;padding:4px 0 6px 8px;">No damage or healing this fight.</div>`;
    }
    const pct = (v, total) => total > 0 ? ` <span style="color:${INK_MUTED};">${Math.round(v / total * 100)}%</span>` : '';
    const cell = (v, total) => v > 0 ? `${v}${pct(v, total)}` : `<span style="color:${INK_MUTED};">·</span>`;
    let html = `<table style="width:100%;border-collapse:collapse;font-size:10px;color:${INK_DIM};margin:2px 0 6px;">
        <tr style="color:${INK_MUTED};"><th style="text-align:left;font-weight:normal;padding:1px 4px 1px 8px;">Ability</th>
        <th style="text-align:right;font-weight:normal;padding:1px 4px;">Damage</th>
        <th style="text-align:right;font-weight:normal;padding:1px 4px;">Healing</th>
        <th style="text-align:right;font-weight:normal;padding:1px 4px;">KOs</th>
        <th style="text-align:right;font-weight:normal;padding:1px 4px;">Uses</th></tr>`;
    for (const a of row.abilities) {
        html += `<tr><td style="text-align:left;padding:1px 4px 1px 8px;color:${INK};">${esc(sourceName(a.key))}</td>
            <td style="text-align:right;padding:1px 4px;">${cell(a.dealt, row.dealt)}</td>
            <td style="text-align:right;padding:1px 4px;">${cell(a.healed, row.healed)}</td>
            <td style="text-align:right;padding:1px 4px;">${a.kos || `<span style="color:${INK_MUTED};">·</span>`}</td>
            <td style="text-align:right;padding:1px 4px;">${a.uses || `<span style="color:${INK_MUTED};">·</span>`}</td></tr>`;
    }
    return html + '</table>';
}

// A bar with its value at the tip. Zero shows just the value, so the row still reads.
function bar(value, max, color, isTop, label, name) {
    const w = max > 0 ? Math.max(value > 0 ? 3 : 0, Math.round(value / max * 100)) : 0;
    return `<div title="${esc(`${name}: ${value} ${label.toLowerCase()}`)}" style="display:flex;align-items:center;gap:4px;min-width:0;padding:3px 0;">
        <div style="flex:1;min-width:0;height:8px;position:relative;">
            <div style="position:absolute;left:0;top:0;bottom:0;width:${w}%;background:${color};border-radius:0 4px 4px 0;"></div>
        </div>
        <span style="font-size:10px;min-width:28px;text-align:right;color:${isTop ? INK : INK_DIM};font-weight:${isTop ? 'bold' : 'normal'};">${value}</span>
    </div>`;
}

/**
 * The breakdown panel's HTML for `team`, with the rows in `open` (unit ids) expanded.
 * @param {import('./battle-stats.js').BattleStats} stats
 * @param {'player'|'enemy'} team
 * @param {Set<number>} open
 */
export function breakdownHtml(stats, team, open) {
    const rows = stats.rows(team);
    const max = Object.fromEntries(MEASURES.map(m => [m.field, Math.max(0, ...rows.map(r => r[m.field]))]));
    const maxKos = Math.max(0, ...rows.map(r => r.kos));
    const grid = 'display:grid;grid-template-columns:minmax(64px,1.1fr) repeat(3,minmax(54px,1fr)) 30px;column-gap:8px;align-items:center;';
    const tab = (t, label) => `<button data-bd-team="${t}" style="padding:3px 12px;font-family:inherit;font-size:11px;cursor:pointer;border:1px solid #446;
        ${t === team ? `background:#2a2a48;color:${INK};` : `background:transparent;color:${INK_DIM};`}
        border-radius:${t === 'player' ? '4px 0 0 4px' : '0 4px 4px 0'};">${label}</button>`;

    let html = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
        <span style="color:${INK};font-size:12px;font-weight:bold;">Battle breakdown</span>
        <span style="display:flex;">${tab('player', 'Allies')}${tab('enemy', 'Enemies')}</span></div>
        <div style="${grid}color:${INK_MUTED};font-size:9px;text-transform:uppercase;letter-spacing:1px;padding:0 4px 3px;border-bottom:1px solid #2a2a40;">
            <span>Name</span>${MEASURES.map(m => `<span style="display:flex;align-items:center;gap:4px;"><span style="width:8px;height:8px;border-radius:2px;background:${m.color};flex-shrink:0;"></span>${m.label}</span>`).join('')}
            <span style="text-align:right;">KOs</span></div>`;
    if (rows.length === 0) html += `<div style="color:${INK_MUTED};font-size:11px;padding:8px 4px;">No one fought on this side.</div>`;
    for (const r of rows) {
        const isOpen = open.has(r.id);
        html += `<div data-bd-row="${r.id}" role="button" tabindex="0" aria-expanded="${isOpen}" title="Show ${esc(r.name)}'s abilities"
            style="${grid}padding:1px 4px;cursor:pointer;border-radius:3px;${isOpen ? 'background:#1e1e34;' : ''}">
            <span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;color:${INK};">
                <span style="color:${INK_MUTED};font-size:9px;">${isOpen ? '▾' : '▸'}</span> ${esc(r.name)}${r.fromSummons ? `<br><span style="color:${INK_MUTED};font-size:9px;padding-left:10px;" title="Includes damage and hits taken by this unit's summons">+summons</span>` : ''}</span>
            ${MEASURES.map(m => bar(r[m.field], max[m.field], m.color, r[m.field] > 0 && r[m.field] === max[m.field], m.label, r.name)).join('')}
            <span style="text-align:right;font-size:10px;color:${r.kos > 0 && r.kos === maxKos ? INK : INK_DIM};font-weight:${r.kos > 0 && r.kos === maxKos ? 'bold' : 'normal'};">${r.kos}</span>
        </div>`;
        if (isOpen) html += `<div style="background:#1a1a2c;border-radius:3px;margin:0 0 3px;">${abilityTable(r)}</div>`;
    }
    return html;
}

/**
 * Shows the breakdown in `el` and keeps it interactive (team toggle, rows that open).
 * @param {HTMLElement} el
 * @param {import('./battle-stats.js').BattleStats} stats
 */
export function mountBreakdown(el, stats) {
    let team = 'player';
    const open = new Set();
    el.style.cssText = `background:${SURFACE};border:1px solid #2a2a40;border-radius:6px;padding:8px 10px;
        width:min(560px,92vw);max-height:42vh;overflow-y:auto;text-align:left;pointer-events:auto;box-sizing:border-box;`;
    const draw = () => { el.innerHTML = breakdownHtml(stats, team, open); };
    const toggleRow = (rowEl) => {
        const id = Number(rowEl.dataset.bdRow);
        if (open.has(id)) open.delete(id); else open.add(id);
        draw();
    };
    el.addEventListener('click', (e) => {
        const t = e.target.closest('[data-bd-team]');
        if (t) { team = t.dataset.bdTeam; open.clear(); draw(); return; }
        const row = e.target.closest('[data-bd-row]');
        if (row) toggleRow(row);
    });
    el.addEventListener('keydown', (e) => {
        const row = e.target.closest?.('[data-bd-row]');
        if (row && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toggleRow(row); }
    });
    draw();
}
