import { NODES, QUESTS, EVENTS, BATTLE_SCENARIOS, ROAMING_SPAWN_POOL, PINNED_ENCOUNTER_DATA } from './world-map-data.js';
import { CHARACTER_DATA } from './data/characters.js';

export class RoamingEnemy {
    constructor(id, nodeId, spriteKey, name, battleScenarioId, opts = {}) {
        this.id               = id;
        this.nodeId           = nodeId;
        this.spriteKey        = spriteKey;
        this.name             = name;
        this.battleScenarioId = battleScenarioId;
        this.defeated         = false;
        this.spawnDay         = opts.spawnDay ?? 1;
        this.lifespanDays     = opts.lifespanDays ?? 10;
    }

    isExpired(currentDay) {
        return currentDay >= this.spawnDay + this.lifespanDays;
    }
}

export class PinnedEncounter {
    constructor(id, nodeId, spriteKey, name, battleScenarioId, opts = {}) {
        this.id               = id;
        this.nodeId           = nodeId;
        this.spriteKey        = spriteKey;
        this.name             = name;
        this.battleScenarioId = battleScenarioId;
        this.defeated         = false;
        this.questId          = opts.questId ?? null;
    }
}

export class WorldMap {
    constructor() {
        // Deep-clone node data so we can mutate discovery/visited state
        this.nodes = NODES.map(n => ({ ...n, connections: [...n.connections] }));
        this.currentNodeId = 'bervenia_village';
        this.completedBattles = new Set();
        this.activeQuests = [];
        this.completedQuests = new Set();
        this.gold = 200;
        this.day = 1;
        this._nodeMap = Object.fromEntries(this.nodes.map(n => [n.id, n]));
        this._usedEventIds = new Set();
        this._rand = 0;

        // Party roster: player characters from CHARACTER_DATA, deep-cloned so
        // appearance (equipment, colors) can be mutated independently.
        this.party = CHARACTER_DATA
            .filter(c => c.team === 'player')
            .map(c => ({
                ...c,
                appearance: c.appearance ? { ...c.appearance } : null,
                xp: c.xp ? { ...c.xp } : {},
            }));

        // Inventory: { itemKey: count }. Seeded with one copy of each item
        // currently equipped across the party so the inventory view is coherent
        // from the start (equipped items count as "owned").
        this.inventory = {};
        for (const member of this.party) {
            if (!member.appearance) continue;
            for (const field of ['armorKey','helmetKey','weaponKey','toolKey']) {
                const key = member.appearance[field];
                if (key) this.inventory[key] = (this.inventory[key] || 0) + 1;
            }
        }

        this.inventory['stone_spear'] = (this.inventory['stone_spear'] || 0) + 1;

        // Roaming enemies (seed with initial raider band)
        this.roamingEnemies = [
            new RoamingEnemy('raiders_0', 'amber_crossroads', 'raider_brute', 'Raider Band', 'bandit_ambush',
                { spawnDay: 1, lifespanDays: 10 }),
        ];

        // Pinned encounters (static, node-bound until defeated)
        this.pinnedEncounters = PINNED_ENCOUNTER_DATA.map(d =>
            new PinnedEncounter(d.id, d.nodeId, d.spriteKey, d.name, d.battleScenarioId, { questId: d.questId })
        );

        // Discover connections of the starting node
        this._discoverNeighbors(this.currentNodeId);
    }

    get currentNode() { return this._nodeMap[this.currentNodeId]; }

    getNode(id) { return this._nodeMap[id] || null; }

    // ---- Inventory helpers ----

    addItem(key, count = 1) {
        this.inventory[key] = (this.inventory[key] || 0) + count;
    }

    removeItem(key, count = 1) {
        if (!this.inventory[key]) return false;
        this.inventory[key] -= count;
        if (this.inventory[key] <= 0) delete this.inventory[key];
        return true;
    }

    hasItem(key) {
        return (this.inventory[key] || 0) > 0;
    }

    itemCount(key) {
        return this.inventory[key] || 0;
    }

    // Equip an item onto a party member's slot. The previously equipped item
    // (if any) goes back into inventory; the new item is taken from inventory
    // or stripped from whoever else currently has it equipped.
    // Pass newKey = null to unequip without replacing.
    equipItem(memberName, field, newKey) {
        const member = this.party.find(m => m.name === memberName);
        if (!member?.appearance) return false;

        const oldKey = member.appearance[field];

        if (newKey && !this.hasItem(newKey)) {
            // Check if another party member has it equipped in any slot
            let stripped = false;
            for (const other of this.party) {
                if (other.name === memberName || !other.appearance) continue;
                for (const f of ['armorKey','helmetKey','weaponKey','toolKey']) {
                    if (other.appearance[f] === newKey) {
                        other.appearance[f] = null;
                        stripped = true;
                        break;
                    }
                }
                if (stripped) break;
            }
            if (!stripped) return false;
        }

        // Put old item back
        if (oldKey) this.addItem(oldKey);

        // Take new item out of inventory (may already be gone if stripped above)
        if (newKey) this.removeItem(newKey);

        member.appearance[field] = newKey || null;
        return true;
    }

