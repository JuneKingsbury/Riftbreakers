import { SHOP_ITEMS, NODES } from './world-map-data.js';
import { JOB_STATS, ABILITIES, jobLevel, unlockedAbilities, meetsPrerequisites, missingPrerequisites, masteryStatBonus, crossJobUnlockedAbilities, XP_THRESHOLDS, allowedEquipTypes, isPlayerJob } from './data-registry.js';
import { JOB_DATA } from './data/jobs.js';
import { EQUIPMENT, equipmentStatBonuses } from './data/equipment.js';

const NODE_NAME_MAP = Object.fromEntries(NODES.map(n => [n.id, n.name]));

const TYPE_LABELS = {
    town:     'Town',
    wilds:    'Wilds',
    ruins:    'Ruins',
    dungeon:  'Dungeon',
    fortress: 'Fortress',
};

const BTN_BASE = `
    display:block; width:100%; padding:6px 10px; margin-bottom:5px;
    background:#151528; border:1px solid #447; color:#ccc;
    font-family:'Courier New',monospace; font-size:12px;
    cursor:pointer; text-align:left; border-radius:3px;
`;

const BTN_DISABLED = 'opacity:0.4;cursor:not-allowed;';

export class WorldMapUI {
    constructor(containerEl) {
        this._overlay  = document.createElement('div');
        this._overlay.style.cssText = `
            position:fixed; inset:0; z-index:200;
            pointer-events:none;
            font-family:'Courier New',monospace; font-size:12px; color:#ccc;
        `;
        document.body.appendChild(this._overlay);

        this._sidebar  = this._makeSidebar();
        this._modal    = this._makeModal();
        this._notification = this._makeNotification();
        this._tooltip  = this._makeTooltip();
        this._onAction = null;
        this._lastSidebarKey = null;
    }

    setActionHandler(fn) { this._onAction = fn; }

    destroy() {
        if (this._modalKeyHandler) document.removeEventListener('keydown', this._modalKeyHandler);
        this._overlay?.remove();
        this._modal?.remove();
        this._notification?.remove();
        this._tooltip?.remove();
    }

    update(worldMap, selectedNodeId) {
        // Only rebuild the DOM when something that affects the sidebar actually changed.
        // This prevents the innerHTML churn that breaks click events.
        const key = `${worldMap.currentNodeId}|${selectedNodeId}|${worldMap.gold}|${worldMap.day}|${worldMap.activeQuests.length}|${worldMap.completedBattles.size}`;
        if (key === this._lastSidebarKey) return;
        this._lastSidebarKey = key;
        this._updateSidebar(worldMap, selectedNodeId);
    }

    // ---------- notification toast ----------
    notify(text, durationMs = 2800) {
        const el = this._notification;
        el.textContent = text;
        el.style.opacity = '1';
        el.style.display = 'block';
        clearTimeout(this._notifyTimer);
        this._notifyTimer = setTimeout(() => {
            el.style.opacity = '0';
            setTimeout(() => { el.style.display = 'none'; }, 400);
        }, durationMs);
    }

    // ---------- sidebar ----------
    _makeSidebar() {
        const el = document.createElement('div');
        el.style.cssText = `
            position:absolute; top:0; right:0; width:200px; height:100%;
            background:rgba(8,8,20,0.92); border-left:1px solid #335;
            padding:10px 8px; box-sizing:border-box;
            overflow-y:auto; pointer-events:auto;
        `;
        this._overlay.appendChild(el);

        // Delegated listener persists across innerHTML replacements
        el.addEventListener('click', (e) => {
            const btn = e.target.closest('.wm-btn');
            if (!btn) return;
            if (btn.dataset.disabled === 'true') return;
            const action  = btn.dataset.action;
            const nodeId  = btn.dataset.node  || null;
            const questId = btn.dataset.quest || null;
            if (this._onAction) this._onAction(action, nodeId, questId);
        });

        // Tooltip delegation for quest rows
        el.addEventListener('mouseover', (e) => {
            const row = e.target.closest('.wm-quest-row');
            if (!row || !this._tooltip) return;
            const questId = row.dataset.questId;
            const q = this._activeQuestMap?.[questId];
            if (!q) return;
            const targetName = NODE_NAME_MAP[q.targetNodeId] || q.targetNodeId;
            const rewardItems = (q.rewardItems || []).join(', ') || 'none';
            this._tooltip.innerHTML =
                `<div style="color:#ffcc44;font-weight:bold;margin-bottom:4px;">${q.title}</div>` +
                `<div style="color:#aaa;margin-bottom:6px;">${q.description}</div>` +
                `<div style="color:#888;font-size:10px;">Go to: <span style="color:#ccc;">${targetName}</span></div>` +
                `<div style="color:#888;font-size:10px;">Reward: <span style="color:#fc8;">${q.rewardGold}g</span>${q.rewardItems?.length ? `, <span style="color:#adf;">${rewardItems}</span>` : ''}</div>`;
            this._tooltip.style.display = 'block';
        });

        el.addEventListener('mousemove', (e) => {
            if (this._tooltip.style.display === 'none') return;
            this._positionTooltip(e.clientX, e.clientY);
        });

        el.addEventListener('mouseout', (e) => {
            if (!e.target.closest('.wm-quest-row')) return;
            if (e.relatedTarget?.closest?.('.wm-quest-row')) return;
            this._tooltip.style.display = 'none';
        });

        return el;
    }

    _makeTooltip() {
        const el = document.createElement('div');
        el.style.cssText = `
            position:fixed; z-index:500; display:none;
            background:rgba(8,8,24,0.97); border:1px solid #559;
            border-radius:5px; padding:8px 10px;
            font-size:11px; color:#ccc; line-height:1.6;
            pointer-events:none; max-width:240px;
            box-shadow:0 4px 16px rgba(0,0,0,0.7);
            font-family:'Courier New',monospace;
        `;
        document.body.appendChild(el);
        return el;
    }

    _positionTooltip(cx, cy) {
        const tt = this._tooltip;
        const margin = 12;
        let x = cx - tt.offsetWidth - margin;
        let y = cy - tt.offsetHeight / 2;
        if (x < 0) x = cx + margin;
        if (y < 0) y = margin;
        if (y + tt.offsetHeight > window.innerHeight) y = window.innerHeight - tt.offsetHeight - margin;
        tt.style.left = x + 'px';
        tt.style.top  = y + 'px';
    }

