// "Equip now": for a newly gained item, who could wear it and what would change for each.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { equipOptions, canOfferEquip, rateSwap, statWeights } from '../../js/run/equip-options.js';
import { RunState } from '../../js/run/run-state.js';

// An Evoker and a Warden (both start with a Wooden Wand: MAT +3, MP +4) and a Runebow (bows only).
const party = () => RunState.create({ jobs: ['evoker', 'warden', 'runebow'], seed: 3 });

test('a better staff is an upgrade for each caster, and the archer is listed as unable to wear it', () => {
    // GIVEN: a Void Staff in the bag
    const run = party();
    run.addItem('void_staff');

    // WHEN: the options are worked out
    const { field, wearers, others } = equipOptions(run, 'void_staff');

    // THEN: both casters could wear it in place of their wand, gaining MAT and MP regen
    assert.equal(field, 'weaponKey');
    assert.deepEqual(wearers.map(w => w.member.job), ['evoker', 'warden']);
    for (const w of wearers) {
        assert.equal(w.current, 'wooden_wand');
        assert.equal(w.verdict, 'upgrade');
        assert.equal(w.delta.mat, 12);
        assert.equal(w.delta.mpRegen, 2);
    }
    assert.deepEqual(others.map(m => m.job), ['runebow']);
});

test('swapping gear that grants a skill shows the skill gained and the one lost', () => {
    // GIVEN: an Evoker wearing a Runic Wand (it grants Mirror Ward), and a Void Staff in the bag
    const run = party();
    const ev = run.party[0];
    ev.appearance.weaponKey = 'runic_wand';
    run.addItem('void_staff');

    // WHEN: the options are worked out
    const w = equipOptions(run, 'void_staff').wearers.find(x => x.member === ev);

    // THEN: Mirror Ward is listed as lost, but the staff's much bigger stats still make it an upgrade
    assert.deepEqual(w.loses, ['mirror_ward']);
    assert.deepEqual(w.gains, []);
    assert.equal(w.verdict, 'upgrade');
});

test('a worse item is a downgrade, and the same item is no change', () => {
    const run = party();
    const ev = run.party[0];
    ev.appearance.weaponKey = 'void_staff';
    run.addItem('wooden_wand');
    assert.equal(equipOptions(run, 'wooden_wand').wearers.find(x => x.member === ev).verdict, 'downgrade');
    ev.appearance.weaponKey = 'wooden_wand';
    assert.equal(equipOptions(run, 'wooden_wand').wearers.find(x => x.member === ev).verdict, 'same');
});

test('"Equip now" is offered only while the item is in the bag and someone can wear it', () => {
    const run = party();
    assert.equal(canOfferEquip(run, 'void_staff'), false, 'not in the bag');
    run.addItem('void_staff');
    assert.equal(canOfferEquip(run, 'void_staff'), true);
    assert.ok(run.equip(run.party[0].name, 'weaponKey', 'void_staff'));
    assert.equal(canOfferEquip(run, 'void_staff'), false, 'equipped, so no longer in the bag');

    run.addItem('war_axe');
    run.party.splice(0);   // nobody left to wear anything
    assert.equal(canOfferEquip(run, 'war_axe'), false);
});

test('an event that gives an item remembers which, for its "Equip now" button', () => {
    const run = party();
    run.pending = { kind: 'event', eventId: 'x', resolved: false };
    Object.defineProperty(run, 'currentEvent', { value: { choices: [{ label: 'Take it', effect: { item: 'common' }, resultText: 'You find {item}.' }] } });
    run.chooseEvent(0);
    assert.ok(run.pending.itemGained);
    assert.equal(run.inventory[run.pending.itemGained], 1);
});

// Class-aware verdicts: a change is weighed by how much the class uses each stat.
const warlord = { job: 'warlord', origin: null }, evoker = { job: 'evoker', origin: null };

test('a big gain in a stat the class lives on beats a small loss elsewhere', () => {
    // A fighter: ATK +8, DEF −1.
    assert.equal(rateSwap(warlord, { atk: 8, def: -1 }).verdict, 'upgrade');
});

test('gaining only stats the class barely uses is a minor change, not an upgrade', () => {
    const r = rateSwap(warlord, { mat: 4 });
    assert.equal(r.verdict, 'minor');
    assert.deepEqual(r.unused, ['mat'], 'shown dimmed in the picker');
});

test('more ATK for less MAT is a downgrade for a caster', () => {
    assert.equal(rateSwap(evoker, { atk: 6, mat: -1 }).verdict, 'downgrade');
});

