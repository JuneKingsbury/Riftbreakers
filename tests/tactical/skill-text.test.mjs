// What skills say and do: cures clear only harmful statuses, descriptions show the numbers of
// the rank a character has, upgrade tooltips list what the next rank changes, and the battle
// log names tactics rules only when the player asks for it.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { gridMap } from '../map-fixtures.mjs';
import { createUnit } from '../../js/tactical/units.js';
import { standZ } from '../../js/tactical/battle-map.js';
import { TacticalBattle } from '../../js/tactical/battle.js';
import { resolveAbility, inflictStatus } from '../../js/tactical/abilities.js';
import { ABILITIES, rankChanges, rankedKey } from '../../js/tactical/data-registry.js';
import { planTurn } from '../../js/tactical/ai/executor.js';
import { autoScriptFor } from '../../js/tactical/ai/default-scripts.js';

const map = gridMap(Array.from({ length: 5 }, () => '.'.repeat(10)));
function mk(name, job, team, x, y, extra = {}) {
    const u = createUnit(name, job, team, x, y, { z: standZ(map, x, y) });
    return Object.assign(u, { abilities: ['attack'], reaction: null, support: null, movement: null, eva: 0 }, extra);
}

test('cures clear harmful statuses but leave helpful ones alone', () => {
    for (const cure of ['cure', 'purify', 'aegis_ward', 'panacea_mist']) {
        assert.ok(ABILITIES[cure]?.isCure, cure);
        const healer = mk('Healer', 'warden', 'player', 1, 1);
        const ally = mk('Ally', 'evoker', 'player', 2, 1);
        for (const s of ['poison', 'slow', 'haste', 'protect', 'regen']) inflictStatus(ally, s, 3);
        resolveAbility(healer, ally, cure, map);
        assert.deepEqual([...ally.status].sort(), ['haste', 'protect', 'regen'], cure);
    }
});

test('curing Enfeeble also lifts its ATK penalty', () => {
    const healer = mk('Healer', 'warden', 'player', 1, 1);
    const ally = mk('Ally', 'evoker', 'player', 2, 1);
    inflictStatus(ally, 'enfeebled', 3);
    assert.ok(ally.buffs.some(b => b.key === 'enfeebled'));
    resolveAbility(healer, ally, 'cure', map);
    assert.ok(!ally.buffs.some(b => b.key === 'enfeebled'));
});

test('a skill\'s description shows the numbers for its rank', () => {
    assert.match(ABILITIES.earth_skin.desc, /DEF \+8\b/);
    assert.match(ABILITIES[rankedKey('earth_skin', 2)].desc, /DEF \+10\b/);
    assert.match(ABILITIES[rankedKey('earth_skin', 3)].desc, /DEF \+12\b/);
    assert.match(ABILITIES.pinning_shot.desc, /for 2 turns/);
    assert.match(ABILITIES[rankedKey('pinning_shot', 3)].desc, /for 3 turns/, 'rank III adds a turn');
    // Every description is fully filled in, at every rank.
    for (const [key, ab] of Object.entries(ABILITIES)) {
        assert.ok(!/[{}]/.test(ab.desc ?? ''), `${key}: ${ab.desc}`);
        assert.ok(!/\+\?|by \?|\? turns/.test(ab.desc ?? ''), `${key}: ${ab.desc}`);
    }
});

test('every skill that inflicts a status says how long it lasts, at every rank', () => {
    assert.match(ABILITIES.ice.desc, /slows them for 2 turns/);
    assert.match(ABILITIES[rankedKey('ice', 3)].desc, /slows them for 3 turns/);
    assert.match(ABILITIES.bind_will.desc, /for 1 turn\b/, 'one turn, not "1 turns"');
    for (const [key, ab] of Object.entries(ABILITIES)) {
        if (!ab.applyStatus || !ab.statusDuration) continue;
        const n = ab.statusDuration;
        assert.match(ab.desc ?? '', new RegExp(`\\b${n} turns?\\b`), `${key} should say ${n} turn(s): ${ab.desc}`);
    }
});

test('the upgrade tooltip lists what the next rank changes', () => {
    assert.deepEqual(rankChanges('fire', 1), ['Power 100% → 120%', 'MP cost 12 → 10']);
    assert.deepEqual(rankChanges('heal', 1), ['Healing 100% → 120%', 'MP cost 18 → 15']);
    assert.ok(rankChanges('earth_skin', 1).includes('DEF +8 → +10'));
    assert.ok(rankChanges('sunder', 1).includes('DEF −5 → −6'));
    assert.ok(rankChanges('pinning_shot', 2).includes('Slow lasts 2 → 3 turns'));
    assert.ok(rankChanges('brace', 1).includes('Trigger chance 40% → 50%'));
    assert.deepEqual(rankChanges('fire', 3), [], 'nothing past rank III');
    assert.deepEqual(rankChanges('mana_stride', 1), [], 'movement skills don\'t upgrade');
});

test('the battle log names tactics rules only when that setting is on', () => {
    const run = (logTactics) => {
        const me = mk('Ava', 'evoker', 'player', 1, 2, { abilities: ['attack', 'fire'] });
        const foe = mk('Gob', 'goblin', 'enemy', 4, 2);
        me.script = autoScriptFor(me);
        const battle = new TacticalBattle(map, [me, foe]);
        battle.logTactics = logTactics;
        planTurn(me, battle);
        return battle.log.filter(l => l.startsWith('Ava follows:'));
    };
    assert.equal(new TacticalBattle(map, []).logTactics, false, 'off by default');
    assert.deepEqual(run(false), []);
    assert.equal(run(true).length, 1);
});
