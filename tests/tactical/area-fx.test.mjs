// Area effects: which style each area ability plays, the battle reporting every cell an area
// covered, tiles that heave under an earth spell (TerrainShaker), and delayed tile effects.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import * as THREE from '../../lib/three/three.module.js';
import { gridMap } from '../map-fixtures.mjs';
import { createUnit } from '../../js/tactical/units.js';
import { standZ, cellKey } from '../../js/tactical/battle-map.js';
import { TacticalBattle } from '../../js/tactical/battle.js';
import { buildTerrainMesh, TerrainShaker, FACE, decodeOwner } from '../../js/tactical/terrain-mesh.js';
import { BattleFx } from '../../js/tactical/battle-fx.js';
import { areaStyle } from '../../js/tactical/fx-presets.js';
import { battleEventSound } from '../../js/audio/game-sounds.js';
import { ABILITIES } from '../../js/tactical/data-registry.js';

const map = gridMap(Array.from({ length: 6 }, () => '.'.repeat(8)));
const mk = (name, job, team, x, y, abilities = ['attack']) => Object.assign(createUnit(name, job, team, x, y, { z: standZ(map, x, y) }), { abilities, eva: 0 });

test('earth spells quake the ground, the bigger the area the harder; other elements have their own look', () => {
    for (const k of ['tremor', 'landslide', 'stone_spike', 'stone_wall', 'root_field']) assert.equal(areaStyle(k).kind, 'quake', k);
    assert.ok(areaStyle('landslide').quake > areaStyle('stone_spike').quake, 'radius 2 shakes harder than radius 1');
    assert.equal(areaStyle('fire').kind, 'flames');
    assert.equal(areaStyle('thunder').kind, 'storm');
    assert.equal(areaStyle('consecrate').kind, 'light');
    assert.equal(areaStyle('void_burst').kind, 'arcane');
    assert.equal(areaStyle('spore_cloud').kind, 'spores');
    assert.equal(areaStyle('acid_flask').kind, 'splash');
    assert.equal(areaStyle('acid_flask').flash, ABILITIES.acid_flask.projectileColor, 'a splash glows the flask\'s color');
    assert.equal(areaStyle('mass_foresight').kind, 'blessing');
    assert.equal(areaStyle('arrow_rain').kind, 'impact');
    assert.equal(areaStyle('fire').quake, 0, 'only earth, thunder and volleys shake');
});

test('an area ability reports every cell it covered; a single-target one reports nothing', () => {
    const caster = mk('Caster', 'earthshaker', 'player', 1, 2, ['tremor', 'stone_fist']);
    const foe = mk('Foe', 'goblin', 'enemy', 5, 2);
    const battle = new TacticalBattle(map, [caster, foe]);
    const areas = [];
    battle.onEvent = (type, d) => { if (type === 'area') areas.push(d); };
    battle.applyEnemyAbility(caster, 'tremor', 5, 2);
    caster._charging && (caster._charging.ct = caster._charging.needed, battle.checkAndFireCharges());
    assert.equal(areas.length, 1);
    assert.equal(areas[0].ability, 'tremor');
    assert.equal(areas[0].cells.length, 13, 'radius 2 on open ground');
    assert.ok(areas[0].cells.includes(cellKey(5, 2, 0)) && areas[0].cells.includes(cellKey(3, 2, 0)));
    assert.deepEqual([areas[0].center.x, areas[0].center.y], [5, 2]);

    areas.length = 0;
    battle.applyEnemyAbility(caster, 'stone_fist', 5, 2);
    assert.equal(areas.length, 0);
});

test('a corpse burst reports the cells around the body', () => {
    const gc = mk('Grave', 'gravecaller', 'player', 1, 2, ['corpse_burst']);
    const body = mk('Body', 'goblin', 'enemy', 4, 2);
    body.hp = 0; body.status.push('unconscious');
    const battle = new TacticalBattle(map, [gc, body]);
    const areas = [];
    battle.onEvent = (type, d) => { if (type === 'area') areas.push(d); };
    battle.applyEnemyAbility(gc, 'corpse_burst', 4, 2);
    assert.equal(areas.length, 1);
    assert.ok(areas[0].cells.includes(cellKey(4, 2, 0)) && areas[0].cells.includes(cellKey(5, 2, 0)));
});

// ---- Shaking tiles ----------------------------------------------------------------------

function terrainOf(m) {
    return buildTerrainMesh(m, null, () => null);
}

// The y of every top-face vertex of a cell, from the built terrain.
function topYs(terrain, m, key) {
    const out = [];
    for (const mesh of terrain.pickMeshes) {
        const attr = mesh.geometry.attributes.position;
        mesh.userData.owners.forEach((owner, q) => {
            const o = decodeOwner(m, owner);
            if (`${o.x},${o.y},${o.z}` === key && o.face === FACE.TOP) for (let v = 0; v < 4; v++) out.push(attr.getY(q * 4 + v));
        });
    }
    return out;
}

