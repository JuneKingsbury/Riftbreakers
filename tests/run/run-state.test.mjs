// RunState: node flow, rewards, HP carry-over, recruits, shops, events and saving.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { RunState, MAX_PARTY } from '../../js/run/run-state.js';
import { battleRewards } from '../../js/run/data/encounters.js';
import { runOptions, newProfile, buyUnlock, recordRun, renownFor } from '../../js/run/profile.js';
import { EVENTS } from '../../js/run/data/events.js';
import { PROMOTION_LEVEL, XP_PER_LEVEL, buildLoadout } from '../../js/tactical/loadout.js';
import { EQUIPMENT, itemPrice } from '../../js/tactical/data/equipment.js';

const totalXp = (m) => (m.level - 1) * XP_PER_LEVEL + m.xp;

const newRun = (seed = 1, options) => RunState.create({ jobs: ['warden', 'evoker', 'runebow'], seed, ...(options ? { options } : {}) });

// Moves to the first reachable node of `type` on the current act map, rewriting the
// node's type if none is reachable (keeps tests independent of the generated layout).
function enter(run, type) {
    const ids = run.reachable();
    const id = ids.find(i => run.map.nodes[i].type === type) ?? ids[0];
    run.map.nodes[id].type = type;
    return run.enterNode(id);
}


test('a new run: three level 1 members with their starter skill and skill points to spend, on act 1', () => {
    const run = newRun();
    assert.equal(run.party.length, 3);
    assert.deepEqual(run.party.map(m => m.job), ['warden', 'evoker', 'runebow']);
    assert.equal(new Set(run.party.map(m => m.name)).size, 3, 'names are unique (scripts are keyed by name)');
    assert.deepEqual(run.party[1].learned, ['fire']);
    assert.equal(run.party[0].level, 1);
    assert.equal(run.party[0].sp, 2);
    assert.equal(run.act, 1);
    assert.equal(run.reachable().length, run.map.floors[0].length);
});

test('battle: a win fully heals the party and grants XP (levels) and gold', () => {
    const run = newRun();
    run.party[1].hp = 3;                         // hurt by an event before the fight
    enter(run, 'combat');
    assert.equal(run.pending.kind, 'battle');
    assert.deepEqual(run.reachable(), [], 'cannot move on mid-node');
    const [a] = run.party;
    a.xp = XP_PER_LEVEL - 1;
    const goldBefore = run.gold;
    const reward = run.completeBattle(true);
    assert.ok(run.party.every(m => m.hp === null), 'everyone back to full');
    const base = battleRewards('normal', 1);
    assert.equal(reward.xp[a.name], base.xp);
    assert.equal(reward.levelUps[a.name], 1);
    assert.equal(a.level, 2);
    assert.equal(a.sp, 3);
    assert.equal(run.gold, goldBefore + base.gold);
    assert.equal(reward.kind, 'reward');
    assert.equal(reward.items.length, 3);
    assert.ok(run.claimRewardItem(reward.items[0]));
    assert.ok(!run.claimRewardItem(reward.items[1]), 'only one item');
    assert.equal(run.inventory[reward.items[0]], 1);
    assert.ok(run.leaveNode());
    assert.ok(run.reachable().length > 0);
});

test('losing a battle ends the run', () => {
    const run = newRun();
    enter(run, 'combat');
    assert.equal(run.completeBattle(false), null);
    assert.equal(run.status, 'lost');
    assert.deepEqual(run.reachable(), []);
});

test('elites give a relic; bosses offer a relic choice, then the next act', () => {
    const run = newRun(2);
    enter(run, 'elite');
    run.completeBattle(true);
    assert.equal(run.relics.length, 1);
    run.leaveNode();

    run.currentNodeId = run.map.floors[13][0].id;    // skip to the boss
    run.pending = null;
    run.enterNode(run.map.bossId);
    const reward = run.completeBattle(true);
    assert.ok(reward.boss && reward.relicPick && reward.relics.length === 3);
    assert.ok(run.claimRewardRelic(reward.relics[1]));
    assert.ok(run.relics.includes(reward.relics[1]));
    run.leaveNode();
    assert.equal(run.act, 2);
    assert.equal(run.currentNodeId, null);
    assert.equal(run.stats.bosses, 1);
});

// Wins the current act's boss fight and moves on.
function beatBoss(run) {
    run.currentNodeId = run.map.floors[13][0].id;
    run.enterNode(run.map.bossId);
    run.completeBattle(true);
    run.leaveNode();
}

