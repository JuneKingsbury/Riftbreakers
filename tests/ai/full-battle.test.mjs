// Headless auto-battles on the real maps, real unit builder and real turn
// dispatcher (runAutoTurn): player characters follow their scripts, enemies use
// the scoring AI, and nobody ever waits for manual input.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { loadMapData } from '../../js/tactical/battle-map.js';
import { MAP_DATA } from '../../js/tactical/data/maps.js';
import { TacticalBattle, STATES } from '../../js/tactical/battle.js';
import { CHARACTER_DATA } from '../../js/tactical/data/characters.js';
import { BATTLE_SCENARIOS } from '../../js/tactical/world-map-data.js';
import { buildUnits } from '../../js/tactical/build-units.js';
import { runAutoTurn } from '../../js/tactical/ai/executor.js';
import { abilitiesForMember } from '../../js/tactical/ai/party.js';
import { defaultScriptFor } from '../../js/tactical/ai/default-scripts.js';

const MAX_TURNS = 3000;
const players = () => CHARACTER_DATA.filter(c => c.team === 'player');

function playBattle(mapDef, scenarioId, worldMap = null) {
    const map = loadMapData(mapDef);
    const units = buildUnits(worldMap, scenarioId, map.playerSpawns, map.enemySpawns);
    const battle = new TacticalBattle(map, units);
    const autoUnits = new Set(units.filter(u => u.team === 'player').map(u => u.id));
    let turns = 0;
    let scriptedTurns = 0;
    while (battle.state !== STATES.BATTLE_OVER && turns < MAX_TURNS) {
        const unit = battle.advanceCT();
        assert.ok(unit, 'someone is always ready to act');
        battle.startTurn(unit);
        if (battle.state === STATES.ENEMY_TURN || battle.state === STATES.PLAYER_TURN) {
            // Same rule as BattleScene: with no manual control, no turn waits for input.
            if (unit.script && !unit.status.includes('charm')) scriptedTurns++;
            runAutoTurn(unit, battle, null);
        }
        for (const id of battle._pendingSummons) autoUnits.add(id);
        battle._pendingSummons = [];
        battle.checkAndFireCharges();
        turns++;
    }
    return { battle, turns, scriptedTurns };
}

test('a party member\'s ability list matches the unit BattleScene builds', () => {
    const map = loadMapData(MAP_DATA[0]);
    const units = buildUnits(null, 'none', map.playerSpawns, map.enemySpawns).filter(u => u.team === 'player');
    for (const member of players()) {
        const unit = units.find(u => u.name === member.name);
        assert.deepEqual(abilitiesForMember(member), unit.abilities, member.name);
    }
});

test('class and support-skill changes from the Party menu flow into the unit and its script', () => {
    const party = players().map(c => ({ ...c, xp: { ...c.xp }, appearance: c.appearance ? { ...c.appearance } : null }));
    const aldric = party.find(m => m.name === 'Aldric');
    aldric.job = 'evoker';                 // class change
    aldric.xp.evoker = 400;                // enough job levels to unlock abilities
    aldric.supportSkill = 'heal';          // cross-job slot
    const map = loadMapData(MAP_DATA[0]);
    const unit = buildUnits({ party }, 'none', map.playerSpawns, map.enemySpawns).find(u => u.name === 'Aldric');

    assert.equal(unit.job, 'evoker');
    assert.deepEqual(abilitiesForMember(aldric), unit.abilities);
    assert.ok(unit.abilities.includes('heal'), 'support skill is available to the script');
    assert.deepEqual(unit.script, defaultScriptFor('evoker'), 'default script follows the new class');
});

test('only player characters get scripts. Enemies keep the scoring AI', () => {
    const map = loadMapData(MAP_DATA[0]);
    const units = buildUnits(null, 'bandit_ambush', map.playerSpawns, map.enemySpawns);
    assert.ok(units.some(u => u.team === 'enemy'));
    for (const u of units) assert.equal(!!u.script, u.team === 'player', u.name);
});

test('fully automatic battles finish on every map', () => {
    const scenarios = Object.keys(BATTLE_SCENARIOS).slice(0, 3);
    const results = { player: 0, enemy: 0 };
    for (const mapDef of MAP_DATA) {
        for (const scenarioId of scenarios) {
            const { battle, turns, scriptedTurns } = playBattle(mapDef, scenarioId);
            assert.equal(battle.state, STATES.BATTLE_OVER, `${mapDef.id} / ${scenarioId} stalled after ${turns} turns`);
            assert.ok(battle.winner === 'player' || battle.winner === 'enemy');
            assert.ok(scriptedTurns > 0, 'player scripts actually ran');
            results[battle.winner]++;
        }
    }
    console.log('winners over', MAP_DATA.length * scenarios.length, 'battles:', results);
});

test('no two units ever share a tile at the end of a battle', () => {
    const { battle } = playBattle(MAP_DATA[0], Object.keys(BATTLE_SCENARIOS)[0]);
    const seen = new Set();
    for (const u of battle.livingUnits) {
        const key = `${u.x},${u.y}`;
        assert.ok(!seen.has(key), `two units on ${key}`);
        seen.add(key);
    }
});
