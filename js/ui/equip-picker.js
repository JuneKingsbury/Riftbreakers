// The equip picker: "who should wear this?" for one item, right after it's taken, bought or
// found. Lists every member who can wear it with what they wear in that slot now, the stat
// change (stats the class doesn't use dimmed) and any skill change, plus a class-aware
// upgrade/downgrade tag and a "Best fit" mark; members who can't wear it are listed dimmed. Equipping sends the old item to the bag. See run/equip-options.js.
import { equipOptions } from '../run/equip-options.js';
import { deltaText } from '../run/gear-screen.js';
import { EQUIPMENT } from '../tactical/data/equipment.js';
import { EQUIP_SLOTS } from '../content/vocab.js';
import { Sound } from '../audio/sound.js';
import { BTN, BTN_GOOD, esc, jobLabel, abilityName, itemTitle, itemSummary, itemIconHtml, portraitHtml, drawSprites, wireTips } from '../run/ui-kit.js';

const SLOT_LABEL = Object.fromEntries(Object.values(EQUIP_SLOTS).map(s => [s.field, s.label]));
const VERDICT = {
    upgrade:   { text: '▲ Upgrade',   color: '#7e7' },
    downgrade: { text: '▼ Downgrade', color: '#f77' },
    mixed:     { text: '◆ Trade-off', color: '#fc8' },
    minor:     { text: '≈ Minor',     color: '#99a' },
    same:      { text: '= Same',      color: '#888' },
};
const SMALL = 'width:auto;flex-shrink:0;padding:4px 12px;font-family:inherit;font-size:11px;border-radius:3px;cursor:pointer;';

/**
 * Shows the picker in a modal.
 * @param {import('../run/ui-kit.js').Modal} modal
 * @param {import('../run/run-state.js').RunState} run
 * @param {string} key  The item to hand out.
 * @param {{ skin?: object, onDone: (equipped: boolean) => void }} opts
 *   onDone: after equipping (true) or keeping it in the bag (false). The caller saves and
 *   shows its screen again.
 */
export function showEquipPicker(modal, run, key, { skin, onDone }) {
    const { field, wearers, others } = equipOptions(run, key);
    const slot = SLOT_LABEL[field]?.toLowerCase() ?? 'gear';
    let html = `<div style="display:flex;gap:10px;align-items:center;margin-bottom:8px;">
            ${itemIconHtml(key, 32)}
            <div><div style="font-weight:bold;font-size:15px;"><span style="color:#ffcc44;">Equip</span> ${itemTitle(key)}</div>
            <div style="color:#889;font-size:10px;">${esc(itemSummary(key))}</div></div>
        </div>
        <div style="color:#999;font-size:11px;margin-bottom:8px;">Who should wear it? Whatever they wear in that ${esc(slot)} slot now goes to the bag.</div>`;
    for (const w of wearers) {
        const m = w.member, v = VERDICT[w.verdict];
        const skills = [...w.gains.map(a => `<span style="color:#7e7;">+${esc(abilityName(a))}</span>`),
            ...w.loses.map(a => `<span style="color:#f77;">−${esc(abilityName(a))}</span>`)].join(' ');
        html += `<div style="display:flex;gap:10px;align-items:center;margin-bottom:6px;padding:7px 8px;background:#0c0c1c;border:1px solid ${w.best ? '#7a6a2a' : w.verdict === 'upgrade' ? '#3a5a3a' : '#2a2a44'};border-radius:5px;">
            ${portraitHtml(m, 32)}
            <div style="flex:1;min-width:0;">
                <div><span style="font-weight:bold;color:${m.appearance?.nameColor || '#ccc'};">${esc(m.name)}</span>
                    <span style="color:#888;font-size:10px;text-transform:uppercase;">${esc(jobLabel(m.job))}</span>
                    <span style="color:${v.color};font-size:10px;font-weight:bold;margin-left:4px;">${v.text}</span>${w.best ? `<span style="color:#ffcc44;font-size:10px;font-weight:bold;margin-left:4px;">★ Best fit</span>` : ''}</div>
                <div style="color:#888;font-size:10px;">Now: ${w.current ? esc(EQUIPMENT[w.current]?.name ?? w.current) : `<span style="color:#666;">empty ${esc(slot)} slot</span>`}</div>
                <div style="font-size:10px;">${deltaText(w.delta, w.unused)}${skills ? ` · ${skills}` : ''}</div>
            </div>
            <button data-equip-to="${esc(m.name)}" style="${BTN}${SMALL}${w.verdict === 'upgrade' ? BTN_GOOD : ''}">Equip</button>
        </div>`;
    }
    if (others.length) {
        html += `<div style="color:#666;font-size:10px;margin:2px 0 6px;">Can't wear it: ${others.map(m => `${esc(m.name)} (${esc(jobLabel(m.job))})`).join(', ')}</div>`;
    }
    html += `<button data-keep style="${BTN}text-align:center;color:#aaa;">Keep in bag</button>`;
    const body = modal.show(html, { dismissible: false, width: 500, view: `equip:${key}` });
    drawSprites(body, run.party, skin);
    wireTips(body);
    body.querySelectorAll('[data-equip-to]').forEach(b => b.addEventListener('click', () => {
        const ok = run.equip(b.dataset.equipTo, field, key);
        if (ok) Sound.playSfx('equip');
        onDone(ok);
    }));
    body.querySelector('[data-keep]').addEventListener('click', () => onDone(false));
}
