// Enchanting: rest sites can enchant an owned item to +1 and then +2, and items are very
// rarely found already enchanted. An enchanted item is an ordinary item key ('x+1'), so it
// equips, sells, saves and fights like any other.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { RunState, FOUND_ENCHANT_CHANCE, ELITE_ENCHANT_MULT } from '../../js/run/run-state.js';
import {
    EQUIPMENT, MAX_ENCHANT, equipmentStatBonuses, baseItemKey, enchantLevel, enchantedKey, canEnchant, itemPrice, itemName,
} from '../../js/tactical/data/equipment.js';
import { runOptions, newProfile, buyUnlock } from '../../js/run/profile.js';

const newRun = (seed = 1, options) => RunState.create({ jobs: ['warden', 'evoker', 'runebow'], seed, ...(options ? { options } : {}) });

function restAt(run) {
    const id = run.reachable()[0];
    run.map.nodes[id].type = 'rest';
    run.enterNode(id);
}

test('enchanted keys name their base item and level', () => {
    assert.equal(baseItemKey('iron_sword+2'), 'iron_sword');
    assert.equal(baseItemKey('iron_sword'), 'iron_sword');
    assert.equal(enchantLevel('iron_sword+1'), 1);
    assert.equal(enchantLevel('iron_sword'), 0);
    assert.equal(enchantedKey('iron_sword+1', 2), 'iron_sword+2');
    assert.equal(itemName('iron_sword+1'), 'Iron Sword +1');
    assert.ok(canEnchant('iron_sword+1'));
    assert.ok(!canEnchant(`iron_sword+${MAX_ENCHANT}`));
    assert.ok(!canEnchant('not_an_item'));
});

test('each enchant level raises an item\'s stats and keeps what it is', () => {
    const base = EQUIPMENT.iron_sword, plus1 = EQUIPMENT['iron_sword+1'], plus2 = EQUIPMENT['iron_sword+2'];
    assert.ok(plus1.atk > base.atk && plus2.atk > plus1.atk);
    for (const f of ['slot', 'type', 'rarity']) assert.equal(plus2[f], base[f], f);
    // An item granting an ability still grants it, and even an item without combat stats improves.
    assert.deepEqual(EQUIPMENT['lantern+1'].grants, EQUIPMENT.lantern.grants);
    assert.ok((EQUIPMENT['lantern+1'].maxHp || 0) > (EQUIPMENT.lantern.maxHp || 0));
    // No item loses a stat, and movement and speed never change.
    for (const key of Object.keys(EQUIPMENT)) {
        const a = EQUIPMENT[key], b = EQUIPMENT[`${key}+2`];
        for (const s of ['atk', 'def', 'mat', 'mdf', 'maxHp', 'maxMp']) assert.ok((b[s] || 0) >= (a[s] || 0), `${key} ${s}`);
        for (const s of ['spd', 'move', 'eva']) assert.equal(b[s] || 0, a[s] || 0, `${key} ${s}`);
    }
});

test('enchanted variants never appear in loops over the item list', () => {
    assert.ok(Object.keys(EQUIPMENT).every(k => enchantLevel(k) === 0));
    assert.ok(EQUIPMENT['iron_sword+1'], 'but can be looked up');
});

test('enchanting an equipped weapon at a rest makes its wearer stronger', () => {
    const run = newRun();
    const m = run.party[1];
    const before = equipmentStatBonuses(m.appearance);
    restAt(run);
    assert.ok(run.enchant({ member: m.name, field: 'weaponKey' }));
    assert.equal(enchantLevel(m.appearance.weaponKey), 1);
    const after = equipmentStatBonuses(m.appearance);
    const gained = Object.keys(after).filter(s => (after[s] || 0) > (before[s] || 0));
    assert.ok(gained.length > 0, 'a stat went up');
    assert.ok(Object.keys(before).every(s => after[s] >= before[s]), 'none went down');
});

