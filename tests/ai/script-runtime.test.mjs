// Run with: node --test "tests/**/*.test.mjs"
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createUnit } from '../../js/tactical/units.js';
import { loadMapData, getTile } from '../../js/tactical/battle-map.js';
import { ABILITIES } from '../../js/tactical/data-registry.js';
import { resolveAbility } from '../../js/tactical/abilities.js';
import { estimateAbilityEffect } from '../../js/tactical/ai/estimate.js';
import { runScript } from '../../js/tactical/ai/script-runtime.js';
import { defaultScriptFor } from '../../js/tactical/ai/default-scripts.js';
import { validateScript, sanitizeScript, hasErrors } from '../../js/tactical/ai/script-validate.js';
import { executeIntent } from '../../js/tactical/ai/executor.js';
import { inAbilityRange, canUse } from '../../js/tactical/ai/queries.js';
import * as store from '../../js/tactical/ai/script-store.js';

// A flat 16x5 field. `wallAt` puts a sight-blocking wall column on x = wallAt.
function field(wallAt = null) {
    const rows = [];
    const elev = [];
    for (let y = 0; y < 5; y++) {
        rows.push(Array.from({ length: 16 }, (_, x) => (x === wallAt ? '#' : '.')).join(''));
        elev.push('0'.repeat(16));
    }
    return loadMapData({ width: 16, height: 5, tiles: rows, elevation: elev, playerSpawns: [], enemySpawns: [] });
}
const map = field();

function mk(name, job, team, x, y, extra = {}) {
    assert.ok(getTile(map, x, y)?.passable, `fixture tile ${x},${y} must be passable`);
    return Object.assign(createUnit(name, job, team, x, y), extra);
}

const always = { test: 'always', params: {} };
const rule = (id, when, then) => ({ id, enabled: true, when, then });
const script = (...rules) => ({ version: 1, rules });
const enemyNearest = { side: 'enemy', pick: 'nearest' };

test('empty script falls back to an implicit wait', () => {
    const me = mk('Me', 'warden', 'player', 3, 2);
    const foe = mk('Foe', 'goblin', 'enemy', 12, 2);
    const intent = runScript(script(), me, [me, foe], map);
    assert.equal(intent.act.kind, 'wait');
    assert.equal(intent.move, null);
});

test('generic script targets the lowest-HP enemy and closes in when out of reach', () => {
    const me = mk('Me', 'goblin', 'player', 15, 2);
    const tank = mk('Tank', 'warden', 'enemy', 1, 2);
    const weak = mk('Weak', 'evoker', 'enemy', 1, 3, { hp: 3 });
    const intent = runScript(defaultScriptFor('goblin'), me, [me, tank, weak], map);
    assert.equal(intent.act.kind, 'wait', 'target is out of reach this turn');
    assert.ok(intent.move, 'moves toward the weakest enemy');
    const before = Math.abs(me.x - weak.x) + Math.abs(me.y - weak.y);
    const after = Math.abs(intent.move.x - weak.x) + Math.abs(intent.move.y - weak.y);
    assert.ok(after < before);
});

test('generic script attacks the lowest-HP enemy once in range', () => {
    const me = mk('Me', 'goblin', 'player', 4, 2);
    const tank = mk('Tank', 'warden', 'enemy', 3, 2);
    const weak = mk('Weak', 'evoker', 'enemy', 4, 3, { hp: 3 });
    const intent = runScript(defaultScriptFor('goblin'), me, [me, tank, weak], map);
    assert.equal(intent.act.kind, 'ability');
    assert.equal(intent.act.targetName, 'Weak');
    assert.equal(intent.move, null, 'already in range, so stays put');
});

test('unconscious enemies are not targeted', () => {
    const me = mk('Me', 'goblin', 'player', 4, 2);
    const down = mk('Down', 'warden', 'enemy', 3, 2, { status: ['unconscious'], hp: 0 });
    const up = mk('Up', 'warden', 'enemy', 5, 2);
    assert.equal(runScript(defaultScriptFor('goblin'), me, [me, down, up], map).act.targetName, 'Up');
});

