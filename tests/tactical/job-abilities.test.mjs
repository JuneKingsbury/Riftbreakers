// Every player job's kit (actions, reaction, support, movement) and the
// mechanics those abilities rely on.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { gridMap } from '../map-fixtures.mjs';
import { JOB_DATA } from '../../js/tactical/data/jobs.js';
import { ABILITIES } from '../../js/tactical/data-registry.js';
import { createUnit } from '../../js/tactical/units.js';
import { resolveAbility, inflictStatus } from '../../js/tactical/abilities.js';
import { abilitySlot } from '../../js/tactical/loadout.js';
import { TacticalBattle } from '../../js/tactical/battle.js';

const map = gridMap(Array.from({ length: 7 }, () => '.'.repeat(12)));

function withRandom(value, fn) {
    const orig = Math.random;
    Math.random = () => value;
    try { return fn(); } finally { Math.random = orig; }
}

const unit = (name, job, team, x, y, extra = {}) =>
    Object.assign(createUnit(name, job, team, x, y, { level: 8 }), { reaction: null, support: null, movement: null, eva: 0 }, extra);

const playerJobs = Object.keys(JOB_DATA).filter(j => JOB_DATA[j].learnable);

test('every player job has its own skillset plus a reaction, support and movement ability', () => {
    const owner = {};
    for (const job of playerJobs) {
        const keys = Object.keys(JOB_DATA[job].learnable);
        for (const k of keys) assert.ok(ABILITIES[k], `${job}: unknown ability ${k}`);
        for (const slot of ['action', 'reaction', 'support', 'movement']) {
            assert.ok(keys.some(k => abilitySlot(k) === slot), `${job} has a ${slot} ability`);
        }
        for (const k of keys) {
            assert.ok(!owner[k], `${k} is taught by both ${owner[k]} and ${job}`);
            owner[k] = job;
        }
    }
});

// ---- Supports ----

test('Iron Will blocks stun; Wyrd Drain lengthens inflicted statuses', () => {
    const warden = unit('W', 'warden', 'player', 1, 1, { support: 'iron_will' });
    assert.equal(inflictStatus(warden, 'stun', 1), false);
    assert.ok(!warden.status.includes('stun'));
    assert.equal(inflictStatus(warden, 'poison', 2), true, 'other statuses still land');

    const fate = unit('F', 'fatebinder', 'player', 1, 1, { support: 'wyrd_drain' });
    const foe = unit('E', 'goblin', 'enemy', 2, 1);
    inflictStatus(foe, 'slow', 2, fate);
    assert.equal(foe.statusTimers.slow, 3);
});

test('Concentrate ignores evasion', () => {
    const archer = unit('A', 'runebow', 'player', 1, 1);
    const dodgy = () => unit('E', 'goblin', 'enemy', 2, 1, { eva: 100 });
    // A side attack halves the target's 100 evasion to 50%, so a 0.1 roll is a dodge.
    assert.ok(withRandom(0.1, () => resolveAbility(archer, dodgy(), 'attack', map)).missed);
    archer.support = 'concentrate';
    assert.ok(!withRandom(0.1, () => resolveAbility(archer, dodgy(), 'attack', map)).missed);
});

test('Spell Pierce, Arcane Weapon and Bloodlust raise damage', () => {
    const dmg = (src, key) => withRandom(0.5, () => resolveAbility(src, unit('E', 'kingdom_guard', 'enemy', 2, 1), key, map).damage);
    const rift = unit('R', 'riftcaller', 'player', 1, 1);
    const base = dmg(rift, 'rift_bolt');
    rift.support = 'spell_pierce';
    assert.ok(dmg(rift, 'rift_bolt') > base);

    const bm = unit('B', 'battlemage', 'player', 1, 1);
    const plain = dmg(bm, 'attack');
    bm.support = 'arcane_weapon';
    assert.ok(dmg(bm, 'attack') > plain);

    const beast = unit('C', 'beastcaller', 'player', 1, 1, { support: 'bloodlust' });
    const healthy = dmg(beast, 'attack');
    beast.hp = 5;
    assert.ok(dmg(beast, 'attack') > healthy);
});