test('a quaking tile heaves and settles back exactly, and its neighbours stay put', () => {
    const terrain = terrainOf(map);
    const shaker = new TerrainShaker(terrain, map);
    const hit = cellKey(3, 2, 0), still = cellKey(6, 4, 0);
    const base = topYs(terrain, map, hit), baseStill = topYs(terrain, map, still);
    shaker.quake([{ key: hit, delay: 0 }], { amp: 0.1, ms: 600, now: 1000 });

    shaker.update(1050);   // 1/12 of the way: rising
    assert.ok(shaker.offsetAt(hit, 1050) > 0);
    const moved = topYs(terrain, map, hit);
    assert.ok(moved.every((y, i) => y > base[i]), 'the whole top face lifts');
    assert.deepEqual(topYs(terrain, map, still), baseStill);

    shaker.update(1700);   // after the quake
    assert.deepEqual(topYs(terrain, map, hit), base, 'back exactly where it was');
    assert.equal(shaker.busy, false);
});

test('a quake ripples: a tile with a delay waits its turn, and a tile\'s side faces stretch with it', () => {
    const hill = gridMap(['....', '....'], ['0100', '0000']);   // (1,0) is a raised block with open sides
    const terrain = terrainOf(hill);
    const shaker = new TerrainShaker(terrain, hill);
    const key = cellKey(1, 0, 1);
    shaker.quake([{ key, delay: 200 }], { amp: 0.1, ms: 600, now: 0 });
    assert.equal(shaker.offsetAt(key, 100), 0, 'not yet');
    assert.ok(shaker.offsetAt(key, 250) !== 0);
    // Sides of the raised block: top edges move, bottom edges stay.
    const sides = [];
    for (const mesh of terrain.pickMeshes) {
        const attr = mesh.geometry.attributes.position;
        mesh.userData.owners.forEach((owner, q) => {
            const o = decodeOwner(hill, owner);
            if (`${o.x},${o.y},${o.z}` !== key || o.face === FACE.TOP || o.face === FACE.BOTTOM) return;
            for (let v = 0; v < 4; v++) sides.push({ attr, i: q * 4 + v, y0: attr.getY(q * 4 + v) });
        });
    }
    assert.ok(sides.length >= 8, 'the raised block shows its sides');
    const topEdge = Math.max(...sides.map(s => s.y0));
    shaker.update(250);
    const lift = shaker.offsetAt(key, 250);
    for (const v of sides) {
        const dy = v.attr.getY(v.i) - v.y0;
        if (v.y0 >= topEdge - 1e-6) assert.ok(Math.abs(dy - lift) < 1e-6, 'top edge rides the quake');
        else assert.equal(dy, 0, 'bottom edge stays');
    }
});

test('a stronger quake on a shaking tile takes over; a weaker one doesn\'t', () => {
    const terrain = terrainOf(map);
    const shaker = new TerrainShaker(terrain, map);
    const key = cellKey(2, 2, 0);
    shaker.quake([{ key }], { amp: 0.2, ms: 600, now: 0 });
    shaker.quake([{ key }], { amp: 0.05, ms: 600, now: 100 });
    assert.equal(shaker.active.get(key).amp, 0.2);
    shaker.quake([{ key }], { amp: 0.3, ms: 600, now: 100 });
    assert.equal(shaker.active.get(key).amp, 0.3);
});

// ---- Timing -----------------------------------------------------------------------------

test('delayed tile effects wait for battle time, so they keep pace with the playback speed', () => {
    const scene = new THREE.Scene();
    const fx = new BattleFx(scene, () => null);
    let ran = 0;
    fx.later(200, () => ran++);
    fx.update(100, 48);
    assert.equal(ran, 0);
    fx.update(100, 48);
    assert.equal(ran, 1);
    fx.later(0, () => ran++);
    assert.equal(ran, 2, 'no delay: at once');

    fx.tileFlash({ x: 0, y: 0, z: 0 }, '#ff0000', { ms: 300 });
    assert.equal(fx.flashes.length, 1);
    fx.update(100, 48);
    assert.ok(fx.flashes[0].mesh.material.opacity > 0);
    fx.update(250, 48);
    assert.equal(fx.flashes.length, 0);
});

test('earth spells rumble as the ground heaves, and thunder cracks over its area', () => {
    assert.equal(battleEventSound('area', { ability: 'landslide' }), 'terraform');
    assert.equal(battleEventSound('area', { ability: 'stone_wall' }), null, 'terrain spells rumble as they are cast instead');
    assert.equal(battleEventSound('area', { ability: 'thunder' }), 'thunder');
    assert.equal(battleEventSound('area', { ability: 'fire' }), null);
});