test('healer heals the most wounded ally by percentage', () => {
    const healer = mk('Healer', 'sanctifier', 'player', 4, 2);
    const a = mk('A', 'warden', 'player', 5, 2);
    const b = mk('B', 'warden', 'player', 3, 2);
    a.hp = Math.round(a.maxHp * 0.5);
    b.hp = Math.round(b.maxHp * 0.2);
    const foe = mk('Foe', 'goblin', 'enemy', 15, 2);
    const intent = runScript(defaultScriptFor('sanctifier'), healer, [healer, a, b, foe], map);
    assert.equal(intent.act.kind, 'ability');
    assert.equal(intent.act.ability, 'radiant_heal');
    assert.equal(intent.act.targetName, 'B');
});

test('healer revives an unconscious ally before topping up others', () => {
    const healer = mk('Healer', 'sanctifier', 'player', 4, 2);
    const down = mk('Down', 'warden', 'player', 5, 2, { status: ['unconscious'], hp: 0 });
    const hurt = mk('Hurt', 'warden', 'player', 3, 2);
    hurt.hp = 1;
    const foe = mk('Foe', 'goblin', 'enemy', 15, 2);
    assert.equal(runScript(defaultScriptFor('sanctifier'), healer, [healer, down, hurt, foe], map).act.targetName, 'Down');
});

test('a heal is skipped when nobody needs one', () => {
    const healer = mk('Healer', 'sanctifier', 'player', 4, 2);
    const ally = mk('Ally', 'warden', 'player', 5, 2);
    const foe = mk('Foe', 'goblin', 'enemy', 6, 2);
    const s = script(
        rule('heal', always, { do: 'ability', ability: 'best_heal', target: { side: 'ally', pick: 'nearest' } }),
        rule('hit', always, { do: 'ability', ability: 'attack', target: enemyNearest }),
    );
    const intent = runScript(s, healer, [healer, ally, foe], map);
    assert.equal(intent.act.ability, 'attack', 'full-HP ally is not worth a heal');
    assert.equal(intent.trace[0].ruleId, 'hit');
});

test('a unit can heal itself through the self side', () => {
    const me = mk('Me', 'paladin', 'player', 4, 2);
    me.hp = 5;
    const foe = mk('Foe', 'goblin', 'enemy', 12, 2);
    const s = script(rule('self', always, { do: 'ability', ability: 'best_heal', target: { side: 'self' } }));
    const intent = runScript(s, me, [me, foe], map);
    assert.equal(intent.act.kind, 'ability');
    assert.equal(intent.act.ability, 'heal');
    assert.equal(intent.act.targetId, me.id);
});

test('a rule whose action is infeasible falls through to the next rule', () => {
    const me = mk('Me', 'warden', 'player', 3, 2);
    const foe = mk('Foe', 'goblin', 'enemy', 4, 2);
    const s = script(
        rule('nope', always, { do: 'ability', ability: 'fire', target: enemyNearest }),
        rule('hit', always, { do: 'ability', ability: 'attack', target: enemyNearest }),
    );
    const intent = runScript(s, me, [me, foe], map);
    assert.equal(intent.act.ability, 'attack');
    assert.equal(intent.trace[0].ruleId, 'hit');
});

test('disabled rules are skipped', () => {
    const me = mk('Me', 'warden', 'player', 3, 2);
    const foe = mk('Foe', 'goblin', 'enemy', 4, 2);
    const s = script(
        { ...rule('off', always, { do: 'defend' }), enabled: false },
        rule('hit', always, { do: 'ability', ability: 'attack', target: enemyNearest }),
    );
    assert.equal(runScript(s, me, [me, foe], map).act.kind, 'ability');
});

test('a move rule is free: scanning continues and the unit can still act from the new tile', () => {
    const mage = mk('Mage', 'evoker', 'player', 5, 2);
    const foe = mk('Foe', 'goblin', 'enemy', 6, 2);
    const s = script(
        rule('kite', { test: 'enemy_within', params: { range: 1 } }, { do: 'move', mode: 'away', target: enemyNearest }),
        rule('cast', always, { do: 'ability', ability: 'thunder', target: enemyNearest, approach: false }),
    );
    const intent = runScript(s, mage, [mage, foe], map);
    assert.ok(intent.move, 'steps away');
    assert.ok(Math.abs(intent.move.x - foe.x) + Math.abs(intent.move.y - foe.y) > 1);
    assert.equal(intent.act.ability, 'thunder', 'still in range of the longer spell from the new tile');
    assert.deepEqual(intent.trace.map(t => t.ruleId), ['kite', 'cast']);
});

