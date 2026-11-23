// Battle effects: which effect goes with which ability or event (fx-presets.js), and the
// particle, effect-sprite and shake mechanics (battle-fx.js), run on plain three.js objects
// with no WebGL.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import * as THREE from '../../lib/three/three.module.js';
import { BattleFx } from '../../js/tactical/battle-fx.js';
import {
    abilityColors, projectileSprite, impactSprite, meleeSprite, isHeavyHit, hitShake, statusSprite,
    statusAura, statusBadges, wardColors, HP_BAR_COLORS,
    PHYSICAL_SPARKS, HEAL_COLORS,
} from '../../js/tactical/fx-presets.js';

const fxWith = (textures = {}) => {
    const scene = new THREE.Scene();
    const fx = new BattleFx(scene, (category, key) => textures[`${category}:${key}`] ?? null);
    fx.reducedMotion = false;
    return { scene, fx };
};
const alive = (fx) => Object.values(fx.layers).reduce((n, l) => n + l.items.length, 0);

// ---- Choices ----------------------------------------------------------------------------

test('arrows fly as arrows, thrown stones tumble, and spells fly as their element', () => {
    assert.equal(projectileSprite('long_shot'), 'projectile_arrow');
    assert.equal(projectileSprite('long_shot@3'), 'projectile_arrow', 'any rank');
    assert.equal(projectileSprite('throw_stone'), null);
    assert.equal(projectileSprite('fire'), 'projectile_spell');
    assert.equal(projectileSprite('hex'), 'projectile_void');
    assert.equal(projectileSprite('ice'), 'projectile_arcane');
    assert.equal(projectileSprite('heal'), null, 'no element: a plain glow');
});

test('impacts and swooshes suit the attack', () => {
    assert.equal(impactSprite('fire'), 'fire');
    assert.equal(impactSprite('ice'), 'freezing');
    assert.equal(impactSprite('smite'), 'smite');
    assert.equal(impactSprite('attack'), 'hit');
    assert.equal(meleeSprite('attack'), 'attack_swing');
    assert.equal(meleeSprite('wolf_bite'), 'attack_stab');
});

test('particles take the element\'s colors, heals are green, and plain blows throw sparks', () => {
    assert.notDeepEqual(abilityColors('fire'), abilityColors('ice'));
    assert.deepEqual(abilityColors('heal'), HEAL_COLORS);
    assert.deepEqual(abilityColors('attack'), PHYSICAL_SPARKS);
    assert.deepEqual(abilityColors('no_such_ability'), PHYSICAL_SPARKS);
});

test('a heavy hit is a quarter of the target\'s HP; the camera shakes hardest when the party is hurt', () => {
    const hero = { team: 'player', maxHp: 100 }, foe = { team: 'enemy', maxHp: 100 };
    assert.ok(isHeavyHit(25, hero) && !isHeavyHit(24, hero));
    assert.ok(hitShake(30, hero) > hitShake(10, hero));
    assert.ok(hitShake(10, hero) > 0);
    assert.equal(hitShake(10, foe), 0, 'ordinary hits on enemies don\'t shake');
    assert.ok(hitShake(30, hero) > hitShake(30, foe));
    assert.equal(statusSprite('protect'), 'spell_shield');
    assert.equal(statusSprite('poison'), null, 'poison bubbles instead of an icon');
});

test('lingering statuses wear a badge with the turns left; stat changes get one each', () => {
    const unit = { team: 'enemy', status: ['protect', 'poison', 'doom'], statusTimers: { poison: 3, protect: 99, doom: 2 },
        buffs: [{ key: 'war_cry', stat: 'atk', value: 4 }, { key: 'enfeebled', stat: 'atk', value: -5 }, { key: 'x', stat: 'def', value: -2 }] };
    const badges = statusBadges(unit);
    assert.deepEqual(badges.map(b => b.key), ['poison', 'protect', 'buff_atk', 'buff_def'], 'harmful first; doom has its own countdown');
    assert.equal(badges[0].turns, 3);
    assert.equal(badges[1].turns, null, 'a battle-long status shows no countdown');
    assert.ok(badges[0].harmful && !badges[1].harmful && badges[3].harmful);
    assert.equal(badges[2].name, 'ATK +4', 'Enfeeble\'s own -5 is on its status badge, not here');
    assert.ok(statusBadges(unit, { withDoom: true }).some(b => b.key === 'doom'));
    assert.deepEqual(statusBadges({ status: [] }), []);
});

