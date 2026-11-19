// Battle rules that builds lean on: MP recovers a little every turn, a counter or reflex
// heal is as strong as the reactor's own rank of that skill, and Doom wounds bosses rather
// than felling them, on a timer that duration bonuses don't stretch.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { gridMap } from '../map-fixtures.mjs';
import { RunState } from '../../js/run/run-state.js';
import { buildUnits } from '../../js/tactical/build-units.js';
import { TacticalBattle } from '../../js/tactical/battle.js';
import { inflictStatus } from '../../js/tactical/abilities.js';
import { tryReaction } from '../../js/tactical/reactions.js';

const field = () => gridMap(Array.from({ length: 6 }, () => '.'.repeat(10)));

function withRandom(value, fn) {
    const orig = Math.random;
    Math.random = () => value;
    try { return fn(); } finally { Math.random = orig; }
}

// A Runebow and an Alchemist against two goblins; `kind: 'boss'` makes Goblin A the boss.
function fight(kind = 'normal') {
    const run = RunState.create({ jobs: ['runebow', 'alchemist'], seed: 11 });
    const encounter = { kind, enemyLevel: 1, roster: [{ job: 'goblin', name: 'Goblin A' }, { job: 'goblin', name: 'Goblin B' }] };
    const units = buildUnits({ party: run.party, encounter, relics: [] },
        [{ x: 0, y: 0 }, { x: 0, y: 5 }], [{ x: 3, y: 0 }, { x: 9, y: 5 }]);
    for (const u of units) u.eva = 0;
    const battle = new TacticalBattle(field(), units);
    const [archer, alchemist] = units.filter(u => u.team === 'player');
    const [foeA, foeB] = units.filter(u => u.team === 'enemy');
    return { battle, archer, alchemist, foeA, foeB };
}

test('a unit recovers 3 MP at the start of each of its turns, up to its maximum', () => {
    // GIVEN: an archer short on MP, and a unit with no MP pool at all
    const { battle, archer, alchemist } = fight();
    archer.mp = 10;
    alchemist.maxMp = alchemist.mp = 0;

    // WHEN: each starts a turn
    battle.startTurn(archer);
    battle.startTurn(alchemist);

    // THEN: the archer has 3 more MP, and the unit without a pool still has none
    assert.equal(archer.mp, 13);
    assert.equal(alchemist.mp, 0);

    // AND: a full pool doesn't overflow
    archer.mp = archer.maxMp - 1;
    battle.startTurn(archer);
    assert.equal(archer.mp, archer.maxMp);
});

test('a counter hits with the reactor\'s own rank of the skill, not rank I', () => {
    // Return Fire answers a ranged hit with a Long Shot. The same shot is fired twice, once by an
    // archer with Long Shot I and once with Long Shot III, under identical rolls.
    const counterDamage = (longShot) => {
        const { battle, archer, foeA } = fight();
        archer.reaction = 'return_fire';
        archer.abilities = ['attack', longShot];
        foeA.hp = foeA.maxHp = 999;
        withRandom(0, () => tryReaction(battle, archer, foeA, 'long_shot', { damage: 5 }));
        return 999 - foeA.hp;
    };
    const rank1 = counterDamage('long_shot'), rank3 = counterDamage('long_shot@3');
    assert.ok(rank1 > 0, 'the counter fired');
    assert.ok(rank3 > rank1, `Long Shot III counters harder (${rank3}) than Long Shot I (${rank1})`);
});

test('when Doom runs out on a boss it takes a quarter of its max HP instead of falling', () => {
    // GIVEN: a boss and its minion, both Doomed with a turn left
    const { battle, foeA: boss, foeB: minion, archer } = fight('boss');
    boss.maxHp = boss.hp = 200;
    for (const u of [boss, minion]) { inflictStatus(u, 'doom', 1, archer); }

    // WHEN: their turns come round
    battle.startTurn(boss);
    battle.startTurn(minion);

    // THEN: the boss is badly hurt but standing; the minion falls as before
    assert.equal(boss.hp, 150);
    assert.ok(!boss.status.includes('unconscious'));
    assert.equal(minion.hp, 0);

    // AND: a boss with less HP left than that is finished off
    inflictStatus(boss, 'doom', 1, archer);
    boss.hp = 20;
    battle.startTurn(boss);
    assert.equal(boss.hp, 0);
});

test('status duration bonuses lengthen other statuses but never delay Doom', () => {
    // GIVEN: a caster with Wyrd Drain (statuses last 1 turn longer)
    const { archer, foeA } = fight();
    archer.support = 'wyrd_drain';
    archer.mp = archer.maxMp;

    // WHEN: they slow and Doom the same target
    inflictStatus(foeA, 'slow', 3, archer);
    inflictStatus(foeA, 'doom', 3, archer);

    // THEN: the slow is stretched, the Doom timer isn't
    assert.equal(foeA.statusTimers.slow, 4);
    assert.equal(foeA.statusTimers.doom, 3);
});

test('MP regen gear adds to the 3 MP every unit recovers per turn', () => {
    // GIVEN: an Evoker with a Void Staff (+2 MP per turn) and Mana-Weave Robe (+1)
    const run = RunState.create({ jobs: ['evoker'], seed: 11 });
    const [ev] = run.party;
    ev.appearance = { ...ev.appearance, weaponKey: 'void_staff', armorKey: 'mana_weave_robe' };
    const encounter = { enemyLevel: 1, roster: [{ job: 'goblin', name: 'Goblin A' }] };
    const units = buildUnits({ party: run.party, encounter, relics: [] }, [{ x: 0, y: 0 }], [{ x: 9, y: 5 }]);
    const battle = new TacticalBattle(field(), units);
    const caster = units.find(u => u.team === 'player');
    caster.mp = 0;

    // WHEN: their turn starts
    battle.startTurn(caster);

    // THEN: they recover 3 + 2 + 1
    assert.equal(caster.mpRegen, 6);
    assert.equal(caster.mp, 6);
});