test('after moving, a later approach rule cannot move a second time', () => {
    const me = mk('Me', 'warden', 'player', 3, 2);
    const foe = mk('Foe', 'goblin', 'enemy', 15, 2);
    const s = script(
        rule('step', always, { do: 'move', mode: 'toward', target: enemyNearest }),
        rule('hit', always, { do: 'ability', ability: 'attack', target: enemyNearest, approach: true }),
    );
    const intent = runScript(s, me, [me, foe], map);
    assert.ok(intent.move);
    assert.equal(intent.act.kind, 'wait');
});

test('target conditions are false when the rule has no target', () => {
    const me = mk('Me', 'warden', 'player', 3, 2);
    const s = script(rule('x', { test: 'target_hp_pct', params: { cmp: '<', value: 100 } }, { do: 'defend' }));
    assert.equal(runScript(s, me, [me], map).act.kind, 'wait');
});

test('and / or / not compose', () => {
    const me = mk('Me', 'warden', 'player', 3, 2);
    const foe = mk('Foe', 'goblin', 'enemy', 4, 2);
    const hurt = { test: 'self_hp_pct', params: { cmp: '<', value: 10 } };
    const close = { test: 'enemy_within', params: { range: 2 } };
    const run = when => runScript(script(rule('r', when, { do: 'defend' })), me, [me, foe], map).act.kind;
    assert.equal(run({ op: 'and', args: [hurt, close] }), 'wait');
    assert.equal(run({ op: 'or', args: [hurt, close] }), 'defend');
    assert.equal(run({ op: 'not', args: [hurt] }), 'defend');
});

test('interpreter does not mutate the battle', () => {
    const me = mk('Me', 'warden', 'player', 3, 2);
    const foe = mk('Foe', 'goblin', 'enemy', 15, 2);
    const snapshot = JSON.stringify([me, foe]);
    runScript(defaultScriptFor('warden'), me, [me, foe], map);
    assert.equal(JSON.stringify([me, foe]), snapshot);
});

test('line of sight: a wall blocks a sight-dependent ability but not one that ignores sight', () => {
    const walled = field(8);
    const archer = createUnit('Archer', 'runebow', 'player', 6, 2);
    const foe = createUnit('Foe', 'goblin', 'enemy', 10, 2);
    assert.notEqual(ABILITIES.long_shot.requiresLos, false, 'long_shot needs sight');
    assert.equal(inAbilityRange(archer, foe, 'long_shot', walled), false, 'wall in between');
    assert.equal(inAbilityRange(archer, foe, 'long_shot', null), true, 'without a map only distance counts');

    const s = script(rule('shoot', always, { do: 'ability', ability: 'long_shot', target: enemyNearest, approach: false }));
    assert.equal(runScript(s, archer, [archer, foe], walled).act.kind, 'wait', 'no shot through the wall');

    // fire sets requiresLos: false, so the same wall does not stop it.
    const mage = createUnit('Mage', 'evoker', 'player', 6, 2);
    const near = createUnit('Near', 'goblin', 'enemy', 9, 2);
    assert.equal(ABILITIES.fire.requiresLos, false);
    assert.equal(inAbilityRange(mage, near, 'fire', walled), true);
});

test('silence stops magic but physical attacks still work', () => {
    const mage = mk('Mage', 'evoker', 'player', 4, 2, { status: ['silence'] });
    const foe = mk('Foe', 'goblin', 'enemy', 5, 2);
    assert.equal(canUse(mage, 'fire'), false);
    assert.equal(canUse(mage, 'attack'), true);
    const intent = runScript(defaultScriptFor('goblin'), mage, [mage, foe], map);
    assert.equal(intent.act.ability, 'attack');
});

