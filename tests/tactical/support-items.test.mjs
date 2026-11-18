// Support items: the Drum of Rallying is an off-hand anyone can carry, and its Rallying Beat
// buffs a group of allies (never enemies), which the automatic tactics know how to use.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createUnit } from '../../js/tactical/units.js';
import { standZ } from '../../js/tactical/battle-map.js';
import { TacticalBattle } from '../../js/tactical/battle.js';
import { getEffectiveStat } from '../../js/tactical/abilities.js';
import { JOB_DATA } from '../../js/content/jobs.js';
import { EQUIPMENT } from '../../js/tactical/data/equipment.js';
import { allowedEquipTypes } from '../../js/tactical/data-registry.js';
import { runScript } from '../../js/tactical/ai/script-runtime.js';
import { autoScriptFor } from '../../js/tactical/ai/default-scripts.js';
import { gridMap } from '../map-fixtures.mjs';

const map = gridMap(Array.from({ length: 5 }, () => '.'.repeat(14)));
const mk = (name, job, team, x, y, extraAbilities = []) =>
    createUnit(name, job, team, x, y, { z: standZ(map, x, y), extraAbilities });

test('the Drum of Rallying is a tool every player job can carry', () => {
    const drum = EQUIPMENT.drum_of_rallying;
    assert.equal(drum.slot, 'tool');
    assert.deepEqual(drum.grants, ['rallying_beat']);
    const playerJobs = Object.keys(JOB_DATA).filter(j => JOB_DATA[j].tier);
    for (const job of playerJobs) {
        const types = allowedEquipTypes(job, 'tool');
        assert.ok(types === null || types.has(drum.type), `${job} can carry it`);
    }
});

test('Rallying Beat raises ATK and MAT for allies in the area, and not for enemies standing in it', () => {
    const drummer = mk('Drummer', 'novice', 'player', 3, 2, ['rallying_beat']);
    const near = mk('Near', 'novice', 'player', 5, 2);
    const far = mk('Far', 'novice', 'player', 9, 2);
    const foe = mk('Foe', 'goblin', 'enemy', 5, 3);
    const battle = new TacticalBattle(map, [drummer, near, far, foe]);
    const atk = u => getEffectiveStat(u, 'atk');
    const before = [near, far, foe].map(atk);

    battle.applyEnemyAbility(drummer, 'rallying_beat', near.x, near.y);

    assert.equal(atk(near), before[0] + 2);
    assert.equal(getEffectiveStat(near, 'mat'), near.mat + 2);
    assert.equal(atk(far), before[1], 'out of the area');
    assert.equal(atk(foe), before[2], 'enemies are never rallied');
});

test('automatic tactics beat the drum for the group once enemies are near, and not again while it lasts', () => {
    const drummer = mk('Drummer', 'novice', 'player', 3, 2, ['rallying_beat']);
    const a = mk('A', 'novice', 'player', 4, 1);
    const b = mk('B', 'novice', 'player', 4, 3);
    const c = mk('C', 'novice', 'player', 5, 2);
    const foe = mk('Foe', 'goblin', 'enemy', 8, 2);
    const units = [drummer, a, b, c, foe];
    const script = autoScriptFor('novice', drummer.abilities);

    const first = runScript(script, drummer, units, map);
    assert.equal(first.act.kind, 'ability');
    assert.equal(first.act.ability, 'rallying_beat');
    assert.ok([a, b, c].some(u => u.id === first.act.targetId), 'aimed at the group, never at the enemy');

    for (const u of [a, b, c]) u.buffs.push({ key: 'rallying_beat', stat: 'atk', value: 2, duration: 3 });
    const second = runScript(script, drummer, units, map);
    assert.notEqual(second.act.ability, 'rallying_beat', 'everyone is still rallied');

    foe.x = 13;   // far off: no need yet
    for (const u of [a, b, c]) u.buffs = [];
    assert.notEqual(runScript(script, drummer, units, map).act.ability, 'rallying_beat');
});