test('a run has four acts, ending in the Shifting Labyrinth, and winning the act 4 boss wins it', () => {
    // GIVEN: a new run at the act 3 boss
    const run = newRun(3);
    assert.equal(run.actCount, 4);
    assert.equal(run.realms[3], 'shifting_labyrinth');
    run.act = 3;

    // WHEN / THEN: beating it moves on to act 4 instead of ending the run
    beatBoss(run);
    assert.equal(run.status, 'active');
    assert.equal(run.act, 4);
    assert.equal(run.realmId, 'shifting_labyrinth');

    // WHEN / THEN: beating the act 4 boss wins
    beatBoss(run);
    assert.equal(run.status, 'won');
});

test('beating the final boss wins the run at once, without an item or relic choice', () => {
    // GIVEN: a run at the act 4 boss
    const run = newRun(5);
    run.act = 4;
    run._startAct();
    const gold = run.gold;
    run.currentNodeId = run.map.floors[13][0].id;
    run.enterNode(run.map.bossId);

    // WHEN: the boss falls
    const reward = run.completeBattle(true, { partySize: 3, survivors: 3, rounds: 10 });

    // THEN: the run is won with nothing left to claim, but the fight still paid out
    assert.equal(run.status, 'won');
    assert.equal(run.pending, null, 'no reward screen');
    assert.equal(reward.final, true);
    assert.deepEqual(reward.items, []);
    assert.deepEqual(reward.relics, []);
    assert.ok(reward.gold > 0 && run.gold === gold + reward.gold);
    assert.ok(reward.score.points > 0 && run.score >= reward.score.points);
    assert.ok(Object.values(reward.xp).every(xp => xp > 0));
    assert.equal(run.stats.bosses, 1);
    assert.equal(run.bossesDefeated.length, 1, 'it still counts for the bestiary');

    // AND: an earlier act's boss still offers its loot
    const early = newRun(5);
    early.currentNodeId = early.map.floors[13][0].id;
    early.enterNode(early.map.bossId);
    const loot = early.completeBattle(true);
    assert.equal(early.status, 'active');
    assert.ok(loot.items.length > 0 && loot.relics.length > 0);
});

test('the last act has no recruits; the acts before it have one on every route', () => {
    const run = newRun(4);
    for (let act = 1; act <= 4; act++) {
        const recruits = Object.values(run.map.nodes).filter(n => n.type === 'recruit').length;
        if (act < 4) assert.ok(recruits > 0, `act ${act} has a recruit floor`);
        else assert.equal(recruits, 0, 'act 4 has no recruit nodes');
        beatBoss(run);
    }
    assert.equal(run.status, 'won');
});

test('a run saved before act 4 existed still ends after its third act', () => {
    // GIVEN: a saved run with only three realms, in its third act
    const data = JSON.parse(newRun(3).serialize());
    data.realms = ['wild_frontiers', 'arcane_library', 'palace_fortress'];
    data.act = 3;
    const run = RunState.deserialize(data);
    assert.ok(run, 'it still loads');
    assert.equal(run.actCount, 3);

    // WHEN: it beats the act 3 boss
    beatBoss(run);

    // THEN: the run is won, not sent on to an act with no realm
    assert.equal(run.status, 'won');
});

test('rest trains everyone or enchants one item; only one per visit, and it tends wounds', () => {
    const run = newRun();
    const [a, b] = run.party;
    a.hp = 10;
    enter(run, 'rest');
    const xps = run.party.map(totalXp);
    assert.ok(run.train());
    assert.deepEqual(run.party.map(totalXp), xps.map(x => x + run.options.drillXp));
    assert.equal(a.hp, null, 'wounds tended');
    const weapon = b.appearance.weaponKey;
    assert.ok(weapon, 'members start armed');
    assert.ok(!run.enchant({ member: b.name, field: 'weaponKey' }), 'already rested');
    run.leaveNode();

    enter(run, 'rest');
    assert.ok(run.enchant({ member: b.name, field: 'weaponKey' }));
    assert.equal(b.appearance.weaponKey, `${weapon}+1`, 'enchanting levels the item');
    assert.ok(!run.train(), 'one or the other');
    run.leaveNode();

    enter(run, 'rest');
    b.level = PROMOTION_LEVEL;
    assert.ok(run.promote(b.name, 'riftcaller'));
    assert.equal(b.origin, 'evoker');
    assert.ok(run.train(), 'promoting does not use up the rest');
});

