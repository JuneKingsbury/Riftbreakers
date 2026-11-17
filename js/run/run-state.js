// One roguelike run: the act map, the party, gold, items and relics, and the
// interaction pending at the current node. Plain data apart from the Rng, so the
// whole run serializes to JSON and resumes exactly.
//
// Node flow (driven by RunMapScene):
//   enterNode(id)            Move to a reachable node; sets `pending` for that node type
//   ...node actions...       startBattle/completeBattle, shop buy/sell, chooseEvent, rest, ...
//   leaveNode()              Done with the node (after a boss: next act or victory)
//
// pending kinds:
//   battle   { encounter }                      Waiting for the fight
//
// HP: the party is fully healed after every won battle. Damage from events (member.hp
// below max) lasts until then, so the party starts the next fight wounded.
//   reward   { gold, xp, levelUps, items, relics, relicPick, boss, claimed... } After a won battle
//   shop     { stock: [{ key, price, sold }], relic }
//   event    { eventId, resolved, result }
//   rest     { used }
//   treasure { gold, relic, claimed }
//   recruit  { candidates, done }
//   relicChoice { relics }                      Heirloom pick at the start of a run
import { Rng, randomSeed } from './rng.js';
import { generateActMap, reachableIds } from './map-gen.js';
import { rollEncounter, battleRewards, ACT_COUNT, EASY_FIGHTS } from './data/encounters.js';
import { RELICS, relicStatMods, relicMult, relicsWith } from './data/relics.js';
import { eventsFor, EVENTS } from './data/events.js';
import { rollRealms, REALMS } from './data/realms.js';
import { createMember, recruitCandidates } from './data/recruits.js';
import { runOptions, BASE_JOBS } from './profile.js';
import { EQUIPMENT, EQUIP_FIELDS, equipmentStatBonuses, itemPrice, itemRarity, itemName } from '../tactical/data/equipment.js';
import { JOB_STATS, ABILITIES, allowedEquipTypes, jobsOfTier } from '../tactical/data-registry.js';
import { sanitizeLoadout, learnAbility, upgradeAbility, canPromote, promote, promotionOptions, addXp, levelStatMods } from '../tactical/loadout.js';

export const SAVE_KEY = 'riftbreak.run.v1';
export const SAVE_VERSION = 4;
export const MAX_PARTY = 6;
export const TRAIN_SP = 1;
// Extra skill points the starting party begins with, so each member opens with a choice.
export const START_BONUS_SP = 1;
export const START_PARTY = 3;

const BATTLE_TYPES = { combat: 'normal', elite: 'elite', boss: 'boss' };

// Item rarity weights for rewards and shop stock, by act and fight kind.
const ITEM_RARITY = {
    1: { normal: { common: 70, uncommon: 28, rare: 2 },  elite: { common: 30, uncommon: 55, rare: 15 }, boss: { uncommon: 50, rare: 50 } },
    2: { normal: { common: 35, uncommon: 55, rare: 10 }, elite: { common: 5, uncommon: 55, rare: 40 },  boss: { uncommon: 30, rare: 70 } },
    3: { normal: { common: 10, uncommon: 55, rare: 35 }, elite: { uncommon: 35, rare: 65 },            boss: { rare: 100 } },
};

export class RunState {
    // opts.jobs     The starting roles (START_PARTY of them)
    // opts.options  runOptions(profile); defaults to a fresh profile
    // opts.seed     Rng seed (random by default)
    static create({ jobs, options = runOptions(null), seed = randomSeed() } = {}) {
        const run = new RunState();
        run.version = SAVE_VERSION;
        run.seed = seed;
        run.rng = new Rng(seed);
        run.options = options;
        run.act = 1;
        run.realms = RunState.realmsForSeed(seed);
        run.gold = options.startGold;
        run.inventory = {};
        run.relics = [];
        run.scripts = {};
        run.status = 'active';
        run.stats = { floors: 0, battles: 0, elites: 0, bosses: 0 };
        run.seenEncounters = [];
        run.seenEvents = [];
        run.party = [];
        for (const job of (jobs || BASE_JOBS).slice(0, START_PARTY)) {
            const m = createMember(run.rng, job, run.party.map(x => x.name), { level: options.startLevel });
            m.sp += START_BONUS_SP;
            run.party.push(m);
        }
        run._startAct();
        if (options.heirloom) run.pending = { kind: 'relicChoice', relics: run._rollRelics(['common'], 3) };
        return run;
    }