    // Returns a map of { itemKey: memberName } for items equipped across the party.
    // When the same item key is worn by multiple members, the first member found
    // who is NOT the given viewer is returned — keeping the "[Name]" annotation
    // pointing at someone other than the viewer. Pass viewerName to get that behaviour;
    // omit it to get last-writer behaviour (used for inventory display).
    equippedByMap(viewerName) {
        const map = {};
        for (const member of this.party) {
            if (!member.appearance) continue;
            for (const f of ['armorKey','helmetKey','weaponKey','toolKey']) {
                const k = member.appearance[f];
                if (!k) continue;
                // Only overwrite if we don't yet have an entry, or the current
                // entry is the viewer themselves (prefer showing someone else).
                if (!map[k] || map[k] === viewerName) {
                    map[k] = member.name;
                }
            }
        }
        return map;
    }

    // ---- Travel / map ----

    canTravelTo(nodeId) {
        const node = this._nodeMap[nodeId];
        if (!node || !node.discovered) return false;
        return this.currentNode.connections.includes(nodeId);
    }

    travelTo(nodeId) {
        if (!this.canTravelTo(nodeId)) return false;
        const fromId = this.currentNodeId;
        this.currentNodeId = nodeId;
        this.day++;
        const node = this.currentNode;
        node.visited = true;
        this._discoverNeighbors(nodeId);
        const roamEncs   = this._tickRoamingEnemies(fromId, nodeId);
        const pinnedEncs = this._checkPinnedEncounters(nodeId);
        // Pinned encounters go first — they're guarding the destination
        this._lastEncounters = [...pinnedEncs, ...roamEncs];
        return true;
    }

    _discoverNeighbors(nodeId) {
        const node = this._nodeMap[nodeId];
        if (!node) return;
        for (const connId of node.connections) {
            const conn = this._nodeMap[connId];
            if (conn && !conn.discovered) conn.discovered = true;
        }
    }

    getAvailableActions() {
        return this.currentNode.actions || [];
    }

    // BFS over discovered+connected nodes.
    findPath(fromId, toId) {
        if (fromId === toId) return [];
        const visited = new Set([fromId]);
        const queue   = [[fromId, []]];
        while (queue.length) {
            const [cur, path] = queue.shift();
            const node = this._nodeMap[cur];
            if (!node) continue;
            for (const connId of node.connections) {
                if (visited.has(connId)) continue;
                const conn = this._nodeMap[connId];
                if (!conn || !conn.discovered) continue;
                const newPath = [...path, connId];
                if (connId === toId) return newPath;
                visited.add(connId);
                queue.push([connId, newPath]);
            }
        }
        return null;
    }

    drawRandomEvent() {
        const available = EVENTS.filter(e => !this._usedEventIds.has(e.id));
        const pool = available.length > 0 ? available : EVENTS;
        if (available.length === 0) this._usedEventIds.clear();
        const ev = pool[Math.floor(pool.length * this._seededRand())];
        this._usedEventIds.add(ev.id);
        return ev;
    }

    _seededRand() {
        let h = this.day * 31 + this.currentNodeId.length * 17 + this._usedEventIds.size * 7;
        h = ((h >>> 16) ^ h) * 0x45d9f3b;
        h = ((h >>> 16) ^ h) * 0x45d9f3b;
        h = (h >>> 16) ^ h;
        return (h & 0x7fffffff) / 0x7fffffff;
    }

    getAvailableQuests() {
        const accepted = new Set(this.activeQuests.map(q => q.id));
        return QUESTS.filter(q => !accepted.has(q.id) && !this.completedQuests.has(q.id));
    }

    acceptQuest(questId) {
        const def = QUESTS.find(q => q.id === questId);
        if (!def) return false;
        if (this.activeQuests.some(q => q.id === questId)) return false;
        this.activeQuests.push({ ...def, completed: false });
        return true;
    }

    getReadyQuests() {
        return this.activeQuests.filter(q => q.targetNodeId === this.currentNodeId);
    }

    turnInQuest(questId) {
        // Support both location-gated and battle-completed quests
        const idx = this.activeQuests.findIndex(q =>
            q.id === questId &&
            (q.targetNodeId === this.currentNodeId || q._battleCompleted)
        );
        if (idx === -1) return null;
        const q = this.activeQuests.splice(idx, 1)[0];
        q.completed = true;
        this.completedQuests.add(q.id);
        this.gold += q.rewardGold || 0;
        for (const item of (q.rewardItems || [])) this.addItem(item);
        return q;
    }