test('a member who is ready can promote anywhere, at no cost, but only once and only while the run lasts', () => {
    const run = newRun();
    const [a, b, c] = run.party;
    assert.ok(!run.promote(a.name, 'paladin'), 'not ready below the promotion level');

    a.level = PROMOTION_LEVEL;
    assert.equal(run.pending, null, 'on the map, between nodes');
    const gold = run.gold;
    assert.ok(run.promote(a.name, 'paladin'));
    assert.equal(a.job, 'paladin');
    assert.equal(run.gold, gold, 'free');
    assert.ok(!run.promote(a.name, 'lifeseer'), 'only once, even into the other option');

    enter(run, 'combat');                       // waiting for a fight
    b.level = PROMOTION_LEVEL;
    assert.equal(run.pending.kind, 'battle');
    assert.ok(run.promote(b.name, 'riftcaller'), 'just before a battle');
    assert.ok(!run.promote(b.name, 'nowhere'), 'not a promotion of that job');

    c.level = PROMOTION_LEVEL;
    run.completeBattle(false);
    assert.equal(run.status, 'lost');
    assert.ok(!run.promote(c.name, 'beastcaller'), 'not after the run ends');
    assert.equal(c.job, 'runebow');
});

test('recruits join up to six; a full party gets JP instead', () => {
    const run = newRun();
    while (run.party.length < MAX_PARTY) {
        enter(run, 'recruit');
        const names = run.pending.candidates.map(c => c.name);
        assert.equal(new Set([...names, ...run.party.map(m => m.name)]).size, names.length + run.party.length);
        assert.ok(run.recruit(0));
        run.leaveNode();
    }
    enter(run, 'recruit');
    assert.ok(run.pending.full);
    assert.ok(!run.recruit(0));
    const xps = run.party.map(totalXp);
    assert.ok(run.declineRecruit());
    assert.deepEqual(run.party.map(totalXp), xps.map(x => x + 40));
});

test('shop: buy and sell; equipping moves items and respects class armor types', () => {
    const run = newRun();
    run.gold = 1000;
    enter(run, 'shop');
    const p = run.pending;
    assert.ok(p.stock.length >= 5);
    assert.ok(run.buy(0));
    assert.ok(!run.buy(0), 'sold out');
    assert.equal(run.inventory[p.stock[0].key], 1);
    const gold = run.gold;
    assert.ok(run.sell(p.stock[0].key));
    assert.ok(run.gold > gold);

    run.addItem('iron_chainmail');
    const [warden, evoker] = run.party;
    assert.ok(!run.equip(evoker.name, 'armorKey', 'iron_chainmail'), 'evokers wear cloth');
    assert.ok(run.equip(warden.name, 'armorKey', 'iron_chainmail'));
    assert.equal(warden.appearance.armorKey, 'iron_chainmail');
    assert.equal(run.inventory.iron_brigandine, 1, 'old armor back in the bag');
    assert.ok(!run.equip(warden.name, 'helmetKey', 'iron_brigandine'), 'wrong slot');
});

test("a gear passive works on top of the member's chosen slot, and goes with the item", () => {
    const run = newRun();
    const warden = run.party[0];                    // starts with an Iron Shield (Martyr)
    warden.learned.push('guardian_ward');
    warden.loadout.reaction = 'guardian_ward';
    assert.deepEqual(buildLoadout(warden).bonusPassives, ['martyr']);
    assert.equal(buildLoadout(warden).reaction, 'guardian_ward');
    assert.ok(run.equip(warden.name, 'toolKey', null));
    assert.deepEqual(buildLoadout(warden).bonusPassives, []);
    assert.equal(warden.loadout.reaction, 'guardian_ward', 'the learned choice is untouched');
});

test('events apply their effects and can lead to a battle', () => {
    const run = newRun(4);
    enter(run, 'event');
    run.pending.eventId = 'training_grounds';
    const xp = totalXp(run.party[0]);
    const res = run.chooseEvent(1);
    assert.equal(res.next, null);
    assert.equal(totalXp(run.party[0]), xp + 30);
    assert.equal(run.chooseEvent(0), null, 'one choice per event');
    run.leaveNode();

    enter(run, 'event');
    run.pending.eventId = 'ambush';
    assert.equal(run.chooseEvent(1).next, 'battle');
    assert.equal(run.pending.kind, 'battle');
    assert.ok(!run.leaveNode(), 'the fight must happen');
    run.completeBattle(true);
    run.leaveNode();

    // Recruits come only from the map's recruit floor, never from events.
    const offersRecruit = c => [c.effect, ...(c.outcomes || []).map(o => o.effect)].some(e => e?.recruit);
    for (const ev of EVENTS) assert.ok(!ev.choices.some(offersRecruit), `${ev.id} offers a recruit`);

    for (const ev of EVENTS) assert.ok(ev.choices.length >= 1 && ev.choices.length <= 3, ev.id);
});

