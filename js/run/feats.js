// Feats, from the title screen: a collection log of every item in the game (found or not yet
// found, across all runs), a bestiary of every boss and how often it has been beaten, and the
// most recent winning runs. All come from the profile (items, bossKills, recentWins), so they
// last between runs and travel with save exports.
import { EQUIPMENT, EQUIP_FIELDS } from '../tactical/data/equipment.js';
import { REALMS, ACT_REALMS } from './data/realms.js';
import { ENCOUNTERS } from './data/encounters.js';
import { loadProfile, RECENT_WINS, BOSS_IDS, COLLECTION_REWARDS } from './profile.js';
import {
    Modal, FONT, RARITY_COLOR, esc, jobLabel, itemLabel, itemSummary, itemIconHtml, portraitHtml, drawSprites, wireTips,
} from './ui-kit.js';

const SLOTS = [['weapon', 'Weapons'], ['armor', 'Armor'], ['helmet', 'Helmets'], ['tool', 'Tools'], ['boots', 'Boots'], ['trinket', 'Trinkets']];
const RARITY_ORDER = { common: 0, uncommon: 1, rare: 2 };
const TAB = `padding:5px 12px;font-family:${FONT};font-size:12px;border-radius:4px 4px 0 0;cursor:pointer;width:auto;`;

/** Every item in the game, grouped by slot and sorted by rarity then name. */
export function itemCatalog() {
    const out = {};
    for (const [slot] of SLOTS) {
        out[slot] = Object.keys(EQUIPMENT)
            .filter(k => EQUIPMENT[k].slot === slot)
            .sort((a, b) => (RARITY_ORDER[EQUIPMENT[a].rarity ?? 'common'] - RARITY_ORDER[EQUIPMENT[b].rarity ?? 'common'])
                || EQUIPMENT[a].name.localeCompare(EQUIPMENT[b].name));
    }
    return out;
}

/** Every boss, by act: [{ act, bosses: [{ id, name, realm }] }], in the order the acts list them. */
export function bossCatalog() {
    const defOf = (id) => Object.values(ENCOUNTERS).flatMap(z => z.boss ?? []).find(d => d.id === id);
    return Object.entries(ACT_REALMS).map(([act, realms]) => ({
        act: Number(act),
        bosses: realms.flatMap(r => (REALMS[r].bosses ?? []).filter(id => BOSS_IDS.includes(id))
            .map(id => ({ id, name: defOf(id)?.name ?? id, realm: r }))),
    }));
}

/** A share as a whole percent, rounded down so 100% means truly everything. */
export function percent(have, total) {
    return total ? Math.floor((have / total) * 100) : 0;
}