test('a summoner calls a creature onto a free tile toward the enemy', () => {
    const caster = mk('Caller', 'spiritbinder', 'player', 4, 2);
    const foe = mk('Foe', 'goblin', 'enemy', 12, 2);
    const s = script(rule('call', always, { do: 'ability', ability: 'best_summon' }));
    const intent = runScript(s, caster, [caster, foe], map);
    assert.equal(intent.act.kind, 'ability');
    assert.equal(intent.act.ability, 'call_wisp');
    assert.ok(intent.act.x > caster.x, 'placed on the enemy side');
    assert.ok(Math.abs(intent.act.x - caster.x) + Math.abs(intent.act.y - caster.y) <= ABILITIES.call_wisp.range);
});

test('an ally buff is not recast on an ally who already has it', () => {
    const warden = mk('Warden', 'warden', 'player', 4, 2);
    const ally = mk('Ally', 'evoker', 'player', 5, 2);
    const foe = mk('Foe', 'goblin', 'enemy', 15, 2);
    const buffs = ABILITIES.stone_aegis.applyStatus;
    assert.ok(buffs, 'stone_aegis applies a status');
    const s = script(rule('buff', always, { do: 'ability', ability: 'stone_aegis', target: { side: 'ally', pick: 'nearest' } }));
    assert.equal(runScript(s, warden, [warden, ally, foe], map).act.kind, 'ability');
    ally.status.push(buffs);
    assert.equal(runScript(s, warden, [warden, ally, foe], map).act.kind, 'wait');
});

test('estimateAbilityEffect matches resolveAbility when variance is neutral', () => {
    const realRandom = Math.random;
    Math.random = () => 0.5;
    try {
        for (const [job, key] of [['evoker', 'attack'], ['evoker', 'fire'], ['paladin', 'heal']]) {
            // No passives, buffs or statuses, so only the core formula applies.
            const src = mk('S', job, 'player', 3, 2, { abilities: [key] });
            const tgt = mk('T', 'warden', 'enemy', 4, 2, { eva: 0 });
            tgt.hp = tgt.maxHp - 5;
            const est = estimateAbilityEffect(src, tgt, key, map);
            const res = resolveAbility(src, tgt, key, map);
            assert.equal(est.damage, res.damage, `${key} damage`);
            assert.equal(est.healing, res.healing, `${key} healing`);
        }
    } finally {
        Math.random = realRandom;
    }
});

test('validation flags unknown tests, abilities and target sides', () => {
    const bad = script(
        rule('a', { test: 'nope' }, { do: 'defend' }),
        rule('b', always, { do: 'ability', ability: 'not_real' }),
        rule('c', always, { do: 'ability', ability: 'heal', target: { side: 'enemy' } }),
    );
    const problems = validateScript(bad);
    assert.equal(problems.filter(p => p.rule === 0).length, 1);
    assert.equal(problems.filter(p => p.rule === 1).length, 1);
    assert.equal(problems.filter(p => p.rule === 2).length, 1);
    assert.ok(hasErrors(problems));
    assert.equal(sanitizeScript(bad), null);
});

test('abilities the unit lacks are a warning, not an error', () => {
    const warden = mk('W', 'warden', 'player', 3, 2);
    const s = script(rule('a', always, { do: 'ability', ability: 'fire', target: enemyNearest }));
    const problems = validateScript(s, warden);
    assert.equal(problems.length, 1);
    assert.equal(problems[0].severity, 'warning');
    assert.ok(!hasErrors(problems));
    assert.equal(runScript(s, warden, [warden], map).act.kind, 'wait', 'rule is skipped at run time');
});

test('every default script is valid for every player job', () => {
    const jobs = ['novice', 'evoker', 'spellblade', 'warden', 'runebow', 'stoneshaper', 'seer', 'battlemage', 'paladin',
        'riftcaller', 'earthshaker', 'sanctifier', 'spiritbinder', 'worldsinger', 'fatebinder', 'lifeseer', 'beastcaller',
        'goblin', 'unknown_job'];
    for (const job of jobs) {
        assert.deepEqual(validateScript(defaultScriptFor(job)).filter(p => p.severity !== 'warning'), [], job);
    }
});