test('Providence survives one killing blow per battle', () => {
    const seer = unit('L', 'lifeseer', 'player', 1, 1, { support: 'providence', hp: 3 });
    const brute = unit('E', 'orc_captain', 'enemy', 2, 1);
    const first = withRandom(0.5, () => resolveAbility(brute, seer, 'attack', map));
    assert.ok(first.providence);
    assert.equal(seer.hp, 1);
    withRandom(0.5, () => resolveAbility(brute, seer, 'attack', map));
    assert.equal(seer.hp, 0, 'only once');
});

test('Swiftcast halves charge time and JP Boost raises JP', () => {
    const seer = unit('S', 'seer', 'player', 1, 1, { support: 'swiftcast' });
    const battle = new TacticalBattle(map, [seer, unit('E', 'goblin', 'enemy', 5, 1)]);
    battle.applyEnemyAbility(seer, 'fire', 3, 1);
    assert.equal(seer._charging.needed, Math.round(ABILITIES.fire.chargeTime / 2));

    const novice = unit('N', 'novice', 'player', 1, 1, { jpEligible: true, jobLv: 1 });
    const b2 = new TacticalBattle(map, [novice]);
    b2._awardJp(novice);
    novice.support = 'jp_boost';
    b2._awardJp(novice);
    assert.equal(b2.jpEarned.N.novice, 10 + 15);
});

test('Spirit Pact strengthens summons', () => {
    const binder = unit('S', 'spiritbinder', 'player', 1, 1, { support: 'spirit_pact' });
    const battle = new TacticalBattle(map, [binder]);
    const wisp = battle._resolveSummon(binder, ABILITIES.call_wisp, 2, 1);
    const plain = createUnit('W', 'spectral_wisp', 'player', 0, 0);
    assert.ok(wisp.maxHp > plain.maxHp && wisp.mat > plain.mat);
});

// ---- Actions ----

test('Focus buffs the caster; Draining Edge heals; Sunder lowers DEF', () => {
    const nov = unit('N', 'novice', 'player', 1, 1);
    const r = resolveAbility(nov, nov, 'focus', map);
    assert.equal(r.floatingText, 'Focus!');
    assert.equal(nov.buffs.filter(b => b.key === 'focus').length, 2);

    const blade = unit('B', 'spellblade', 'player', 1, 1, { hp: 10 });
    const foe = unit('E', 'kingdom_guard', 'enemy', 2, 1);
    const hit = withRandom(0.5, () => resolveAbility(blade, foe, 'draining_edge', map));
    assert.ok(hit.drained > 0 && blade.hp === 10 + hit.drained);
    withRandom(0.5, () => resolveAbility(blade, foe, 'sunder', map));
    assert.ok(foe.buffs.some(b => b.stat === 'def' && b.value < 0));
});

test('Unravel strips protections; Death Sentence fells the target when it runs out', () => {
    const fate = unit('F', 'fatebinder', 'player', 1, 1);
    const foe = unit('E', 'kingdom_guard', 'enemy', 4, 1);
    inflictStatus(foe, 'protect', 3);
    foe.buffs.push({ key: 'x', stat: 'def', value: 5, duration: 2 });
    resolveAbility(fate, foe, 'unravel', map);
    assert.ok(!foe.status.includes('protect') && foe.buffs.length === 0);

    const battle = new TacticalBattle(map, [fate, foe]);
    withRandom(0.5, () => resolveAbility(fate, foe, 'death_sentence', map));
    assert.ok(foe.status.includes('doom'));
    for (let i = 0; i < 3; i++) battle.startTurn(foe);
    assert.equal(foe.hp, 0);
    assert.ok(foe.status.includes('unconscious'));
});

// ---- Reactions ----

test('Martyr takes half of an adjacent ally\'s wound', () => {
    const pal = unit('P', 'paladin', 'player', 2, 1, { reaction: 'martyr' });
    const ally = unit('A', 'evoker', 'player', 3, 1);
    const foe = unit('E', 'orc_captain', 'enemy', 4, 1);
    const battle = new TacticalBattle(map, [pal, ally, foe]);
    withRandom(0.1, () => battle.applyEnemyAbility(foe, 'attack', ally.x, ally.y));
    const taken = ally.maxHp - ally.hp;
    const shared = pal.maxHp - pal.hp;
    assert.ok(shared > 0, 'paladin took some of the blow');
    assert.ok(Math.abs(taken - shared) <= 1, `split evenly (${taken} vs ${shared})`);
});