test('a real trade-off that evens out is called one', () => {
    // A caster: MAT +2 for MDF −3 is about even.
    assert.equal(rateSwap(evoker, { mat: 2, mdf: -3 }).verdict, 'mixed');
});

test('classes without MP ignore MP gear; casters value it', () => {
    assert.equal(statWeights({ job: 'alchemist', origin: null }).mpRegen, 0);
    assert.equal(rateSwap({ job: 'alchemist', origin: null }, { maxMp: 10, mpRegen: 2 }).verdict, 'minor');
    assert.equal(rateSwap(evoker, { mpRegen: 2 }).verdict, 'upgrade');
});

test('offense weights follow the class\'s skills, not just its base stats', () => {
    // The Runebow has more MAT than ATK, but most of its attacks are physical.
    const w = statWeights({ job: 'runebow', origin: null });
    assert.ok(w.atk > w.mat);
    // A promoted member counts both kits: a Battlemage (from the Evoker) leans magic.
    const bm = statWeights({ job: 'battlemage', origin: 'evoker' });
    assert.ok(bm.mat >= bm.atk && bm.atk > 0);
});

test('the member an item suits best is marked as the best fit', () => {
    // GIVEN: the Evoker has a Wooden Wand and the Warden a better staff already
    const run = party();
    const [ev, wa] = run.party;
    wa.appearance.weaponKey = 'crystal_staff';
    run.addItem('void_staff');

    // WHEN: the options are worked out
    const { wearers } = equipOptions(run, 'void_staff');

    // THEN: both gain, but the Evoker gains more, so the Evoker is the best fit
    assert.deepEqual(wearers.filter(w => w.best).map(w => w.member), [ev]);
});

// Auto-equip: new gear goes to whoever it helps most, without ever making anything worse.
import { autoEquip, isStrictUpgrade } from '../../js/run/equip-options.js';

test('auto-equip gives a new item to the member it helps most', () => {
    // GIVEN: the Warden already has a Crystal Staff, the Evoker only a Wooden Wand
    const run = party();
    const [ev, wa] = run.party;
    wa.appearance.weaponKey = 'crystal_staff';
    run.addItem('void_staff');

    // WHEN: a Void Staff arrives
    const moves = autoEquip(run, 'void_staff');

    // THEN: the Evoker gets it, and the Wooden Wand goes to the bag (no one is helped by it)
    assert.equal(ev.appearance.weaponKey, 'void_staff');
    assert.deepEqual(moves.map(m => [m.key, m.name]), [['void_staff', ev.name], ['wooden_wand', null]]);
    assert.equal(run.inventory.wooden_wand, 1);
});

test('what a member takes off is passed on to someone it is an upgrade for', () => {
    // GIVEN: a Seer in a Wool Parka and an Evoker in a Cotton Shirt
    const run = RunState.create({ jobs: ['evoker', 'seer'], seed: 3 });
    const [ev, seer] = run.party;
    ev.appearance.armorKey = 'cotton_shirt';
    seer.appearance.armorKey = 'wool_parka';
    run.addItem('thornweave_vest');

    // WHEN: a Thornweave Vest arrives (light armor: only the Seer can wear it)
    const moves = autoEquip(run, 'thornweave_vest');

    // THEN: the Seer takes it, her Wool Parka goes to the Evoker, and the shirt to the bag
    assert.equal(seer.appearance.armorKey, 'thornweave_vest');
    assert.equal(ev.appearance.armorKey, 'wool_parka');
    assert.deepEqual(moves.map(m => [m.key, m.name]), [['thornweave_vest', seer.name], ['wool_parka', ev.name], ['cotton_shirt', null]]);
    assert.deepEqual(run.inventory, { cotton_shirt: 1 });
});

test('auto-equip never makes a trade: losing a skill or a used stat keeps the item in the bag', () => {
    // GIVEN: the Evoker wears a Runic Wand (it grants Mirror Ward) and the Warden a Void Staff
    const run = party();
    const [ev, wa] = run.party;
    ev.appearance.weaponKey = 'runic_wand';
    wa.appearance.weaponKey = 'void_staff';
    run.addItem('void_staff');

    // WHEN: another Void Staff arrives: better stats for the Evoker, but Mirror Ward would go
    const moves = autoEquip(run, 'void_staff');

    // THEN: nothing moves (the picker still offers it as an Upgrade, by hand)
    assert.deepEqual(moves, []);
    assert.equal(ev.appearance.weaponKey, 'runic_wand');
    const w = equipOptions(run, 'void_staff').wearers.find(x => x.member === ev);
    assert.equal(w.verdict, 'upgrade');
    assert.equal(isStrictUpgrade(w), false);
});