test('Protect, Shell and Defend ring the HP bar; the teams\' bars differ; most statuses trickle particles', () => {
    assert.equal(wardColors({ status: ['protect', 'shell', 'poison'] }).length, 2);
    assert.equal(wardColors({ status: ['defend'] }).length, 1);
    assert.deepEqual(wardColors({ status: ['haste'] }), []);
    assert.notEqual(HP_BAR_COLORS.player, HP_BAR_COLORS.enemy);
    for (const s of ['poison', 'slow', 'stun', 'regen', 'protect', 'shell', 'doom']) assert.ok(statusAura(s)?.every > 0, s);
    assert.equal(statusAura('no_such_status'), null);
});

// ---- Mechanics --------------------------------------------------------------------------

test('a burst spawns its particles, they move and fade, and all are gone after their lifetime', () => {
    const { fx } = fxWith();
    fx.burst({ x: 0, y: 1, z: 0 }, { count: 6, speed: [1, 1], up: [0, 0], life: [0.4, 0.4] });
    assert.equal(alive(fx), 6);
    const start = fx.layers.spark.items.map(p => [p.x, p.z]);
    fx.update(100, 48);
    assert.ok(fx.layers.spark.items.some((p, i) => p.x !== start[i][0] || p.z !== start[i][1]), 'they fly outwards');
    assert.equal(fx.layers.spark.geometry.drawRange.count, 6);
    for (let i = 0; i < 5; i++) fx.update(100, 48);
    assert.equal(alive(fx), 0);
    assert.equal(fx.layers.spark.geometry.drawRange.count, 0);
});

test('debris falls under gravity and comes to rest on the floor', () => {
    const { fx } = fxWith();
    fx.burst({ x: 0, y: 1, z: 0 }, { layer: 'debris', count: 3, up: [0, 0], gravity: 5, life: [5, 5], floor: 0.5 });
    for (let i = 0; i < 20; i++) fx.update(50, 48);
    assert.ok(fx.layers.debris.items.every(p => p.y === 0.5));
});

test('a burst fans around its direction when given one', () => {
    const { fx } = fxWith();
    fx.burst({ x: 0, y: 0, z: 0 }, { count: 9, dir: { x: 1, z: 0 }, spread: 0.3, speed: [1, 1] });
    assert.ok(fx.layers.spark.items.every(p => p.vx > 0.5), 'all thrown forwards');
});

test('the particle count is capped, so a huge fight can\'t pile them up without limit', () => {
    const { fx } = fxWith();
    for (let i = 0; i < 100; i++) fx.burst({ x: 0, y: 0, z: 0 }, { count: 50, life: [9, 9] });
    assert.ok(fx.layers.spark.items.length <= 600);
});

test('an effect sprite needs its art, grows and rises over its life, then is removed', () => {
    const tex = new THREE.Texture();
    const { scene, fx } = fxWith({ 'effects:spell_heal': tex });
    assert.equal(fx.sprite('missing', { x: 0, y: 0, z: 0 }), null, 'ascii skin: nothing to draw');
    const s = fx.sprite('spell_heal', { x: 0, y: 1, z: 0 }, { ms: 400, size: 0.4, grow: 0.4, rise: 0.5 });
    assert.ok(scene.children.includes(s.s));
    fx.update(200, 48);
    assert.ok(s.s.position.y > 1 && s.s.scale.x > 0.4);
    fx.update(250, 48);
    assert.ok(!scene.children.includes(s.s));
});

test('effects keep pace with the playback speed: the same lifetime passes in less real time', () => {
    const one = fxWith().fx, four = fxWith().fx;
    for (const fx of [one, four]) fx.burst({ x: 0, y: 0, z: 0 }, { count: 4, life: [0.4, 0.4] });
    one.update(50, 48);          // 50 ms at 1x
    four.update(50 * 4, 48);     // the same 50 ms at 4x: the view passes dt × speed
    const lifeLeft = (fx) => fx.layers.spark.items[0].life;
    assert.ok(Math.abs(lifeLeft(one) - (1 - 0.05 / 0.4)) < 1e-9);
    assert.ok(Math.abs(lifeLeft(four) - (1 - 0.2 / 0.4)) < 1e-9);
});

test('shake decays to nothing, and is off for players who ask for reduced motion', () => {
    const { fx } = fxWith();
    fx.shake(0.1);
    const o = fx.shakeOffset();
    assert.ok(Math.abs(o.x) <= 0.1 && Math.abs(o.y) <= 0.1);
    for (let i = 0; i < 30; i++) fx.update(30, 48);
    assert.deepEqual(fx.shakeOffset(), { x: 0, y: 0 });
    fx.shake(5);
    assert.ok(fx.shakeAmount <= 0.3, 'capped');

    fx.reducedMotion = true;
    fx.shakeAmount = 0;
    fx.shake(0.2);
    assert.equal(fx.shakeAmount, 0);
});
