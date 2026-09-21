import { STATES } from './battle.js';
import { ABILITIES } from './abilities.js';

export class BattleUI {
    constructor(container, battle, renderer) {
        this.battle   = battle;
        this.renderer = renderer;
        this._onAction    = null;
        this._skillMenuOpen = false;
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

        // Passive effect summary
        const PASSIVE_EFFECTS = {
            mana_surge:  '<span style="color:#c8a0ff;">Effect: +15% magic damage dealt while MP > 0</span>',
            regen_aura:  '<span style="color:#8f8;">Effect: Heal 5 HP at the start of each turn while MP > 0</span>',
            farsight:    '<span style="color:#aaddff;">Effect: +20% evasion vs physical attacks while MP > 0</span>',
            divine_ward: '<span style="color:#ffeeaa;">Effect: -20% incoming physical damage while MP > 0</span>',
            seers_vigil: '<span style="color:#aaddff;">Effect: +15% evasion vs physical; -10% incoming magic damage while MP > 0</span>',
            wyrd_drain:  '<span style="color:#cc44aa;">Effect: Slows inflicted by this unit last 1 extra turn (via SPD debuff)</span>',
        };
        if (ab.passive && abilityKey && PASSIVE_EFFECTS[abilityKey]) {
            lines.push(PASSIVE_EFFECTS[abilityKey]);
        }

        const stats = [];
        if (ab.range > 0)    stats.push(`Range: <b>${ab.range}</b>`);
        if (ab.aoe > 0)      stats.push(`AoE: <b>${ab.aoe}</b>`);
        if (ab.mpCost > 0)   stats.push(`MP Cost: <b style="color:#88f;">${ab.mpCost}</b>`);
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

        // Stable order within each team: sort by id (creation/roster order).
        const players = battle.livingUnits.filter(u => u.team === 'player').sort((a, b) => a.id - b.id);
        const enemies = battle.livingUnits.filter(u => u.team === 'enemy').sort((a, b) => a.id - b.id);
        const living  = [...players, ...enemies];

        // Roster key uses stable IDs — only changes when units die.
        const rosterKey = living.map(u => u.id).sort((a, b) => a - b).join(',');
        if (this._sidebarRosterKey !== rosterKey) {
            this._sidebarRosterKey = rosterKey;
            this._rebuildSidebarRoster(sb, players, enemies, living);
        }

        // Fast path: update only the dynamic values in-place every frame.
        this._patchSidebarRoster(sb, living, u, battle);
        this._patchSidebarDetails(sb, u, battle);
    }

