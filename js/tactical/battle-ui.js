import { STATES } from './battle.js';
import { placeTipAt } from '../ui/tip-place.js';
import { ABILITIES, passivesOf } from './abilities.js';
import { mountBreakdown } from './battle-breakdown.js';
import { statusBadges, wardColors, HP_BAR_COLORS } from './fx-presets.js';
import { ENGINE_STATES, STATS } from '../content/vocab.js';

// Rule labels and unit names can come from player-authored scripts.
function esc(text) {
    return String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// Hover tips for the stat labels in the sidebar and inspect panel.
const STAT_TIPS = Object.fromEntries(Object.entries(STATS).map(([k, st]) => [k, esc(`${st.short}\n${st.desc}`)]));
const FACING_TIP = esc('Facing\nThe direction this unit is facing. Its EVA works fully against attacks from the front, half as well from the sides, and not at all from behind.');

// A unit's statuses and stat changes as colored chips (the same badges as its map tag).
function statusChips(unit, marginTop) {
    const chips = statusBadges(unit, { withDoom: true }).map(b =>
        `<span data-tip="${esc(`${b.name}${b.turns ? ` (${b.turns} turns left)` : ''}\n${b.desc}`)}" style="display:inline-block;margin:0 3px 2px 0;padding:0 3px;border:1px solid ${b.color};border-radius:3px;color:${b.color};cursor:help;`
        + `background:${b.harmful ? '#3a0808' : '#0c0c1c'};">${b.key.startsWith('buff_') ? esc(b.name) : `${b.glyph} ${esc(b.name)}`}`
        + `${b.turns ? ` <span style="color:#fff;">${b.turns}</span>` : ''}</span>`);
    for (const s of ['unconscious', 'dead']) if (unit.status.includes(s)) chips.push(`<span data-tip="${esc(`${ENGINE_STATES[s].name}\n${ENGINE_STATES[s].desc}`)}" style="color:#888;cursor:help;">${s}</span>`);
    return chips.length ? `<div style="margin-top:${marginTop}px;font-size:10px;line-height:14px;">${chips.join('')}</div>` : '';
}

// After a loss, a line or two on what went wrong, read off the battle's numbers, so the next
// run goes better. Each check names something the player can change.
function defeatTipsHtml(battle) {
    const stats = battle.stats;
    if (!stats) return '';
    const mine = battle.units.filter(u => u.team === 'player' && u.summonerId == null);
    const line = (u) => stats.byUnit.get(u.id) ?? { dealt: 0, taken: 0, healed: 0 };
    const healed = mine.reduce((s, u) => s + line(u).healed, 0);
    const dealt = mine.reduce((s, u) => s + line(u).dealt, 0);
    const taken = mine.reduce((s, u) => s + line(u).taken, 0);
    const foes = battle.units.filter(u => u.team === 'enemy' && u.summonerId == null);
    const foeHp = foes.reduce((s, u) => s + u.maxHp, 0);
    const tips = [];
    if (healed === 0) tips.push('Nobody in the party could heal. A Warden, an Alchemist or a Lifeseer, or even a tool with First Aid, would keep everyone standing longer.');
    const tank = [...mine].sort((a, b) => line(b).taken - line(a).taken)[0];
    if (tank && mine.length > 1 && line(tank).taken > taken * 0.45) {
        tips.push(`${tank.name} took ${Math.round(line(tank).taken / Math.max(1, taken) * 100)}% of all the damage. Heavier armor or a spot further back at deploy would spread the hits around.`);
    }
    if (foeHp > 0 && dealt < foeHp * 0.5) tips.push(`Your party dealt ${dealt} damage, but the enemies had ${foeHp} HP between them. Stronger attacks, skill upgrades or better weapons would end fights faster.`);
    if (!tips.length) tips.push('That one was close. A few more levels, a rest before the boss or a relic from an elite could tip it your way.');
    return `<div style="margin-top:10px;max-width:420px;text-align:left;border:1px solid #533;background:rgba(40,10,10,0.5);border-radius:4px;padding:6px 10px;">
        <div style="color:#fc8;font-size:11px;font-weight:bold;margin-bottom:3px;">Next time</div>
        ${tips.slice(0, 2).map(t => `<div style="color:#ccb;font-size:11px;line-height:1.45;margin-bottom:3px;">${esc(t)}</div>`).join('')}
        <div style="color:#888;font-size:10px;margin-top:4px;">The renown you earned this run still goes toward unlocks.</div>
    </div>`;
}

// Protect, Shell and Defend ring a unit's HP bar in their colors (inline style for the bar's track).
function wardRing(unit) {
    const wards = wardColors(unit);
    return wards.length ? `box-shadow:${wards.map((c, i) => `0 0 0 ${i + 1}px ${c}`).join(',')},0 0 5px ${wards[0]};` : '';
}

// Hotkey label for each skillset command, in menu order.
export const SKILLSET_KEYS = ['S', 'X'];

// The unit's action commands. Party members carry their loadout's skillsets;
// anyone else (e.g. a charmed enemy) gets one list of every usable skill.
export function unitSkillsets(unit) {
    const sets = unit.skillsets ?? [{
        name: 'Skills',
        abilities: unit.abilities.filter(k => k !== 'attack' && ABILITIES[k] && !ABILITIES[k].passive),
    }];
    return sets.filter(s => s.abilities.length > 0);
}

const SPEEDS = [1, 2, 4];
// A touch held this long (ms) on a battle button is a look at its tooltip, not a press.
const TOUCH_HOLD_MS = 450;

// Width of the unit list. In landscape it runs down the left edge, so the command menu, its
// skill info and the key hints start to the right of it (portrait CSS moves it to the
// bottom instead). battle-scene.js keeps the camera clear of it.
export const SIDEBAR_W = 190;

export class BattleUI {
    // opts.fullAuto: every player unit is script-controlled, so show pause/speed
    // controls instead of manual command hints.
    // opts.showDecisions: also show the rule the last scripted unit fired (the tactics log setting).
    constructor(container, battle, renderer, opts = {}) {
        this.battle   = battle;
        this.renderer = renderer;
        this._fullAuto = !!opts.fullAuto;
        this._showDecisions = !!opts.showDecisions;
        this._onPlayback = null;
        this._onAction    = null;
        this._openSkillset = null;   // index into unitSkillsets(unit), or null
        this._sidebarRosterKey = null;

        // Mount everything inside a full-screen overlay that sits on top of the
        // game canvas. This avoids the #game overflow:hidden clipping the panels.
        this._overlay = document.createElement('div');
        this._overlay.id = 'tactical-ui-overlay';
        this._overlay.style.cssText = `
            position: fixed; inset: 0; z-index: 200;
            pointer-events: none;
            font-family: 'Courier New', monospace; font-size: 12px; color: #ccc;
        `;
        document.body.appendChild(this._overlay);

        this._sidebar    = this._makeSidebar();
        this._actionMenu = this._makeActionMenu();
        this._result     = this._makeResult();
        this._hint       = this._makeHint();
        this._tooltip    = this._makeTooltip();
        this._skillInfo  = this._makeSkillInfo();
        this._controls   = this._fullAuto ? this._makeControls() : null;

        // Single persistent listener: hide tooltip whenever cursor leaves a tac-btn.
        this._onDocMouseMove = (e) => {
            if (!e.target.closest('.tac-btn[data-key], .tac-btn[data-action="defend"]')) {
                this._hideTooltip();
            }
        };
        document.addEventListener('mousemove', this._onDocMouseMove);
    }

    setActionHandler(fn) { this._onAction = fn; }

    // Pixels the HUD covers at the bottom of the screen (the unit list and log in portrait).
    bottomInset() {
        return Math.max(0, window.innerHeight - this._sidebar.getBoundingClientRect().top);
    }

    // fn('pause') toggles pause, fn('speed', n) sets the speed multiplier.
    setPlaybackHandler(fn) { this._onPlayback = fn; }

    // Pause / speed buttons and a readout of the rule the last scripted unit fired.
    _makeControls() {
        const el = document.createElement('div');
        el.className = 'tac-controls';
        el.style.cssText = `
            position: absolute; top: 24px; left: 50%; transform: translateX(-50%);
            display: flex; flex-direction: column; align-items: center; gap: 4px;
            pointer-events: none;
        `;
        el.innerHTML = `
            <div style="display:flex;gap:4px;pointer-events:auto;">
                <button data-ctl="pause" style="${this._ctlStyle(false)}">Pause</button>
                ${SPEEDS.map(s => `<button data-ctl="speed" data-speed="${s}" style="${this._ctlStyle(false)}">${s}x</button>`).join('')}
                <button data-ctl="help" data-tip="Glossary\nPause the battle and look up stats, statuses and affixes." style="${this._ctlStyle(false)}">?</button>
            </div>
            <div data-decision style="${this._showDecisions ? '' : 'display:none;'}font-size:11px;color:#9ab;background:rgba(8,8,20,0.8);padding:2px 8px;border-radius:3px;max-width:520px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"></div>
        `;
        el.addEventListener('click', (e) => {
            const btn = e.target.closest('button[data-ctl]');
            if (!btn || !this._onPlayback) return;
            if (btn.dataset.ctl === 'pause') this._onPlayback('pause');
            else if (btn.dataset.ctl === 'help') this._onPlayback('help');
            else this._onPlayback('speed', Number(btn.dataset.speed));
        });
        this._overlay.appendChild(el);
        return el;
    }

    _ctlStyle(active) {
        return `padding:3px 9px;background:${active ? '#2a2a55' : '#151528'};border:1px solid ${active ? '#99f' : '#447'};` +
            'color:#ccc;font-family:inherit;font-size:11px;cursor:pointer;border-radius:3px;';
    }

    _updateControls(battle, playback) {
        if (!this._controls) return;
        const pb = playback || { paused: false, speed: 1 };
        for (const btn of this._controls.querySelectorAll('button[data-ctl]')) {
            const active = btn.dataset.ctl === 'pause' ? pb.paused : Number(btn.dataset.speed) === pb.speed;
            btn.style.cssText = this._ctlStyle(active);
            if (btn.dataset.ctl === 'pause') btn.textContent = pb.paused ? 'Resume' : 'Pause';
        }
        if (!this._showDecisions) return;
        const d = battle.lastDecision;
        const line = d && d.trace.length ? `${esc(d.name)}: ${d.trace.map(t => esc(t.label)).join(' > ')}` : '';
        this._controls.querySelector('[data-decision]').innerHTML = line;
    }

    inspectUnit(unit) {
        this._inspectedUnit = unit || null;
    }

    _makeSidebar() {
        const el = document.createElement('div');
        el.className = 'tac-sidebar';
        el.style.cssText = `
            position: absolute; top: 0; left: 0; width: ${SIDEBAR_W}px; height: 100%;
            background: rgba(8,8,20,0.92); border-right: 1px solid #335;
            padding: 10px 8px; box-sizing: border-box;
            overflow-x: hidden; overflow-y: auto; pointer-events: auto;
        `;
        this._overlay.appendChild(el);
        return el;
    }

    _makeActionMenu() {
        const el = document.createElement('div');
        el.className = 'tac-actions';
        el.style.cssText = `
            position: absolute; bottom: 14px; left: ${SIDEBAR_W + 14}px;
            background: rgba(8,8,24,0.95); border: 1px solid #447;
            border-radius: 5px; padding: 6px 8px;
            display: none; min-width: 150px;
            pointer-events: auto;
        `;
        this._overlay.appendChild(el);
        return el;
    }


    _makeResult() {
        const el = document.createElement('div');
        el.style.cssText = `
            display: none; position: absolute; inset: 0;
            background: rgba(0,0,0,0.75);
            align-items: center; justify-content: safe center;
            flex-direction: column; gap: 18px;
            overflow-y: auto; padding: 12px 0; box-sizing: border-box;
            pointer-events: auto;
        `;
        this._overlay.appendChild(el);
        return el;
    }

    _makeHint() {
        const el = document.createElement('div');
        el.className = 'tac-hint';
        el.style.cssText = `
            position: absolute; top: 6px; left: ${SIDEBAR_W + 8}px;
            font-size: 10px; color: #556; pointer-events: none;
        `;
        el.textContent = this._fullAuto
            ? '[Space] Pause  [1/2/3] Speed  [Click] Inspect unit  [Arrows] Pan  [Q/E] Rotate  [F] Focus  [V] Free cam  [Scroll] Zoom'
            : '[M]ove  [A]ttack  [D]efend  [P]ivot  [W]ait  [U] Auto  [Esc] Cancel  [Arrows] Pan  [Q/E] Rotate  [F] Focus  [V] Free cam  [Scroll] Zoom';
        this._overlay.appendChild(el);
        return el;
    }

    _makeTooltip() {
        const el = document.createElement('div');
        el.style.cssText = `
            position: fixed; z-index: 300;
            background: rgba(8,8,24,0.97); border: 1px solid #559;
            border-radius: 5px; padding: 8px 10px;
            font-size: 11px; color: #ccc; line-height: 1.5;
            pointer-events: none; display: none;
            max-width: 220px; box-shadow: 0 4px 16px rgba(0,0,0,0.7);
        `;
        document.body.appendChild(el);
        return el;
    }

    _makeSkillInfo() {
        const el = document.createElement('div');
        el.className = 'tac-skillinfo';
        el.style.cssText = `
            position: absolute; bottom: 14px; left: ${SIDEBAR_W + 175}px;
            background: rgba(8,8,24,0.97); border: 1px solid #559;
            border-radius: 5px; padding: 8px 10px;
            font-size: 11px; color: #ccc; line-height: 1.6;
            pointer-events: none; display: none;
            max-width: 200px; box-shadow: 0 4px 16px rgba(0,0,0,0.7);
        `;
        this._overlay.appendChild(el);
        return el;
    }

    _abilityDescription(ab, unit, abilityKey) {
        const lines = [];
        const typeColor = ab.type === 'magic' ? '#c8a0ff' : ab.type === 'passive' ? '#888' : '#ffcc88';
        lines.push(`<span style="color:${typeColor};font-weight:bold;">${ab.name}</span>`);

        const tags = [];
        if (ab.type === 'physical') tags.push('<span style="color:#ffcc88;">Physical</span>');
        if (ab.type === 'magic')    tags.push('<span style="color:#c8a0ff;">Magic</span>');
        if (ab.element)             tags.push(`<span style="color:#88ccff;">${ab.element[0].toUpperCase() + ab.element.slice(1)}</span>`);
        if (ab.passive)             tags.push('<span style="color:#888;">Passive</span>');
        if (tags.length) lines.push(tags.join(' '));

        if (ab.desc) {
            lines.push(`<span style="color:#aaa;">${ab.desc}</span>`);
        }


        const stats = [];
        if (ab.range > 0)    stats.push(`Range: <b>${ab.range}</b>`);
        if (ab.aoe > 0)      stats.push(`Area: <b>${ab.aoe}</b>`);
        if (ab.mpCost > 0)   stats.push(`MP cost: <b style="color:#88f;">${ab.mpCost}</b>`);
        if (stats.length) lines.push(stats.join('  '));

        if (ab.chargeTime > 0) {
            lines.push(`<span style="color:#c8f;">Charges for ${ab.chargeTime} CT before it goes off</span>`);
        }

        if (ab.basePower) {
            const pct = Math.round(ab.basePower * 100);
            const stat = ab.type === 'physical' ? 'ATK' : 'MAT';
            lines.push(`Power: <b>${pct}%</b> of ${stat}`);
        }

        if (ab.applyStatus) {
            lines.push(`Inflicts <b style="color:#fc6;">${ab.applyStatus}</b>${ab.statusDuration ? ` for ${ab.statusDuration} turns` : ''}`);
        }
        if (ab.isHeal)  lines.push(`<span style="color:#8f8;">Restores HP</span>`);
        if (ab.isCure)  lines.push(`<span style="color:#aff;">Removes harmful statuses</span>`);

        if (unit && ab.mpCost > 0 && unit.mp < ab.mpCost) {
            lines.push(`<span style="color:#f66;">Not enough MP</span>`);
        }

        return lines.join('<br>');
    }

    update(battle, onExit, turnFlags, playback) {
        this._turnFlags = turnFlags || { hasMoved: false, hasActed: false, autoUnits: new Set() };
        this._updateControls(battle, playback);
        this._updateSidebar(battle);
        this._updateActionMenu(battle);
        this._updateSkillInfo(battle);
        if (battle.state === STATES.BATTLE_OVER) this._showResult(battle, onExit, turnFlags);
    }

    _updateSkillInfo(battle) {
        const si = this._skillInfo;
        const key = battle.selectedAbility;
        if (battle.state === STATES.SELECT_ABILITY_TARGET && key && ABILITIES[key]) {
            si.innerHTML = this._abilityDescription(ABILITIES[key], battle.activeUnit, key);
            si.style.display = 'block';
        } else {
            si.style.display = 'none';
        }
    }

    _updateSidebar(battle) {
        const sb = this._sidebar;
        const u  = battle.activeUnit;

        // Only the party is listed; enemies are read off the map (or inspected).
        // Stable order: sort by id (creation/roster order).
        const party = battle.livingUnits.filter(u => u.team === 'player').sort((a, b) => a.id - b.id);

        // Roster key uses stable IDs — only changes when units join or die.
        const rosterKey = party.map(u => u.id).join(',');
        if (this._sidebarRosterKey !== rosterKey) {
            this._sidebarRosterKey = rosterKey;
            this._rebuildSidebarRoster(sb, party);
        }

        // Fast path: update only the dynamic values in-place every frame.
        this._patchSidebarRoster(sb, party, u, battle);
        this._patchSidebarDetails(sb, u?.team === 'player' ? u : null, battle);
    }

    _rebuildSidebarRoster(sb, party) {
        // Remove existing roster content, keep the detail panel placeholder.
        sb.querySelectorAll('.tac-roster-row').forEach(el => el.remove());

        const detailPanel = sb.querySelector('.tac-detail-panel');

        const insertBefore = (el) => detailPanel ? sb.insertBefore(el, detailPanel) : sb.appendChild(el);

        const BAR = 'background:#1a1a2a;border-radius:2px;position:relative;overflow:hidden;';
        for (const unit of party) {
            const row = document.createElement('div');
            row.className = 'tac-roster-row';
            row.dataset.uid = unit.id;
            row.style.cssText = 'padding:4px 4px 3px;margin-bottom:4px;background:#0e0e20;border:1px solid #223;border-left:3px solid #223;border-radius:3px;';
            row.innerHTML = `
                <div style="display:flex;align-items:center;gap:5px;">
                    <div class="tac-portrait" style="width:30px;height:30px;flex-shrink:0;border-radius:2px;overflow:hidden;background:#111;border:1px solid #7bf44;"></div>
                    <div style="flex:1;min-width:0;">
                        <div style="display:flex;justify-content:space-between;align-items:baseline;gap:4px;">
                            <span class="tac-name" style="color:#7bf;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(unit.name)}</span>
                            <span class="tac-turn" style="font-size:9px;color:#888;white-space:nowrap;"></span>
                        </div>
                        <div class="tac-hp-track" style="${BAR}height:8px;margin-top:3px;">
                            <div class="tac-hp-ghost" style="position:absolute;top:0;left:0;height:100%;width:0%;background:#f44;"></div>
                            <div class="tac-hp-bar" style="position:relative;height:100%;width:0%;transition:width 0.25s ease-out,background-color 0.25s;"></div>
                        </div>
                        <div style="display:flex;justify-content:space-between;font-size:9px;margin-top:1px;line-height:11px;">
                            <span class="tac-hp" style="font-weight:bold;"></span>
                            <span class="tac-mp" style="color:#88f;"></span>
                        </div>
                    </div>
                </div>
                <div class="tac-mp-track" style="${BAR}height:3px;margin-top:2px;">
                    <div class="tac-mp-bar" style="background:#36f;height:100%;width:0%;transition:width 0.25s ease-out;"></div>
                </div>
                <div style="${BAR}height:3px;margin-top:2px;">
                    <div class="tac-ct-ghost" style="position:absolute;top:0;left:0;height:100%;width:0%;background:#fff;"></div>
                    <div class="tac-ct-bar" style="position:relative;height:100%;width:0%;transition:width 0.12s linear;"></div>
                </div>
                <div class="tac-charge-wrap" style="display:none;${BAR}height:3px;margin-top:2px;">
                    <div class="tac-charge-bar" style="background:#ffcc44;height:100%;width:0%;transition:width 0.12s linear;"></div>
                </div>
                <div class="tac-status" style="font-size:9px;line-height:13px;"></div>`;
            insertBefore(row);
        }

        // Draw portraits after browser layout.
        requestAnimationFrame(() => this._drawPortraits(sb, party));
    }

    _drawPortraits(sb, living) {
        const renderer = this.renderer;
        if (!renderer) return;
        sb.querySelectorAll('.tac-roster-row').forEach(row => {
            const uid  = row.dataset.uid;
            const unit = living.find(u => String(u.id) === uid);
            if (!unit) return;
            const el = row.querySelector('.tac-portrait');
            if (!el) return;
            const sprite = renderer.unitSprites.get(unit, false, null);
            if (!sprite) return;
            const w = el.offsetWidth  || 28;
            const h = el.offsetHeight || 28;
            let c = el._portraitCanvas;
            if (!c) {
                c = document.createElement('canvas');
                c.style.cssText = 'width:100%;height:100%;display:block;image-rendering:pixelated;';
                el.appendChild(c);
                el._portraitCanvas = c;
            }
            if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
            const ctx = c.getContext('2d');
            ctx.clearRect(0, 0, w, h);
            const sw = sprite.width, sh = sprite.height;
            const srcH = Math.round(h / (w / sw));
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(sprite, 0, 0, sw, Math.min(sh, srcH), 0, 0, w, h);
        });
    }

    _patchSidebarRoster(sb, party, activeUnit, battle) {
        sb.querySelectorAll('.tac-roster-row').forEach(row => {
            const uid  = row.dataset.uid;
            const unit = party.find(u => String(u.id) === uid);
            if (!unit) return;

            const isActive = unit === activeUnit;
            const ko    = unit.status.includes('unconscious');
            const hpF   = Math.max(0, unit.hp / unit.maxHp);
            const hpPct = Math.round(hpF * 100);
            const hpC   = hpF > 0.5 ? '#3c3' : hpF > 0.25 ? '#cc3' : '#c33';
            // A full gauge (100 CT) means the unit is ready to act; a channeling unit shows its spell's progress.
            const ctPct = unit._charging
                ? Math.round(Math.min(1, unit._charging.ct / Math.max(1, unit._charging.needed)) * 100)
                : Math.round(Math.min(1, unit.ct / 100) * 100);

            row.style.borderColor     = isActive ? '#44ff8866' : '#223';
            row.style.borderLeftColor = ko ? '#555' : isActive ? '#44ff88' : hpC;
            row.style.background      = isActive ? '#12261c' : '#0e0e20';
            row.style.opacity         = ko ? 0.55 : 1;

            const nameEl = row.querySelector('.tac-name');
            if (nameEl) nameEl.style.fontWeight = isActive ? 'bold' : 'normal';

            const turnEl = row.querySelector('.tac-turn');
            if (turnEl) {
                const [text, col] = ko ? ['KO', '#f66']
                    : isActive ? ['▶ ACTING', '#4f8']
                    : unit._charging ? [`✦ casting ${ctPct}%`, '#fc4']
                    : [`SPD ${unit.spd}`, '#778'];
                turnEl.textContent = text;
                turnEl.style.color = col;
            }

            const hpEl = row.querySelector('.tac-hp');
            if (hpEl) { hpEl.textContent = `HP ${unit.hp}/${unit.maxHp}`; hpEl.style.color = hpC; }
            const hpTrack = row.querySelector('.tac-hp-track');
            if (hpTrack) hpTrack.style.boxShadow = wardRing(unit).replace(/^box-shadow:|;$/g, '');
            this._drainBar(row.querySelector('.tac-hp-bar'), row.querySelector('.tac-hp-ghost'), hpPct, hpC);

            const mpEl    = row.querySelector('.tac-mp');
            const mpTrack = row.querySelector('.tac-mp-track');
            const hasMp   = unit.maxMp > 0;
            if (mpEl) mpEl.textContent = hasMp ? `MP ${unit.mp}/${unit.maxMp}` : '';
            if (mpTrack) {
                mpTrack.style.display = hasMp ? 'block' : 'none';
                if (hasMp) mpTrack.firstElementChild.style.width = Math.round(unit.mp / unit.maxMp * 100) + '%';
            }

            this._drainBar(row.querySelector('.tac-ct-bar'), row.querySelector('.tac-ct-ghost'), ctPct,
                isActive ? '#44ff88' : '#4af');

            const chargeWrap = row.querySelector('.tac-charge-wrap');
            const chargeBar  = row.querySelector('.tac-charge-bar');
            if (chargeWrap && chargeBar) {
                const ch = unit._charging;
                if (ch) {
                    chargeWrap.style.display = 'block';
                    chargeBar.style.width = Math.min(100, (ch.ct / ch.needed) * 100) + '%';
                } else {
                    chargeWrap.style.display = 'none';
                }
            }

            // Statuses only re-render when they change, so the chips don't flicker every frame.
            const statusEl = row.querySelector('.tac-status');
            if (statusEl) {
                const html = statusChips(unit, 3);
                if (statusEl._html !== html) { statusEl._html = html; statusEl.innerHTML = html; }
            }
        });
    }

    // Sets a bar's fill; when it drops, a ghost bar behind it snaps to the old value and drains,
    // so the size of a hit (or a spent CT gauge) stays readable for a moment.
    _drainBar(bar, ghost, pct, color) {
        if (!bar) return;
        const prev = parseFloat(bar.dataset.pct ?? pct);
        if (ghost) {
            if (pct < prev) {
                ghost.style.transition = 'none';
                ghost.style.width = prev + '%';
                // Force reflow so the snap is applied before we re-enable transition.
                void ghost.offsetWidth;
                ghost.style.transition = 'width 0.6s ease-out 0.15s';
                ghost.style.width = pct + '%';
            } else if (pct > prev) {
                ghost.style.transition = 'none';
                ghost.style.width = pct + '%';
            }
        }
        bar.dataset.pct = pct;
        bar.style.width = pct + '%';
        bar.style.background = color;
    }

    _patchSidebarDetails(sb, u, battle) {
        // Rebuild the static detail + inspect panels via innerHTML — they don't
        // change structure often and contain no canvases, so this is safe.
        let html = '';
        if (u) {
            const col  = u.team === 'player' ? '#7bf' : '#f76';
            const hpP  = Math.round(u.hp / u.maxHp * 100);
            const mpP  = u.maxMp > 0 ? Math.round(u.mp / u.maxMp * 100) : 0;
            html += `
            <div style="margin-top:10px;padding-top:6px;border-top:1px solid #335;">
                <div style="color:${col};font-weight:bold;font-size:12px;margin-bottom:4px;">${u.name}</div>
                <div style="font-size:10px;color:#888;text-transform:uppercase;">${u.job}</div>
                <div style="margin-top:5px;">
                    <div style="display:flex;justify-content:space-between;font-size:10px;"><span style="color:#888;">HP</span><span>${u.hp}/${u.maxHp}</span></div>
                    <div style="background:#111;height:5px;border-radius:2px;margin:2px 0 4px;${wardRing(u)}"><div style="background:${HP_BAR_COLORS[u.team] ?? HP_BAR_COLORS.player};width:${hpP}%;height:100%;border-radius:2px;"></div></div>
                </div>
                ${u.maxMp > 0 ? `<div>
                    <div style="display:flex;justify-content:space-between;font-size:10px;"><span style="color:#888;">MP</span><span>${u.mp}/${u.maxMp}</span></div>
                    <div style="background:#111;height:4px;border-radius:2px;margin:2px 0 4px;"><div style="background:#36f;width:${mpP}%;height:100%;border-radius:2px;"></div></div>
                </div>` : ''}
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:1px 6px;font-size:10px;margin-top:4px;">
                    <span data-tip="${STAT_TIPS.atk}" style="color:#888;cursor:help;">ATK</span><span>${u.atk}</span>
                    <span data-tip="${STAT_TIPS.def}" style="color:#888;cursor:help;">DEF</span><span>${u.def}</span>
                    <span data-tip="${STAT_TIPS.mat}" style="color:#888;cursor:help;">MAT</span><span>${u.mat}</span>
                    <span data-tip="${STAT_TIPS.mdf}" style="color:#888;cursor:help;">MDF</span><span>${u.mdf}</span>
                    <span data-tip="${STAT_TIPS.spd}" style="color:#888;cursor:help;">SPD</span><span>${u.spd}</span>
                    <span data-tip="${STAT_TIPS.move}" style="color:#888;cursor:help;">Move</span><span>${u.move}</span>
                    <span data-tip="${STAT_TIPS.eva}" style="color:#888;cursor:help;">EVA</span><span>${u.eva || 0}</span>
                    <span data-tip="${STAT_TIPS.crit}" style="color:#888;cursor:help;">CRIT</span><span>${u.crit ?? 5}%</span>
                    <span data-tip="${FACING_TIP}" style="color:#888;cursor:help;">Facing</span><span>${u.facing || 'south'}</span>
                </div>
                ${statusChips(u, 5)}
            </div>`;
        }

        const insp = this._inspectedUnit;
        if (insp && insp !== u) {
            const col  = insp.team === 'player' ? '#7bf' : '#f76';
            const hpP  = Math.round(insp.hp / insp.maxHp * 100);
            const hpC  = hpP > 50 ? '#3c3' : hpP > 25 ? '#cc3' : '#c33';
            const mpP  = insp.maxMp > 0 ? Math.round(insp.mp / insp.maxMp * 100) : 0;
            const dead = insp.status.includes('dead');
            html += `
            <div style="margin-top:10px;padding-top:6px;border-top:1px solid #335;opacity:${dead ? 0.55 : 1};">
                <div style="color:#aaa;font-size:9px;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Inspecting</div>
                <div style="display:flex;align-items:baseline;gap:5px;margin-bottom:2px;">
                    <span style="color:${col};font-weight:bold;font-size:12px;">${insp.name}</span>
                    <span style="color:#555;font-size:9px;">${insp.char}</span>
                </div>
                <div style="font-size:10px;color:#888;text-transform:uppercase;margin-bottom:5px;">${insp.job}${insp.team === 'enemy' ? ' <span style="color:#f76;">(enemy)</span>' : ''}</div>
                <div>
                    <div style="display:flex;justify-content:space-between;font-size:10px;"><span style="color:#888;">HP</span><span style="color:${hpC};">${insp.hp}/${insp.maxHp}</span></div>
                    <div style="background:#111;height:5px;border-radius:2px;margin:2px 0 4px;${wardRing(insp)}"><div style="background:${HP_BAR_COLORS[insp.team] ?? hpC};width:${hpP}%;height:100%;border-radius:2px;"></div></div>
                </div>
                ${insp.maxMp > 0 ? `<div>
                    <div style="display:flex;justify-content:space-between;font-size:10px;"><span style="color:#888;">MP</span><span>${insp.mp}/${insp.maxMp}</span></div>
                    <div style="background:#111;height:4px;border-radius:2px;margin:2px 0 4px;"><div style="background:#36f;width:${mpP}%;height:100%;border-radius:2px;"></div></div>
                </div>` : ''}
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:1px 6px;font-size:10px;margin-top:3px;">
                    <span data-tip="${STAT_TIPS.atk}" style="color:#888;cursor:help;">ATK</span><span>${insp.atk}</span>
                    <span data-tip="${STAT_TIPS.def}" style="color:#888;cursor:help;">DEF</span><span>${insp.def}</span>
                    <span data-tip="${STAT_TIPS.mat}" style="color:#888;cursor:help;">MAT</span><span>${insp.mat}</span>
                    <span data-tip="${STAT_TIPS.mdf}" style="color:#888;cursor:help;">MDF</span><span>${insp.mdf}</span>
                    <span data-tip="${STAT_TIPS.spd}" style="color:#888;cursor:help;">SPD</span><span>${insp.spd}</span>
                    <span data-tip="${STAT_TIPS.move}" style="color:#888;cursor:help;">Move</span><span>${insp.move}</span>
                </div>
                ${statusChips(insp, 4)}
            </div>`;
        }

        let panel = sb.querySelector('.tac-detail-panel');
        if (!panel) {
            panel = document.createElement('div');
            panel.className = 'tac-detail-panel';
            sb.appendChild(panel);
        }
        panel.innerHTML = html;
    }

    get _skillMenuOpen() { return this._openSkillset !== null; }
    openSkillMenu(idx = 0) { this._openSkillset = idx; }
    closeSkillMenu() { this._openSkillset = null; }

    _updateActionMenu(battle) {
        const menu = this._actionMenu;
        const unit = battle.activeUnit;
        if (battle.state !== STATES.PLAYER_TURN || !unit || this._fullAuto) {
            menu.style.display = 'none';
            this._openSkillset = null;
            return;
        }
        menu.style.display = 'block';

        const BASE = 'display:block;width:100%;padding:5px 8px;margin-bottom:3px;background:#151528;border:1px solid #447;color:#ccc;font-family:inherit;font-size:12px;cursor:pointer;text-align:left;border-radius:3px;';
        const DISABLED = 'opacity:0.4;cursor:not-allowed;';

        const skillsets = unitSkillsets(unit);
        const { hasMoved, hasActed, autoUnits } = this._turnFlags || {};

        if (this._skillMenuOpen && skillsets[this._openSkillset]) {
            const skillset = skillsets[this._openSkillset];
            const skillAbs = skillset.abilities;
            let html = `<div style="color:#c8a0ff;font-size:11px;font-weight:bold;margin-bottom:5px;padding-bottom:4px;border-bottom:1px solid #335;">`;
            html += `<span class="tac-back" style="cursor:pointer;color:#888;margin-right:6px;">&lt; Back</span>${esc(skillset.name)}</div>`;

            if (skillAbs.length === 0) {
                html += `<div style="font-size:11px;color:#666;padding:4px 0;">No skills to use.</div>`;
            }
            skillAbs.forEach((k, i) => {
                const ab  = ABILITIES[k];
                const can = unit.mp >= ab.mpCost;
                const dis = !can ? DISABLED : '';
                const mp  = ab.mpCost > 0 ? ` <span style="color:#88f;font-size:10px;">(${ab.mpCost}MP)</span>` : '';
                const rng = `<span style="color:#666;font-size:10px;"> range ${ab.range}${ab.aoe > 0 ? ', area ' + ab.aoe : ''}</span>`;
                const ct  = ab.chargeTime > 0 ? ` <span style="color:#c8f;font-size:10px;">[charge ${ab.chargeTime}]</span>` : '';
                html += `<button class="tac-btn" data-action="ability" data-key="${k}" style="${BASE}${dis}"><span style="color:#888;font-size:10px;">[${i + 1}] </span>${ab.name}${mp}${rng}${ct}</button>`;
            });

            // Equipped reaction / support / movement as non-clickable info
            // (chosen ones, then any from equipment)
            const passives = ['reaction', 'support', 'movement'].flatMap(slot => passivesOf(unit, slot).map(k => [k, slot]));
            if (passives.length > 0) {
                html += `<div style="font-size:10px;color:#666;margin-top:4px;padding-top:4px;border-top:1px solid #223;">`;
                for (const [k, slot] of passives) {
                    const fromGear = k !== unit[slot];
                    html += `<div style="padding:2px 0;">${ABILITIES[k].name} <span style="color:#555;">(${slot}${fromGear ? ', gear' : ''})</span></div>`;
                }
                html += `</div>`;
            }

            html += `<button class="tac-back-btn" style="${BASE.replace('#151528','#111120')};color:#666;margin-top:2px;">[Esc] Back</button>`;

            menu.innerHTML = html;
            menu.querySelectorAll('.tac-back, .tac-back-btn').forEach(el => {
                el.addEventListener('mousedown', e => { e.stopPropagation(); this.closeSkillMenu(); });
            });
        } else {
            const isAuto = autoUnits?.has(unit.id);
            const autoTag = isAuto ? ` <span style="color:#f8a;font-size:9px;letter-spacing:1px;">[AUTO]</span>` : '';
            let html = `<div style="color:#ffcc44;font-size:11px;font-weight:bold;margin-bottom:5px;padding-bottom:4px;border-bottom:1px solid #335;">${unit.name}'s turn${autoTag}</div>`;

            html += `<button class="tac-btn" data-action="move" style="${BASE}${hasMoved ? DISABLED : ''}">[M] Move${hasMoved ? ' <span style="color:#555;font-size:10px;">(done)</span>' : ''}</button>`;

            if (unit.abilities.includes('attack')) {
                html += `<button class="tac-btn" data-action="ability" data-key="attack" style="${BASE}${hasActed ? DISABLED : ''}">[A] Attack</button>`;
            }

            skillsets.forEach((set, i) => {
                const anyAffordable = set.abilities.some(k => unit.mp >= ABILITIES[k].mpCost);
                const dis = (!anyAffordable || hasActed) ? DISABLED : '';
                html += `<button class="tac-btn" data-action="skills" data-skillset="${i}" style="${BASE}${dis}">[${SKILLSET_KEYS[i]}] ${esc(set.name)} ></button>`;
            });

            html += `<button class="tac-btn" data-action="defend" style="${BASE.replace('#151528','#0a1a2a')};color:#7bf;border-color:#36a;${hasActed ? DISABLED : ''}">[D] Defend</button>`;

            html += `<button class="tac-btn" data-action="pivot" style="${BASE.replace('#151528','#111118')};color:#888;font-size:11px;">[P] Pivot</button>`;

            const keepCt = hasMoved ? 20 : 40;
            html += `<button class="tac-btn" data-action="wait" style="${BASE.replace('#151528','#1a1008')};color:#fc8;">[W] Wait <span style="color:#a86;font-size:10px;">(keep ${keepCt} CT)</span></button>`;

            html += `<button class="tac-btn" data-action="auto" style="${BASE.replace('#151528','#1a0a18')};color:#f8a;border-color:#744;margin-top:4px;">[U] Auto <span style="color:#a68;font-size:10px;">acts on its own from now on</span></button>`;

            menu.innerHTML = html;
        }

        const STATIC_TOOLTIPS = {
            defend: `<span style="color:#7bf;font-weight:bold;">Defend</span><br>Brace until your next turn.<br><span style="color:#aaa;">Take less damage from attacks and spells, and dodge physical attacks more often.</span><br>CT cost: <b style="color:#fc8;">${hasMoved ? 100 : 80}</b>`,
            move:   null,
            skills: null,
            pivot:  null,
            wait:   null,
        };

        menu.querySelectorAll('.tac-btn').forEach(btn => {
            btn.addEventListener('mousedown', e => {
                e.stopPropagation();
                // Lifting a finger after holding a button only shows its tooltip (see below).
                if (this._suppressPress) { this._suppressPress = false; return; }
                this._hideTooltip();
                if (btn.style.cursor === 'not-allowed') return;
                const action = btn.dataset.action;
                if (action === 'skills') { this.openSkillMenu(Number(btn.dataset.skillset) || 0); return; }
                if (this._onAction) this._onAction(action, btn.dataset.key);
            });

            // Ability buttons (attack, skills, etc.), then static-tooltip buttons (defend, etc.)
            const key = btn.dataset.key;
            const action = btn.dataset.action;
            const tipHtml = key && ABILITIES[key] ? () => this._abilityDescription(ABILITIES[key], unit, key)
                : action && STATIC_TOOLTIPS[action] ? () => STATIC_TOOLTIPS[action] : null;
            if (!tipHtml) return;
            btn.addEventListener('mouseenter', e => this._showTooltip(tipHtml(), e.clientX, e.clientY, false));
            btn.addEventListener('mousemove', e => { if (!this._touchHold) placeTipAt(this._tooltip, e.clientX, e.clientY, false); });
            // Touch has no hover: holding a button shows its tooltip clear of the finger. A quick
            // tap still presses the button; letting go after a hold doesn't.
            btn.addEventListener('pointerdown', e => {
                if (e.pointerType !== 'touch') return;
                this._touchHold = { id: e.pointerId, at: performance.now() };
                this._showTooltip(tipHtml(), e.clientX, e.clientY, true);
            });
            btn.addEventListener('pointermove', e => {
                if (this._touchHold?.id === e.pointerId) placeTipAt(this._tooltip, e.clientX, e.clientY, true);
            });
            const lift = (e) => {
                if (this._touchHold?.id !== e.pointerId) return;
                const held = performance.now() - this._touchHold.at;
                this._touchHold = null;
                if (held >= TOUCH_HOLD_MS) {
                    this._suppressPress = true;
                    setTimeout(() => { this._suppressPress = false; }, 700);
                }
                clearTimeout(this._tipTimer);
                this._tipTimer = setTimeout(() => this._hideTooltip(), 2500);
            };
            btn.addEventListener('pointerup', lift);
            btn.addEventListener('pointercancel', lift);
            // No long-press menu or text selection callout over the tooltip.
            btn.addEventListener('contextmenu', e => e.preventDefault());
        });
    }

    _showTooltip(html, x, y, touch) {
        clearTimeout(this._tipTimer);
        this._tooltip.innerHTML = html;
        this._tooltip.style.display = 'block';
        placeTipAt(this._tooltip, x, y, touch);
    }

    _hideTooltip() {
        this._tooltip.style.display = 'none';
    }


    _showResult(battle, onExit, flags) {
        const r = this._result;
        if (r.style.display === 'flex') return;
        r.style.display = 'flex';
        const won = battle.winner === 'player';
        const rewards = flags?.rewards;

        // rewards: the run's battle reward (RunState.completeBattle), or null outside a run.
        let rewardHtml = '';
        if (rewards && won) {
            rewardHtml += `<div style="margin-top:10px;border-top:1px solid #335;padding-top:8px;text-align:left;min-width:200px;">`;
            for (const [name, xp] of Object.entries(rewards.xp || {})) {
                const up = rewards.levelUps?.[name] ? ` <span style="color:#ffdd44;">LEVEL UP!</span>` : '';
                rewardHtml += `<div style="color:#aaffaa;font-size:12px;">${esc(name)}: +${xp} XP${up}</div>`;
            }
            if (rewards.gold > 0) {
                rewardHtml += `<div style="color:#ffdd88;font-size:12px;">+${rewards.gold} gold</div>`;
            }
            if (rewards.score) {
                const sc = rewards.score;
                rewardHtml += `<div style="color:#99ccff;font-size:12px;">+${sc.points} score <span style="color:#778;font-size:10px;">(${sc.survivors}/${sc.partySize} standing, ${sc.rounds} turns)</span></div>`;
            }
            rewardHtml += `</div>`;
        }

        r.innerHTML = `
            <div style="font-size:40px;font-weight:bold;color:${won ? '#ffcc44' : '#f44'};text-shadow:0 0 24px currentColor;letter-spacing:4px;">
                ${won ? 'VICTORY!' : 'DEFEAT'}
            </div>
            <div style="color:#aaa;font-size:13px;">${!won ? 'Your party has fallen. The run is over.' : rewards?.final ? 'The final rift is sealed.' : 'All enemies defeated.'}</div>
            ${won ? '' : defeatTipsHtml(battle)}
            ${rewardHtml}
            <div id="tac-breakdown"></div>
            ${this._battleLogHtml(battle)}
            <button id="tac-return-btn" style="margin-top:12px;padding:10px 28px;background:#1a1a30;border:1px solid #557;color:#ccc;font-family:inherit;font-size:14px;cursor:pointer;border-radius:4px;pointer-events:auto;">
                ${won ? 'Continue' : 'Return'}
            </button>
        `;
        const breakdown = r.querySelector('#tac-breakdown');
        if (breakdown && battle.stats) mountBreakdown(breakdown, battle.stats);
        document.getElementById('tac-return-btn')?.addEventListener('click', () => { if (onExit) onExit(); });
    }

    // The whole fight's log, oldest first, folded away behind a toggle on the result screen.
    _battleLogHtml(battle) {
        if (!battle.log.length) return '';
        const lines = [...battle.log].reverse().map(l =>
            `<div style="font-size:11px;line-height:1.4;color:#bbc;">${esc(l)}</div>`).join('');
        return `
            <details style="width:min(520px,92vw);background:rgba(8,8,20,0.9);border:1px solid #335;border-radius:4px;">
                <summary style="cursor:pointer;padding:6px 10px;color:#99a;font-size:12px;">Battle log</summary>
                <div style="max-height:240px;overflow-y:auto;padding:4px 10px 8px;border-top:1px solid #335;text-align:left;">${lines}</div>
            </details>`;
    }

    destroy() {
        clearTimeout(this._tipTimer);
        this._overlay?.remove();
        this._tooltip?.remove();
        if (this._onDocMouseMove) document.removeEventListener('mousemove', this._onDocMouseMove);
    }
}