test('event choices with unmet requirements are refused', () => {
    const run = newRun();
    enter(run, 'event');
    run.pending.eventId = 'wandering_mage';
    run.gold = 10;
    assert.equal(run.chooseEvent(0), null);
    run.gold = 100;
    assert.ok(run.chooseEvent(0));
    assert.equal(run.gold, 40);
});

test('relics: stat mods raise max HP, multipliers change rewards', () => {
    const run = newRun();
    const m = run.party[0];
    const max = run.maxHp(m);
    m.hp = 20;
    run.addRelic('stone_heart');
    assert.equal(run.maxHp(m), max + 10);
    assert.equal(m.hp, 30, 'current HP rises with max HP');
    run.addRelic('merchants_seal');
    enter(run, 'combat');
    const gold = run.gold;
    run.completeBattle(true);
    assert.equal(run.gold - gold, Math.round(battleRewards('normal', 1).gold * 1.25));
});

test('a run saves and resumes exactly, including the random rolls', () => {
    const run = newRun(9);
    enter(run, 'combat');
    run.completeBattle(true);
    run.scripts[run.party[0].name] = { version: 1, rules: [] };
    const copy = RunState.deserialize(run.serialize());
    assert.deepEqual(JSON.parse(copy.serialize()), JSON.parse(run.serialize()));
    assert.equal(copy.rng.next(), run.rng.next(), 'same next roll');
    assert.equal(RunState.deserialize('{"version":0}'), null, 'old saves are refused');

    const store = new Map();
    const storage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: k => store.delete(k) };
    assert.ok(run.save(storage));
    assert.equal(RunState.load(storage).gold, run.gold);
    RunState.clearSave(storage);
    assert.equal(RunState.load(storage), null);
});

test('profile: unlocks change run options; finished runs earn renown', () => {
    const profile = newProfile();
    assert.deepEqual(runOptions(profile).jobs, ['warden', 'evoker', 'runebow']);
    assert.ok(!buyUnlock(profile, 'job_seer'), 'no renown yet');
    profile.renown = 200;
    assert.ok(buyUnlock(profile, 'job_seer'));
    assert.ok(!buyUnlock(profile, 'purse_2'), 'needs Coin Purse first');
    assert.ok(buyUnlock(profile, 'purse_1') && buyUnlock(profile, 'purse_2'));
    const opts = runOptions(profile);
    assert.ok(opts.jobs.includes('seer'));
    assert.equal(opts.startGold, 200);

    const run = RunState.create({ jobs: ['seer', 'warden', 'evoker'], options: opts, seed: 1 });
    assert.equal(run.gold, 200);
    run.stats = { floors: 20, elites: 2, bosses: 1, battles: 9 };
    run.status = 'lost';
    const renown = profile.renown;
    assert.equal(recordRun(profile, run), renownFor(run.stats, false));
    assert.equal(profile.renown, renown + 20 + 6 + 10);
    assert.equal(profile.stats.runs, 1);
});

test('the Heirloom unlock starts the run with a relic choice', () => {
    const profile = newProfile();
    profile.unlocked.push('heirloom');
    const run = RunState.create({ jobs: ['warden', 'evoker', 'runebow'], options: runOptions(profile), seed: 5 });
    assert.equal(run.pending.kind, 'relicChoice');
    assert.deepEqual(run.reachable(), []);
    assert.ok(run.chooseStartingRelic(run.pending.relics[0]));
    assert.equal(run.relics.length, 1);
    assert.ok(run.reachable().length > 0);
});

