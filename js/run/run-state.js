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
import { rollEncounter, realmEncounters, battleRewards, ACT_COUNT, EASY_FIGHTS } from './data/encounters.js';
import { RELICS, relicStatMods, relicMult, relicsWith } from './data/relics.js';
import { eventsFor, EVENTS } from './data/events.js';
import { rollRealms, REALMS, ACT_REALMS, appearsIn } from './data/realms.js';
import { createMember, recruitCandidates } from './data/recruits.js';
import { autoAllocate, plannedPromotion } from './skill-plans.js';
import { battleScore } from './score.js';
import { notifySaved } from './save-events.js';
import { runOptions, BASE_JOBS } from './profile.js';
import { EQUIPMENT, EQUIP_FIELDS, equipmentStatBonuses, itemPrice, itemRarity, itemName, canEnchant, enchantedKey, enchantLevel } from '../tactical/data/equipment.js';
import { JOB_STATS, ABILITIES, allowedEquipTypes, jobsOfTier } from '../tactical/data-registry.js';
import { sanitizeLoadout, learnAbility, upgradeAbility, canPromote, promote, promotionOptions, addXp, levelStatMods } from '../tactical/loadout.js';
import { rollAffixes } from './data/affixes.js';

export const SAVE_KEY = 'riftbreak.run.v1';
export const SAVE_VERSION = 4;
export const MAX_PARTY = 6;
// Found items (loot, shops, events) are very rarely already enchanted: the chance an item is
// +1 or +2. Elite and boss rewards double both.
export const FOUND_ENCHANT_CHANCE = { plus1: 0.03, plus2: 0.005 };
export const ELITE_ENCHANT_MULT = 2;
// Extra skill points the starting party begins with, so each member opens with a choice.
export const START_BONUS_SP = 1;
// A run starts with 1 to START_PARTY members of the player's choosing (fewer is a challenge run).
export const START_PARTY = 3;
export const MIN_START_PARTY = 1;

const BATTLE_TYPES = { combat: 'normal', elite: 'elite', boss: 'boss' };

// Item rarity weights for rewards and shop stock, by act and fight kind. Each reward choice
// rolls separately. Legendary appears only in elite and boss rewards from act 2 on; shops use
// the `normal` weights, so they never stock it.
const ITEM_RARITY = {
    1: { normal: { common: 70, uncommon: 28, rare: 2 },  elite: { common: 30, uncommon: 55, rare: 15 },           boss: { uncommon: 50, rare: 50 } },
    2: { normal: { common: 35, uncommon: 55, rare: 10 }, elite: { common: 5, uncommon: 55, rare: 40 },            boss: { uncommon: 30, rare: 68, legendary: 2 } },
    3: { normal: { common: 10, uncommon: 55, rare: 35 }, elite: { uncommon: 35, rare: 64, legendary: 1 },        boss: { rare: 95, legendary: 5 } },
    4: { normal: { uncommon: 40, rare: 60 },             elite: { uncommon: 15, rare: 83, legendary: 2 },        boss: { rare: 94, legendary: 6 } },
};

// ---- Rift Tiers (profile RIFT_TIERS) ----
export const RIFT_TAX = 0.25;   // Tier II: shop prices
export const SLIM_GOLD = 0.7;   // Tier III: battle gold
const TIER1_TOUGH = { maxHp: 10, atk: 2, mat: 2 };                  // Tier I: elites and bosses
const TIER4_STORM = { maxHp: 8, atk: 1, def: 1, mat: 1, mdf: 1 };   // Tier IV: every enemy
const TIER5_RIFTSTORM = { maxHp: 8, atk: 1, mat: 1 };               // Tier V: every enemy, on top of IV
// Endless mode (after sealing the final rift): each depth adds this to every enemy, on top of
// the last act's own scaling. Depth 3 is roughly two more Rift Tiers' worth.
const ENDLESS_STEP = { maxHp: 10, atk: 2, def: 1, mat: 2, mdf: 1 };
// The realms endless acts are set in: the last acts', whose fights suit those levels.
const ENDLESS_REALMS = () => [...new Set([...(ACT_REALMS[ACT_COUNT - 1] ?? []), ...ACT_REALMS[ACT_COUNT]])];

