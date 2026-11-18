// The renown unlockables and challenge options: Rift Tiers, the small-party bonus, the
// collection rewards, Traveler's Pack, Masterwork, Haggler, Relic Codex, Scout's Report,
// Tactician's Codex and the title backdrops.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { RunState, RIFT_TAX, riftTierMods } from '../../js/run/run-state.js';
import {
    newProfile, runOptions, recordRun, renownFor, renownMultiplier, RIFT_TIERS, MAX_RIFT_TIER, UNLOCKS,
    COLLECTION_REWARDS, claimCollectionRewards, collectionPercent, buyUnlock,
} from '../../js/run/profile.js';
import { EQUIPMENT, itemPrice } from '../../js/tactical/data/equipment.js';
import { RELICS } from '../../js/run/data/relics.js';
import { SCOUTING } from '../../js/run/data/scouting.js';
import { BACKDROPS } from '../../js/run/data/backdrops.js';
import { realmEncounters } from '../../js/run/data/encounters.js';

const JOBS = ['warden', 'evoker', 'runebow'];
const run = (opts = {}, seed = 5, jobs = JOBS) => RunState.create({ jobs, seed, options: { ...runOptions(null), ...opts } });
function enter(r, type) {
    const id = r.reachable()[0];
    r.map.nodes[id].type = type;
    return r.enterNode(id);
}
const owning = (...keys) => { const p = newProfile(); p.unlocked = keys; return runOptions(p); };

// ---- Rift Tiers and the small-party bonus ----

test('harder tiers and smaller parties pay more renown, and the bonuses add up', () => {
    assert.equal(renownMultiplier(0, 3), 1);
    assert.equal(renownMultiplier(2, 3), 1.5);
    assert.equal(renownMultiplier(0, 1), 1.5);
    assert.equal(renownMultiplier(0, 2), 1.25);
    assert.equal(renownMultiplier(4, 1), 2.5, 'Tier IV (+100%) and a lone hero (+50%)');
    assert.equal(renownMultiplier(5, 1), 3, 'Tier V (+150%) and a lone hero (+50%)');

    const profile = newProfile();
    const r = run({ tier: 2 }, 5, ['evoker']);
    r.status = 'won';
    r.stats = { floors: 45, battles: 20, elites: 3, bosses: 3 };
    assert.equal(recordRun(profile, r), Math.round(renownFor(r.stats, true) * 2));
});

test('a win opens the next Rift Tier, up to the last', () => {
    const profile = newProfile();
    assert.equal(profile.stats.riftTier, 0);
    const win = (tier) => { const r = run({ tier }); r.status = 'won'; recordRun(profile, r); };
    win(0); assert.equal(profile.stats.riftTier, 1);
    win(0); assert.equal(profile.stats.riftTier, 1, 'winning at a lower tier opens nothing new');
    for (let t = 1; t <= MAX_RIFT_TIER; t++) win(t);
    assert.equal(profile.stats.riftTier, MAX_RIFT_TIER);
    const lost = run({ tier: 4 }); lost.status = 'lost'; recordRun(profile, lost);
    assert.equal(profile.stats.riftTier, MAX_RIFT_TIER);
    assert.equal(RIFT_TIERS.length, 6);
});

test('Tier I toughens elites and bosses, Tier IV every enemy', () => {
    assert.equal(riftTierMods(0, 'elite'), null);
    assert.equal(riftTierMods(1, 'normal'), null);
    assert.ok(riftTierMods(1, 'elite').maxHp > 0 && riftTierMods(1, 'boss').atk > 0);
    assert.ok(riftTierMods(4, 'normal').def > 0);
    const plain = run(), hard = run({ tier: 1 });
    enter(plain, 'elite'); enter(hard, 'elite');
    const hp = (r) => r.pending.encounter.roster.reduce((s, e) => s + (e.statMods.maxHp || 0), 0);
    assert.ok(hp(hard) > hp(plain));
});