    _updateSidebar(worldMap, selectedNodeId) {
        const current  = worldMap.currentNode;
        const selected = selectedNodeId ? worldMap.getNode(selectedNodeId) : null;
        const display  = selected || current;
        const canTravel  = selected && selected.id !== current.id && worldMap.canTravelTo(selected.id);
        const routePath  = (!canTravel && selected && selected.id !== current.id && selected.discovered)
            ? worldMap.findPath(current.id, selected.id)
            : null;
        const canRoute   = routePath && routePath.length > 1;
        const actions   = worldMap.getAvailableActions();
        const quests    = worldMap.activeQuests.filter(q => !q.completed);

        let html = '';

        // Gold + day
        html += `<div style="display:flex;justify-content:space-between;margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid #335;">
            <span style="color:#fc8;">&#9733; ${worldMap.gold}g</span>
            <span style="color:#88a;">Day ${worldMap.day}</span>
        </div>`;

        // Location heading
        html += `<div style="color:#ffcc44;font-weight:bold;font-size:13px;margin-bottom:2px;">${display.name}</div>`;
        html += `<div style="color:#886;font-size:10px;text-transform:uppercase;margin-bottom:6px;">${TYPE_LABELS[display.type] || display.type}</div>`;
        html += `<div style="color:#aaa;font-size:11px;line-height:1.5;margin-bottom:10px;border-bottom:1px solid #223;padding-bottom:8px;">${display.flavor}</div>`;

        // Travel / route button
        if (selected && selected.id !== current.id) {
            if (canTravel) {
                html += `<button class="wm-btn" data-action="travel" data-node="${selected.id}" style="${BTN_BASE}color:#7bf;border-color:#36a;">&#10132; Travel to ${selected.name}</button>`;
            } else if (canRoute) {
                const hops = routePath.length;
                html += `<button class="wm-btn" data-action="route" data-node="${selected.id}" style="${BTN_BASE}color:#7bf;border-color:#36a;">&#10132; Route to ${selected.name} <span style="color:#88a;font-size:10px;">(${hops} hops)</span></button>`;
            } else {
                html += `<button class="wm-btn" data-disabled="true" style="${BTN_BASE}${BTN_DISABLED}color:#7bf;border-color:#36a;">${selected.discovered ? 'Not reachable from here' : 'Undiscovered'}</button>`;
            }
        }

        // Party + Inventory buttons — always visible
        html += `<button class="wm-btn" data-action="party" style="${BTN_BASE}color:#adf;border-color:#448;">&#9776; Party</button>`;
        const invCount = Object.values(worldMap.inventory).reduce((s, n) => s + n, 0);
        html += `<button class="wm-btn" data-action="inventory" style="${BTN_BASE}color:#adf;border-color:#448;">&#x1F392; Inventory <span style="color:#888;font-size:10px;">(${invCount})</span></button>`;

        // Actions (only when at the current node)
        if (!selected || selected.id === current.id) {
            if (actions.includes('shop')) {
                html += `<button class="wm-btn" data-action="shop" style="${BTN_BASE}">&#x1F6CD; Shop</button>`;
            }
            if (actions.includes('questboard')) {
                const newQuests = worldMap.getAvailableQuests().length;
                const badge = newQuests > 0 ? ` <span style="color:#fc8;font-size:10px;">(${newQuests} available)</span>` : '';
                html += `<button class="wm-btn" data-action="questboard" style="${BTN_BASE}">&#x1F4CB; Quest Board${badge}</button>`;
            }
            if (actions.includes('event')) {
                html += `<button class="wm-btn" data-action="event" style="${BTN_BASE}">&#x1F300; Random Event</button>`;
            }
            if (actions.includes('rest') || true) {
                // Rest is always available
                html += `<button class="wm-btn" data-action="rest" style="${BTN_BASE}color:#8a8;border-color:#3a5a3a;">&#x1F3D5; Make Camp (+1 day)</button>`;
            }
            // Battle button if there is an available scenario
            if (current.battleScenarioId && !worldMap.completedBattles.has(current.battleScenarioId)) {
                html += `<button class="wm-btn" data-action="battle" style="${BTN_BASE}color:#f88;border-color:#744;">&#x2694; Enter Battle</button>`;
            } else if (current.battleScenarioId && worldMap.completedBattles.has(current.battleScenarioId)) {
                html += `<button class="wm-btn" data-action="battle" style="${BTN_BASE}">&#x2694; Battle Again</button>`;
            }
        }

        // Active quests summary
        if (quests.length > 0) {
            this._activeQuestMap = Object.fromEntries(quests.map(q => [q.id, q]));
            html += `<div style="margin-top:10px;padding-top:8px;border-top:1px solid #223;">`;
            html += `<div style="color:#fc8;font-size:10px;text-transform:uppercase;margin-bottom:4px;">Active Quests</div>`;
            for (const q of quests) {
                const atTarget = q.targetNodeId === current.id;
                if (atTarget) {
                    html += `<div class="wm-quest-row" data-quest-id="${q.id}" style="margin-bottom:4px;border-bottom:1px solid #1a1a28;padding-bottom:4px;">`;
                    html += `<div style="font-size:10px;color:#8f8;padding:2px 0;">${q.title} &#10003;</div>`;
                    html += `<button class="wm-btn" data-action="turnin" data-quest="${q.id}" style="${BTN_BASE}padding:3px 8px;margin-bottom:0;color:#fc8;border-color:#664;font-size:11px;">Turn In</button>`;
                    html += `</div>`;
                } else {
                    html += `<div class="wm-quest-row" data-quest-id="${q.id}" style="font-size:10px;color:#aaa;padding:3px 2px;border-bottom:1px solid #1a1a28;">${q.title}</div>`;
                }
            }
            html += `</div>`;
        } else {
            this._activeQuestMap = {};
        }

        this._sidebar.innerHTML = html;
    }

    // ---------- modal overlay ----------
    _makeModal() {
        const el = document.createElement('div');
        el.style.cssText = `
            display:none; position:fixed; inset:0; z-index:300;
            background:rgba(0,0,0,0.7);
            align-items:center; justify-content:center;
            pointer-events:auto;
        `;
        document.body.appendChild(el);

        // Backdrop click or Esc both invoke _modalBack()
        el.addEventListener('click', (e) => {
            if (e.target === el) this._modalBack();
        });
        this._modalKeyHandler = (e) => {
            if (e.key === 'Escape' && el.style.display !== 'none') {
                e.preventDefault();
                this._modalBack();
            }
        };
        document.addEventListener('keydown', this._modalKeyHandler);

        // _modalBackFn: set by sub-views so Esc/backdrop navigates to parent instead of closing.
        // _modalDismissible: false on forced screens (encounter, battle result) so Esc does nothing.
        this._modalBackFn     = null;
        this._modalDismissible = true;
        this._modalOnClose    = null;
        return el;
    }

    // Called by Esc, backdrop click, and the Close/Back button.
    _modalBack() {
        if (!this._modalDismissible) return;
        if (this._modalBackFn) {
            const fn = this._modalBackFn;
            this._modalBackFn = null;
            fn();
        } else {
            this._modal.style.display = 'none';
            if (this._modalOnClose) { this._modalOnClose(); this._modalOnClose = null; }
        }
    }

    _makeNotification() {
        const el = document.createElement('div');
        el.style.cssText = `
            display:none; position:fixed; bottom:80px; left:50%; transform:translateX(-50%);
            background:rgba(8,8,28,0.95); border:1px solid #557; border-radius:5px;
            padding:8px 20px; font-size:12px; color:#ddc; z-index:400;
            transition:opacity 0.4s; pointer-events:none;
        `;
        document.body.appendChild(el);
        return el;
    }

    _openModal(html, onClose) {
        const el = this._modal;
        el.innerHTML = `
            <div style="background:#0d0d1e;border:1px solid #447;border-radius:8px;
                        padding:20px 24px;max-width:420px;width:90%;max-height:80vh;
                        overflow-y:auto;overflow-x:hidden;box-sizing:border-box;
                        position:relative;pointer-events:auto;">
                ${html}
                <button id="wm-modal-close" style="${BTN_BASE}margin-top:14px;color:#888;">Close</button>
            </div>
        `;
        el.style.display = 'flex';
        this._modalBackFn      = null;
        this._modalDismissible = true;
        this._modalOnClose     = onClose || null;
        el.querySelector('#wm-modal-close').addEventListener('click', () => this._modalBack());
        return el;
    }

    // ---------- Quest Turn-In ----------
    showQuestTurnIn(quest, onConfirm) {
        const itemNames = (quest.rewardItems || [])
            .map(id => SHOP_ITEMS.find(i => i.id === id)?.name || id)
            .join(', ');

        let html = `<div style="color:#ffcc44;font-weight:bold;font-size:15px;margin-bottom:8px;">Quest Complete</div>`;
        html += `<div style="color:#fc8;font-size:12px;margin-bottom:12px;">${quest.title}</div>`;

        // Story paragraph
        html += `<div style="color:#ccc;font-size:12px;line-height:1.75;margin-bottom:16px;
                             padding:10px 12px;background:#0a0a1a;border-left:2px solid #447;
                             border-radius:0 4px 4px 0;">${quest.turnInStory || 'The task is done.'}</div>`;

        // Reward summary
        html += `<div style="background:#0d1a0d;border:1px solid #3a5a3a;border-radius:4px;padding:10px 12px;margin-bottom:14px;">`;
        html += `<div style="color:#8f8;font-size:11px;text-transform:uppercase;margin-bottom:6px;">Rewards</div>`;
        html += `<div style="display:flex;gap:16px;font-size:12px;">`;
        html += `<span style="color:#fc8;">&#9733; ${quest.rewardGold}g</span>`;
        if (itemNames) html += `<span style="color:#adf;">+ ${itemNames}</span>`;
        html += `</div></div>`;

        html += `<button id="wm-turnin-confirm" style="${BTN_BASE}text-align:center;color:#fc8;border-color:#664;">Collect Reward</button>`;

        this._openModal(html, null);
        this._modalDismissible = false;
        this._modal.querySelector('#wm-modal-close').style.display = 'none';
        this._modal.querySelector('#wm-turnin-confirm').addEventListener('click', () => {
            this._modalDismissible = true;
            this._modal.style.display = 'none';
            if (onConfirm) onConfirm();
        });
    }

