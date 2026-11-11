// Job points, learning abilities, loadout slots, and the reaction/support/movement
// effects they equip.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { gridMap } from '../map-fixtures.mjs';
import { createUnit, createUnitFromCharData } from '../../js/tactical/units.js';
import { jobLevel, meetsPrerequisites } from '../../js/tactical/data-registry.js';
import { resolveAbility, computeMoveRange, computeMovePath } from '../../js/tactical/abilities.js';
import { availableJp, canLearn, learnAbility, buildLoadout, equippable, sanitizeLoadout, jpPerAction, scaledLoadout } from '../../js/tactical/loadout.js';
import { buildUnits } from '../../js/tactical/build-units.js';
import { BATTLE_SCENARIOS } from '../../js/tactical/world-map-data.js';
import { TacticalBattle } from '../../js/tactical/battle.js';
import { WorldMap } from '../../js/tactical/world-map.js';

function field(rowChar = () => '.') {
    const rows = [];
    for (let y = 0; y < 7; y++) {
        rows.push(Array.from({ length: 16 }, (_, x) => rowChar(x, y)).join(''));
    }
    return gridMap(rows);
}

const member = (over = {}) => ({
    name: 'Test', job: 'spellblade', team: 'player', x: 3, y: 3,
    jp: { novice: 250, spellblade: 100 }, jpSpent: {}, learned: ['hex'],
    loadout: { secondary: null, reaction: null, support: null, movement: null },
    ...over,
});

function withRandom(value, fn) {
    const orig = Math.random;
    Math.random = () => value;
    try { return fn(); } finally { Math.random = orig; }
}

test('job level comes from total JP earned and gates job prerequisites', () => {
    assert.equal(jobLevel({}, 'novice'), 1);
    assert.equal(jobLevel({ novice: 199 }, 'novice'), 1);
    assert.equal(jobLevel({ novice: 200 }, 'novice'), 2);
    assert.equal(jobLevel({ novice: 3000 }, 'novice'), 8);
    assert.ok(!meetsPrerequisites({ novice: 100 }, 'evoker'));
    assert.ok(meetsPrerequisites({ novice: 250 }, 'evoker'));
});

test('learning spends that job\'s JP, refuses when short, and never lowers the level', () => {
    const m = member({ jp: { novice: 250, spellblade: 450 } });
    assert.ok(!canLearn(m, 'spellblade', 'hex'), 'already learned');
    assert.ok(learnAbility(m, 'spellblade', 'counter'));            // 300
    assert.equal(availableJp(m, 'spellblade'), 150);
    assert.equal(jobLevel(m.jp, 'spellblade'), 3, 'level is from JP earned, not unspent');
    assert.ok(!learnAbility(m, 'spellblade', 'mute'), 'mute costs 350');
    assert.ok(!learnAbility(m, 'spellblade', 'fire'), 'fire is not a Spellblade ability');
    assert.ok(learnAbility(m, 'novice', 'focus'), 'novice JP buys novice abilities');
    assert.equal(availableJp(m, 'novice'), 150);
});

test('loadout: primary + secondary skillsets hold only learned actions; slots hold learned abilities', () => {
    const m = member({ learned: ['hex', 'focus', 'fire', 'counter', 'mana_surge', 'move_plus_1'] });
    m.loadout = { secondary: 'novice', reaction: 'counter', support: 'mana_surge', movement: 'move_plus_1' };
    const lo = buildLoadout(m);
    assert.deepEqual(lo.abilities, ['attack', 'hex', 'focus'], 'fire is learned but its Evocation skillset is not equipped');
    assert.deepEqual(lo.skillsets.map(s => s.name), ['Runeblade', 'Fundamentals']);
    assert.equal(lo.reaction, 'counter');
    assert.equal(lo.support, 'mana_surge');
    assert.deepEqual(equippable(m, 'secondary'), ['novice', 'evoker']);
    assert.deepEqual(equippable({ ...m, jp: { spellblade: 100 } }, 'secondary'), ['novice'], 'locked jobs are not offered');

    const unit = createUnitFromCharData(m);
    assert.equal(unit.move, 4, 'Move +1 is folded into move');
    assert.ok(unit.jpEligible);

    m.job = 'novice';
    sanitizeLoadout(m);
    assert.equal(m.loadout.secondary, null, 'secondary cannot be the current job');
    assert.equal(m.loadout.reaction, 'counter', 'other slots survive a job change');
});