test('store round-trips a script and ignores corrupt data', () => {
    const mem = new Map();
    globalThis.localStorage = {
        getItem: k => (mem.has(k) ? mem.get(k) : null),
        setItem: (k, v) => mem.set(k, v),
    };
    try {
        const cd = { name: 'Aldric', job: 'warden', team: 'player' };
        assert.deepEqual(store.getScriptFor(cd), defaultScriptFor('warden'));

        const custom = script(rule('only', always, { do: 'defend' }));
        assert.ok(store.saveScript('Aldric', custom));
        assert.equal(store.getScriptFor(cd).rules[0].id, 'only');
        assert.ok(store.hasCustomScript('Aldric'));

        assert.equal(store.saveScript('Aldric', { rules: [rule('x', { test: 'nope' }, { do: 'defend' })] }), false);
        assert.equal(store.getScriptFor(cd).rules[0].id, 'only', 'invalid save did not overwrite');

        mem.set(store.STORAGE_KEY, '{not json');
        assert.deepEqual(store.getScriptFor(cd), defaultScriptFor('warden'));

        store.saveScript('Aldric', custom);
        assert.deepEqual(store.getScriptFor({ ...cd, team: 'enemy' }), defaultScriptFor('warden'), 'enemies ignore saved scripts');
        store.resetScript('Aldric');
        assert.ok(!store.hasCustomScript('Aldric'));
    } finally {
        delete globalThis.localStorage;
    }
});

test('a saved script follows the character across a class change', () => {
    const mem = new Map();
    globalThis.localStorage = {
        getItem: k => (mem.has(k) ? mem.get(k) : null),
        setItem: (k, v) => mem.set(k, v),
    };
    try {
        const member = { name: 'Lyria', job: 'evoker', team: 'player' };
        const custom = script(rule('mine', always, { do: 'ability', ability: 'fire', target: enemyNearest }));
        store.saveScript('Lyria', custom);
        member.job = 'warden';   // changed from the Party menu
        assert.equal(store.getScriptFor(member).rules[0].id, 'mine', 'script is keyed by name, not job');

        // And the unsaved default tracks the live job.
        const fresh = { name: 'Ryn', job: 'runebow', team: 'player' };
        assert.deepEqual(store.getScriptFor(fresh), defaultScriptFor('runebow'));
        fresh.job = 'sanctifier';
        assert.deepEqual(store.getScriptFor(fresh), defaultScriptFor('sanctifier'));
    } finally {
        delete globalThis.localStorage;
    }
});

function fakeBattle(units) {
    const log = [];
    return {
        map,
        log,
        ended: null,
        applied: [],
        get livingUnits() { return units; },
        logMsg: m => log.push(m),
        endTurn(cost) { this.ended = cost; },
        applyEnemyAbility(unit, key, x, y) { this.applied.push({ key, x, y }); },
    };
}

test('executor charges the manual-game CT cost and records the last target', () => {
    const me = mk('Me', 'warden', 'player', 3, 2);
    const foe = mk('Foe', 'goblin', 'enemy', 4, 2);
    const battle = fakeBattle([me, foe]);
    const intent = runScript(script(rule('hit', always, { do: 'ability', ability: 'attack', target: enemyNearest })), me, [me, foe], map);
    executeIntent(me, intent, battle, null);
    assert.equal(battle.applied.length, 1);
    assert.equal(battle.ended, Math.max(80, ABILITIES.attack.actionCost ?? 60));
    assert.equal(me._lastTargetId, foe.id);
    assert.equal(me._turnsTaken, 1);
});

test('executor adds 20 CT for moving, charges 60 to idle and 80 to defend', () => {
    const me = mk('Me', 'warden', 'player', 3, 2);
    let battle = fakeBattle([me]);
    executeIntent(me, { move: { x: 4, y: 2 }, pivot: null, trace: [], act: { kind: 'wait' } }, battle, null);
    assert.equal(battle.ended, 80, 'move 20 + idle 60');
    assert.equal(me.x, 4);

    battle = fakeBattle([me]);
    executeIntent(me, { move: null, pivot: null, trace: [], act: { kind: 'wait' } }, battle, null);
    assert.equal(battle.ended, 60);

    battle = fakeBattle([me]);
    executeIntent(me, { move: null, pivot: null, trace: [], act: { kind: 'defend' } }, battle, null);
    assert.equal(battle.ended, 80);
    assert.ok(me.status.includes('defend'));
});