    applyEventOutcome(outcome) {
        const ef = outcome.effect || {};
        if (ef.goldDelta) this.gold = Math.max(0, this.gold + ef.goldDelta);
        if (ef.dayDelta)  this.day  += ef.dayDelta;
        return ef;
    }

    completeBattle(scenarioId, won) {
        if (!won) return { won: false };

        this.completedBattles.add(scenarioId);
        this.currentNode.visited = true;

        const rewards = { won: true, xpGained: 0, goldGained: 0, itemsGained: [], questsCompleted: [] };
        const scenario = BATTLE_SCENARIOS[scenarioId];
        if (scenario) {
            const xp = scenario.xpPerMember || 0;
            rewards.xpGained = xp;
            for (const member of this.party) {
                member.xp = member.xp || {};
                member.xp[member.job] = (member.xp[member.job] || 0) + xp;
            }
            rewards.goldGained = scenario.gold || 0;
            this.gold += rewards.goldGained;
            rewards.itemsGained = [...(scenario.items || [])];
            for (const item of rewards.itemsGained) this.addItem(item);
        }

        // Mark any pinned encounter for this scenario as defeated and check quest links
        for (const pe of this.pinnedEncounters) {
            if (pe.battleScenarioId === scenarioId && !pe.defeated) {
                pe.defeated = true;
                if (pe.questId) {
                    const q = this.activeQuests.find(q2 => q2.id === pe.questId);
                    if (q) { q._battleCompleted = true; rewards.questsCompleted.push(q); }
                }
            }
        }

        // Check quests with battleCompletionId matching this scenario
        for (const q of this.activeQuests) {
            if (q.battleCompletionId === scenarioId && !q._battleCompleted) {
                q._battleCompleted = true;
                if (!rewards.questsCompleted.includes(q)) rewards.questsCompleted.push(q);
            }
        }

        return rewards;
    }

    rest() {
        this.day++;
        const roamEncs = this._tickRoamingEnemies(null, null);
        this._lastEncounters = roamEncs;
    }

    _checkPinnedEncounters(nodeId) {
        const encounters = [];
        for (const enc of this.pinnedEncounters) {
            if (enc.defeated) continue;
            if (enc.nodeId === nodeId) {
                encounters.push({ enemy: enc, crossed: false, pinned: true });
            }
        }
        return encounters;
    }

    _tickRoamingEnemies(playerFrom, playerTo) {
        // Remove expired and defeated roamers
        this.roamingEnemies = this.roamingEnemies.filter(e => !e.defeated && !e.isExpired(this.day));

        const encounters = [];
        for (const enemy of this.roamingEnemies) {
            const prevNodeId = enemy.nodeId;
            const node = this._nodeMap[enemy.nodeId];
            if (node) {
                const options = node.connections.filter(id => this._nodeMap[id]);
                if (options.length) {
                    this._rand = (this._rand * 1664525 + 1013904223) & 0xffffffff;
                    if (Math.abs(this._rand) % 2 === 0) {
                        this._rand = (this._rand * 1664525 + 1013904223) & 0xffffffff;
                        const idx = Math.abs(this._rand) % options.length;
                        enemy.nodeId = options[idx];
                    }
                }
            }
            if (enemy.nodeId === this.currentNodeId) {
                encounters.push({ enemy, crossed: false });
                continue;
            }
            if (playerFrom && playerTo &&
                enemy.nodeId === playerFrom && prevNodeId === playerTo) {
                enemy.nodeId = playerTo;
                encounters.push({ enemy, crossed: true });
            }
        }

        this._trySpawnRoamers();
        return encounters;
    }

    _trySpawnRoamers() {
        for (const template of ROAMING_SPAWN_POOL) {
            const alreadyExists = this.roamingEnemies.some(
                e => e.id.startsWith(template.id_prefix)
            );
            if (alreadyExists) continue;

            // 20% spawn chance per tick using the LCG
            this._rand = (this._rand * 1664525 + 1013904223) & 0xffffffff;
            if (Math.abs(this._rand) % 100 >= 20) continue;

            // Pick from discovered non-current nodes in the spawn list
            const available = template.spawnNodes.filter(id => {
                const n = this._nodeMap[id];
                return n && n.discovered && id !== this.currentNodeId;
            });
            if (!available.length) continue;

            this._rand = (this._rand * 1664525 + 1013904223) & 0xffffffff;
            const nodeId    = available[Math.abs(this._rand) % available.length];
            const lifespan  = 7 + (Math.abs(this._rand) % 8);
            const id        = `${template.id_prefix}_${this.day}`;
            this.roamingEnemies.push(new RoamingEnemy(
                id, nodeId, template.spriteKey, template.name, template.battleScenarioId,
                { spawnDay: this.day, lifespanDays: lifespan }
            ));
        }
    }

    popEncounters() {
        const enc = this._lastEncounters || [];
        this._lastEncounters = [];
        return enc;
    }
}