test('Mana Surge only boosts magic when equipped as Support', () => {
    const map = field();
    const foe = () => createUnit('Foe', 'goblin', 'enemy', 5, 3);
    const plain = createUnit('A', 'evoker', 'player', 3, 3);
    const surged = Object.assign(createUnit('B', 'evoker', 'player', 3, 3), { support: 'mana_surge' });
    const dmgPlain = withRandom(0.5, () => resolveAbility(plain, foe(), 'fire', map).damage);
    const dmgSurge = withRandom(0.5, () => resolveAbility(surged, foe(), 'fire', map).damage);
    assert.ok(dmgSurge > dmgPlain, `${dmgSurge} > ${dmgPlain}`);
});

test('Counter strikes back once, and a counter never triggers another counter', () => {
    const map = field();
    const blade = Object.assign(createUnit('Blade', 'spellblade', 'player', 4, 3), { reaction: 'counter', eva: 0 });
    const gob   = Object.assign(createUnit('Gob', 'goblin', 'enemy', 5, 3), { reaction: 'counter', eva: 0 });
    const battle = new TacticalBattle(map, [blade, gob]);
    const gobHp = gob.hp;
    withRandom(0.1, () => battle.applyEnemyAbility(gob, 'goblin_slash', blade.x, blade.y));
    assert.ok(gob.hp < gobHp, 'goblin took counter damage');
    assert.equal(battle.log.filter(l => l.includes('reacts')).length, 1);

    // Out of reach: a ranged hit cannot be countered in melee.
    const far = Object.assign(createUnit('Archer', 'raider_archer', 'enemy', 8, 3), { eva: 0 });
    const b2 = new TacticalBattle(map, [blade, far]);
    withRandom(0.1, () => b2.applyEnemyAbility(far, 'long_shot', blade.x, blade.y));
    assert.equal(b2.log.filter(l => l.includes('reacts')).length, 0);
});

test('movement abilities change the move range', () => {
    const map = field();
    const base = createUnit('A', 'novice', 'player', 7, 3);
    const plus = Object.assign(createUnit('B', 'novice', 'player', 7, 3, { loadout: { abilities: ['attack'], movement: 'move_plus_1' } }));
    assert.ok(computeMoveRange(plus, map, [plus]).size > computeMoveRange(base, map, [base]).size);

    // Stone Stride: rubble costs 1 instead of 2.
    const rubble = field(() => ':');
    const walker = createUnit('C', 'stoneshaper', 'player', 7, 3);
    const strider = Object.assign(createUnit('D', 'stoneshaper', 'player', 7, 3), { movement: 'stone_stride' });
    assert.ok(computeMoveRange(strider, rubble, [strider]).size > computeMoveRange(walker, rubble, [walker]).size);

    // Blink: walk through a ring of allies, but never stop on one.
    const blinker = Object.assign(createUnit('E', 'riftcaller', 'player', 7, 3), { movement: 'blink' });
    const ring = [[6, 3], [8, 3], [7, 2], [7, 4]].map(([x, y], i) => createUnit(`R${i}`, 'novice', 'player', x, y));
    const stuck = createUnit('F', 'riftcaller', 'player', 7, 3);
    assert.equal(computeMoveRange(stuck, map, [stuck, ...ring]).size, 0);
    const range = computeMoveRange(blinker, map, [blinker, ...ring]);
    assert.ok(range.size > 0);
    for (const r of ring) assert.ok(!range.has(`${r.x},${r.y},${r.z}`));
});

test('climb abilities reach ledges the base climb limit cannot', () => {
    // Unit at (1,1) on the ground; a 2-high ledge at x=3 and a 4-high one at x=5.
    const rows = ['.......', '.......', '.......'];
    const elev = ['0002204', '0002204', '0002204'];
    const ledges = gridMap(rows, elev);
    const at = (unit, x, y) => [...computeMoveRange(unit, ledges, [unit])].some(k => k.startsWith(`${x},${y},`));
    const mk = (movement) => Object.assign(createUnit('U', 'seer', 'player', 1, 1), { move: 6, movement });

    assert.ok(!at(mk(null), 3, 1), 'base climb (1) cannot step up 2');
    assert.ok(at(mk('fleet_step'), 3, 1), 'Climb +1 reaches a 2-high ledge');
    assert.ok(!at(mk('fleet_step'), 6, 1), 'but not a 4-high one');
    assert.ok(at(mk('featherstep'), 3, 1), 'Climb +2 reaches the 2-high ledge');
    assert.ok(at(mk('blink'), 6, 1), 'Blink ignores elevation entirely');

    const climber = mk('featherstep');
    const path = computeMovePath(climber, ledges, [climber], 3, 1);
    assert.ok(path && path.at(-1).z === 2, 'path ends on top of the ledge');
});