test('Tier II raises shop prices and Tier III cuts an item choice from battle rewards', () => {
    const plain = run(), taxed = run({ tier: 2 });
    enter(plain, 'shop'); enter(taxed, 'shop');
    const e = taxed.pending.stock[0];
    assert.equal(e.price, Math.round(itemPrice(e.key) * (1 + RIFT_TAX)));

    const choices = (tier) => {
        const r = run({ tier });
        enter(r, 'combat');
        return r.completeBattle(true).items.length;
    };
    assert.equal(choices(3), choices(0) - 1);
});

test('Tier IV bosses bring one more ally', () => {
    const boss = (tier) => {
        const r = run({ tier });
        enter(r, 'boss');
        return r.pending.encounter.roster.length;
    };
    assert.ok(boss(4) >= boss(0));
    assert.ok(boss(4) > boss(0) || realmEncounters(run().realmId, 'boss').every(e => e.def.roster.length <= boss(0)), 'unless the roster has no one else');
});

test('Tier V toughens every enemy beyond Tier IV, and elites bring one more ally', () => {
    for (const kind of ['normal', 'elite', 'boss']) {
        const iv = riftTierMods(4, kind), v = riftTierMods(5, kind);
        assert.ok(v.maxHp > iv.maxHp && v.atk > iv.atk && v.mat > iv.mat, kind);
    }
    const elite = (tier) => {
        const r = run({ tier });
        enter(r, 'elite');
        return r.pending.encounter.roster.length;
    };
    assert.ok(elite(5) >= elite(4));
    assert.ok(elite(5) > elite(4) || realmEncounters(run().realmId, 'elite').every(e => e.def.roster.length <= elite(4)), 'unless the roster has no one else');
});

// ---- Collection rewards ----

test('finding a third of all items pays 50 renown once, and two thirds earns the Collector\'s Loupe', () => {
    const profile = newProfile();
    const all = Object.keys(EQUIPMENT);
    profile.items = all.slice(0, Math.ceil(all.length * 0.33) + 1);
    assert.ok(collectionPercent(profile) >= 33);
    assert.deepEqual(claimCollectionRewards(profile).map(r => r.id), ['collect_33']);
    assert.equal(profile.renown, COLLECTION_REWARDS.collect_33.renown);
    assert.deepEqual(claimCollectionRewards(profile), [], 'only once');
    assert.equal(runOptions(profile).featItems.length, 0);

    profile.items = all.slice(0, Math.ceil(all.length * 0.67));
    assert.deepEqual(claimCollectionRewards(profile).map(r => r.id), ['collect_66']);
    assert.deepEqual(runOptions(profile).featItems, ['jewelers_loupe']);
});

test('the Collector\'s Loupe only drops once it has been earned', () => {
    assert.ok(EQUIPMENT.jewelers_loupe.featOnly);
    const rolls = (opts) => {
        const r = run(opts);
        const seen = new Set();
        for (let i = 0; i < 400; i++) for (const k of r._rollItems({ rare: 1 }, 4)) seen.add(k.replace(/\+\d$/, ''));
        return seen.has('jewelers_loupe');
    };
    assert.equal(rolls({}), false);
    assert.equal(rolls({ featItems: ['jewelers_loupe'] }), true);
});

// ---- Run perks ----

test('Traveler\'s Pack starts the bag with common boots and a common trinket, and changes nothing else', () => {
    const plain = run(), packed = run(owning('travelers_pack'));
    const bag = Object.keys(packed.inventory);
    assert.deepEqual(bag.map(k => EQUIPMENT[k].slot).sort(), ['boots', 'trinket']);
    assert.ok(bag.every(k => (EQUIPMENT[k].rarity ?? 'common') === 'common'));
    assert.deepEqual(Object.keys(plain.inventory), []);
    assert.equal(JSON.stringify(packed.map), JSON.stringify(plain.map), 'the same map');
    assert.deepEqual(packed.party.map(m => m.name), plain.party.map(m => m.name));
});