    // The realm of each act. Rolled from its own stream so it doesn't shift the run's rolls.
    static realmsForSeed(seed) {
        return rollRealms(new Rng((seed ^ 0x9E3779B9) >>> 0), ACT_COUNT);
    }

    // ---- Save / load ----

    serialize() {
        const { rng, ...rest } = this;
        return JSON.stringify({ ...rest, rngState: rng.state });
    }

    static deserialize(json) {
        const data = typeof json === 'string' ? JSON.parse(json) : json;
        // Version 3 saves predate realms: they keep playing, with realms rolled from the seed.
        if (data?.version === 3) {
            data.version = SAVE_VERSION;
            data.realms = RunState.realmsForSeed(data.seed);
        }
        if (data?.version !== SAVE_VERSION || !data.realms?.every(id => REALMS[id])) return null;
        const run = Object.assign(new RunState(), data);
        run.rng = new Rng(0);
        run.rng.state = data.rngState >>> 0;
        delete run.rngState;
        run._unequipMisfits();
        return run;
    }

    save(storage = globalThis.localStorage) {
        try { storage?.setItem(SAVE_KEY, this.serialize()); return true; } catch { return false; }
    }

    static load(storage = globalThis.localStorage) {
        try {
            const raw = storage?.getItem(SAVE_KEY);
            return raw ? RunState.deserialize(raw) : null;
        } catch {
            return null;
        }
    }

    static clearSave(storage = globalThis.localStorage) {
        try { storage?.removeItem(SAVE_KEY); } catch { /* ignore */ }
    }

    // ---- Map ----

    _startAct() {
        this.map = generateActMap(this.rng, this.act);
        this.currentNodeId = null;
        this.visited = [];
        this.pending = null;
    }

    // The realm the current act is set in (data/realms.js).
    get realmId() {
        return this.realms[this.act - 1];
    }

    get realm() {
        return REALMS[this.realmId];
    }

    get currentNode() {
        return this.currentNodeId ? this.map.nodes[this.currentNodeId] : null;
    }

    reachable() {
        if (this.pending || this.status !== 'active') return [];
        return reachableIds(this.map, this.currentNodeId);
    }

    enterNode(id) {
        if (!this.reachable().includes(id)) return null;
        const node = this.map.nodes[id];
        this.currentNodeId = id;
        this.visited.push(id);
        this.stats.floors += 1;
        switch (node.type) {
            case 'combat': case 'elite': case 'boss':
                this.pending = { kind: 'battle', encounter: this._rollEncounter(BATTLE_TYPES[node.type]) };
                break;
            case 'shop':     this.pending = this._rollShop(); break;
            case 'event':    this.pending = { kind: 'event', eventId: this._rollEvent(), resolved: false, result: null }; break;
            case 'rest':     this.pending = { kind: 'rest', used: false }; break;
            case 'treasure': this.pending = { kind: 'treasure', gold: this.rng.range(40, 70), relic: this._rollRelics(['common', 'uncommon'], 1)[0] ?? null, claimed: false }; break;
            case 'recruit':  this.pending = this._recruitPending(); break;
        }
        return node;
    }

    // Finishes the current node. After the boss this moves to the next act, or wins the run.
    leaveNode() {
        if (this.pending?.kind === 'battle') return false;
        const wasBoss = this.currentNode?.type === 'boss';
        this.pending = null;
        if (wasBoss) {
            if (this.act >= ACT_COUNT) {
                this.status = 'won';
            } else {
                this.act += 1;
                if (this.options.secondWind) for (const m of this.party) this._grantXp(m, 50);
                this._startAct();
            }
        }
        return true;
    }