test('off-hand items are tools, and a save with one equipped as a weapon puts it back in the bag', () => {
    assert.equal(EQUIPMENT.parrying_dagger.slot, 'tool');
    assert.equal(EQUIPMENT.aegis_of_the_vanguard.slot, 'tool');
    assert.equal(EQUIPMENT.aegis_of_the_vanguard.type, 'shield');

    const run = newRun();
    const blade = run.party.find(m => m.job === 'warden');
    run.addItem('parrying_dagger');
    assert.ok(!run.equip(blade.name, 'weaponKey', 'parrying_dagger'), 'no longer a weapon');

    const saved = JSON.parse(run.serialize());
    const m = saved.party.find(x => x.name === blade.name);
    m.appearance.weaponKey = 'parrying_dagger';   // equipped before the move
    const before = saved.inventory.parrying_dagger ?? 0;
    const loaded = RunState.deserialize(saved);
    const lm = loaded.member(blade.name);
    assert.equal(lm.appearance.weaponKey, null);
    assert.equal(loaded.inventory.parrying_dagger, before + 1, 'returned to the bag, not lost');
});

test('a save made at an event that no longer exists resumes at a real event', () => {
    const run = newRun(9);
    enter(run, 'event');
    const saved = JSON.parse(run.serialize());
    saved.pending.eventId = 'lost_sellsword';   // removed when recruits moved to the map

    const loaded = RunState.deserialize(saved);

    assert.ok(loaded.currentEvent, 'a current event is found');
    assert.notEqual(loaded.pending.eventId, 'lost_sellsword');
    assert.equal(loaded.pending.resolved, false);
});

test('a run can start with one, two or three roles; asking for none gives the default three', async () => {
    const { MIN_START_PARTY, START_PARTY } = await import('../../js/run/run-state.js');
    assert.equal(MIN_START_PARTY, 1);
    for (const jobs of [['warden'], ['evoker', 'runebow'], ['warden', 'evoker', 'runebow']]) {
        const run = RunState.create({ jobs, seed: 2 });
        assert.deepEqual(run.party.map(m => m.job), jobs);
        assert.equal(run.status, 'active');
        assert.ok(run.reachable().length > 0, 'the act map is open');
    }
    assert.equal(RunState.create({ jobs: [], seed: 2 }).party.length, START_PARTY);
    assert.equal(RunState.create({ jobs: ['warden', 'evoker', 'runebow', 'seer'], seed: 2 }).party.length, START_PARTY, 'never more than three');
});

test('a lone hero\'s first battle is a real fight that plays to the end', async () => {
    const { loadMapData } = await import('../../js/tactical/battle-map.js');
    const { MAP_DATA } = await import('../../js/tactical/data/maps/index.js');
    const { TacticalBattle } = await import('../../js/tactical/battle.js');
    const { buildUnits } = await import('../../js/tactical/build-units.js');
    const { runRealtimeBattle } = await import('../../js/tactical/realtime.js');
    const run = RunState.create({ jobs: ['spellblade'], seed: 4 });
    enter(run, 'combat');
    const enc = run.pending.encounter;
    assert.ok(enc.roster.length >= 2, 'not a walkover');
    const map = loadMapData(MAP_DATA[0]);
    const battle = new TacticalBattle(map, buildUnits({ party: run.party, encounter: enc }, map.playerSpawns, map.enemySpawns));
    assert.equal(battle.units.filter(u => u.team === 'player').length, 1);
    assert.ok(runRealtimeBattle(battle, {}).over);
});

test('buying a relic that changes shop prices reprices what is still on sale in that shop', () => {
    // GIVEN: a shop selling Lucky Coin (20% off), and gold to buy everything
    const run = RunState.create({ jobs: ['evoker'], seed: 9 });
    const shop = run._rollShop();
    shop.relic = { key: 'lucky_coin', price: 220, sold: false };
    run.pending = shop;
    run.gold = 10000;
    run.buy(0);
    const soldPrice = shop.stock[0].price;

    // WHEN: the coin is bought
    assert.ok(run.buyRelic());

    // THEN: every unsold item is 20% cheaper; the one already bought keeps its price
    assert.deepEqual(shop.stock.slice(1).map(e => e.price), shop.stock.slice(1).map(e => Math.round(itemPrice(e.key) * 0.8)));
    assert.equal(shop.stock[0].price, soldPrice);
});

test('the reward screen knows which item and relic were taken', () => {
    const run = RunState.create({ jobs: ['evoker'], seed: 9 });
    run.pending = { kind: 'reward', items: ['short_bow', 'leather_cap'], relics: ['lucky_coin', 'gamblers_crown'], relicPick: true };
    assert.ok(run.claimRewardItem('leather_cap'));
    assert.ok(run.claimRewardRelic('gamblers_crown'));
    assert.equal(run.pending.itemTaken, 'leather_cap');
    assert.equal(run.pending.relicTaken, 'gamblers_crown');
});