function addStatMods(...mods) {
    const out = {};
    for (const m of mods) for (const [k, v] of Object.entries(m || {})) out[k] = (out[k] || 0) + v;
    return out;
}

/** Extra enemy stats a Rift Tier adds to a fight of `kind`, or null. */
export function riftTierMods(tier, kind) {
    const mods = addStatMods(
        tier >= 1 && (kind === 'elite' || kind === 'boss') ? TIER1_TOUGH : null,
        tier >= 4 ? TIER4_STORM : null,
        tier >= 5 ? TIER5_RIFTSTORM : null,
    );
    return Object.keys(mods).length ? mods : null;
}

export class RunState {
    // opts.jobs     The starting roles: MIN_START_PARTY to START_PARTY of them (none: BASE_JOBS)
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
        run.gold = options.challenge === 'no_gold' ? 0 : options.startGold;
        run.inventory = {};
        run.relics = [];
        run.scripts = {};
        run.status = 'active';
        run.stats = { floors: 0, battles: 0, elites: 0, bosses: 0 };
        run.score = 0;   // see score.js; added to by each won battle
        run.seenEncounters = [];
        run.seenEvents = [];
        run.party = [];
        const roles = jobs?.length ? jobs : BASE_JOBS;
        for (const job of roles.slice(0, START_PARTY)) {
            const m = createMember(run.rng, job, run.party.map(x => x.name), { level: options.startLevel });
            m.sp += START_BONUS_SP;
            run.party.push(m);
        }
        run.startPartySize = run.party.length;   // for the small-party renown bonus
        run._startAct();
        if (options.heirloom) {
            // Relic Codex swaps one of the three common choices for an uncommon relic.
            const relics = options.relicCodex
                ? [...run._rollRelics(['common'], 2), ...run._rollRelics(['uncommon'], 1)]
                : run._rollRelics(['common'], 3);
            run.pending = { kind: 'relicChoice', relics };
        }
        // Traveler's Pack: a common pair of boots and a common trinket. Rolled on their own
        // stream, so the rest of the run plays out as it would without them.
        if (options.travelersPack) {
            const pack = new Rng((seed ^ 0x51ED7A11) >>> 0);
            for (const slot of ['boots', 'trinket']) {
                const keys = Object.keys(EQUIPMENT).filter(k => EQUIPMENT[k].slot === slot && itemRarity(k) === 'common' && !EQUIPMENT[k].featOnly
                    && appearsIn(EQUIPMENT[k], run.act, run.realmId));
                if (keys.length) run.addItem(pack.pick(keys));
            }
        }
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
        // A save made at an event that has since been removed rolls a fresh one.
        if (run.pending?.kind === 'event' && !run.currentEvent) run.pending.eventId = run._rollEvent();
        return run;
    }

    save(storage = globalThis.localStorage) {
        try { storage?.setItem(SAVE_KEY, this.serialize()); notifySaved(); return true; } catch { return false; }
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
        try { storage?.removeItem(SAVE_KEY); notifySaved(); } catch { /* ignore */ }
    }

    // ---- Map ----

    _startAct() {
        // The act's boss is chosen now (on its own stream, so other rolls don't shift), so the
        // act intro can name it (Scout's Report) and the boss node fields that same fight.
        const bosses = realmEncounters(this.realmId, 'boss').map(e => e.def.id);
        this.actBoss = bosses.length ? new Rng((this.seed ^ (0xB055 * this.act)) >>> 0).pick(bosses) : null;
        // The last act has no recruit floor: the party should be at full size by then.
        this.map = generateActMap(this.rng, this.tableAct, { recruit: this.act < ACT_COUNT, shops: !this.noGold });
        this.currentNodeId = null;
        this.visited = [];
        this.pending = null;
    }

    // The act whose tables (rewards, item rarities, map shape, events) apply: the act itself,
    // or the last act for the acts of an endless run.
    get tableAct() {
        return Math.min(this.act, ACT_COUNT);
    }

    // ---- Endless mode ----

    /** Whether the run can go on into endless acts: it has just sealed the final rift (not a daily run). */
    get canGoEndless() {
        return this.status === 'won' && !this.endless && !this.endlessDeclined && !this.options?.daily && this.act >= this.actCount;
    }

    /**
     * Goes on past the final rift: the run is active again, already counts as won
     * (`sealedRift`), and moves to the first endless act. It ends only when the party falls
     * (or the run is abandoned). Record the run (profile.recordRun) before calling this: the
     * sealed run is what counts, and endless play is just for fun. Returns false if it can't.
     */
    goEndless() {
        if (!this.canGoEndless) return false;
        this.status = 'active';
        this.sealedRift = true;
        // What the run scored when it sealed the rift: what it is recorded with.
        this.sealedScore = this.score || 0;
        this.endless = { depth: 0 };
        this.pending = null;
        this._nextEndlessAct();
        return true;
    }

    // The next endless act: one level deeper, in a late realm other than the last one, picked
    // on its own stream of the seed.
    _nextEndlessAct() {
        this.endless.depth += 1;
        const pool = ENDLESS_REALMS().filter(id => id !== this.realmId);
        const realm = new Rng((this.seed ^ Math.imul(this.endless.depth, 0x2545F491)) >>> 0).pick(pool);
        this.realms.push(realm);
        this.act += 1;
        this._startAct();
    }

    /** "Act 2", or "Depth 3" in an endless run. */
    get actLabel() {
        return this.endless ? `Depth ${this.endless.depth}` : `Act ${this.act}`;
    }

    // How many acts this run has: one per realm. Runs saved before Act 4 existed keep their
    // three acts, so they end where they always would have.
    get actCount() {
        return this.realms.length;
    }

    // ---- Challenge runs (profile CHALLENGES) ----

    get challenge() {
        return this.options?.challenge ?? null;
    }

    // Empty Purse: the run never gains gold and has no shops.
    get noGold() {
        return this.challenge === 'no_gold';
    }

    // Gold the run gains: all of it, or none on an Empty Purse run. Returns what was added.
    _earnGold(amount) {
        const gained = this.noGold ? 0 : Math.max(0, amount);
        this.gold += gained;
        return gained;
    }

    /** Whether `member` may promote now: ready (see loadout.canPromote) and not a Humble Origins run. */
    canPromote(member) {
        return this.challenge !== 'no_promotions' && canPromote(member);
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
            case 'treasure': this.pending = { kind: 'treasure', gold: this.noGold ? 0 : this.rng.range(40, 70), relic: this._rollRelics(['common', 'uncommon'], 1)[0] ?? null, claimed: false }; break;
            case 'recruit':  this.pending = this._recruitPending(); break;
        }
        return node;
    }

    // Finishes the current node. After the boss this moves to the next act, or wins the run.
    // (Beating the last act's boss already wins it, in completeBattle; this covers runs saved at
    // that reward screen before then.)
    leaveNode() {
        if (this.pending?.kind === 'battle') return false;
        const wasBoss = this.currentNode?.type === 'boss';
        this.pending = null;
        if (wasBoss) {
            if (this.endless) {
                if (this.options.secondWind) for (const m of this.party) this._grantXp(m, 50);
                this._nextEndlessAct();
            } else if (this.act >= this.actCount) {
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

    // Follows every member's skill plan (see skill-plans.js): promotes them into the plan's
    // class once they are eligible, then spends their skill points. Plans are the player's, so
    // the caller passes them in. Returns [{ name, promoted }] for promotions and
    // [{ name, key, rank }] for skills, in the order they happened.
    autoAllocate(plans) {
        const out = [];
        for (const m of this.party) {
            const job = plannedPromotion(m, plans);
            if (job && this.promote(m.name, job)) out.push({ name: m.name, promoted: job });
            for (const b of autoAllocate(m, plans)) out.push({ name: m.name, ...b });
        }
        return out;
    }

    learn(memberName, key) {
        const m = this.member(memberName);
        return !!m && learnAbility(m, key);
    }

    // A member who is ready (see canPromote) may promote at any time during the run, from the
    // Party menu. It is free: it doesn't use up a rest or any other node.
    promote(memberName, job) {
        const m = this.member(memberName);
        if (!m || this.status !== 'active' || !this.canPromote(m) || !promotionOptions(m).includes(job)) return false;
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

    // Rolls `count` different items. Pools hold base items only (enchanted variants aren't
    // enumerable, see equipment.js); each pick then has a small chance to come enchanted.
    // kind: 'elite' or 'boss' for better odds of an enchanted find.
    _rollItems(weights, count, kind = 'normal') {
        const out = [];
        for (let i = 0; i < count * 6 && out.length < count; i++) {
            const rarity = this.rng.weighted(weights);
            const keys = Object.keys(EQUIPMENT).filter(k => itemRarity(k) === rarity && !out.includes(k)
                && (!EQUIPMENT[k].featOnly || this.options.featItems?.includes(k)) && appearsIn(EQUIPMENT[k], this.tableAct, this.realmId));
            const usable = keys.filter(k => this.usableByParty(k));
            const pool = usable.length ? usable : keys;
            if (pool.length) out.push(this.rng.pick(pool));
        }
        return out.map(k => this._maybeEnchant(k, kind));
    }

    _maybeEnchant(key, kind = 'normal') {
        const mult = (kind === 'elite' || kind === 'boss' ? ELITE_ENCHANT_MULT : 1) * (this.options.masterwork ? 2 : 1);
        const r = this.rng.next();
        if (r < FOUND_ENCHANT_CHANCE.plus2 * mult) return enchantedKey(key, 2);
        if (r < (FOUND_ENCHANT_CHANCE.plus2 + FOUND_ENCHANT_CHANCE.plus1) * mult) return enchantedKey(key, 1);
        return key;
    }

    _rollRelics(rarities, count) {
        // Empty Purse runs never find gold or shop relics: they would do nothing.
        const useless = (r) => this.noGold && (r.goldMult || r.shopDiscount);
        const pool = Object.keys(RELICS).filter(k => rarities.includes(RELICS[k].rarity) && !this.relics.includes(k) && !useless(RELICS[k])
            && appearsIn(RELICS[k], this.tableAct, this.realmId));
        return this.rng.sample(pool, count);
    }

    addRelic(key) {
        if (!RELICS[key] || this.relics.includes(key)) return false;
        const before = this.party.map(m => this.maxHp(m));
        this.relics.push(key);
        // A max HP relic raises current HP too.
        // (A max HP drawback lowers it, but never below 1.)
        this.party.forEach((m, i) => { if (m.hp != null) m.hp = Math.max(1, m.hp + this.maxHp(m) - before[i]); });
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
        const tier = this.options.tier ?? 0;
        // Bosses: the fight chosen when the act began (the others count as already seen).
        let seen = this.seenEncounters;
        if (kind === 'boss' && this.actBoss) seen = [...seen, ...realmEncounters(this.realmId, 'boss').map(e => e.def.id).filter(id => id !== this.actBoss)];
        // Rift Tier IV: bosses bring one more ally, and Tier V: elites do too (as if the party
        // were one larger).
        const extraAlly = (kind === 'boss' && tier >= 4) || (kind === 'elite' && tier >= 5);
        const size = this.party.length + (extraAlly ? 1 : 0);
        const enc = rollEncounter(this.rng, this.realmId, this.tableAct, kind, size, seen, easy);
        this.seenEncounters.push(enc.id);
        const mods = riftTierMods(tier, enc.kind);
        const units = [...enc.roster, ...(enc.phases ?? []).flatMap(p => p.summon ?? [])];
        if (mods) for (const r of units) r.statMods = addStatMods(r.statMods, mods);
        // Endless acts: every enemy gets stronger with depth.
        const depth = this.endless?.depth ?? 0;
        if (depth > 0) {
            const step = Object.fromEntries(Object.entries(ENDLESS_STEP).map(([k, v]) => [k, v * depth]));
            for (const r of units) r.statMods = addStatMods(r.statMods, step);
        }
        // Elite affixes go on the leader (data/affixes.js), from their own stream of the seed.
        const affixes = rollAffixes(this.seed, this.seenEncounters.length, enc.kind, this.tableAct, tier);
        if (affixes.length && enc.roster[0]) enc.roster[0].affixes = affixes;
        return enc;
    }

    // An event that leads to a fight replaces its pending state with the battle.
    _startEventBattle(kind) {
        this.pending = { kind: 'battle', encounter: this._rollEncounter(kind), fromEvent: true };
    }

    // Called once when the battle ends. A win gives every member XP and fully heals the
    // party, knocked-out members included, and adds to the run score (score.js) from
    // `result` (TacticalBattle.partyResult: { partySize, survivors, rounds }; none: no points).
    // Returns the reward (also left in `pending`), or null after a defeat.
    completeBattle(won, result = null) {
        const p = this.pending;
        if (p?.kind !== 'battle') return null;
        const enc = p.encounter;
        if (!won) {
            this.status = 'lost';
            this.pending = null;
            return null;
        }
        for (const m of this.party) m.hp = null;

        const base = battleRewards(enc.kind, this.tableAct);
        const xpMult = relicMult(this.relics, 'xpMult');
        const xpGained = {}, levelUps = {};
        for (const m of this.party) {
            const own = ABILITIES[m.loadout?.support]?.xpMult ?? 1;
            const amt = Math.round(base.xp * xpMult * own);
            xpGained[m.name] = amt;
            levelUps[m.name] = this._grantXp(m, amt);
        }
        const gold = this._earnGold(Math.round(base.gold * relicMult(this.relics, 'goldMult') * ((this.options.tier ?? 0) >= 3 ? SLIM_GOLD : 1)));
        this.stats.battles += 1;
        if (enc.kind === 'elite') this.stats.elites += 1;
        if (enc.kind === 'boss') {
            this.stats.bosses += 1;
            // For the bestiary in Feats (profile.noteBosses counts them).
            (this.bossesDefeated = this.bossesDefeated || []).push(enc.id);
        }

        // The run score. Runs saved before scoring start counting from here.
        let score = null;
        if (result?.partySize > 0) {
            score = { ...battleScore({ kind: enc.kind, ...result, startPartySize: this.startPartySize ?? 3, tier: this.options.tier ?? 0 }),
                survivors: result.survivors, partySize: result.partySize, rounds: result.rounds };
            this.score = (this.score || 0) + score.points;
        }

        // The last act's boss ends the run: there is nothing left to spend loot on, so no item or
        // relic choice. The battle's result screen still shows the XP, gold and score it gave.
        if (enc.kind === 'boss' && this.act >= this.actCount && !this.endless) {
            this.pending = null;
            this.status = 'won';
            return { kind: 'reward', encounter: enc, boss: true, final: true, gold, score, xp: xpGained, levelUps, items: [], relics: [] };
        }

        // Take It or Leave It: one item and one boss relic, whatever else would add choices.
        const oneChoice = this.challenge === 'one_choice';
        const choices = oneChoice ? 1 : Math.max(1, base.itemChoices + (relicsWith(this.relics, 'extraItemChoice').length ? 1 : 0)
            - ((this.options.tier ?? 0) >= 3 ? 1 : 0));   // Rift Tier III
        const bossRelics = oneChoice ? 1 : 3;
        let relics = [];
        if (enc.kind === 'boss') relics = this._rollRelics(['rare'], bossRelics);
        else if (enc.kind === 'elite') relics = this._rollRelics(this.options.relicLore ? ['common', 'uncommon', 'rare'] : ['common', 'uncommon'], 1);
        if (enc.kind === 'boss' && relics.length === 0) relics = this._rollRelics(['uncommon'], bossRelics);
        this.pending = {
            kind: 'reward',
            encounter: enc,
            boss: enc.kind === 'boss',
            gold,
            score,
            xp: xpGained,
            levelUps,
            items: this._rollItems(ITEM_RARITY[this.tableAct][enc.kind], choices, enc.kind),
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
        const tax = (this.options.tier ?? 0) >= 2 ? RIFT_TAX : 0;   // Rift Tier II
        return Math.round(price * (1 + tax) * (1 - Math.min(0.5, off)));
    }

    _rollShop() {
        const weights = { ...ITEM_RARITY[this.tableAct].normal };
        if (this.options.fineWares) weights.uncommon = (weights.uncommon || 0) + 25;
        const stock = this._rollItems(weights, this.options.fineWares ? 6 : 5)
            .map(key => ({ key, price: this._discount(itemPrice(key)), sold: false }));
        const relicKey = this._rollRelics(['common', 'uncommon'], 1)[0] ?? null;
        const relic = relicKey ? { key: relicKey, price: this._discount(RELICS[relicKey].rarity === 'common' ? 150 : 220), sold: false } : null;
        return { kind: 'shop', stock, relic, restocked: false };
    }

    // Haggler: once per shop, replace the unsold items with fresh stock for free.
    canRestock() {
        const p = this.pending;
        return !!this.options.haggler && p?.kind === 'shop' && !p.restocked;
    }

    restockShop() {
        if (!this.canRestock()) return false;
        const p = this.pending;
        const weights = { ...ITEM_RARITY[this.tableAct].normal };
        if (this.options.fineWares) weights.uncommon = (weights.uncommon || 0) + 25;
        const unsold = p.stock.filter(e => !e.sold).length;
        const fresh = this._rollItems(weights, unsold).map(key => ({ key, price: this._discount(itemPrice(key)), sold: false }));
        p.stock = [...p.stock.filter(e => e.sold), ...fresh];
        p.restocked = true;
        return true;
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
        this._earnGold(this.sellPrice(key));
        return true;
    }

    // ---- Rest ----

    // A rest site offers one of: train (XP for everyone) or enchant one item the party owns
    // (see enchant). Resting also tends any wounds from events.
    train() {
        if (this.pending?.kind !== 'rest' || this.pending.used) return false;
        for (const m of this.party) this._grantXp(m, this.options.drillXp);
        this._useRest();
        return true;
    }

    _useRest() {
        this.pending.used = true;
        for (const m of this.party) m.hp = null;
    }

    // Enchants one owned item a level (to at most +2): an equipped one, where is
    // { member, field } (an EQUIP_FIELDS name), or one in the bag, where is { item: key }.
    // Uses up the rest. With Master Trainer, the party also gains XP.
    enchant(where) {
        if (this.pending?.kind !== 'rest' || this.pending.used || !where) return false;
        let m = null;
        if (where.member != null) {
            m = this.member(where.member);
            const key = m && EQUIP_FIELDS.includes(where.field) ? m.appearance?.[where.field] : null;
            if (!key || !canEnchant(key)) return false;
            const before = this.maxHp(m);
            m.appearance[where.field] = enchantedKey(key, enchantLevel(key) + 1);
            if (m.hp != null) m.hp = Math.max(1, Math.min(this.maxHp(m), m.hp + this.maxHp(m) - before));
        } else {
            const key = where.item;
            if (!this.inventory[key] || !canEnchant(key)) return false;
            this.removeItem(key);
            this.addItem(enchantedKey(key, enchantLevel(key) + 1));
        }
        // Runs saved before enchanting have the Master Trainer bonus as trainXp instead.
        const xp = this.options.enchantXp ?? (this.options.trainXp ? 25 : 0);
        if (xp) for (const p of this.party) this._grantXp(p, xp);
        this._useRest();
        return true;
    }

    // ---- Treasure ----

    claimTreasure() {
        const p = this.pending;
        if (p?.kind !== 'treasure' || p.claimed) return false;
        this._earnGold(p.gold);
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
        else this._earnGold(40);
        p.done = true;
        return true;
    }

    // ---- Events ----

    _rollEvent() {
        // Realm events come up about half the time while fresh ones remain.
        const { realm, general } = eventsFor(this.tableAct, this.realmId);
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
        if (r.items != null && Object.keys(this.inventory).length < r.items) return false;
        return true;
    }

    // Resolves an event choice. Returns { text, next } where next is 'battle' or null;
    // for a battle the pending state becomes the fight.
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
        if (fx.goldLost) text += ' (Empty Purse: the gold slips away.)';
        this.pending.resolved = true;
        this.pending.result = text;
        let next = null;
        if (effect?.battle) { this._startEventBattle(effect.battle); next = 'battle'; }
        return { text, next };
    }

    // Applies an event effect (see data/events.js). Returns what was gained: { item, relic, member }.
    applyEffect(effect) {
        const out = {};
        if (effect.gold > 0) {
            if (!this._earnGold(effect.gold)) out.goldLost = true;
        } else if (effect.gold) this.gold = Math.max(0, this.gold + effect.gold);
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
