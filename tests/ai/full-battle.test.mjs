// Headless auto-battles on the real maps, real unit builder and real turn
// dispatcher (runAutoTurn): player characters follow their scripts, enemies use
// the scoring AI, and nobody ever waits for manual input.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { loadMapData } from '../../js/tactical/battle-map.js';
import { MAP_DATA } from '../../js/tactical/data/maps/index.js';
import { TacticalBattle, STATES } from '../../js/tactical/battle.js';
import { CHARACTER_DATA } from '../../js/tactical/data/characters.js';
import { ENCOUNTERS, buildEncounter, realmEncounters } from '../../js/run/data/encounters.js';
import { ACT_REALMS } from '../../js/run/data/realms.js';
import { RunState } from '../../js/run/run-state.js';
import { createMember } from '../../js/run/data/recruits.js';
import { Rng } from '../../js/run/rng.js';
import { buildUnits } from '../../js/tactical/build-units.js';
import { runAutoTurn } from '../../js/tactical/ai/executor.js';
import { runRealtimeBattle } from '../../js/tactical/realtime.js';
import { abilitiesForMember } from '../../js/tactical/ai/party.js';
import { autoScriptFor } from '../../js/tactical/ai/default-scripts.js';
import { promote, PROMOTION_LEVEL } from '../../js/tactical/loadout.js';

const MAX_TURNS = 3000;
const players = () => CHARACTER_DATA.filter(c => c.team === 'player');

// The real-time flow every automatic battle uses.
function playRealtime(mapDef, setup = null) {
    const map = loadMapData(mapDef);
    const units = buildUnits(setup, map.playerSpawns, map.enemySpawns);
    const battle = new TacticalBattle(map, units);
    let scriptedTurns = 0;
    const rt = runRealtimeBattle(battle, { hooks: { onTurn: (u) => { if (u.script) scriptedTurns++; } } });
    return { battle, turns: rt.turnsTaken, scriptedTurns, rt };
}

// The turn-by-turn flow (still used when commanding units by hand).
function playBattle(mapDef, setup = null) {
    const map = loadMapData(mapDef);
    const units = buildUnits(setup, map.playerSpawns, map.enemySpawns);
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
    const units = buildUnits(null, map.playerSpawns, map.enemySpawns).filter(u => u.team === 'player');
    for (const member of players()) {
        const unit = units.find(u => u.name === member.name);
        assert.deepEqual(abilitiesForMember(member), unit.abilities, member.name);
    }
});

test('promotion, learning and equipment grants from the Party menu flow into the unit and its script', () => {
    const party = players().map(c => ({
        ...c, learned: [...c.learned], loadout: { ...c.loadout },
        appearance: c.appearance ? { ...c.appearance } : null,
    }));
    const aldric = party.find(m => m.name === 'Aldric');
    aldric.level = PROMOTION_LEVEL;
    assert.ok(promote(aldric, 'paladin'));
    aldric.learned.push('smite', 'fire');  // fire isn't in Aldric's kits: never usable
    aldric.ranks = { smite: 2 };
    aldric.appearance.toolKey = 'lantern'; // grants First Aid
    const map = loadMapData(MAP_DATA[0]);
    const unit = buildUnits({ party }, map.playerSpawns, map.enemySpawns).find(u => u.name === 'Aldric');

    assert.equal(unit.job, 'paladin');
    assert.deepEqual(abilitiesForMember(aldric), unit.abilities);
    assert.deepEqual(unit.abilities, ['attack', 'ward', 'smite@2', 'first_aid']);
    assert.deepEqual(unit.skillsets.map(s => s.name), ['Abjuration', 'Holy Arts']);
    assert.deepEqual(unit.script, autoScriptFor('paladin', unit.abilities), 'default behavior follows the new job and skills');
});

test('only player characters get scripts. Enemies keep the scoring AI', () => {
    const map = loadMapData(MAP_DATA[0]);
    const units = buildUnits({ encounter: ENCOUNTERS.wild_frontiers.normal[0] }, map.playerSpawns, map.enemySpawns);
    assert.ok(units.some(u => u.team === 'enemy'));
    for (const u of units) assert.equal(!!u.script, u.team === 'player', u.name);
});

// A fresh run party of `size` members, one per starting role.
function runParty(size, seed) {
    const rng = new Rng(seed);
    const jobs = ['warden', 'evoker', 'runebow', 'spellblade', 'stoneshaper', 'seer'];
    const party = [];
    for (let i = 0; i < size; i++) party.push(createMember(rng, jobs[i], party.map(m => m.name)));
    return party;
}

test('fully automatic battles finish on every map, for any party size and act', () => {
    const results = { player: 0, enemy: 0 };
    const cases = [[3, 1, 'normal'], [4, 2, 'elite'], [6, 3, 'boss']];
    MAP_DATA.forEach((mapDef, i) => {
        for (const [size, act, kind] of cases) {
            // Rotate through the act's realms, and the fights folded into them, so they all get played.
            const realm = ACT_REALMS[act][i % ACT_REALMS[act].length];
            const fights = realmEncounters(realm, kind);
            const { def, zone } = fights[i % fights.length];
            const party = runParty(size, size * 7 + act);
            const encounter = buildEncounter(def, kind, act, size, false, realm, zone);
            const { battle, turns, scriptedTurns } = playRealtime(mapDef, { party, encounter });
            const label = `${mapDef.id} / ${size}v${encounter.roster.length} act ${act} ${realm}/${zone} ${kind}`;
            assert.equal(battle.state, STATES.BATTLE_OVER, `${label} stalled after ${turns} turns`);
            assert.ok(battle.winner === 'player' || battle.winner === 'enemy');
            assert.ok(scriptedTurns > 0, 'player scripts actually ran');
            results[battle.winner]++;
        }
    });
    console.log('winners over', MAP_DATA.length * cases.length, 'battles:', results);
});

test('a run party carries its wounds and relics into battle', () => {
    const run = RunState.create({ jobs: ['warden', 'evoker', 'runebow'], seed: 3 });
    const [a] = run.party;
    a.hp = 5;
    run.relics.push('stone_heart', 'war_banner');
    const map = loadMapData(MAP_DATA[0]);
    const units = buildUnits({ party: run.party, encounter: ENCOUNTERS.wild_frontiers.normal[0], relics: run.relics }, map.playerSpawns, map.enemySpawns);
    const ua = units.find(u => u.name === a.name);
    assert.equal(ua.hp, 5);
    assert.equal(ua.maxHp, run.maxHp(a));
    assert.ok(units.filter(u => u.team === 'player').every(u => u.status.includes('haste')));
    assert.ok(units.filter(u => u.team === 'enemy').every(u => !u.status.includes('haste')));
});

test('no two units ever share a tile at the end of a battle, in either flow', () => {
    for (const play of [playBattle, playRealtime]) {
        const { battle } = play(MAP_DATA[0], { encounter: ENCOUNTERS.wild_frontiers.normal[0] });
        const seen = new Set();
        for (const u of battle.livingUnits) {
            const key = `${u.x},${u.y},${u.z}`;
            assert.ok(!seen.has(key), `two units on ${key}`);
            seen.add(key);
        }
    }
});

test('the turn-by-turn flow still finishes battles', () => {
    const { battle } = playBattle(MAP_DATA[0], { encounter: ENCOUNTERS.wild_frontiers.normal[0] });
    assert.equal(battle.state, STATES.BATTLE_OVER);
});

