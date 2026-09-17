import { NODES, QUESTS, EVENTS } from './world-map-data.js';

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
        this.inventory = [];
        this._nodeMap = Object.fromEntries(this.nodes.map(n => [n.id, n]));
        this._usedEventIds = new Set();
        this._rand = 0;

        // Roaming enemies
        this.roamingEnemies = [
            new RoamingEnemy('raiders', 'amber_crossroads', 'raider_brute', 'Raider Band', 'bandit_ambush'),
        ];

        // Discover connections of the starting node
        this._discoverNeighbors(this.currentNodeId);
    }

    get currentNode() { return this._nodeMap[this.currentNodeId]; }

    getNode(id) { return this._nodeMap[id] || null; }

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
        // Tick enemies and check for collisions (same node OR crossing paths)
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

    // BFS over discovered+connected nodes. Returns [id, id, ...] excluding start,
    // or null if no path exists.
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

    // Returns a random event, cycling through all before repeating
    drawRandomEvent() {
        const available = EVENTS.filter(e => !this._usedEventIds.has(e.id));
        const pool = available.length > 0 ? available : EVENTS;
        if (available.length === 0) this._usedEventIds.clear();
        const ev = pool[Math.floor(pool.length * this._seededRand())];
        this._usedEventIds.add(ev.id);
        return ev;
    }

    // Simple deterministic-ish rand using day+nodeId to avoid pure random
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

    // Returns quests that are ready to turn in at the current location
    getReadyQuests() {
        return this.activeQuests.filter(q => q.targetNodeId === this.currentNodeId);
    }

    // Completes a single quest by id, applies rewards, returns the quest object or null
    turnInQuest(questId) {
        const idx = this.activeQuests.findIndex(q => q.id === questId && q.targetNodeId === this.currentNodeId);
        if (idx === -1) return null;
        const q = this.activeQuests.splice(idx, 1)[0];
        q.completed = true;
        this.completedQuests.add(q.id);
        this.gold += q.rewardGold || 0;
        for (const item of (q.rewardItems || [])) {
            this.inventory.push(item);
        }
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

    // Returns any roaming enemies that collided with the player this tick.
    // fromId/toId are the player's travel edge (null for rest).
    _tickRoamingEnemies(playerFrom, playerTo) {
        const encounters = [];
        for (const enemy of this.roamingEnemies) {
            if (enemy.defeated) continue;
            const prevNodeId = enemy.nodeId;
            // Move enemy one step along a random discovered connection
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
            // Collision: enemy landed on player's node
            if (enemy.nodeId === this.currentNodeId) {
                encounters.push({ enemy, crossed: false });
                continue;
            }
            // Crossing paths: enemy moved to player's origin while player moved to enemy's origin
            if (playerFrom && playerTo &&
                enemy.nodeId === playerFrom && prevNodeId === playerTo) {
                // Send the enemy back so both characters meet at the player's destination
                enemy.nodeId = playerTo;
                encounters.push({ enemy, crossed: true });
            }
        }
        return encounters;
    }

    // Consume and return pending encounters (called by scene after travel).
    popEncounters() {
        const enc = this._lastEncounters || [];
        this._lastEncounters = [];
        return enc;
    }
}