    // Items can change slot or type between versions (the Parrying Dagger moved from weapon to
    // tool). Anything equipped where it no longer fits goes back to the bag.
    _unequipMisfits() {
        for (const m of this.party) {
            for (const field of EQUIP_FIELDS) {
                const key = m.appearance?.[field];
                if (!key) continue;
                if (EQUIPMENT[key] && `${EQUIPMENT[key].slot}Key` === field && this.canEquip(m, key)) continue;
                m.appearance[field] = null;
                if (EQUIPMENT[key]) this.addItem(key);
            }
            if (m.hp != null) m.hp = Math.max(1, Math.min(this.maxHp(m), m.hp));
            sanitizeLoadout(m);
        }
    }

    // ---- Party ----

    member(name) {
        return this.party.find(m => m.name === name) ?? null;
    }

    // Max HP outside battle: job base + member mods + equipment + relics.
    maxHp(member) {
        return (JOB_STATS[member.job]?.maxHp ?? 0)
            + (levelStatMods(member.level).maxHp ?? 0)
            + (member.statMods?.maxHp ?? 0)
            + (equipmentStatBonuses(member.appearance).maxHp ?? 0)
            + (relicStatMods(this.relics).maxHp ?? 0);
    }

    hp(member) {
        return member.hp == null ? this.maxHp(member) : Math.min(member.hp, this.maxHp(member));
    }

    // Heals (or with a negative fraction, hurts) every member by a fraction of max HP.
    healAll(frac) {
        for (const m of this.party) {
            const max = this.maxHp(m);
            const hp = Math.max(1, Math.min(max, this.hp(m) + Math.round(max * frac)));
            m.hp = hp >= max ? null : hp;
        }
    }

    // Returns the levels gained.
    _grantXp(member, amount) {
        return addXp(member, amount);
    }

    upgrade(memberName, key) {
        const m = this.member(memberName);
        return !!m && upgradeAbility(m, key);
    }

    learn(memberName, key) {
        const m = this.member(memberName);
        return !!m && learnAbility(m, key);
    }

    // A member who is ready (see canPromote) may promote at any time during the run, from the
    // Party menu. It is free: it doesn't use up a rest or any other node.
    promote(memberName, job) {
        const m = this.member(memberName);
        if (!m || this.status !== 'active' || !canPromote(m) || !promotionOptions(m).includes(job)) return false;
        const before = this.maxHp(m);
        promote(m, job);
        // Keep the same wounds when the new job's base HP differs.
        if (m.hp != null) m.hp = Math.max(1, m.hp + this.maxHp(m) - before);
        sanitizeLoadout(m);
        return true;
    }

    // ---- Items ----

    addItem(key, count = 1) {
        this.inventory[key] = (this.inventory[key] || 0) + count;
    }

    removeItem(key) {
        if (!this.inventory[key]) return false;
        if (--this.inventory[key] <= 0) delete this.inventory[key];
        return true;
    }

    canEquip(member, key) {
        const item = EQUIPMENT[key];
        if (!item) return false;
        const allowed = allowedEquipTypes(member.job, item.slot, member.origin);
        return allowed === null || allowed.has(item.type);
    }

    // Can anyone in the party use this item?
    usableByParty(key) {
        return this.party.some(m => this.canEquip(m, key));
    }

    // Equips an inventory item (or null to unequip) in the item's slot. The old item returns to the inventory.
    equip(memberName, field, key) {
        const m = this.member(memberName);
        if (!m || !EQUIP_FIELDS.includes(field)) return false;
        if (key) {
            if (!this.inventory[key] || !this.canEquip(m, key)) return false;
            if (`${EQUIPMENT[key].slot}Key` !== field) return false;
        }
        const before = this.maxHp(m);
        const old = m.appearance[field];
        if (old) this.addItem(old);
        if (key) this.removeItem(key);
        m.appearance[field] = key || null;
        if (m.hp != null) m.hp = Math.max(1, Math.min(this.maxHp(m), m.hp + this.maxHp(m) - before));
        sanitizeLoadout(m);
        return true;
    }