test('per-action JP, spillover and the victory bonus are applied by completeBattle', () => {
    const wm = new WorldMap();
    const [a, b] = wm.party;
    const before = { a: { ...a.jp }, b: { ...b.jp } };
    const earned = { [a.name]: { [a.job]: jpPerAction(1) * 5 } };   // 50 JP
    const rewards = wm.completeBattle('bandit_ambush', true, earned);

    assert.equal(a.jp[a.job], before.a[a.job] + 50 + 40);
    // b can take a's job only if b meets its prerequisites (all Tier 1 need Novice Lv.2).
    assert.equal(b.jp[a.job] || 0, (before.b[a.job] || 0) + 12);
    assert.equal(b.jp[b.job], before.b[b.job] + 40);
    assert.equal(rewards.jpGained[a.name], 90);

    // Action JP is kept on defeat, with no victory bonus.
    const lost = wm.completeBattle('bandit_ambush', false, { [a.name]: { [a.job]: 10 } });
    assert.equal(lost.won, false);
    assert.equal(lost.jpGained[a.name], 10);
});

test('a battle records JP for party units only', () => {
    const map = field();
    const m = createUnitFromCharData(member({ x: 4, y: 3 }));
    const foe = Object.assign(createUnit('Gob', 'goblin', 'enemy', 5, 3), { eva: 0 });
    const battle = new TacticalBattle(map, [m, foe]);
    withRandom(0.5, () => {
        battle.applyEnemyAbility(m, 'attack', foe.x, foe.y);
        battle.applyEnemyAbility(foe, 'goblin_slash', m.x, m.y);
    });
    assert.deepEqual(battle.jpEarned, { Test: { spellblade: jpPerAction(1) } });
});

test('enemies on player jobs know only what a player could have learned by the encounter level', () => {
    assert.deepEqual(scaledLoadout('evoker', 1).abilities, ['attack', 'fire']);
    assert.deepEqual(scaledLoadout('evoker', 2).abilities, ['attack', 'fire', 'ice'], 'fire free + 200 JP');
    assert.deepEqual(scaledLoadout('evoker', 3).abilities, ['attack', 'fire', 'ice', 'thunder'], 'fire free + 400 JP');
    assert.ok(!scaledLoadout('evoker', 3).abilities.includes('flare'), 'no Flare at Lv.3');
    const strong = scaledLoadout('evoker', 8);
    assert.ok(strong.abilities.includes('flare'));
    assert.equal(strong.support, 'mana_surge');
    assert.equal(scaledLoadout('evoker', 1).support, null);

    // A bare createUnit on a player job defaults to Lv.1, not the whole skillset.
    assert.deepEqual(createUnit('E', 'paladin', 'enemy', 0, 0).abilities, ['attack', 'smite']);
    assert.deepEqual(createUnit('E', 'paladin', 'enemy', 0, 0, { level: 2 }).abilities, ['attack', 'smite', 'heal']);
});

test('roster entries on player jobs use the scenario enemyLevel, or their own level', () => {
    const id = '__test_scaled';
    BATTLE_SCENARIOS[id] = {
        enemyLevel: 1,
        roster: [{ job: 'evoker', name: 'Weak' }, { job: 'evoker', name: 'Boss', level: 6 }],
    };
    try {
        const units = buildUnits(null, id, [], []);
        const weak = units.find(u => u.name === 'Weak');
        const boss = units.find(u => u.name === 'Boss');
        assert.deepEqual(weak.abilities, ['attack', 'fire']);
        assert.ok(boss.abilities.includes('thunder'));
        assert.ok(!weak.jpEligible && !boss.jpEligible, 'enemies earn no JP');
    } finally {
        delete BATTLE_SCENARIOS[id];
    }
});
