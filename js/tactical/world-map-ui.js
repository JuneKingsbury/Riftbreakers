import { SHOP_ITEMS, NODES } from './world-map-data.js';

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
        return el;
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
                        overflow-y:auto;position:relative;pointer-events:auto;">
                ${html}
                <button id="wm-modal-close" style="${BTN_BASE}margin-top:14px;color:#888;">Close</button>
            </div>
        `;
        el.style.display = 'flex';
        el.querySelector('#wm-modal-close').addEventListener('click', () => {
            el.style.display = 'none';
            if (onClose) onClose();
        });
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
        this._modal.querySelector('#wm-modal-close').style.display = 'none';
        this._modal.querySelector('#wm-turnin-confirm').addEventListener('click', () => {
            this._modal.style.display = 'none';
            if (onConfirm) onConfirm();
        });
    }

    // ---------- Shop ----------
    showShop(worldMap, onClose) {
        const items = SHOP_ITEMS;
        let html = `<div style="color:#ffcc44;font-weight:bold;font-size:15px;margin-bottom:10px;">Shop</div>`;
        html += `<div style="color:#fc8;margin-bottom:12px;">Gold: <b>${worldMap.gold}g</b></div>`;
        html += `<div id="wm-shop-items">`;
        for (const item of items) {
            const canAfford = worldMap.gold >= item.cost;
            html += `
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;padding:6px;
                            background:#111122;border:1px solid #334;border-radius:4px;">
                    <div style="flex:1;">
                        <div style="font-size:12px;">${item.name}</div>
                        <div style="font-size:10px;color:#888;">${item.desc}</div>
                    </div>
                    <button class="wm-buy-btn" data-item="${item.id}" data-cost="${item.cost}"
                        style="padding:4px 10px;font-family:inherit;font-size:11px;
                               background:#1a1a30;border:1px solid #447;color:${canAfford ? '#ccc' : '#555'};
                               cursor:${canAfford ? 'pointer' : 'not-allowed'};border-radius:3px;">
                        ${item.cost}g
                    </button>
                </div>`;
        }
        html += `</div>`;

        this._openModal(html, onClose);

        this._modal.querySelectorAll('.wm-buy-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const cost   = parseInt(btn.dataset.cost, 10);
                const itemId = btn.dataset.item;
                if (worldMap.gold < cost) return;
                worldMap.gold -= cost;
                worldMap.inventory.push(itemId);
                const item = SHOP_ITEMS.find(i => i.id === itemId);
                this.notify(`Bought: ${item?.name || itemId}`);
                // Refresh gold display in modal
                const goldEl = this._modal.querySelector('b');
                if (goldEl) goldEl.textContent = worldMap.gold + 'g';
                // Update button states
                this._modal.querySelectorAll('.wm-buy-btn').forEach(b => {
                    const c = parseInt(b.dataset.cost, 10);
                    if (worldMap.gold < c) {
                        b.style.color  = '#555';
                        b.style.cursor = 'not-allowed';
                    }
                });
            });
        });
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
        this._modal.querySelector('#wm-modal-close').style.display = 'none';
        this._modal.querySelector('#wm-enc-fight').addEventListener('click', () => {
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

        // Hide the default close button until an outcome is chosen
        this._modal.querySelector('#wm-modal-close').style.display = 'none';

        this._modal.querySelectorAll('.wm-outcome-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx     = parseInt(btn.dataset.idx, 10);
                const outcome = event.outcomes[idx];

                // Show result text
                const outDiv = this._modal.querySelector('#wm-event-outcomes');
                outDiv.innerHTML = `<div style="color:#8cf;font-size:12px;line-height:1.7;
                                              padding:8px;background:#0a1020;
                                              border:1px solid #335;border-radius:4px;
                                              margin-bottom:10px;">${outcome.resultText}</div>`;
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
        this._modal.querySelector('#wm-modal-close').style.display = 'none';
        this._modal.querySelector('#wm-br-continue').addEventListener('click', () => {
            this._modal.style.display = 'none';
            if (onContinue) onContinue();
        });
    }

    // ---------- Quest completion ----------
    showQuestComplete(quest) {
        this.notify(`Quest complete: ${quest.title} (+${quest.rewardGold}g)`, 4000);
    }
}
