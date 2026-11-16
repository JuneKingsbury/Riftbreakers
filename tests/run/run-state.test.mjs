// RunState: node flow, rewards, HP carry-over, recruits, shops, events and saving.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { RunState, MAX_PARTY } from '../../js/run/run-state.js';
import { battleRewards } from '../../js/run/data/encounters.js';
import { runOptions, newProfile, buyUnlock, recordRun, renownFor } from '../../js/run/profile.js';
import { EVENTS } from '../../js/run/data/events.js';
import { PROMOTION_LEVEL, XP_PER_LEVEL } from '../../js/tactical/loadout.js';

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

test('elites give a relic; bosses offer a relic choice and a promotion, then the next act', () => {
    const run = newRun(2);
    enter(run, 'elite');
    run.completeBattle(true);
    assert.equal(run.relics.length, 1);
    run.leaveNode();

    run.currentNodeId = run.map.floors[13][0].id;    // skip to the boss
    run.pending = null;
    const m = run.party[0];
    m.level = PROMOTION_LEVEL;
    assert.ok(!run.promote(m.name, 'paladin'), 'not at an ordinary node');
    run.enterNode(run.map.bossId);
    const reward = run.completeBattle(true);
    assert.ok(reward.boss && reward.relicPick && reward.relics.length === 3);
    assert.ok(run.claimRewardRelic(reward.relics[1]));
    assert.ok(run.relics.includes(reward.relics[1]));
    assert.ok(run.promote(m.name, 'paladin'));
    assert.equal(m.job, 'paladin');
    run.leaveNode();
    assert.equal(run.act, 2);
    assert.equal(run.currentNodeId, null);
    assert.equal(run.stats.bosses, 1);
});

test('winning the act 3 boss wins the run', () => {
    const run = newRun(3);
    run.act = 3;
    run.currentNodeId = run.map.floors[13][0].id;
    run.enterNode(run.map.bossId);
    run.completeBattle(true);
    run.leaveNode();
    assert.equal(run.status, 'won');
});

test('rest drills everyone, or trains one member, or promotes; only one per visit, and it tends wounds', () => {
    const run = newRun();
    const [a, b] = run.party;
    a.hp = 10;
    enter(run, 'rest');
    const xps = run.party.map(totalXp);
    assert.ok(run.drill());
    assert.deepEqual(run.party.map(totalXp), xps.map(x => x + run.options.drillXp));
    assert.equal(a.hp, null, 'wounds tended');
    assert.ok(!run.train(b.name), 'already rested');
    run.leaveNode();

    enter(run, 'rest');
    const sp = b.sp;
    assert.ok(run.train(b.name));
    assert.equal(b.sp, sp + 1, 'training gives a skill point');
    run.leaveNode();

    enter(run, 'rest');
    b.level = PROMOTION_LEVEL;
    assert.ok(run.promote(b.name, 'riftcaller'));
    assert.equal(b.origin, 'evoker');
    assert.ok(!run.drill(), 'promoting used the rest');
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

test('shop: buy and sell; equipping moves items and respects job armour types', () => {
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
    assert.equal(run.inventory.wool_tunic, 1, 'old armour back in the bag');
    assert.ok(!run.equip(warden.name, 'helmetKey', 'wool_tunic'), 'wrong slot');
});

test('equipment-granted passives are dropped from the loadout when the item comes off', () => {
    const run = newRun();
    const warden = run.party[0];
    warden.loadout.reaction = 'martyr';           // from the Iron Shield
    assert.ok(run.equip(warden.name, 'toolKey', null));
    assert.equal(warden.loadout.reaction, null);
});

test('events apply their effects and can lead to a battle or recruits', () => {
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

    enter(run, 'event');
    run.pending.eventId = 'lost_sellsword';
    assert.equal(run.chooseEvent(0).next, 'recruit');
    assert.equal(run.pending.kind, 'recruit');

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