    sellPrice(key) {
        return Math.floor(itemPrice(key) / 2);
    }

    _rollItems(weights, count) {
        const out = [];
        for (let i = 0; i < count * 6 && out.length < count; i++) {
            const rarity = this.rng.weighted(weights);
            const keys = Object.keys(EQUIPMENT).filter(k => itemRarity(k) === rarity && !out.includes(k));
            const usable = keys.filter(k => this.usableByParty(k));
            const pool = usable.length ? usable : keys;
            if (pool.length) out.push(this.rng.pick(pool));
        }
        return out;
    }

    _rollRelics(rarities, count) {
        const pool = Object.keys(RELICS).filter(k => rarities.includes(RELICS[k].rarity) && !this.relics.includes(k));
        return this.rng.sample(pool, count);
    }

    addRelic(key) {
        if (!RELICS[key] || this.relics.includes(key)) return false;
        const before = this.party.map(m => this.maxHp(m));
        this.relics.push(key);
        // A max HP relic raises current HP too.
        this.party.forEach((m, i) => { if (m.hp != null) m.hp += this.maxHp(m) - before[i]; });
        return true;
    }

    chooseStartingRelic(key) {
        if (this.pending?.kind !== 'relicChoice' || !this.pending.relics.includes(key)) return false;
        this.addRelic(key);
        this.pending = null;
        return true;
    }

    // ---- Battles ----

    _rollEncounter(kind) {
        const easy = kind === 'normal' && this.act === 1 && this.stats.battles < EASY_FIGHTS;
        const enc = rollEncounter(this.rng, this.realmId, this.act, kind, this.party.length, this.seenEncounters, easy);
        this.seenEncounters.push(enc.id);
        return enc;
    }

    // An event that leads to a fight replaces its pending state with the battle.
    _startEventBattle(kind) {
        this.pending = { kind: 'battle', encounter: this._rollEncounter(kind), fromEvent: true };
    }

    // Called once when the battle ends. A win gives every member XP and fully heals the
    // party, knocked-out members included. Returns the reward (also left in `pending`), or
    // null after a defeat.
    completeBattle(won) {
        const p = this.pending;
        if (p?.kind !== 'battle') return null;
        const enc = p.encounter;
        if (!won) {
            this.status = 'lost';
            this.pending = null;
            return null;
        }
        for (const m of this.party) m.hp = null;

        const base = battleRewards(enc.kind, this.act);
        const xpMult = relicMult(this.relics, 'xpMult');
        const xpGained = {}, levelUps = {};
        for (const m of this.party) {
            const own = ABILITIES[m.loadout?.support]?.xpMult ?? 1;
            const amt = Math.round(base.xp * xpMult * own);
            xpGained[m.name] = amt;
            levelUps[m.name] = this._grantXp(m, amt);
        }
        const gold = Math.round(base.gold * relicMult(this.relics, 'goldMult'));
        this.gold += gold;
        this.stats.battles += 1;
        if (enc.kind === 'elite') this.stats.elites += 1;
        if (enc.kind === 'boss') this.stats.bosses += 1;

        const choices = base.itemChoices + (relicsWith(this.relics, 'extraItemChoice').length ? 1 : 0);
        let relics = [];
        if (enc.kind === 'boss') relics = this._rollRelics(['rare'], 3);
        else if (enc.kind === 'elite') relics = this._rollRelics(this.options.relicLore ? ['common', 'uncommon', 'rare'] : ['common', 'uncommon'], 1);
        if (enc.kind === 'boss' && relics.length === 0) relics = this._rollRelics(['uncommon'], 3);
        this.pending = {
            kind: 'reward',
            encounter: enc,
            boss: enc.kind === 'boss',
            gold,
            xp: xpGained,
            levelUps,
            items: this._rollItems(ITEM_RARITY[this.act][enc.kind], choices),
            itemClaimed: false,
            relics,
            // Bosses offer a choice of relics; elites give their one relic.
            relicPick: enc.kind === 'boss',
            relicClaimed: false,
        };
        if (!this.pending.relicPick && relics.length) {
            this.addRelic(relics[0]);
            this.pending.relicClaimed = true;
        }
        return this.pending;
    }