test('an item in the bag can be enchanted to +2 over two rests, and no further', () => {
    const run = newRun();
    run.addItem('iron_sword');
    restAt(run);
    assert.ok(run.enchant({ item: 'iron_sword' }));
    assert.deepEqual(run.inventory, { 'iron_sword+1': 1 });
    run.leaveNode();
    restAt(run);
    assert.ok(!run.enchant({ item: 'iron_sword' }), 'the plain sword is gone');
    assert.ok(run.enchant({ item: 'iron_sword+1' }));
    run.leaveNode();
    restAt(run);
    assert.ok(!run.enchant({ item: 'iron_sword+2' }), '+2 is the most');
    assert.ok(run.train(), 'the rest is still unused');
});

test('enchanting needs a rest, an owned item and a real slot', () => {
    const run = newRun();
    run.addItem('iron_sword');
    assert.ok(!run.enchant({ item: 'iron_sword' }), 'not at a rest');
    restAt(run);
    assert.ok(!run.enchant({ item: 'void_mattock' }), 'not owned');
    assert.ok(!run.enchant({ member: run.party[0].name, field: 'nonsense' }));
    assert.ok(!run.enchant({ member: 'Nobody', field: 'weaponKey' }));
    assert.ok(!run.enchant(null));
});

test('with Master Trainer, enchanting also gives everyone XP', () => {
    const profile = newProfile();
    profile.renown = 999;
    buyUnlock(profile, 'drillmaster');
    const run = newRun(1, runOptions(profile));
    const xp = run.party.map(m => m.xp + m.level * 100);
    restAt(run);
    run.enchant({ member: run.party[0].name, field: 'weaponKey' });
    assert.deepEqual(run.party.map(m => m.xp + m.level * 100), xp.map(x => x + 25));
});

test('enchanted items sell for more, and equip, unequip and sell like any other', () => {
    assert.ok(itemPrice('iron_sword+1') > itemPrice('iron_sword'));
    assert.ok(itemPrice('iron_sword+2') > itemPrice('iron_sword+1'));
    const run = newRun();
    const m = run.party[1];
    run.addItem('wooden_wand+2');
    assert.ok(run.equip(m.name, 'weaponKey', 'wooden_wand+2'));
    assert.equal(m.appearance.weaponKey, 'wooden_wand+2');
    assert.ok(run.equip(m.name, 'weaponKey', null));
    assert.equal(run.inventory['wooden_wand+2'], 1);
    assert.ok(run.sellPrice('wooden_wand+2') > run.sellPrice('wooden_wand'));
});

test('an enchanted item survives saving and loading', () => {
    const run = newRun();
    restAt(run);
    run.enchant({ member: run.party[0].name, field: 'armorKey' });
    run.addItem('iron_sword+1');
    const loaded = RunState.deserialize(run.serialize());
    assert.equal(enchantLevel(loaded.party[0].appearance.armorKey), 1);
    assert.equal(loaded.inventory['iron_sword+1'], 1);
});

test('items are only rarely found already enchanted, and more often from elites and bosses', () => {
    const run = newRun(7);
    const N = 20000;
    const share = (kind) => {
        const counts = [0, 0, 0];
        for (let i = 0; i < N; i++) counts[enchantLevel(run._maybeEnchant('iron_sword', kind))]++;
        return counts.map(c => c / N);
    };
    const normal = share('normal'), elite = share('elite');
    const near = (x, want, tol) => assert.ok(Math.abs(x - want) < tol, `${x} not near ${want}`);
    near(normal[1], FOUND_ENCHANT_CHANCE.plus1, 0.006);
    near(normal[2], FOUND_ENCHANT_CHANCE.plus2, 0.002);
    near(elite[1], FOUND_ENCHANT_CHANCE.plus1 * ELITE_ENCHANT_MULT, 0.01);
    near(elite[2], FOUND_ENCHANT_CHANCE.plus2 * ELITE_ENCHANT_MULT, 0.003);

    // The same seed always finds the same items.
    const a = newRun(11), b = newRun(11);
    assert.deepEqual(a._rollItems({ common: 1 }, 40, 'boss'), b._rollItems({ common: 1 }, 40, 'boss'));
});
