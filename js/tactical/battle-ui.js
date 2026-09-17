import { STATES } from './battle.js';
import { ABILITIES } from './abilities.js';

export class BattleUI {
    constructor(container, battle, renderer) {
        this.battle   = battle;
        this.renderer = renderer;
        this._onAction    = null;
        this._skillMenuOpen = false;

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
        this._log        = this._makeLog();
        this._result     = this._makeResult();
        this._hint       = this._makeHint();
        this._tooltip    = this._makeTooltip();
        this._skillInfo  = this._makeSkillInfo();

        // Single persistent listener: hide tooltip whenever cursor leaves a tac-btn.
        this._onDocMouseMove = (e) => {
            if (!e.target.closest('.tac-btn[data-key], .tac-btn[data-action="defend"]')) {
                this._hideTooltip();
            }
        };
        document.addEventListener('mousemove', this._onDocMouseMove);
    }

    setActionHandler(fn) { this._onAction = fn; }

    inspectUnit(unit) {
        this._inspectedUnit = unit || null;
    }

    _makeSidebar() {
        const el = document.createElement('div');
        el.style.cssText = `
            position: absolute; top: 0; right: 0; width: 190px; height: 100%;
            background: rgba(8,8,20,0.92); border-left: 1px solid #335;
            padding: 10px 8px; box-sizing: border-box;
            overflow: hidden; pointer-events: auto;
        `;
        this._overlay.appendChild(el);
        return el;
    }

    _makeActionMenu() {
        const el = document.createElement('div');
        el.style.cssText = `
            position: absolute; bottom: 70px; left: 14px;
            background: rgba(8,8,24,0.95); border: 1px solid #447;
            border-radius: 5px; padding: 6px 8px;
            display: none; min-width: 150px;
            pointer-events: auto;
        `;
        this._overlay.appendChild(el);
        return el;
    }

    _makeLog() {
        const el = document.createElement('div');
        el.style.cssText = `
            position: absolute; bottom: 0; left: 0; right: 190px; height: 65px;
            background: rgba(8,8,20,0.88); border-top: 1px solid #335;
            padding: 5px 10px; overflow: hidden;
            display: flex; flex-direction: column-reverse;
            pointer-events: none;
        `;
        this._overlay.appendChild(el);
        return el;
    }

    _makeResult() {
        const el = document.createElement('div');
        el.style.cssText = `
            display: none; position: absolute; inset: 0;
            background: rgba(0,0,0,0.75);
            align-items: center; justify-content: center;
            flex-direction: column; gap: 18px;
            pointer-events: auto;
        `;
        this._overlay.appendChild(el);
        return el;
    }

    _makeHint() {
        const el = document.createElement('div');
        el.style.cssText = `
            position: absolute; top: 6px; left: 8px;
            font-size: 10px; color: #556; pointer-events: none;
        `;
        el.textContent = '[M]ove  [A]ttack  [D]efend  [P]ivot  [W]ait  [Esc] Cancel  [Arrows] Pan  [Q/E] Rotate  [F] Focus  [Scroll] Zoom';
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
        el.style.cssText = `
            position: absolute; bottom: 70px; left: 175px;
            background: rgba(8,8,24,0.97); border: 1px solid #559;
            border-radius: 5px; padding: 8px 10px;
            font-size: 11px; color: #ccc; line-height: 1.6;
            pointer-events: none; display: none;
            max-width: 200px; box-shadow: 0 4px 16px rgba(0,0,0,0.7);
        `;
        this._overlay.appendChild(el);
        return el;
    }

    _abilityDescription(ab, unit) {
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
        if (ab.aoe > 0)      stats.push(`AoE: <b>${ab.aoe}</b>`);
        if (ab.mpCost > 0)   stats.push(`MP Cost: <b style="color:#88f;">${ab.mpCost}</b>`);
        if (ab.actionCost)   stats.push(`CT Cost: <b style="color:#fc8;">${ab.actionCost}</b>`);
        if (stats.length) lines.push(stats.join('  '));

        if (ab.chargeTime > 0) {
            lines.push(`<span style="color:#c8f;">Charge Time: ${ab.chargeTime} &mdash; fires on next CT tick</span>`);
        }

        if (ab.basePower) {
            const pct = Math.round(ab.basePower * 100);
            const stat = ab.type === 'physical' ? 'ATK' : 'MAT';
            lines.push(`Power: <b>${pct}%</b> of ${stat}`);
        }

        if (ab.applyStatus) {
            lines.push(`Applies: <b style="color:#fc6;">${ab.applyStatus}</b>${ab.statusDuration ? ` (${ab.statusDuration} turns)` : ''}`);
        }
        if (ab.isHeal)  lines.push(`<span style="color:#8f8;">Restores HP</span>`);
        if (ab.isCure)  lines.push(`<span style="color:#aff;">Removes all status effects</span>`);

        if (unit && ab.mpCost > 0 && unit.mp < ab.mpCost) {
            lines.push(`<span style="color:#f66;">Not enough MP</span>`);
        }

        return lines.join('<br>');
    }