test('Thorn Hide hurts melee attackers; Purifying Light cleanses afflictions', () => {
    const singer = unit('W', 'worldsinger', 'player', 2, 1, { reaction: 'thorn_hide' });
    const foe = unit('E', 'orc_captain', 'enemy', 3, 1);
    const battle = new TacticalBattle(map, [singer, foe]);
    withRandom(0.5, () => battle.applyEnemyAbility(foe, 'attack', singer.x, singer.y));
    assert.ok(foe.hp < foe.maxHp);

    const sanct = unit('S', 'sanctifier', 'player', 2, 3, { reaction: 'purifying_light' });
    const hexer = unit('H', 'shadow_mage', 'enemy', 4, 3);
    const b2 = new TacticalBattle(map, [sanct, hexer]);
    withRandom(0.1, () => b2.applyEnemyAbility(hexer, 'mute', sanct.x, sanct.y));
    assert.ok(!sanct.status.includes('silence'));
});

test('Phase Shift teleports away; Call of the Pack summons a wolf', () => {
    const rift = unit('R', 'riftcaller', 'player', 5, 3, { reaction: 'phase_shift' });
    const foe = unit('E', 'orc_captain', 'enemy', 6, 3);
    const battle = new TacticalBattle(map, [rift, foe]);
    withRandom(0.1, () => battle.applyEnemyAbility(foe, 'attack', rift.x, rift.y));
    assert.ok(Math.abs(rift.x - foe.x) + Math.abs(rift.y - foe.y) > 1, 'no longer adjacent');

    // 30 HP survives the ~24-damage hit and lands below 30% of max HP.
    const beast = unit('C', 'beastcaller', 'player', 5, 3, { reaction: 'call_of_the_pack', hp: 30 });
    const b2 = new TacticalBattle(map, [beast, foe]);
    withRandom(0.1, () => b2.applyEnemyAbility(foe, 'attack', beast.x, beast.y));
    assert.ok(beast.hp > 0 && beast.hp < beast.maxHp * 0.3, `hp ${beast.hp}`);
    assert.ok(b2.units.some(u => u.name === 'Wolf'));
});

// ---- Movement ----

test('after-move effects: Hallowed Step heals neighbours, Omen Step delays enemies, Momentum adds damage', () => {
    const pal = unit('P', 'paladin', 'player', 2, 1, { movement: 'hallowed_step' });
    const ally = unit('A', 'evoker', 'player', 3, 1, { hp: 5 });
    const foe = unit('E', 'goblin', 'enemy', 2, 2, { ct: 50 });
    const battle = new TacticalBattle(map, [pal, ally, foe]);
    battle.afterMove(pal, [{ x: 2, y: 1 }]);
    assert.ok(ally.hp > 5);

    const fate = unit('F', 'fatebinder', 'player', 1, 2, { movement: 'omen_step' });
    battle.units.push(fate);
    battle.afterMove(fate, [{ x: 1, y: 2 }]);
    assert.equal(foe.ct, 35);

    const blade = unit('B', 'spellblade', 'player', 1, 1, { movement: 'momentum' });
    const dmg = () => withRandom(0.5, () => resolveAbility(blade, unit('T', 'kingdom_guard', 'enemy', 2, 1), 'attack', map).damage);
    const still = dmg();
    battle.afterMove(blade, [{}, {}, {}, {}]);
    assert.ok(dmg() > still);
});

test('Take Root heals at the end of a turn spent standing still', () => {
    const singer = unit('W', 'worldsinger', 'player', 1, 1, { movement: 'take_root', hp: 10 });
    const battle = new TacticalBattle(map, [singer, unit('E', 'goblin', 'enemy', 8, 1)]);
    battle.startTurn(singer);
    battle.endTurn(60);
    assert.ok(singer.hp > 10);

    singer.hp = 10;
    battle.startTurn(singer);
    battle.afterMove(singer, [{ x: 1, y: 1 }]);
    battle.endTurn(60);
    assert.equal(singer.hp, 10, 'no heal after moving');
});
