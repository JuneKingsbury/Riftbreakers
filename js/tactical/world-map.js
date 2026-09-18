import { NODES, QUESTS, EVENTS } from './world-map-data.js';
import { CHARACTER_DATA } from './data/characters.js';

export class RoamingEnemy {
    constructor(id, nodeId, spriteKey, name, battleScenarioId) {
        this.id               = id;
        this.nodeId           = nodeId;
        this.spriteKey        = spriteKey;
        this.name             = name;
        this.battleScenarioId = battleScenarioId;
        this.defeated         = false;
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

        // Roaming enemies
        this.roamingEnemies = [
            new RoamingEnemy('raiders', 'amber_crossroads', 'raider_brute', 'Raider Band', 'bandit_ambush'),
        ];

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

    // Returns a map of { itemKey: memberName } for every item currently equipped
    // across the whole party, so the UI can annotate dropdowns.
    equippedByMap() {
        const map = {};
        for (const member of this.party) {
            if (!member.appearance) continue;
            for (const f of ['armorKey','helmetKey','weaponKey','toolKey']) {
                const k = member.appearance[f];
                if (k) map[k] = member.name;
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
        const node = this.currentNode;
        node.visited = true;
        this._discoverNeighbors(nodeId);
        this._lastEncounters = this._tickRoamingEnemies(fromId, nodeId);
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
        const idx = this.activeQuests.findIndex(q => q.id === questId && q.targetNodeId === this.currentNodeId);
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
        if (won) {
            this.completedBattles.add(scenarioId);
            this.currentNode.visited = true;
        }
        return won;
    }

    rest() {
        this.day++;
        this._lastEncounters = this._tickRoamingEnemies(null, null);
    }

    _tickRoamingEnemies(playerFrom, playerTo) {
        const encounters = [];
        for (const enemy of this.roamingEnemies) {
            if (enemy.defeated) continue;
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
        return encounters;
    }

    popEncounters() {
        const enc = this._lastEncounters || [];
        this._lastEncounters = [];
        return enc;
    }
}