    update(battle, onExit, turnFlags) {
        this._turnFlags = turnFlags || { hasMoved: false, hasActed: false };
        this._updateSidebar(battle);
        this._updateActionMenu(battle);
        this._updateLog(battle);
        this._updateSkillInfo(battle);
        if (battle.state === STATES.BATTLE_OVER) this._showResult(battle, onExit);
    }

    _updateSkillInfo(battle) {
        const si = this._skillInfo;
        const key = battle.selectedAbility;
        if (battle.state === STATES.SELECT_ABILITY_TARGET && key && ABILITIES[key]) {
            si.innerHTML = this._abilityDescription(ABILITIES[key], battle.activeUnit);
            si.style.display = 'block';
        } else {
            si.style.display = 'none';
        }
    }

    _updateSidebar(battle) {
        const sb    = this._sidebar;
        const order = battle.previewTurnOrder(8);
        const u     = battle.activeUnit;

        let html = '<div style="color:#ffcc44;font-weight:bold;margin-bottom:5px;font-size:11px;">TURN ORDER</div>';
        for (const unit of order) {
            const col  = unit.team === 'player' ? '#7bf' : '#f76';
            const hpF  = unit.hp / unit.maxHp;
            const hpC  = hpF > 0.5 ? '#3c3' : hpF > 0.25 ? '#cc3' : '#c33';
            const bold = unit === battle.activeUnit ? 'font-weight:bold;' : '';
            html += `<div style="display:flex;align-items:center;gap:4px;padding:2px 0;border-bottom:1px solid #1e1e30;${bold}">
                <span style="color:${col};width:14px;text-align:center;">${unit.char}</span>
                <span style="flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:11px;">${unit.name}</span>
                <span style="color:${hpC};font-size:10px;">${unit.hp}</span>
            </div>`;
        }

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
                    <div style="background:#111;height:5px;border-radius:2px;margin:2px 0 4px;"><div style="background:#3c3;width:${hpP}%;height:100%;border-radius:2px;"></div></div>
                </div>
                ${u.maxMp > 0 ? `<div>
                    <div style="display:flex;justify-content:space-between;font-size:10px;"><span style="color:#888;">MP</span><span>${u.mp}/${u.maxMp}</span></div>
                    <div style="background:#111;height:4px;border-radius:2px;margin:2px 0 4px;"><div style="background:#36f;width:${mpP}%;height:100%;border-radius:2px;"></div></div>
                </div>` : ''}
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:1px 6px;font-size:10px;margin-top:4px;">
                    <span style="color:#888;">ATK</span><span>${u.atk}</span>
                    <span style="color:#888;">DEF</span><span>${u.def}</span>
                    <span style="color:#888;">MAT</span><span>${u.mat}</span>
                    <span style="color:#888;">MDF</span><span>${u.mdf}</span>
                    <span style="color:#888;">SPD</span><span>${u.spd}</span>
                    <span style="color:#888;">MOV</span><span>${u.move}</span>
                    <span style="color:#888;">EVA</span><span>${u.eva || 0}</span>
                    <span style="color:#888;">DIR</span><span>${u.facing || 'south'}</span>
                </div>
                ${u.status.length ? `<div style="margin-top:5px;color:#fc6;font-size:10px;">Status: ${u.status.join(', ')}</div>` : ''}
            </div>`;
        }

        // Inspect panel: shown when the player clicks a unit that isn't the active unit.
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
                    <div style="background:#111;height:5px;border-radius:2px;margin:2px 0 4px;"><div style="background:${hpC};width:${hpP}%;height:100%;border-radius:2px;"></div></div>
                </div>
                ${insp.maxMp > 0 ? `<div>
                    <div style="display:flex;justify-content:space-between;font-size:10px;"><span style="color:#888;">MP</span><span>${insp.mp}/${insp.maxMp}</span></div>
                    <div style="background:#111;height:4px;border-radius:2px;margin:2px 0 4px;"><div style="background:#36f;width:${mpP}%;height:100%;border-radius:2px;"></div></div>
                </div>` : ''}
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:1px 6px;font-size:10px;margin-top:3px;">
                    <span style="color:#888;">ATK</span><span>${insp.atk}</span>
                    <span style="color:#888;">DEF</span><span>${insp.def}</span>
                    <span style="color:#888;">MAT</span><span>${insp.mat}</span>
                    <span style="color:#888;">MDF</span><span>${insp.mdf}</span>
                    <span style="color:#888;">SPD</span><span>${insp.spd}</span>
                    <span style="color:#888;">MOV</span><span>${insp.move}</span>
                </div>
                ${insp.status.length ? `<div style="margin-top:4px;color:#fc6;font-size:10px;">Status: ${insp.status.join(', ')}</div>` : ''}
            </div>`;
        }