    _rebuildSidebarRoster(sb, players, enemies, living) {
        // Remove existing roster content, keep the detail panel placeholder.
        sb.querySelectorAll('.tac-roster-row, .tac-roster-header, .tac-team-header').forEach(el => el.remove());

        const detailPanel = sb.querySelector('.tac-detail-panel');

        const insertBefore = (el) => detailPanel ? sb.insertBefore(el, detailPanel) : sb.appendChild(el);

        // Main header.
        const hdr = document.createElement('div');
        hdr.className = 'tac-roster-header';
        hdr.style.cssText = 'color:#ffcc44;font-weight:bold;margin-bottom:8px;font-size:11px;border-bottom:1px solid #335;padding-bottom:4px;';
        hdr.textContent = 'CHARACTERS';
        insertBefore(hdr);

        const makeTeamSection = (units, label, col) => {
            const teamHdr = document.createElement('div');
            teamHdr.className = 'tac-team-header';
            teamHdr.style.cssText = `color:${col};font-size:9px;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px;margin-top:4px;`;
            teamHdr.textContent = label;
            insertBefore(teamHdr);

            for (const unit of units) {
                const row = document.createElement('div');
                row.className = 'tac-roster-row';
                row.dataset.uid = unit.id;
                row.style.cssText = 'display:flex;align-items:center;gap:5px;padding:3px 2px;margin-bottom:2px;border:1px solid transparent;border-radius:3px;';
                row.innerHTML = `
                    <div class="tac-portrait" style="width:28px;height:28px;flex-shrink:0;border-radius:2px;overflow:hidden;background:#111;border:1px solid ${col}44;"></div>
                    <div style="flex:1;min-width:0;">
                        <div style="display:flex;justify-content:space-between;align-items:baseline;">
                            <span class="tac-name" style="color:${col};font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:70px;">${unit.name}</span>
                            <span class="tac-hp" style="font-size:9px;">${unit.hp}</span>
                            <span class="tac-spd" style="font-size:9px;color:#888;"></span>
                        </div>
                        <div style="background:#1a1a2a;height:4px;border-radius:2px;margin-top:3px;position:relative;overflow:hidden;">
                            <div class="tac-ct-ghost" style="position:absolute;top:0;left:0;height:100%;border-radius:2px;width:0%;background:#fff;"></div>
                            <div class="tac-ct-bar" style="position:relative;height:100%;border-radius:2px;width:0%;transition:width 0.12s linear;"></div>
                        </div>
                        <div class="tac-charge-wrap" style="display:none;background:#1a1a2a;height:4px;border-radius:2px;margin-top:2px;position:relative;overflow:hidden;">
                            <div class="tac-charge-bar" style="background:#ffcc44;height:100%;border-radius:2px;width:0%;transition:width 0.12s linear;"></div>
                            <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:flex-end;padding-right:2px;pointer-events:none;">
                                <span style="font-size:7px;color:#00000088;line-height:1;">✦</span>
                            </div>
                        </div>
                    </div>`;
                insertBefore(row);
            }
        };

        makeTeamSection(players, 'Players', '#7bf');
        makeTeamSection(enemies,  'Enemies', '#f76');

        // Draw portraits after browser layout.
        requestAnimationFrame(() => this._drawPortraits(sb, living));
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
            const sprite = renderer._getCompositeSprite(unit, false, null);
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

    _patchSidebarRoster(sb, living, activeUnit, battle) {
        const activeBorderCol = activeUnit?.team === 'player' ? '#44ff8866' : '#ffcc4466';
        // Scale CT bars within each team so the leader shows full.
        const maxCtPlayer = Math.max(1, ...living.filter(u => u.team === 'player').map(u => u.ct));
        const maxCtEnemy  = Math.max(1, ...living.filter(u => u.team === 'enemy').map(u => u.ct));
        sb.querySelectorAll('.tac-roster-row').forEach(row => {
            const uid  = row.dataset.uid;
            const unit = living.find(u => String(u.id) === uid);
            if (!unit) return;

            const isActive = unit === activeUnit;
            const hpF   = unit.hp / unit.maxHp;
            const hpC   = hpF > 0.5 ? '#3c3' : hpF > 0.25 ? '#cc3' : '#c33';
            const maxCt = unit.team === 'player' ? maxCtPlayer : maxCtEnemy;
            const ctPct = Math.round((unit.ct / maxCt) * 100);
            const ctC   = isActive ? (unit.team === 'player' ? '#44ff88' : '#ffcc44')
                                   : (unit.team === 'player' ? '#4af' : '#f64');

            row.style.borderColor = isActive ? activeBorderCol : 'transparent';

            const nameEl = row.querySelector('.tac-name');
            if (nameEl) nameEl.style.fontWeight = isActive ? 'bold' : 'normal';

            const hpEl  = row.querySelector('.tac-hp');
            if (hpEl) { hpEl.textContent = `${unit.hp}/${unit.maxHp} HP`; hpEl.style.color = hpC; }
            const spdEl = row.querySelector('.tac-spd');
            if (spdEl) spdEl.textContent = `spd:${unit.spd}`;

            const ctBar   = row.querySelector('.tac-ct-bar');
            const ctGhost = row.querySelector('.tac-ct-ghost');
            if (ctBar) {
                const prev = parseFloat(ctBar.dataset.ctPct ?? ctPct);
                if (ctPct < prev && ctGhost) {
                    // CT dropped — snap ghost to old value, then let it drain.
                    ctGhost.style.transition = 'none';
                    ctGhost.style.width = prev + '%';
                    // Force reflow so the snap is applied before we re-enable transition.
                    void ctGhost.offsetWidth;
                    ctGhost.style.transition = 'width 0.6s ease-out';
                    ctGhost.style.width = ctPct + '%';
                } else if (ctPct >= prev && ctGhost) {
                    // CT rising — keep ghost in sync with no delay.
                    ctGhost.style.transition = 'none';
                    ctGhost.style.width = ctPct + '%';
                }
                ctBar.dataset.ctPct = ctPct;
                ctBar.style.width = ctPct + '%';
                ctBar.style.background = ctC;
            }

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
        });
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

        let panel = sb.querySelector('.tac-detail-panel');
        if (!panel) {
            panel = document.createElement('div');
            panel.className = 'tac-detail-panel';
            sb.appendChild(panel);
        }
        panel.innerHTML = html;
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
        const { hasMoved, hasActed } = this._turnFlags || {};

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
            defend: `<span style="color:#7bf;font-weight:bold;">Defend</span><br>Take a defensive stance until your next turn.<br><span style="color:#aaa;">Reduces physical damage taken. Increases evasion against attacks from the front.</span><br>CT Cost: <b style="color:#fc8;">${hasMoved ? 100 : 80}</b>`,
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
                    this._tooltip.innerHTML = this._abilityDescription(ABILITIES[key], unit, key);
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

    _showResult(battle, onExit, flags) {
        const r = this._result;
        if (r.style.display === 'flex') return;
        r.style.display = 'flex';
        const won = battle.winner === 'player';
        const rewards = flags?.rewards;

        let rewardHtml = '';
        if (won && rewards) {
            rewardHtml += `<div style="margin-top:10px;border-top:1px solid #335;padding-top:8px;text-align:left;min-width:200px;">`;
            if (rewards.xpGained > 0) {
                rewardHtml += `<div style="color:#aaffaa;font-size:12px;">+${rewards.xpGained} XP (all members)</div>`;
            }
            if (rewards.goldGained > 0) {
                rewardHtml += `<div style="color:#ffdd88;font-size:12px;">+${rewards.goldGained} gold</div>`;
            }
            for (const item of (rewards.itemsGained || [])) {
                const name = item.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                rewardHtml += `<div style="color:#88ddff;font-size:12px;">Item: ${name}</div>`;
            }
            if (rewards.questsCompleted?.length) {
                for (const q of rewards.questsCompleted) {
                    rewardHtml += `<div style="color:#ffcc88;font-size:12px;">Quest updated: ${q.title}</div>`;
                }
            }
            rewardHtml += `</div>`;
        }

        r.innerHTML = `
            <div style="font-size:40px;font-weight:bold;color:${won ? '#ffcc44' : '#f44'};text-shadow:0 0 24px currentColor;letter-spacing:4px;">
                ${won ? 'VICTORY!' : 'DEFEAT'}
            </div>
            <div style="color:#aaa;font-size:13px;">${won ? 'All enemies defeated.' : 'Your party was wiped out.'}</div>
            ${rewardHtml}
            <button id="tac-return-btn" style="margin-top:12px;padding:10px 28px;background:#1a1a30;border:1px solid #557;color:#ccc;font-family:inherit;font-size:14px;cursor:pointer;border-radius:4px;pointer-events:auto;">
                Return to Map
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