    claimRewardItem(key) {
        const p = this.pending;
        if (p?.kind !== 'reward' || p.itemClaimed || !p.items.includes(key)) return false;
        this.addItem(key);
        p.itemClaimed = true;
        return true;
    }

    claimRewardRelic(key) {
        const p = this.pending;
        if (p?.kind !== 'reward' || !p.relicPick || p.relicClaimed || !p.relics.includes(key)) return false;
        this.addRelic(key);
        p.relicClaimed = true;
        return true;
    }

    // ---- Shop ----

    _discount(price) {
        const off = relicsWith(this.relics, 'shopDiscount').reduce((s, k) => s + RELICS[k].shopDiscount, 0);
        return Math.round(price * (1 - Math.min(0.5, off)));
    }

    _rollShop() {
        const weights = { ...ITEM_RARITY[this.act].normal };
        if (this.options.fineWares) weights.uncommon = (weights.uncommon || 0) + 25;
        const stock = this._rollItems(weights, this.options.fineWares ? 6 : 5)
            .map(key => ({ key, price: this._discount(itemPrice(key)), sold: false }));
        const relicKey = this._rollRelics(['common', 'uncommon'], 1)[0] ?? null;
        const relic = relicKey ? { key: relicKey, price: this._discount(RELICS[relicKey].rarity === 'common' ? 150 : 220), sold: false } : null;
        return { kind: 'shop', stock, relic };
    }

    buy(index) {
        const p = this.pending;
        const entry = p?.kind === 'shop' ? p.stock[index] : null;
        if (!entry || entry.sold || this.gold < entry.price) return false;
        this.gold -= entry.price;
        entry.sold = true;
        this.addItem(entry.key);
        return true;
    }

    buyRelic() {
        const r = this.pending?.kind === 'shop' ? this.pending.relic : null;
        if (!r || r.sold || this.gold < r.price) return false;
        this.gold -= r.price;
        r.sold = true;
        this.addRelic(r.key);
        return true;
    }

    sell(key) {
        if (this.pending?.kind !== 'shop' || !this.removeItem(key)) return false;
        this.gold += this.sellPrice(key);
        return true;
    }

    // ---- Rest ----

    // A rest site offers one of: drill (XP for everyone) or train (a skill point for one
    // member). Resting also tends any wounds from events.
    drill() {
        if (this.pending?.kind !== 'rest' || this.pending.used) return false;
        for (const m of this.party) this._grantXp(m, this.options.drillXp);
        this._useRest();
        return true;
    }

    _useRest() {
        this.pending.used = true;
        for (const m of this.party) m.hp = null;
    }

    train(memberName) {
        const m = this.member(memberName);
        if (!m || this.pending?.kind !== 'rest' || this.pending.used) return false;
        m.sp = (m.sp || 0) + TRAIN_SP;
        if (this.options.trainXp) this._grantXp(m, this.options.trainXp);
        this._useRest();
        return true;
    }

    // ---- Treasure ----

    claimTreasure() {
        const p = this.pending;
        if (p?.kind !== 'treasure' || p.claimed) return false;
        this.gold += p.gold;
        if (p.relic) this.addRelic(p.relic);
        p.claimed = true;
        return true;
    }

    // ---- Recruits ----

    _recruitPending() {
        const full = this.party.length >= MAX_PARTY;
        return {
            kind: 'recruit',
            candidates: full ? [] : recruitCandidates(this.rng, this.party, jobsOfTier(1), this.options.recruitChoices),
            full,
            done: false,
        };
    }

    recruit(index) {
        const p = this.pending;
        const c = p?.kind === 'recruit' && !p.done ? p.candidates[index] : null;
        if (!c || this.party.length >= MAX_PARTY) return false;
        this.party.push(c);
        p.done = true;
        return true;
    }