test('Masterwork doubles the chance of finding an item already enchanted', () => {
    const share = (opts) => {
        const r = run(opts, 11);
        let n = 0;
        for (let i = 0; i < 20000; i++) if (/\+\d$/.test(r._maybeEnchant('iron_sword'))) n++;
        return n / 20000;
    };
    const base = share({}), master = share(owning('masterwork'));
    assert.ok(master > base * 1.7 && master < base * 2.3, `${base} → ${master}`);
});

test('Haggler restocks each shop once, keeping what was bought', () => {
    const r = run({ ...owning('haggler') });
    r.gold = 9999;
    enter(r, 'shop');
    assert.ok(r.buy(0));
    const bought = r.pending.stock[0].key;
    assert.ok(r.canRestock());
    assert.ok(r.restockShop());
    assert.equal(r.pending.stock.filter(e => e.sold).length, 1);
    assert.equal(r.pending.stock.find(e => e.sold).key, bought);
    assert.ok(!r.canRestock() && !r.restockShop(), 'once per shop');
    const plain = run();
    enter(plain, 'shop');
    assert.ok(!plain.canRestock(), 'needs the unlock');
});

test('Relic Codex adds an uncommon relic to the starting choice', () => {
    const p = newProfile();
    p.renown = 999;
    assert.ok(!buyUnlock(p, 'relic_codex'), 'needs Heirloom first');
    assert.ok(buyUnlock(p, 'heirloom') && buyUnlock(p, 'relic_codex'));
    const r = RunState.create({ jobs: JOBS, seed: 3, options: runOptions(p) });
    const rarities = r.pending.relics.map(k => RELICS[k].rarity).sort();
    assert.deepEqual(rarities, ['common', 'common', 'uncommon']);
});

test('Scout\'s Report names the very boss the act ends with', () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
        const r = run(owning('scouts_report'), seed);
        assert.ok(SCOUTING[r.actBoss], `seed ${seed}: a line for ${r.actBoss}`);
        const named = r.actBoss;
        enter(r, 'boss');
        assert.equal(r.pending.encounter.id, named);
    }
    assert.equal(run({}, 9).actBoss, run({}, 9).actBoss, 'the same seed, the same boss');
});

// ---- Tactician's Codex ----

test('the Codex allows longer scripts, and a template saves and loads', async () => {
    const { sanitizeScript } = await import('../../js/tactical/ai/script-validate.js');
    const { MAX_RULES, CODEX_RULES } = await import('../../js/tactical/ai/script-runtime.js');
    const rule = (i) => ({ id: `r${i}`, enabled: true, when: { op: 'and', args: [] }, then: { do: 'wait' } });
    const script = (n) => ({ version: 1, rules: Array.from({ length: n }, (_, i) => rule(i + 1)) });
    assert.ok(CODEX_RULES > MAX_RULES);
    assert.ok(sanitizeScript(script(CODEX_RULES)));
    assert.equal(sanitizeScript(script(CODEX_RULES + 1)), null);

    const data = new Map();
    const prev = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)) } });
    try {
        const { saveTemplate, loadTemplate } = await import('../../js/tactical/ai/script-store.js');
        assert.equal(loadTemplate(), null);
        assert.ok(saveTemplate(script(3)));
        assert.equal(loadTemplate().rules.length, 3);
    } finally {
        if (prev) Object.defineProperty(globalThis, 'localStorage', prev); else delete globalThis.localStorage;
    }
});

// ---- Backdrops ----

test('every bought backdrop is an unlock, and the free ones need none', () => {
    for (const [id, b] of Object.entries(BACKDROPS)) {
        const u = UNLOCKS[`backdrop_${id}`];
        if (b.cost === 0) assert.equal(u, undefined, id);
        else assert.ok(u && u.cost === b.cost && u.backdrop === id, id);
    }
});

test('every new unlock is a real option', () => {
    const all = runOptions({ ...newProfile(), unlocked: Object.keys(UNLOCKS) });
    for (const k of ['travelersPack', 'masterwork', 'haggler', 'relicCodex', 'scoutsReport', 'tacticsCodex']) assert.equal(all[k], true, k);
});