    // ---------- Shop ----------
    showShop(worldMap, skinManager, onClose) {
        const _rebuild = () => {
            let html = `<div style="color:#ffcc44;font-weight:bold;font-size:15px;margin-bottom:10px;">Shop</div>`;
            html += `<div style="color:#fc8;margin-bottom:12px;">Gold: <b id="wm-shop-gold">${worldMap.gold}g</b></div>`;
            for (const shopItem of SHOP_ITEMS) {
                const eq = EQUIPMENT[shopItem.id];
                if (!eq) continue;
                const canAfford = worldMap.gold >= shopItem.cost;
                const statStr = _statSummary(eq);
                html += `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;padding:6px;
                                     background:#111122;border:1px solid #334;border-radius:4px;">
                    <canvas class="wm-item-icon" data-item="${shopItem.id}" width="16" height="16"
                            style="image-rendering:pixelated;flex-shrink:0;"></canvas>
                    <div style="flex:1;min-width:0;">
                        <div style="font-size:12px;">${_jobLabel(shopItem.id)}</div>
                        <div style="font-size:10px;color:#888;">${statStr}</div>
                    </div>
                    <button class="wm-buy-btn" data-item="${shopItem.id}" data-cost="${shopItem.cost}"
                        style="padding:4px 10px;font-family:inherit;font-size:11px;
                               background:#1a1a30;border:1px solid #447;color:${canAfford ? '#ccc' : '#555'};
                               cursor:${canAfford ? 'pointer' : 'not-allowed'};border-radius:3px;">
                        ${shopItem.cost}g
                    </button>
                </div>`;
            }
            const inner = this._modal.querySelector('div');
            if (inner) {
                inner.innerHTML = html + `<button id="wm-modal-close" style="${BTN_BASE}margin-top:14px;color:#888;">Close</button>`;
                inner.querySelector('#wm-modal-close').addEventListener('click', () => this._modalBack());
                if (skinManager) {
                    inner.querySelectorAll('.wm-item-icon').forEach(c => {
                        const sp = skinManager.getItemSprite(c.dataset.item);
                        if (!sp) return;
                        const ctx = c.getContext('2d');
                        ctx.imageSmoothingEnabled = false;
                        ctx.drawImage(sp, 0, 0, c.width, c.height);
                    });
                }
                inner.querySelectorAll('.wm-buy-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const cost = parseInt(btn.dataset.cost, 10);
                        if (worldMap.gold < cost) return;
                        worldMap.gold -= cost;
                        worldMap.addItem(btn.dataset.item);
                        this.notify(`Bought: ${_jobLabel(btn.dataset.item)}`);
                        _rebuild();
                    });
                });
            }
        };

        // Open modal with empty content then populate
        this._openModal('', onClose);
        _rebuild();
    }

    // ---------- Quest Board ----------
    showQuestBoard(worldMap, onClose) {
        const available = worldMap.getAvailableQuests().slice(0, 4);
        const active    = worldMap.activeQuests.filter(q => !q.completed);

        let html = `<div style="color:#ffcc44;font-weight:bold;font-size:15px;margin-bottom:10px;">Quest Board</div>`;

        if (active.length > 0) {
            html += `<div style="color:#fc8;font-size:11px;margin-bottom:8px;">Active Quests</div>`;
            for (const q of active) {
                html += `
                    <div style="margin-bottom:6px;padding:6px;background:#111122;border:1px solid #334;border-radius:4px;">
                        <div style="font-size:12px;color:#ddc;">${q.title}</div>
                        <div style="font-size:10px;color:#888;">${q.description}</div>
                        <div style="font-size:10px;color:#6a6;margin-top:3px;">Reward: ${q.rewardGold}g</div>
                    </div>`;
            }
        }

        if (available.length > 0) {
            html += `<div style="color:#fc8;font-size:11px;margin:8px 0;">Available Quests</div>`;
            for (const q of available) {
                html += `
                    <div style="margin-bottom:6px;padding:6px;background:#111122;border:1px solid #334;border-radius:4px;">
                        <div style="font-size:12px;color:#ddc;">${q.title}</div>
                        <div style="font-size:10px;color:#888;margin-bottom:4px;">${q.description}</div>
                        <div style="display:flex;justify-content:space-between;align-items:center;">
                            <span style="font-size:10px;color:#6a6;">Reward: ${q.rewardGold}g</span>
                            <button class="wm-quest-accept" data-id="${q.id}"
                                style="padding:3px 10px;font-family:inherit;font-size:11px;
                                       background:#1a2a1a;border:1px solid #3a6a3a;color:#aaa;
                                       cursor:pointer;border-radius:3px;">Accept</button>
                        </div>
                    </div>`;
            }
        } else if (active.length === 0) {
            html += `<div style="color:#666;font-size:11px;">No quests currently available.</div>`;
        }

        this._openModal(html, onClose);

        this._modal.querySelectorAll('.wm-quest-accept').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                if (worldMap.acceptQuest(id)) {
                    const q = worldMap.activeQuests.find(q => q.id === id);
                    this.notify(`Quest accepted: ${q?.title || id}`);
                    btn.textContent = 'Accepted';
                    btn.disabled    = true;
                    btn.style.color = '#555';
                }
            });
        });
    }

    // ---------- Random Event ----------
    showEncounter(enemy, flavorText, onFight) {
        let html = `
            <div style="color:#ff6060;font-weight:bold;font-size:15px;margin-bottom:8px;">
                &#x2694; Hostile Encounter
            </div>
            <div style="color:#ffaa88;font-weight:bold;font-size:13px;margin-bottom:6px;">
                ${enemy.name}
            </div>
            <div style="color:#ccc;font-size:12px;line-height:1.7;margin-bottom:14px;">
                ${flavorText}
            </div>
            <button id="wm-enc-fight" style="${BTN_BASE}color:#f88;border-color:#744;text-align:center;">
                &#x2694; Fight
            </button>`;
        this._openModal(html, null);
        this._modalDismissible = false;
        this._modal.querySelector('#wm-modal-close').style.display = 'none';
        this._modal.querySelector('#wm-enc-fight').addEventListener('click', () => {
            this._modalDismissible = true;
            this._modal.style.display = 'none';
            if (onFight) onFight();
        });
    }

    showEvent(event, worldMap, onOutcome) {
        let html = `<div style="color:#ffcc44;font-weight:bold;font-size:15px;margin-bottom:8px;">${event.title}</div>`;
        html += `<div style="color:#ccc;font-size:12px;line-height:1.7;margin-bottom:14px;">${event.text}</div>`;
        html += `<div id="wm-event-outcomes">`;
        for (let i = 0; i < event.outcomes.length; i++) {
            const o = event.outcomes[i];
            html += `<button class="wm-outcome-btn" data-idx="${i}"
                style="${BTN_BASE}margin-bottom:6px;">${o.label}</button>`;
        }
        html += `</div>`;

        this._openModal(html, null);

        // Not dismissible until an outcome is chosen
        this._modalDismissible = false;
        this._modal.querySelector('#wm-modal-close').style.display = 'none';

        this._modal.querySelectorAll('.wm-outcome-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx     = parseInt(btn.dataset.idx, 10);
                const outcome = event.outcomes[idx];

                // Show result text, then allow Esc/Close to dismiss
                const outDiv = this._modal.querySelector('#wm-event-outcomes');
                outDiv.innerHTML = `<div style="color:#8cf;font-size:12px;line-height:1.7;
                                              padding:8px;background:#0a1020;
                                              border:1px solid #335;border-radius:4px;
                                              margin-bottom:10px;">${outcome.resultText}</div>`;
                this._modalDismissible = true;
                this._modal.querySelector('#wm-modal-close').style.display = 'block';

                const eff = worldMap.applyEventOutcome(outcome);
                if (onOutcome) onOutcome(outcome, eff);
            });
        });
    }

    // ---------- Battle result ----------
    showBattleResult(won, onContinue) {
        let html = `
            <div style="text-align:center;">
                <div style="font-size:36px;font-weight:bold;color:${won ? '#ffcc44' : '#f44'};
                            text-shadow:0 0 20px currentColor;letter-spacing:4px;margin-bottom:12px;">
                    ${won ? 'VICTORY!' : 'DEFEAT'}
                </div>
                <div style="color:#aaa;font-size:13px;margin-bottom:16px;">
                    ${won ? 'The enemy is routed. The road ahead is open.' : 'Your party has fallen. Regroup and try again.'}
                </div>
                <button id="wm-br-continue"
                    style="${BTN_BASE}text-align:center;">Return to World Map</button>
            </div>`;

        this._openModal(html, null);
        this._modalDismissible = false;
        this._modal.querySelector('#wm-modal-close').style.display = 'none';
        this._modal.querySelector('#wm-br-continue').addEventListener('click', () => {
            this._modalDismissible = true;
            this._modal.style.display = 'none';
            if (onContinue) onContinue();
        });
    }

    // ---------- Quest completion ----------
    showQuestComplete(quest) {
        this.notify(`Quest complete: ${quest.title} (+${quest.rewardGold}g)`, 4000);
    }

    // ---------- Party screen ----------
    showParty(worldMap, skinManager) {
        const party = worldMap.party || [];

        let html = `<div style="color:#ffcc44;font-weight:bold;font-size:15px;margin-bottom:12px;">Party</div>`;

        for (const member of party) {
            const a = member.appearance;
            const jobStats = JOB_STATS[member.job] || {};
            const jobLabel = _jobLabel(member.job);
            const nameColor = a?.nameColor || '#ccc';

            html += `<div class="wm-party-card" data-member="${member.name}"
                          style="display:flex;gap:10px;align-items:flex-start;
                                 margin-bottom:8px;padding:8px;cursor:pointer;
                                 background:#0d0d20;border:1px solid #335;border-radius:5px;">`;

            html += `<canvas class="wm-party-portrait" data-member="${member.name}"
                              width="32" height="32"
                              style="image-rendering:pixelated;flex-shrink:0;
                                     border:1px solid #446;border-radius:3px;
                                     background:#080818;"></canvas>`;

            html += `<div style="flex:1;min-width:0;">`;
            html += `<div style="font-size:13px;font-weight:bold;color:${nameColor};margin-bottom:1px;">${member.name}</div>`;
            html += `<div style="font-size:10px;color:#888;text-transform:uppercase;margin-bottom:5px;">${jobLabel}</div>`;

            const slots = [
                { label: 'Armor',  key: a?.armorKey  },
                { label: 'Helmet', key: a?.helmetKey },
                { label: 'Weapon', key: a?.weaponKey },
                { label: 'Tool',   key: a?.toolKey   },
            ];
            html += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:2px 8px;font-size:10px;">`;
            for (const slot of slots) {
                if (slot.key) {
                    html += `<div style="color:#666;display:flex;align-items:center;gap:3px;">` +
                        `${slot.label}: ` +
                        `<canvas class="wm-item-icon" data-item="${slot.key}" width="12" height="12"` +
                        ` style="image-rendering:pixelated;flex-shrink:0;"></canvas>` +
                        `<span style="color:#adf;">${slot.key.replace(/_/g, ' ')}</span>` +
                        `</div>`;
                } else {
                    html += `<div style="color:#666;">${slot.label}: <span style="color:#444;">—</span></div>`;
                }
            }
            html += `</div>`;

            html += `<div style="font-size:10px;color:#556;margin-top:5px;">Click to view details ›</div>`;
            html += `</div></div>`;
        }

        this._openModal(html, null);
        this._drawPartyPortraitsAndIcons(party, skinManager);

        this._modal.querySelectorAll('.wm-party-card').forEach(card => {
            card.addEventListener('click', () => {
                const member = party.find(m => m.name === card.dataset.member);
                if (member) this._showPartyMember(member, worldMap, skinManager);
            });
        });
    }

    _drawPartyPortraitsAndIcons(party, skinManager) {
        if (!skinManager) return;
        this._modal.querySelectorAll('.wm-item-icon').forEach(canvas => {
            const sprite = skinManager.getItemSprite(canvas.dataset.item);
            if (!sprite) return;
            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(sprite, 0, 0, canvas.width, canvas.height);
        });
        this._modal.querySelectorAll('.wm-party-portrait').forEach(canvas => {
            const member = party.find(m => m.name === canvas.dataset.member);
            if (!member?.appearance) return;
            const a = member.appearance;
            const composite = skinManager.getCompositedColonistSprite(
                'party_' + member.name, false,
                a.race, a.armorKey, a.helmetKey,
                a.bodyVariant, a.hairVariant, a.shirtVariant,
                a.nameColor,
                a.weaponKey, a.toolKey, null,
                false
            );
            if (!composite) return;
            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(composite, 0, 0, canvas.width, canvas.height);
        });
    }

    _showPartyMember(member, worldMap, skinManager) {
        const a = member.appearance;
        const nameColor = a?.nameColor || '#ccc';
        const jobStats  = JOB_STATS[member.job] || {};
        const jobLabel  = _jobLabel(member.job);

        // ---- Header ----
        let html = `
            <div style="display:flex;gap:12px;align-items:center;margin-bottom:14px;">
                <canvas class="wm-party-portrait" data-member="${member.name}"
                        width="48" height="48"
                        style="image-rendering:pixelated;flex-shrink:0;
                               border:1px solid #446;border-radius:4px;background:#080818;"></canvas>
                <div>
                    <div style="font-size:16px;font-weight:bold;color:${nameColor};">${member.name}</div>
                    <div style="font-size:11px;color:#888;text-transform:uppercase;">${jobLabel}</div>
                </div>
            </div>`;

        // ---- Stats (job base + equipment bonuses) ----
        const bonuses = equipmentStatBonuses(a);
        const stat = (key, base) => {
            const b = bonuses[key] || 0;
            const total = (base ?? 0) + b;
            if (b === 0) return `<span style="color:#ccc;">${total}</span>`;
            const sign = b > 0 ? '+' : '';
            const col  = b > 0 ? '#8f8' : '#f88';
            return `<span style="color:#ccc;">${total}</span> <span style="color:${col};font-size:9px;">(${sign}${b})</span>`;
        };
        const STAT_ROWS = [
            ['HP',  'maxHp', jobStats.maxHp, 'MP',  'maxMp', jobStats.maxMp],
            ['ATK', 'atk',   jobStats.atk,   'DEF', 'def',   jobStats.def],
            ['MAT', 'mat',   jobStats.mat,   'MDF', 'mdf',   jobStats.mdf],
            ['SPD', 'spd',   jobStats.spd,   'MOV', 'move',  jobStats.move],
            ['EVA', 'eva',   jobStats.eva,   null,  null,    null],
        ];
        html += `<div style="font-size:10px;color:#fc8;text-transform:uppercase;margin-bottom:4px;">Stats</div>`;
        html += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:2px 12px;
                              font-size:11px;margin-bottom:12px;padding:8px;
                              background:#080818;border:1px solid #223;border-radius:4px;">`;
        for (const [la, ka, va, lb, kb, vb] of STAT_ROWS) {
            html += `<div style="color:#888;">${la}: ${stat(ka, va)}</div>`;
            html += lb
                ? `<div style="color:#888;">${lb}: ${stat(kb, vb)}</div>`
                : `<div></div>`;
        }
        html += `</div>`;

        // ---- Equipment ----
        const slots = [
            { label: 'Armor',  field: 'armorKey',  slot: 'armor'  },
            { label: 'Helmet', field: 'helmetKey', slot: 'helmet' },
            { label: 'Weapon', field: 'weaponKey', slot: 'weapon' },
            { label: 'Tool',   field: 'toolKey',   slot: 'tool'   },
        ];
        // Build slot option lists.
        // Returns: [ null, ...freeItems, ...onOtherItems ]
        // "free" = in inventory (unequipped copies). "onOther" = equipped by another
        // party member with no free copy in inventory. Items on others are only included
        // if there is no free copy available (so we always consume inventory first).
        const equippedBy = worldMap.equippedByMap(member.name);
        const optsForSlot = (slotName, curKey) => {
            const allowedTypes = allowedEquipTypes(member.job, slotName);
            const jobAllows = (k) => {
                if (!allowedTypes) return true;
                return allowedTypes.has(EQUIPMENT[k]?.type);
            };

            // Items with at least one unequipped copy in inventory
            const free = Object.keys(worldMap.inventory)
                .filter(k => EQUIPMENT[k]?.slot === slotName && worldMap.inventory[k] > 0 && jobAllows(k));
            const freeSet = new Set(free);

            // Items worn by another party member that have no free copy.
            // Exclude curKey: if this member already has it in this slot it is
            // never "on someone else" regardless of what equippedByMap returns
            // (equippedByMap only tracks the last writer when the same item is
            // equipped by multiple members simultaneously).
            const onOthers = Object.entries(equippedBy)
                .filter(([k, name]) =>
                    k !== curKey &&
                    name !== member.name &&
                    EQUIPMENT[k]?.slot === slotName &&
                    !freeSet.has(k) &&
                    jobAllows(k)
                )
                .map(([k]) => k);

            // Always include this member's currently equipped item if somehow missing
            const all = [...free, ...onOthers];
            if (curKey && !all.includes(curKey)) all.unshift(curKey);
            return { free: freeSet, onOthers: new Set(onOthers), all: [null, ...all] };
        };

        html += `<div style="font-size:10px;color:#fc8;text-transform:uppercase;margin-bottom:4px;">Equipment</div>`;
        html += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 8px;margin-bottom:12px;">`;
        for (const slot of slots) {
            const cur  = a?.[slot.field] || '';
            const { free, onOthers, all } = optsForSlot(slot.slot, cur || null);
            html += `<div style="min-width:0;">`;
            html += `<div style="font-size:10px;color:#666;margin-bottom:2px;">${slot.label}</div>`;
            // Item icon sits above the select, not inline, to avoid width pressure
            if (cur) {
                html += `<canvas class="wm-item-icon" data-item="${cur}" width="12" height="12"
                                  style="image-rendering:pixelated;display:block;margin-bottom:2px;"></canvas>`;
            }
            html += `<select class="wm-equip-select" data-field="${slot.field}" data-member="${member.name}"
                              style="width:100%;min-width:0;box-sizing:border-box;
                                     background:#0d0d20;border:1px solid #447;color:#ccc;
                                     font-family:'Courier New',monospace;font-size:10px;padding:2px 3px;
                                     border-radius:3px;">`;
            let passedDivider = false;
            for (const key of all) {
                if (!passedDivider && key && onOthers.has(key)) {
                    passedDivider = true;
                    html += `<option disabled style="color:#555;">─ equipped by others ─</option>`;
                }
                let suffix = '';
                if (key) {
                    if (onOthers.has(key)) {
                        suffix = ` [${equippedBy[key]}]`;
                    } else if (key !== cur) {
                        const n = worldMap.itemCount(key);
                        suffix = n > 1 ? ` ×${n}` : '';
                    }
                }
                const label = key ? `${_jobLabel(key)}${suffix}` : '— none —';
                const sel   = cur === (key || '') ? ' selected' : '';
                html += `<option value="${key || ''}"${sel}>${label}</option>`;
            }
            html += `</select></div>`;
        }
        html += `</div>`;

        // ---- Job ----
        const allJobs = Object.keys(JOB_STATS).filter(isPlayerJob);
        const unlockedJobs = allJobs.filter(k => meetsPrerequisites(member.xp, k));
        const lockedJobs   = allJobs.filter(k => !meetsPrerequisites(member.xp, k));

        html += `<div style="font-size:10px;color:#fc8;text-transform:uppercase;margin-bottom:4px;">Job</div>`;
        html += `<select class="wm-job-select" data-member="${member.name}"
                          style="width:100%;background:#0d0d20;border:1px solid #447;color:#ccc;
                                 font-family:'Courier New',monospace;font-size:11px;padding:4px 6px;
                                 border-radius:3px;margin-bottom:4px;">`;
        for (const key of unlockedJobs) {
            const sel = member.job === key ? ' selected' : '';
            html += `<option value="${key}"${sel}>${_jobLabel(key)}</option>`;
        }
        if (lockedJobs.length > 0) {
            html += `<option disabled style="color:#444;">─── locked ───</option>`;
            for (const key of lockedJobs) {
                const sel     = member.job === key ? ' selected' : '';
                const missing = missingPrerequisites(member.xp, key);
                html += `<option value="${key}"${sel} disabled style="color:#555;">${_jobLabel(key)} — needs: ${missing}</option>`;
            }
        }
        html += `</select>`;

        // ---- Current job info panel ----
        const jobData = JOB_STATS[member.job] || {};
        html += `<div style="background:#080818;border:1px solid #223;border-radius:4px;
                              padding:8px 10px;margin-top:6px;margin-bottom:12px;">`;

        // Prerequisites
        const prereqs = jobData.prerequisites || [];
        if (prereqs.length > 0) {
            const parts = prereqs.map(p => {
                const have = jobLevel(member.xp, p.job);
                const met  = have >= p.level;
                const col  = met ? '#8f8' : '#f88';
                return `<span style="color:${col};">${_jobLabel(p.job)} Lv.${p.level} (${met ? '✓' : `have ${have}`})</span>`;
            });
            html += `<div style="font-size:10px;color:#556;margin-bottom:6px;">Requires: ${parts.join(', ')}</div>`;
        }

        // Description
        if (jobData.desc) {
            html += `<div style="font-size:11px;color:#aaa;line-height:1.6;margin-bottom:8px;">${jobData.desc}</div>`;
        }

        // Abilities
        const abilityKeys = jobData.abilities || [];
        if (abilityKeys.length > 0) {
            html += `<div style="font-size:10px;color:#fc8;text-transform:uppercase;margin-bottom:5px;">Skills</div>`;
            const unlockedSet   = new Set(unlockedAbilities(member.job, member.xp));
            const abilityLevels = jobData.abilityLevels || {};

            for (const key of abilityKeys) {
                const ab       = ABILITIES[key];
                if (!ab) continue;
                const isUnlocked = unlockedSet.has(key);
                const unlockLv   = abilityLevels[key] ?? 1;
                const isPassive  = ab.passive || ab.type === 'passive';
                const typeCol    = !isUnlocked ? '#444'
                    : isPassive           ? '#88aacc'
                    : ab.type === 'magic' ? '#cc88ff'
                    : '#ffaa66';
                const typeLabel  = isPassive ? 'Passive' : ab.type === 'magic' ? 'Magic' : 'Physical';

                const parts = [];
                if (isUnlocked) {
                    if (!isPassive) {
                        if (ab.mpCost)     parts.push(`${ab.mpCost} MP`);
                        if (ab.range)      parts.push(`Range ${ab.range}`);
                        if (ab.aoe)        parts.push(`AoE ${ab.aoe}`);
                        if (ab.chargeTime) parts.push(`Charge ${ab.chargeTime}`);
                    } else {
                        if (ab.passiveMpCost) parts.push(`${ab.passiveMpCost} MP/turn`);
                    }
                }

                let powerHint = '';
                if (isUnlocked && ab.basePower) {
                    const statKey = ab.type === 'physical' ? 'atk' : 'mat';
                    const base    = (jobStats[statKey] || 0) + (bonuses[statKey] || 0);
                    powerHint = `~${Math.round(ab.basePower * base)}`;
                }

                const namCol   = isUnlocked ? '#ddd' : '#444';
                const bgCol    = isUnlocked ? '#0a0a1c' : '#080810';
                const borderCol = isUnlocked ? '#2a2a3a' : '#181820';

                html += `<div class="wm-skill-card" data-ability="${key}"
                              style="margin-bottom:4px;padding:4px 7px;cursor:default;
                                     background:${bgCol};border:1px solid ${borderCol};border-radius:3px;
                                     display:flex;align-items:center;gap:6px;">
                    <span style="font-size:11px;color:${namCol};font-weight:bold;flex:1;">${ab.name}</span>
                    ${isUnlocked
                        ? `<span style="font-size:9px;color:${typeCol};text-transform:uppercase;">${typeLabel}</span>
                           ${parts.length ? `<span style="font-size:9px;color:#556;">${parts.join(' · ')}</span>` : ''}
                           ${powerHint ? `<span style="font-size:10px;color:#fc8;min-width:28px;text-align:right;">${powerHint}</span>` : ''}`
                        : `<span style="font-size:9px;color:#445;">Unlocks Lv.${unlockLv}</span>`
                    }
                </div>`;
            }
        }

        html += `</div>`;

        // ---- XP history ----
        const xpEntries = Object.entries(member.xp || {}).filter(([, v]) => v > 0);
        if (xpEntries.length > 0) {
            html += `<div style="font-size:10px;color:#fc8;text-transform:uppercase;margin-bottom:4px;">Job XP</div>`;
            html += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:2px 12px;font-size:11px;
                                  padding:8px;background:#080818;border:1px solid #223;border-radius:4px;">`;
            for (const [job, xp] of xpEntries) {
                const active = job === member.job;
                const lv     = jobLevel(member.xp, job);
                const next   = XP_THRESHOLDS[lv + 1];
                const prog   = next ? ` — Lv.${lv} (${xp}/${next})` : ` — Lv.${lv} (max)`;
                html += `<div style="color:${active ? nameColor : '#888'};">` +
                    `${_jobLabel(job)}: <span style="color:${active ? '#fff' : '#aaa'};">${xp} xp${prog}</span></div>`;
            }
            html += `</div>`;
        }

        // ---- Mastery bonuses ----
        const masteryBonuses = masteryStatBonus(member.xp || {});
        const masteryEntries = Object.entries(masteryBonuses).filter(([, v]) => v !== 0);
        if (masteryEntries.length > 0) {
            const STAT_LABELS = { atk: 'ATK', def: 'DEF', mat: 'MAT', mdf: 'MDF', spd: 'SPD', move: 'MOV', eva: 'EVA', maxHp: 'HP', maxMp: 'MP' };
            html += `<div style="font-size:10px;color:#fc8;text-transform:uppercase;margin-top:10px;margin-bottom:4px;">Mastery Bonuses</div>`;
            html += `<div style="display:flex;flex-wrap:wrap;gap:4px 10px;font-size:11px;
                                  padding:8px;background:#080818;border:1px solid #223;border-radius:4px;">`;
            for (const [stat, val] of masteryEntries) {
                html += `<span style="color:#8f8;">+${val} ${STAT_LABELS[stat] || stat}</span>`;
            }
            html += `</div>`;
        }

        // ---- Cross-job skill slots ----
        const crossAbilities = crossJobUnlockedAbilities(member.xp || {}, member.job);

        // Build reverse map: abilityKey → job display name (first job that provides it, excluding current)
        const abilityJobName = {};
        for (const [jobKey, jobDef] of Object.entries(JOB_DATA)) {
            if (jobKey === member.job) continue;
            for (const abilityKey of (jobDef.abilities || [])) {
                if (!(abilityKey in abilityJobName)) abilityJobName[abilityKey] = _jobLabel(jobKey);
            }
        }

        const crossActives   = crossAbilities.filter(k => {
            const ab = ABILITIES[k];
            return ab && !ab.passive && ab.type !== 'passive';
        });
        const crossPassives  = crossAbilities.filter(k => {
            const ab = ABILITIES[k];
            return ab && (ab.passive || ab.type === 'passive');
        });

        html += `<div style="font-size:10px;color:#fc8;text-transform:uppercase;margin-top:10px;margin-bottom:4px;">Cross-Job Skills</div>`;
        html += `<div style="padding:8px;background:#080818;border:1px solid #223;border-radius:4px;margin-bottom:12px;">`;

        if (crossAbilities.length === 0) {
            html += `<div style="font-size:11px;color:#445;">Level up other jobs to unlock cross-job skill slots.</div>`;
        } else {
            // Support Skill slot (any skill type)
            html += `<div style="margin-bottom:8px;">`;
            html += `<div style="font-size:10px;color:#888;margin-bottom:3px;">Support Skill <span style="color:#445;">(any unlocked skill from another job)</span></div>`;
            html += `<select class="wm-support-skill-select" data-member="${member.name}"
                              style="width:100%;background:#0d0d20;border:1px solid #447;color:#ccc;
                                     font-family:'Courier New',monospace;font-size:11px;padding:4px 6px;
                                     border-radius:3px;">`;
            html += `<option value="">— none —</option>`;
            for (const key of crossAbilities) {
                const ab  = ABILITIES[key];
                if (!ab) continue;
                const sel     = member.supportSkill === key ? ' selected' : '';
                const tag     = (ab.passive || ab.type === 'passive') ? ' [Passive]' : '';
                const jobName = abilityJobName[key] ? ` (${abilityJobName[key]})` : '';
                html += `<option value="${key}"${sel}>${ab.name}${tag}${jobName}</option>`;
            }
            html += `</select>`;
            html += `</div>`;

            // Support Passive slot (passives only)
            html += `<div>`;
            html += `<div style="font-size:10px;color:#888;margin-bottom:3px;">Support Passive <span style="color:#445;">(passive skills from another job only)</span></div>`;
            if (crossPassives.length === 0) {
                html += `<div style="font-size:11px;color:#445;">No passive skills unlocked in other jobs yet.</div>`;
            } else {
                html += `<select class="wm-support-passive-select" data-member="${member.name}"
                                  style="width:100%;background:#0d0d20;border:1px solid #447;color:#ccc;
                                         font-family:'Courier New',monospace;font-size:11px;padding:4px 6px;
                                         border-radius:3px;">`;
                html += `<option value="">— none —</option>`;
                for (const key of crossPassives) {
                    const ab  = ABILITIES[key];
                    if (!ab) continue;
                    const sel     = member.supportPassive === key ? ' selected' : '';
                    const jobName = abilityJobName[key] ? ` (${abilityJobName[key]})` : '';
                    html += `<option value="${key}"${sel}>${ab.name}${jobName}</option>`;
                }
                html += `</select>`;
            }
            html += `</div>`;
        }

        html += `</div>`;

        // ---- Back button ----
        html += `<button id="wm-party-back" style="${BTN_BASE}margin-top:14px;color:#888;">‹ Back to Party</button>`;

        // Swap modal content without opening a new one
        const inner = this._modal.querySelector('div');
        inner.innerHTML = html;

        // Esc / backdrop goes back to the party list
        this._modalBackFn = () => this.showParty(worldMap, skinManager);

        this._drawPartyPortraitsAndIcons([member], skinManager);

        // Equipment change handler — routes through worldMap.equipItem so
        // inventory counts stay consistent
        inner.querySelectorAll('.wm-equip-select').forEach(sel => {
            sel.addEventListener('change', () => {
                const field  = sel.dataset.field;
                const newKey = sel.value || null;
                worldMap.equipItem(member.name, field, newKey);
                // Invalidate composites for every party member — the stripped
                // member's portrait would otherwise stay stale.
                if (skinManager) {
                    for (const m of worldMap.party) {
                        skinManager.invalidateComposite('party_' + m.name);
                    }
                }
                // Always re-render so the dropdown reflects actual state,
                // even if equipItem returned false.
                this._showPartyMember(member, worldMap, skinManager);
            });
        });

        // Job change handler
        inner.querySelector('.wm-job-select').addEventListener('change', e => {
            member.job = e.target.value;
            // Clear cross-job slots that may no longer be valid after a job change
            member.supportSkill   = null;
            member.supportPassive = null;
            this._showPartyMember(member, worldMap, skinManager);
        });

        // Cross-job slot handlers
        inner.querySelector('.wm-support-skill-select')?.addEventListener('change', e => {
            member.supportSkill = e.target.value || null;
        });
        inner.querySelector('.wm-support-passive-select')?.addEventListener('change', e => {
            member.supportPassive = e.target.value || null;
        });

        inner.querySelector('#wm-party-back').addEventListener('click', () => this._modalBack());

        // Skill card tooltips
        const memberStats = {};
        for (const k of ['atk','def','mat','mdf','spd','move','eva','maxHp','maxMp']) {
            memberStats[k] = (jobStats[k] || 0) + (bonuses[k] || 0);
        }

        // Cross-job select tooltips — show tooltip for currently selected ability on hover
        const _bindSelectTooltip = (sel) => {
            if (!sel) return;
            const showTip = (e) => {
                const key = sel.value;
                const ab  = key ? ABILITIES[key] : null;
                if (!ab) { this._tooltip.style.display = 'none'; return; }
                this._tooltip.innerHTML = this._abilityTooltipHtml(ab, memberStats);
                this._tooltip.style.display = 'block';
                this._positionTooltip(e.clientX, e.clientY);
            };
            sel.addEventListener('mouseenter', showTip);
            sel.addEventListener('mousemove',  (e) => {
                if (this._tooltip.style.display !== 'none') this._positionTooltip(e.clientX, e.clientY);
            });
            sel.addEventListener('mouseleave', () => { this._tooltip.style.display = 'none'; });
            sel.addEventListener('change',     showTip);
        };
        _bindSelectTooltip(inner.querySelector('.wm-support-skill-select'));
        _bindSelectTooltip(inner.querySelector('.wm-support-passive-select'));

        // Equipment slot tooltips — show stats for the currently selected item
        inner.querySelectorAll('.wm-equip-select').forEach(sel => {
            const showTip = (e) => {
                const key = sel.value;
                if (!key) { this._tooltip.style.display = 'none'; return; }
                this._tooltip.innerHTML = this._equipmentTooltipHtml(key);
                this._tooltip.style.display = 'block';
                this._positionTooltip(e.clientX, e.clientY);
            };
            sel.addEventListener('mouseenter', showTip);
            sel.addEventListener('mousemove',  (e) => {
                if (this._tooltip.style.display !== 'none') this._positionTooltip(e.clientX, e.clientY);
            });
            sel.addEventListener('mouseleave', () => { this._tooltip.style.display = 'none'; });
            sel.addEventListener('change',     showTip);
        });

        const unlockedSetForTip = new Set(unlockedAbilities(member.job, member.xp));
        const abilityLevelsForTip = jobData.abilityLevels || {};
        inner.querySelectorAll('.wm-skill-card').forEach(card => {
            const ab  = ABILITIES[card.dataset.ability];
            if (!ab) return;
            const isUnlocked = unlockedSetForTip.has(card.dataset.ability);
            const unlockLv   = abilityLevelsForTip[card.dataset.ability] ?? 1;
            const tipHtml    = isUnlocked
                ? this._abilityTooltipHtml(ab, memberStats)
                : `<span style="color:#888;font-weight:bold;">${ab.name}</span><br>`
                  + `<span style="color:#445;">Locked — reach ${_jobLabel(member.job)} Lv.${unlockLv} to unlock.</span>`;
            card.addEventListener('mouseenter', (e) => {
                this._tooltip.innerHTML = tipHtml;
                this._tooltip.style.display = 'block';
                this._positionTooltip(e.clientX, e.clientY);
            });
            card.addEventListener('mousemove',  (e) => this._positionTooltip(e.clientX, e.clientY));
            card.addEventListener('mouseleave', ()  => { this._tooltip.style.display = 'none'; });
        });
    }
    // ---------- Inventory screen ----------
    showInventory(worldMap, skinManager) {
        const inv = worldMap.inventory;

        // Build a map of itemKey → [memberNames] for every equipped item
        const equippedByMap = {};
        for (const member of worldMap.party) {
            if (!member.appearance) continue;
            for (const field of ['armorKey','helmetKey','weaponKey','toolKey']) {
                const k = member.appearance[field];
                if (k) {
                    if (!equippedByMap[k]) equippedByMap[k] = [];
                    equippedByMap[k].push(member.name);
                }
            }
        }

        // All known item keys = inventory + equipped (union)
        const allKeys = [...new Set([
            ...Object.keys(inv).filter(k => inv[k] > 0),
            ...Object.keys(equippedByMap),
        ])].filter(k => EQUIPMENT[k]);

        // Ordered slot → type groups. Each entry: [slotName, typeName, displayLabel]
        // typeName null means "any type not listed elsewhere in this slot" (catch-all).
        const GROUPS = [
            ['weapon', 'blade',        'Blades'],
            ['weapon', 'heavy_weapon', 'Heavy Weapons'],
            ['weapon', 'bow',          'Bows'],
            ['weapon', 'crossbow',     'Crossbows'],
            ['weapon', 'magic',        'Staves & Wands'],
            ['armor',  'cloth',        'Cloth Armor'],
            ['armor',  'light',        'Light Armor'],
            ['armor',  'medium',       'Medium Armor'],
            ['armor',  'heavy',        'Heavy Armor'],
            ['helmet', 'cloth',        'Cloth Helms'],
            ['helmet', 'light',        'Light Helms'],
            ['helmet', 'medium',       'Medium Helms'],
            ['helmet', 'heavy',        'Heavy Helms'],
            ['tool',   'shield',       'Shields'],
            ['tool',   'quiver',       'Quivers'],
            ['tool',   'offhand_weapon','Off-hand Weapons'],
            ['tool',   'implement',    'Implements'],
        ];
        // Section headers printed once per slot (track with a Set)
        const SLOT_LABEL = { weapon: 'Weapons', armor: 'Armor', helmet: 'Helmets', tool: 'Tools / Off-hand' };

        let html = `<div style="color:#ffcc44;font-weight:bold;font-size:15px;margin-bottom:12px;">Inventory</div>`;

        if (allKeys.length === 0) {
            html += `<div style="color:#555;font-size:11px;">Your inventory is empty.</div>`;
        } else {
            let lastSlot = null;
            for (const [slotName, typeName, groupLabel] of GROUPS) {
                const groupKeys = allKeys.filter(k => EQUIPMENT[k]?.slot === slotName && EQUIPMENT[k]?.type === typeName);
                if (groupKeys.length === 0) continue;
                // Print the slot header the first time we encounter items in this slot
                if (slotName !== lastSlot) {
                    html += `<div style="font-size:11px;color:#fc8;font-weight:bold;text-transform:uppercase;
                                         margin-bottom:4px;margin-top:${lastSlot ? '14px' : '0'};">${SLOT_LABEL[slotName]}</div>`;
                    lastSlot = slotName;
                }
                html += `<div style="font-size:10px;color:#888;text-transform:uppercase;
                                     margin-bottom:3px;margin-top:8px;padding-left:2px;">${groupLabel}</div>`;
                for (const key of groupKeys) {
                    const freeCount  = inv[key] || 0;
                    const wearers    = equippedByMap[key] || [];
                    const eq         = EQUIPMENT[key];
                    const statStr    = _statSummary(eq);
                    const totalOwned = freeCount + wearers.length;

                    // Free count label — bright if any free, dim if all equipped
                    const freeLabel = freeCount > 0
                        ? `<span style="color:#8f8;font-weight:bold;">${freeCount} free</span>`
                        : `<span style="color:#555;">0 free</span>`;

                    // Equipped line — only shown if someone has it on
                    const equippedLine = wearers.length
                        ? `<div style="font-size:10px;color:#557;margin-top:1px;">
                               Equipped: <span style="color:#668;">${wearers.join(', ')}</span>
                           </div>`
                        : '';

                    // Border highlight if there are free copies
                    const borderColor = freeCount > 0 ? '#447' : '#224';

                    html += `<div class="wm-inv-item-row" data-item="${key}" style="display:flex;align-items:center;gap:8px;margin-bottom:5px;
                                         padding:6px;background:#0d0d20;border:1px solid ${borderColor};border-radius:4px;cursor:default;">
                        <canvas class="wm-item-icon" data-item="${key}" width="16" height="16"
                                style="image-rendering:pixelated;flex-shrink:0;"></canvas>
                        <div style="flex:1;min-width:0;">
                            <div style="font-size:12px;display:flex;align-items:baseline;gap:6px;">
                                ${_jobLabel(key)}
                                <span style="font-size:10px;color:#666;">×${totalOwned} total</span>
                                ${freeLabel}
                            </div>
                            <div style="font-size:10px;color:#888;">${statStr}</div>
                            ${equippedLine}
                        </div>
                        ${freeCount > 0 ? `<button class="wm-inv-equip-btn" data-item="${key}"
                                style="padding:3px 8px;font-family:inherit;font-size:10px;
                                       background:#1a1a30;border:1px solid #447;color:#adf;
                                       cursor:pointer;border-radius:3px;flex-shrink:0;">Equip</button>` : ''}
                    </div>`;
                }
            }
        }

        this._openModal(html, null);

        // Item row tooltips
        this._modal.querySelectorAll('.wm-inv-item-row').forEach(row => {
            row.addEventListener('mouseenter', (e) => {
                this._tooltip.innerHTML = this._equipmentTooltipHtml(row.dataset.item);
                this._tooltip.style.display = 'block';
                this._positionTooltip(e.clientX, e.clientY);
            });
            row.addEventListener('mousemove',  (e) => {
                if (this._tooltip.style.display !== 'none') this._positionTooltip(e.clientX, e.clientY);
            });
            row.addEventListener('mouseleave', () => { this._tooltip.style.display = 'none'; });
        });

        if (skinManager) {
            this._modal.querySelectorAll('.wm-item-icon').forEach(c => {
                const sp = skinManager.getItemSprite(c.dataset.item);
                if (!sp) return;
                const ctx = c.getContext('2d');
                ctx.imageSmoothingEnabled = false;
                ctx.drawImage(sp, 0, 0, c.width, c.height);
            });
        }

        this._modal.querySelectorAll('.wm-inv-equip-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this._showEquipPicker(btn.dataset.item, worldMap, skinManager,
                    () => this.showInventory(worldMap, skinManager));
            });
        });
    }

    // Shows a mini-picker: choose which party member + slot to equip an item onto
    _showEquipPicker(itemKey, worldMap, skinManager, onBack) {
        const eq = EQUIPMENT[itemKey];
        if (!eq) return;

        const SLOT_FIELD = { armor: 'armorKey', helmet: 'helmetKey', weapon: 'weaponKey', tool: 'toolKey' };
        const field = SLOT_FIELD[eq.slot];

        let html = `<div style="color:#ffcc44;font-weight:bold;font-size:14px;margin-bottom:4px;">Equip: ${_jobLabel(itemKey)}</div>`;
        html += `<div style="font-size:10px;color:#888;margin-bottom:12px;">Choose a party member to equip this ${eq.slot}.</div>`;

        for (const member of worldMap.party) {
            const a = member.appearance;
            const nameColor  = a?.nameColor || '#ccc';
            const currentKey = a?.[field];
            const curLabel   = currentKey ? _jobLabel(currentKey) : '— none —';

            html += `<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;
                                  padding:8px;background:#0d0d20;border:1px solid #335;border-radius:5px;">
                <canvas class="wm-party-portrait" data-member="${member.name}"
                        width="24" height="24"
                        style="image-rendering:pixelated;flex-shrink:0;border:1px solid #446;
                               border-radius:3px;background:#080818;"></canvas>
                <div style="flex:1;min-width:0;">
                    <div style="font-size:12px;font-weight:bold;color:${nameColor};">${member.name}</div>
                    <div style="font-size:10px;color:#556;">Current: ${curLabel}</div>
                </div>
                <button class="wm-pick-member-btn" data-member="${member.name}"
                        style="padding:3px 8px;font-family:inherit;font-size:10px;
                               background:#1a1a30;border:1px solid #447;color:#adf;
                               cursor:pointer;border-radius:3px;flex-shrink:0;">Equip</button>
            </div>`;
        }
        html += `<button id="wm-inv-back" style="${BTN_BASE}margin-top:6px;color:#888;">‹ Back</button>`;

        const inner = this._modal.querySelector('div');
        inner.innerHTML = html;

        // Esc / backdrop / Back button all go to parent view
        this._modalBackFn = onBack;

        this._drawPartyPortraitsAndIcons(worldMap.party, skinManager);

        inner.querySelectorAll('.wm-pick-member-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (worldMap.equipItem(btn.dataset.member, field, itemKey)) {
                    skinManager?.invalidateComposite('party_' + btn.dataset.member);
                    this.notify(`${_jobLabel(itemKey)} equipped on ${btn.dataset.member}`);
                    onBack();
                }
            });
        });

        inner.querySelector('#wm-inv-back').addEventListener('click', () => this._modalBack());
    }

    // Builds tooltip HTML for an ability, using memberStats for estimated damage.
    // memberStats should be { atk, mat, ... } already including equipment bonuses.
    _equipmentTooltipHtml(key) {
        const eq = EQUIPMENT[key];
        if (!eq) return '';
        const STAT_LABELS = { atk: 'ATK', def: 'DEF', mat: 'MAT', mdf: 'MDF', spd: 'SPD', move: 'MOV', eva: 'EVA', maxHp: 'HP', maxMp: 'MP' };
        const TYPE_COLOR  = { cloth: '#c8a0ff', light: '#adf', medium: '#fc8', heavy: '#f88', blade: '#adf', heavy_weapon: '#f88', magic: '#c8a0ff', bow: '#8fa', tool: '#8fa' };
        const lines = [];
        lines.push(`<span style="color:#ffcc44;font-weight:bold;">${_jobLabel(key)}</span>`);
        const tags = [];
        if (eq.type) tags.push(`<span style="color:${TYPE_COLOR[eq.type] || '#aaa'};">${_jobLabel(eq.type)}</span>`);
        tags.push(`<span style="color:#888;">${_jobLabel(eq.slot)}</span>`);
        lines.push(tags.join(' · '));
        const stats = Object.entries(STAT_LABELS)
            .filter(([k]) => eq[k])
            .map(([k, l]) => `<span style="color:${eq[k] > 0 ? '#8f8' : '#f88'};">${eq[k] > 0 ? '+' : ''}${eq[k]} ${l}</span>`);
        if (stats.length) lines.push(stats.join('  '));
        return lines.join('<br>');
    }

    _abilityTooltipHtml(ab, memberStats) {
        const lines = [];
        const typeColor = ab.passive || ab.type === 'passive' ? '#888'
            : ab.type === 'magic'    ? '#c8a0ff'
            : '#ffcc88';
        lines.push(`<span style="color:${typeColor};font-weight:bold;">${ab.name}</span>`);

        const tags = [];
        if (ab.type === 'physical') tags.push('<span style="color:#ffcc88;">Physical</span>');
        if (ab.type === 'magic')    tags.push('<span style="color:#c8a0ff;">Magic</span>');
        if (ab.element)             tags.push(`<span style="color:#88ccff;">${ab.element[0].toUpperCase() + ab.element.slice(1)}</span>`);
        if (ab.passive)             tags.push('<span style="color:#888;">Passive</span>');
        if (tags.length)            lines.push(tags.join(' · '));

        if (ab.desc) {
            lines.push(`<span style="color:#aaa;">${ab.desc}</span>`);
        }

        const stats = [];
        if (ab.range > 0)   stats.push(`Range: <b>${ab.range}</b>`);
        if (ab.aoe > 0)     stats.push(`AoE: <b>${ab.aoe}</b>`);
        if (ab.mpCost > 0)  stats.push(`MP: <b style="color:#88f;">${ab.mpCost}</b>`);
        if (ab.actionCost)  stats.push(`CT: <b style="color:#fc8;">${ab.actionCost}</b>`);
        if (ab.passiveMpCost) stats.push(`${ab.passiveMpCost} MP/turn`);
        if (stats.length) lines.push(stats.join('  '));

        if (ab.chargeTime > 0) {
            lines.push(`<span style="color:#c8f;">Charge: ${ab.chargeTime} ticks</span>`);
        }

        if (ab.basePower && memberStats) {
            const pct     = Math.round(ab.basePower * 100);
            const statKey = ab.type === 'physical' ? 'atk' : 'mat';
            const base    = (memberStats[statKey] || 0);
            const est     = Math.round(ab.basePower * base);
            lines.push(`Power: <b>${pct}%</b> of ${statKey.toUpperCase()} &mdash; est. <b style="color:#fc8;">~${est}</b>`);
        }

        if (ab.applyStatus) {
            lines.push(`Applies: <b style="color:#fc6;">${ab.applyStatus}</b>${ab.statusDuration ? ` (${ab.statusDuration} turns)` : ''}`);
        }
        if (ab.isHeal) lines.push(`<span style="color:#8f8;">Restores HP</span>`);
        if (ab.isCure) lines.push(`<span style="color:#aff;">Removes status effects</span>`);

        return lines.join('<br>');
    }
}

function _statSummary(eq) {
    if (!eq) return '';
    const STAT_LABELS = { atk: 'ATK', def: 'DEF', mat: 'MAT', mdf: 'MDF', spd: 'SPD', move: 'MOV', eva: 'EVA', maxHp: 'HP', maxMp: 'MP' };
    return Object.entries(STAT_LABELS)
        .filter(([k]) => eq[k])
        .map(([k, l]) => `${eq[k] > 0 ? '+' : ''}${eq[k]} ${l}`)
        .join('  ');
}

function _jobLabel(key) {
    return (key || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
