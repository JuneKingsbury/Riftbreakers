// Positioning: careful (ranged) characters keep out of enemy reach, don't run ahead of
// the group and only swing in melee as a last resort; bold keeps the old behavior.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { gridMap } from '../map-fixtures.mjs';
import { createUnit } from '../../js/tactical/units.js';
import { runScript, positionStyle } from '../../js/tactical/ai/script-runtime.js';
import { autoScriptFor } from '../../js/tactical/ai/default-scripts.js';
import { validateScript, sanitizeScript } from '../../js/tactical/ai/script-validate.js';
import * as Q from '../../js/tactical/ai/queries.js';

const field = () => gridMap(Array.from({ length: 7 }, () => '.'.repeat(16)));
const attackRule = (position) => ({
    version: 1,
    rules: [{ id: 'a', enabled: true, when: { test: 'always', params: {} },
        then: { do: 'ability', ability: 'best_damage', target: { side: 'enemy', pick: 'nearest' }, approach: true, ...(position ? { position } : {}) } }],
});
const archer = (x, y, extra = {}) => Object.assign(createUnit('Bow', 'runebow', 'player', x, y), { abilities: ['attack', 'long_shot'], move: 4 }, extra);
const destOf = (intent, unit) => intent.move ?? { x: unit.x, y: unit.y, z: unit.z };

test('auto positioning is careful for ranged roles and bold for melee and healers', () => {
    assert.equal(positionStyle({}, archer(0, 0)), 'careful');
    assert.equal(positionStyle({}, createUnit('Blade', 'spellblade', 'player', 0, 0)), 'bold', 'Hex reaches 3, but a Spellblade is melee');
    assert.equal(positionStyle({}, createUnit('Ward', 'warden', 'player', 0, 0)), 'bold');
    assert.equal(positionStyle({}, createUnit('Mage', 'shadow_mage', 'enemy', 0, 0)), 'careful', 'no role: judged by reach');
    assert.equal(positionStyle({ position: 'bold' }, archer(0, 0)), 'bold');
});

test('a lone careful archer stops short of enemy reach; bold walks right in', () => {
    const map = field();
    // The enemy can walk 6 and shoot 5, so its reach covers x >= 3 on this row.
    const foe = Object.assign(createUnit('Foe', 'raider_archer', 'enemy', 14, 3), { move: 6 });
    const units = () => { const b = archer(0, 3); return [b, foe]; };

    const [b1] = units();
    const bold = destOf(runScript(attackRule('bold'), b1, [b1, foe], map), b1);
    assert.equal(bold.x, 4, 'bold closes as far as it can');

    const [b2] = units();
    const careful = destOf(runScript(attackRule(), b2, [b2, foe], map), b2);
    assert.ok(!Q.isThreatenedAt(b2, careful.x, careful.y, careful.z, map, [b2, foe]), `careful ended at ${careful.x},${careful.y} in reach`);
});

test('a careful archer ahead of its allies, with no shot yet, waits for the group', () => {
    const map = field();
    const foe = Object.assign(createUnit('Foe', 'goblin', 'enemy', 15, 3), { move: 2 });
    const ally = createUnit('Tank', 'raider', 'player', 0, 1);
    const bow = archer(2, 3);
    const intent = runScript(attackRule(), bow, [bow, ally, foe], map);
    const d = destOf(intent, bow);
    const front = Q.distance(ally, foe);
    assert.ok(front - Q.distance(d, foe) <= 3, `lead ${front - Q.distance(d, foe)}`);

    const boldBow = archer(2, 3);
    const boldDest = destOf(runScript(attackRule('bold'), boldBow, [boldBow, ally, foe], map), boldBow);
    assert.equal(boldDest.x, 6, 'bold charges ahead');
});

test('a careful archer next to an enemy shoots from range instead of swinging', () => {
    const map = field();
    const foe = Object.assign(createUnit('Foe', 'goblin', 'enemy', 6, 3), { move: 2 });
    const bow = archer(5, 3);
    const intent = runScript(attackRule(), bow, [bow, foe], map);
    assert.equal(intent.act.ability, 'long_shot');
    assert.ok(Q.distance(destOf(intent, bow), foe) > 1, 'and steps back first');
});

test('with no ranged option left, a careful unit still fights in melee', () => {
    const map = field();
    const foe = Object.assign(createUnit('Foe', 'goblin', 'enemy', 6, 3), { move: 2 });
    const caster = Object.assign(createUnit('Evo', 'evoker', 'player', 5, 3), { abilities: ['attack', 'fire'], mp: 0 });
    assert.equal(positionStyle({}, caster), 'careful');
    const intent = runScript(attackRule(), caster, [caster, foe], map);
    assert.equal(intent.act.ability, 'attack');
});

test('regroup walks an isolated, threatened unit back toward its allies', () => {
    const map = field();
    const ally = createUnit('Tank', 'raider', 'player', 0, 3);
    const foe = Object.assign(createUnit('Foe', 'goblin', 'enemy', 11, 3), { move: 4 });
    const bow = archer(9, 3);
    const script = { version: 1, rules: [{ id: 'r', enabled: true,
        when: { op: 'and', args: [{ test: 'self_isolated', params: { range: 5 } }, { test: 'self_threatened', params: {} }] },
        then: { do: 'move', mode: 'regroup' } }] };
    const intent = runScript(script, bow, [bow, ally, foe], map);
    assert.ok(intent.move, 'it moved');
    assert.ok(Q.distance(intent.move, ally) < Q.distance(bow, ally));
});

test('default behavior for ranged jobs regroups when cut off; positioning is validated', () => {
    const labels = autoScriptFor('runebow', ['attack', 'long_shot']).rules.map(r => r.label);
    assert.ok(labels.includes('Regroup when cut off and threatened'));
    assert.ok(!autoScriptFor('spellblade', ['attack', 'hex']).rules.some(r => r.label.startsWith('Regroup')));

    const ok = attackRule('careful');
    assert.ok(sanitizeScript(ok));
    assert.deepEqual(validateScript(attackRule()).filter(p => p.severity !== 'warning'), [], 'scripts without positioning still work');
    const bad = attackRule('reckless');
    assert.ok(validateScript(bad).some(p => /positioning/.test(p.message)));
});