test('executor refuses an ability it cannot afford, reach or see', () => {
    const me = mk('Me', 'evoker', 'player', 3, 2);
    const foe = mk('Foe', 'goblin', 'enemy', 4, 2);
    const act = { kind: 'ability', ability: 'fire', x: 4, y: 2, targetId: foe.id };

    let battle = fakeBattle([me, foe]);
    me.mp = 0;
    executeIntent(me, { move: null, pivot: null, trace: [], act }, battle, null);
    assert.equal(battle.applied.length, 0, 'no MP');
    assert.equal(battle.ended, 60);

    me.mp = me.maxMp;
    me.status.push('silence');
    battle = fakeBattle([me, foe]);
    executeIntent(me, { move: null, pivot: null, trace: [], act }, battle, null);
    assert.equal(battle.applied.length, 0, 'silenced');
});

test('movement goes around a pond instead of getting stuck against it', () => {
    // Pond in the way: the enemy is straight below, but the route starts by going sideways.
    //   y=1  .  .  .  .  .  .  .      me at (3,1)
    //   y=2  .  ~  ~  ~  ~  ~  .
    //   y=3  .  ~  ~  ~  ~  ~  .      foe at (3,4)
    //   y=4  .  .  .  .  .  .  .
    const rows = ['.......', '.~~~~~.', '.~~~~~.', '.......'];
    const pond = loadMapData({ width: 7, height: 4, tiles: rows, elevation: rows.map(() => '0000000'), playerSpawns: [], enemySpawns: [] });
    const me = createUnit('Me', 'warden', 'player', 3, 0);
    const foe = createUnit('Foe', 'goblin', 'enemy', 3, 3);
    const s = script(rule('go', always, { do: 'move', mode: 'toward', target: enemyNearest }));

    const intent = runScript(s, me, [me, foe], pond);
    assert.ok(intent.move, 'finds a way instead of standing still');
    // Straight-line distance can't improve from (3,0) toward (3,3) without touching water,
    // so the unit must head for a side column where the walking route is shorter.
    assert.ok(intent.move.x !== 3, `moved sideways to (${intent.move.x},${intent.move.y})`);
    const field = Q_walk(pond, foe);
    assert.ok(field.get(`${intent.move.x},${intent.move.y}`) < field.get('3,0'), 'closer by walking distance');
});

import { walkCostField } from '../../js/tactical/ai/queries.js';
function Q_walk(map, target) { return walkCostField(map, target.x, target.y); }

import { sideForAbility, scriptUsable } from '../../js/tactical/ai/blocks.js';

test('choosing an ability maps to the target side it needs', () => {
    assert.equal(sideForAbility('fire'), 'enemy');
    assert.equal(sideForAbility('heal'), 'ally');
    assert.equal(sideForAbility('cure'), 'ally');
    assert.equal(sideForAbility('stone_aegis'), 'ally');
    assert.equal(sideForAbility('earth_skin'), 'self');
    assert.equal(sideForAbility('best_damage'), 'enemy');
    assert.equal(sideForAbility('best_heal'), 'ally');
    assert.equal(sideForAbility('best_buff'), 'self');
    assert.equal(sideForAbility('best_summon'), null, 'summons choose their own tile');
    assert.equal(sideForAbility('call_wisp'), null);
    assert.equal(sideForAbility('not_real'), null);
});

test('every ability the picker offers validates with the side it suggests', () => {
    for (const [key, ab] of Object.entries(ABILITIES)) {
        if (!scriptUsable(key)) continue;
        const side = sideForAbility(key);
        const then = { do: 'ability', ability: key, ...(side ? { target: { side, pick: 'nearest' } } : {}) };
        const problems = validateScript(script(rule('r', always, then))).filter(p => p.severity !== 'warning');
        assert.deepEqual(problems, [], `${key} (${ab.targetType})`);
    }
});

test('passive and tile-terrain abilities are not offered to scripts', () => {
    assert.equal(scriptUsable('mana_surge'), false, 'passive');
    assert.equal(scriptUsable('stone_wall'), false, 'tile terrain ability');
    assert.equal(scriptUsable('call_wisp'), true, 'summons are supported');
    assert.equal(scriptUsable('fire'), true);
});