        sb.innerHTML = html;
    }

    closeSkillMenu() {
        this._skillMenuOpen = false;
    }

    _updateActionMenu(battle) {
        const menu = this._actionMenu;
        const unit = battle.activeUnit;
        if (battle.state !== STATES.PLAYER_TURN || !unit) {
            menu.style.display = 'none';
            this._skillMenuOpen = false;
            return;
        }
        menu.style.display = 'block';

        const BASE = 'display:block;width:100%;padding:5px 8px;margin-bottom:3px;background:#151528;border:1px solid #447;color:#ccc;font-family:inherit;font-size:12px;cursor:pointer;text-align:left;border-radius:3px;';
        const DISABLED = 'opacity:0.4;cursor:not-allowed;';

        const skillAbs = unit.abilities.filter(k => k !== 'attack' && ABILITIES[k] && !ABILITIES[k].passive);

        if (this._skillMenuOpen) {
            let html = `<div style="color:#c8a0ff;font-size:11px;font-weight:bold;margin-bottom:5px;padding-bottom:4px;border-bottom:1px solid #335;">`;
            html += `<span class="tac-back" style="cursor:pointer;color:#888;margin-right:6px;">&lt; Back</span>Skills</div>`;

            if (skillAbs.length === 0) {
                html += `<div style="font-size:11px;color:#666;padding:4px 0;">No skills available.</div>`;
            }
            skillAbs.forEach((k, i) => {
                const ab  = ABILITIES[k];
                const can = unit.mp >= ab.mpCost;
                const dis = !can ? DISABLED : '';
                const mp  = ab.mpCost > 0 ? ` <span style="color:#88f;font-size:10px;">(${ab.mpCost}MP)</span>` : '';
                const rng = `<span style="color:#666;font-size:10px;"> rng:${ab.range}${ab.aoe > 0 ? '/aoe:' + ab.aoe : ''}</span>`;
                const ct  = ab.chargeTime > 0 ? ` <span style="color:#c8f;font-size:10px;">[CT:${ab.chargeTime}]</span>` : '';
                html += `<button class="tac-btn" data-action="ability" data-key="${k}" style="${BASE}${dis}"><span style="color:#888;font-size:10px;">[${i + 1}] </span>${ab.name}${mp}${rng}${ct}</button>`;
            });

            // Show passive abilities as non-clickable info
            const passiveAbs = unit.abilities.filter(k => ABILITIES[k]?.passive);
            if (passiveAbs.length > 0) {
                html += `<div style="font-size:10px;color:#666;margin-top:4px;padding-top:4px;border-top:1px solid #223;">`;
                for (const k of passiveAbs) {
                    const ab = ABILITIES[k];
                    html += `<div style="padding:2px 0;">${ab.name} <span style="color:#555;">(passive)</span></div>`;
                }
                html += `</div>`;
            }

            html += `<button class="tac-back-btn" style="${BASE.replace('#151528','#111120')};color:#666;margin-top:2px;">[Esc] Back</button>`;

            menu.innerHTML = html;
            menu.querySelectorAll('.tac-back, .tac-back-btn').forEach(el => {
                el.addEventListener('mousedown', e => { e.stopPropagation(); this._skillMenuOpen = false; });
            });
        } else {
            const { hasMoved, hasActed } = this._turnFlags || {};
            let html = `<div style="color:#ffcc44;font-size:11px;font-weight:bold;margin-bottom:5px;padding-bottom:4px;border-bottom:1px solid #335;">${unit.name}'s Turn</div>`;

            html += `<button class="tac-btn" data-action="move" style="${BASE}${hasMoved ? DISABLED : ''}">[M] Move${hasMoved ? ' <span style="color:#555;font-size:10px;">(done)</span>' : ''}</button>`;

            if (unit.abilities.includes('attack')) {
                html += `<button class="tac-btn" data-action="ability" data-key="attack" style="${BASE}${hasActed ? DISABLED : ''}">[A] Attack</button>`;
            }

            if (skillAbs.length > 0) {
                const anyAffordable = skillAbs.some(k => unit.mp >= ABILITIES[k].mpCost);
                const dis = (!anyAffordable || hasActed) ? DISABLED : '';
                html += `<button class="tac-btn" data-action="skills" style="${BASE}${dis}">[S] Skills ></button>`;
            }

            html += `<button class="tac-btn" data-action="defend" style="${BASE.replace('#151528','#0a1a2a')};color:#7bf;border-color:#36a;${hasActed ? DISABLED : ''}">[D] Defend</button>`;

            html += `<button class="tac-btn" data-action="pivot" style="${BASE.replace('#151528','#111118')};color:#888;font-size:11px;">[P] Pivot</button>`;

            const keepCt = hasMoved ? 20 : 40;
            html += `<button class="tac-btn" data-action="wait" style="${BASE.replace('#151528','#1a1008')};color:#fc8;">[W] Wait <span style="color:#a86;font-size:10px;">(keep ${keepCt} CT)</span></button>`;

            menu.innerHTML = html;
        }

        const STATIC_TOOLTIPS = {
            defend: `<span style="color:#7bf;font-weight:bold;">Defend</span><br>Take a defensive stance until your next turn.<br><span style="color:#aaa;">Reduces physical damage taken. Increases evasion against attacks from the front.</span><br>CT Cost: <b style="color:#fc8;">35</b>`,
            move:   null,
            skills: null,
            pivot:  null,
            wait:   null,
        };

        menu.querySelectorAll('.tac-btn').forEach(btn => {
            btn.addEventListener('mousedown', e => {
                e.stopPropagation();
                this._hideTooltip();
                if (btn.style.cursor === 'not-allowed') return;
                const action = btn.dataset.action;
                if (action === 'skills') { this._skillMenuOpen = true; return; }
                if (this._onAction) this._onAction(action, btn.dataset.key);
            });

            // Ability buttons (attack, skills, etc.)
            const key = btn.dataset.key;
            if (key && ABILITIES[key]) {
                btn.addEventListener('mouseenter', e => {
                    this._tooltip.innerHTML = this._abilityDescription(ABILITIES[key], unit);
                    this._tooltip.style.display = 'block';
                    this._positionTooltip(e);
                });
                btn.addEventListener('mousemove', e => this._positionTooltip(e));
                return;
            }

            // Static-tooltip buttons (defend, etc.)
            const action = btn.dataset.action;
            if (action && STATIC_TOOLTIPS[action]) {
                btn.addEventListener('mouseenter', e => {
                    this._tooltip.innerHTML = STATIC_TOOLTIPS[action];
                    this._tooltip.style.display = 'block';
                    this._positionTooltip(e);
                });
                btn.addEventListener('mousemove', e => this._positionTooltip(e));
            }
        });
    }

    _hideTooltip() {
        this._tooltip.style.display = 'none';
    }

    _positionTooltip(e) {
        const tt = this._tooltip;
        const margin = 10;
        let x = e.clientX + margin;
        let y = e.clientY - tt.offsetHeight - margin;
        // Flip down if not enough room above
        if (y < 0) y = e.clientY + margin;
        // Flip left if not enough room to the right
        if (x + tt.offsetWidth > window.innerWidth) x = e.clientX - tt.offsetWidth - margin;
        tt.style.left = x + 'px';
        tt.style.top  = y + 'px';
    }

    _updateLog(battle) {
        const lines = battle.log.slice(0, 5);
        this._log.innerHTML = lines.map(l =>
            `<div style="font-size:11px;line-height:1.35;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${l}</div>`
        ).join('');
    }

    _showResult(battle, onExit) {
        const r = this._result;
        if (r.style.display === 'flex') return;
        r.style.display = 'flex';
        const won = battle.winner === 'player';
        r.innerHTML = `
            <div style="font-size:40px;font-weight:bold;color:${won ? '#ffcc44' : '#f44'};text-shadow:0 0 24px currentColor;letter-spacing:4px;">
                ${won ? 'VICTORY!' : 'DEFEAT'}
            </div>
            <div style="color:#aaa;font-size:13px;">${won ? 'All enemies defeated.' : 'Your party was wiped out.'}</div>
            <button id="tac-return-btn" style="margin-top:8px;padding:10px 28px;background:#1a1a30;border:1px solid #557;color:#ccc;font-family:inherit;font-size:14px;cursor:pointer;border-radius:4px;pointer-events:auto;">
                Return to Menu
            </button>
        `;
        document.getElementById('tac-return-btn')?.addEventListener('click', () => { if (onExit) onExit(); });
    }

    destroy() {
        this._overlay?.remove();
        this._tooltip?.remove();
        if (this._onDocMouseMove) document.removeEventListener('mousemove', this._onDocMouseMove);
    }
}