function when(iso) {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * Opens the Feats panel.
 * @param {object} [skinManager]  For item icons and portraits (none: text only).
 * @param {() => void} [onClose]
 */
export function showFeats(skinManager = globalThis._sharedSkinManager, onClose) {
    const profile = loadProfile();
    const found = new Set(profile.items);
    const catalog = itemCatalog();
    const total = Object.values(catalog).reduce((n, l) => n + l.length, 0);
    const bosses = bossCatalog();
    const bossTotal = bosses.reduce((n, a) => n + a.bosses.length, 0);
    const bossesBeaten = bosses.reduce((n, a) => n + a.bosses.filter(b => profile.bossKills[b.id] > 0).length, 0);
    const modal = new Modal(1200);
    let tab = 'items';

    const bar = (have, all, color) => `<div style="height:6px;background:#1a1a2a;border-radius:3px;overflow:hidden;margin:6px 0 2px;">
        <div style="height:100%;width:${percent(have, all)}%;background:${color};"></div></div>`;

    const itemsHtml = () => {
        const pct = percent(found.size, total);
        // The bar, with a bag over each reward's threshold (claimed: bright, ahead: dim).
        let markers = '';
        for (const [id, r] of Object.entries(COLLECTION_REWARDS)) {
            const got = profile.rewards.includes(id);
            const tip = `${r.at}% of items: ${r.label}\n${got ? 'Earned!' : r.item ? 'A unique trinket that can then be found in any run.' : 'A one-time bonus.'}`;
            markers += `<div data-tip="${esc(tip)}" style="position:absolute;left:${r.at}%;top:-20px;transform:translateX(-50%);text-align:center;">
                <canvas class="rk-item" data-item="wanderers_rations_pouch" width="18" height="18" style="image-rendering:pixelated;${got ? '' : 'filter:grayscale(0.8) brightness(0.6);'}"></canvas>
                <div style="width:2px;height:8px;margin:-2px auto 0;background:${got ? '#fc6' : '#556'};"></div></div>`;
        }
        let html = `<div style="margin-top:10px;font-size:11px;color:#ccd;">Collection: <b style="color:#8d8;">${pct}%</b>
            <span style="color:#778;">(${found.size} of ${total} items found)</span></div>
            <div style="position:relative;margin-top:22px;">${markers}${bar(found.size, total, '#6c6')}</div>
            <div style="display:flex;gap:12px;flex-wrap:wrap;font-size:10px;color:#889;margin-top:4px;">${Object.entries(COLLECTION_REWARDS).map(([id, r]) =>
                `<span>${profile.rewards.includes(id) ? '<span style="color:#fc6;">✓</span>' : '·'} ${r.at}%: ${esc(r.label)}</span>`).join('')}</div>`;
        for (const [slot, label] of SLOTS) {
            const keys = catalog[slot];
            const have = keys.filter(k => found.has(k)).length;
            html += `<div style="display:flex;justify-content:space-between;color:#fc8;font-size:10px;text-transform:uppercase;margin:10px 0 5px;">
                <span>${label}</span><span style="color:${have === keys.length ? '#8d8' : '#778'};">${have} / ${keys.length} · ${percent(have, keys.length)}%</span></div>
                <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:4px;">`;
            for (const k of keys) {
                const item = EQUIPMENT[k], got = found.has(k);
                const rarity = item.rarity ?? 'common';
                // Undiscovered items keep their name and stats secret: only the rarity and slot show.
                const tip = got ? `${itemLabel(k)}\n${rarity[0].toUpperCase()}${rarity.slice(1)} ${slot}\n${itemSummary(k)}` : `Undiscovered\n${rarity[0].toUpperCase()}${rarity.slice(1)} ${slot}`;
                html += `<div data-tip="${esc(tip)}" style="display:flex;gap:6px;align-items:center;padding:4px 6px;border-radius:3px;
                        background:${got ? '#121226' : '#0b0b16'};border:1px solid ${got ? '#334' : '#1c1c2a'};">
                    <span style="${got ? '' : 'filter:grayscale(1) brightness(0.35);'}">${itemIconHtml(k, 20)}</span>
                    <span style="font-size:10px;line-height:1.25;color:${got ? RARITY_COLOR[rarity] : '#555'};${got ? '' : 'font-style:italic;'}">${got ? esc(item.name) : 'Not found yet'}</span>
                </div>`;
            }
            html += `</div>`;
        }
        return html;
    };

    const bestiaryHtml = () => {
        let html = `<div style="margin-top:10px;font-size:11px;color:#ccd;">Bosses defeated: <b style="color:#fc6;">${percent(bossesBeaten, bossTotal)}%</b>
            <span style="color:#778;">(${bossesBeaten} of ${bossTotal})</span></div>${bar(bossesBeaten, bossTotal, '#d94')}`;
        for (const { act, bosses: list } of bosses) {
            html += `<div style="color:#fc8;font-size:10px;text-transform:uppercase;margin:10px 0 5px;">Act ${act}</div>`;
            for (const b of list) {
                const n = profile.bossKills[b.id] || 0;
                html += `<div style="display:flex;gap:8px;align-items:center;padding:6px 8px;margin-bottom:4px;border-radius:4px;
                        background:${n ? '#16121e' : '#0b0b16'};border:1px solid ${n ? '#4a3a22' : '#1c1c2a'};">
                    <span style="font-size:16px;color:${n ? '#f84' : '#333'};">♛</span>
                    <div style="flex:1;min-width:0;">
                        <div style="color:${n ? '#eed' : '#666'};font-weight:${n ? 'bold' : 'normal'};">${n ? esc(b.name) : '???'}</div>
                        <div style="color:#667;font-size:10px;">${esc(REALMS[b.realm]?.name ?? '')}</div>
                    </div>
                    <span style="font-size:11px;color:${n ? '#fc6' : '#555'};white-space:nowrap;">${n ? `Defeated ×${n}` : 'Not yet defeated'}</span>
                </div>`;
            }
        }
        return html;
    };

    const winsHtml = () => {
        const wins = profile.recentWins;
        if (!wins.length) {
            return `<div style="color:#777;padding:16px 0;text-align:center;line-height:1.6;">No victories yet.<br>Close the final rift and your company will be remembered here.</div>`;
        }
        const intro = wins.length === 1 ? 'Your winning run.' : `Your last ${Math.min(RECENT_WINS, wins.length)} winning runs, newest first.`;
        let html = `<div style="color:#778;font-size:10px;margin:8px 0;">${intro}</div>`;
        for (const w of wins) {
            const realms = w.realms.map(r => REALMS[r]?.name).filter(Boolean).join(' → ');
            html += `<div style="padding:8px;margin-bottom:6px;background:#0d0d20;border:1px solid #335;border-radius:5px;">
                <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;">
                    <span style="color:#fc6;font-weight:bold;">★ Victory</span><span style="color:#778;font-size:10px;">${esc(when(w.date))}</span></div>
                ${realms ? `<div style="color:#99a;font-size:10px;margin:2px 0 6px;">${esc(realms)}</div>` : ''}
                <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px;">`;
            for (const m of w.party) {
                html += `<div style="display:flex;gap:5px;align-items:center;">${portraitHtml(m, 24)}
                    <div style="font-size:10px;line-height:1.25;"><div style="color:${esc(m.appearance?.nameColor || '#ccc')};">${esc(m.name)}</div>
                    <div style="color:#778;">Lv ${m.level} ${esc(m.origin ? `${jobLabel(m.origin)} → ${jobLabel(m.job)}` : jobLabel(m.job))}</div></div></div>`;
            }
            html += `</div><div style="color:#889;font-size:10px;">${w.floors} floors · ${w.battles} battles · ${w.elites} elites · ${w.bosses} bosses · ${w.relics} relics · +${w.renown} renown</div></div>`;
        }
        return html;
    };

    const render = () => {
        const s = profile.stats;
        const tabBtn = (id, label) => `<button data-feats-tab="${id}" style="${TAB}background:${tab === id ? '#1e2244' : '#11111f'};
            border:1px solid ${tab === id ? '#99f' : '#335'};border-bottom:none;color:${tab === id ? '#fff' : '#aab'};">${label}</button>`;
        let html = `<div style="color:#ffcc44;font-weight:bold;font-size:16px;margin-bottom:4px;">Feats</div>
            <div style="color:#889;font-size:11px;margin-bottom:10px;">Runs ${s.runs} · Wins ${s.wins} · Best: act ${s.bestAct || '-'}, ${s.bestFloor} floors · Items ${percent(found.size, total)}% · Bosses ${bossesBeaten} / ${bossTotal}</div>
            <div style="display:flex;gap:4px;flex-wrap:wrap;border-bottom:1px solid #335;">${tabBtn('items', `Items ${percent(found.size, total)}%`)}${tabBtn('bestiary', `Bestiary ${bossesBeaten}/${bossTotal}`)}${tabBtn('wins', `Victories ${profile.recentWins.length}`)}</div>`;
        html += tab === 'items' ? itemsHtml() : tab === 'bestiary' ? bestiaryHtml() : winsHtml();
        const body = modal.show(html, { width: 640, view: 'feats', onClose: () => { modal.destroy(); onClose?.(); } });
        // Portraits are looked up by name among the drawn members, so pass the remembered ones.
        drawSprites(body, profile.recentWins.flatMap(w => w.party), skinManager);
        wireTips(body);
        body.querySelectorAll('[data-feats-tab]').forEach(b => b.addEventListener('click', () => { tab = b.dataset.featsTab; render(); }));
    };
    render();
}