    // Turning recruits away (or a full party) pays a consolation: gold, or XP for everyone when full.
    declineRecruit() {
        const p = this.pending;
        if (p?.kind !== 'recruit' || p.done) return false;
        if (p.full) for (const m of this.party) this._grantXp(m, 40);
        else this.gold += 40;
        p.done = true;
        return true;
    }

    // ---- Events ----

    _rollEvent() {
        // Realm events come up about half the time while fresh ones remain.
        const { realm, general } = eventsFor(this.act, this.realmId);
        const fresh = list => list.filter(e => !this.seenEvents.includes(e.id));
        const freshRealm = fresh(realm), freshGeneral = fresh(general);
        let pool;
        if (freshRealm.length && (!freshGeneral.length || this.rng.chance(0.5))) pool = freshRealm;
        else pool = freshGeneral.length ? freshGeneral : [...realm, ...general];
        const ev = this.rng.pick(pool);
        this.seenEvents.push(ev.id);
        return ev.id;
    }

    get currentEvent() {
        return this.pending?.kind === 'event' ? EVENTS.find(e => e.id === this.pending.eventId) : null;
    }

    choiceAvailable(choice) {
        const r = choice.requires || {};
        if (r.gold != null && this.gold < r.gold) return false;
        if (r.partyBelow != null && this.party.length >= r.partyBelow) return false;
        if (r.items != null && Object.keys(this.inventory).length < r.items) return false;
        return true;
    }

    // Resolves an event choice. Returns { text, next } where next is 'battle', 'recruit' or null;
    // for those the pending state becomes the battle or recruit screen.
    chooseEvent(index) {
        const ev = this.currentEvent;
        const choice = ev?.choices[index];
        if (!choice || this.pending.resolved || !this.choiceAvailable(choice)) return null;
        let { effect, resultText } = choice;
        if (choice.outcomes) {
            const weights = Object.fromEntries(choice.outcomes.map((o, i) => [i, o.weight ?? 1]));
            ({ effect, resultText } = choice.outcomes[Number(this.rng.weighted(weights))]);
        }
        const fx = this.applyEffect(effect || {});
        let text = resultText || '';
        text = text.replace('{name}', fx.member ?? '').replace('{item}', fx.item ? itemName(fx.item) : 'nothing')
            .replace('{relic}', fx.relic ? RELICS[fx.relic].name : 'nothing');
        this.pending.resolved = true;
        this.pending.result = text;
        let next = null;
        if (effect?.battle) { this._startEventBattle(effect.battle); next = 'battle'; }
        else if (effect?.recruit && this.party.length < MAX_PARTY) { this.pending = this._recruitPending(); next = 'recruit'; }
        return { text, next };
    }

    // Applies an event effect (see data/events.js). Returns what was gained: { item, relic, member }.
    applyEffect(effect) {
        const out = {};
        if (effect.gold) this.gold = Math.max(0, this.gold + effect.gold);
        if (effect.healPct) this.healAll(effect.healPct);
        if (effect.xp) for (const m of this.party) this._grantXp(m, effect.xp);
        if (effect.item) {
            out.item = this._rollItems({ [effect.item]: 1 }, 1)[0] ?? null;
            if (out.item) this.addItem(out.item);
        }
        if (effect.relic) {
            out.relic = this._rollRelics([effect.relic], 1)[0] ?? this._rollRelics(['common', 'uncommon', 'rare'], 1)[0] ?? null;
            if (out.relic) this.addRelic(out.relic);
        }
        if (effect.loseItem) {
            const keys = Object.keys(this.inventory);
            if (keys.length) this.removeItem(out.lostItem = this.rng.pick(keys));
        }
        if (effect.memberStatMods) {
            const m = this.rng.pick(this.party);
            const before = this.maxHp(m);
            m.statMods = { ...(m.statMods || {}) };
            for (const [k, v] of Object.entries(effect.memberStatMods)) m.statMods[k] = (m.statMods[k] || 0) + v;
            if (m.hp != null) m.hp += this.maxHp(m) - before;
            out.member = m.name;
        }
        return out;
    }
}
