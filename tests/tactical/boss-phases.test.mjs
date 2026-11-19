// Boss phases (an encounter's `phases`, tactical/triggers.js): the first time the boss's HP
// falls below a phase's threshold, it announces it and gains its effects, its allies theirs,
// and reinforcements scaled like the roster join near it.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { gridMap } from '../map-fixtures.mjs';
import { buildUnits } from '../../js/tactical/build-units.js';
import { TacticalBattle, STATES } from '../../js/tactical/battle.js';
import { runRealtimeBattle } from '../../js/tactical/realtime.js';
import { buildEncounter, realmEncounters, ENCOUNTERS } from '../../js/run/data/encounters.js';
import { ACT_REALMS, REALMS } from '../../js/run/data/realms.js';
import { RunState } from '../../js/run/run-state.js';
import { isConscious } from '../../js/tactical/units.js';
import { loadMapData } from '../../js/tactical/battle-map.js';
import { MAP_DATA } from '../../js/tactical/data/maps/index.js';

const field = () => gridMap(Array.from({ length: 8 }, () => '.'.repeat(12)));

function withRandom(value, fn) {
    const orig = Math.random;
    Math.random = () => value;
    try { return fn(); } finally { Math.random = orig; }
}

// A small boss fight: the boss, one ally, and a phase at half HP.
function bossFight(phase) {
    const def = {
        id: 'test_boss', name: 'Test', enemyLevel: 2,
        roster: [{ job: 'orc_captain', name: 'Warlord', statMods: { maxHp: 900 } }, { job: 'raider', name: 'Lackey' }],
        phases: [{ at: 0.5, say: 'The Warlord bellows!', ...phase }],
    };
    const encounter = buildEncounter(def, 'boss', 2, 1);
    const run = RunState.create({ jobs: ['warden'], seed: 3 });
    const units = buildUnits({ party: run.party, encounter }, [{ x: 4, y: 4 }], [{ x: 5, y: 4 }, { x: 8, y: 1 }]);
    for (const u of units) u.eva = 0;
    const battle = new TacticalBattle(field(), units);
    const [hero] = units.filter(u => u.team === 'player');
    const [boss, lackey] = units.filter(u => u.team === 'enemy');
    hero.atk = 300;
    return { battle, hero, boss, lackey, encounter };
}

const strike = (battle, hero, boss) => withRandom(0.5, () => battle.applyEnemyAbility(hero, 'attack', boss.x, boss.y));

test('a phase sets off the first time the boss drops below its threshold, and only then', () => {
    // GIVEN: a boss whose phase hastes it at half HP
    const { battle, hero, boss } = bossFight({ status: { status: 'haste', duration: 3 } });
    boss.hp = Math.round(boss.maxHp * 0.6);

    // WHEN: a hit takes it below half
    strike(battle, hero, boss);

    // THEN: it is hasted, the phase is announced, and it doesn't happen again
    assert.ok(boss.hp < boss.maxHp * 0.5 && boss.hp > 0);
    assert.ok(boss.status.includes('haste'));
    assert.ok(battle.log.includes('The Warlord bellows!'));
    boss.status = boss.status.filter(s => s !== 'haste');
    strike(battle, hero, boss);
    assert.ok(!boss.status.includes('haste'), 'once per battle');
});

test('a phase above the HP the boss still has does nothing yet', () => {
    const { battle, hero, boss } = bossFight({ status: { status: 'haste', duration: 3 } });
    hero.atk = 1;
    strike(battle, hero, boss);
    assert.ok(boss.hp > boss.maxHp * 0.5);
    assert.ok(!boss.status.includes('haste'));
});

test('reinforcements join near the boss as full enemies, scaled like the rest of the fight', () => {
    // GIVEN: a boss that calls two raiders at half HP
    const { battle, hero, boss, encounter } = bossFight({ summon: [{ job: 'raider', name: 'Reserve' }, { job: 'raider', name: 'Reserve' }] });
    boss.hp = Math.round(boss.maxHp * 0.6);
    const before = battle.units.length;

    // WHEN: it drops below half
    strike(battle, hero, boss);

    // THEN: two raiders stand next to it, its side, carrying the fight's act scaling
    const added = battle.units.slice(before);
    assert.deepEqual(added.map(u => u.name), ['Reserve', 'Reserve']);
    for (const u of added) {
        assert.equal(u.team, 'enemy');
        assert.equal(u.summonerId, undefined, 'a real enemy, not a summon');
        assert.ok(Math.abs(u.x - boss.x) + Math.abs(u.y - boss.y) <= 3);
        assert.ok(!battle.units.some(o => o !== u && !o.status.includes('dead') && o.x === u.x && o.y === u.y && o.z === u.z), 'on a free cell');
    }
    assert.deepEqual(encounter.phases[0].summon[0].statMods, encounter.roster[1].statMods, 'scaled like the roster');
    assert.ok(isConscious(added[0]));
});

test("a phase can heal and cleanse the boss and strengthen its allies", () => {
    // GIVEN: a poisoned boss whose phase heals, cleanses and hastes its allies
    const { battle, hero, boss, lackey } = bossFight({ healPct: 0.2, cleanse: true, allies: { status: { status: 'haste', duration: 3 } } });
    boss.hp = Math.round(boss.maxHp * 0.6);
    boss.status.push('poison');

    // WHEN: it drops below half
    strike(battle, hero, boss);

    // THEN
    const healed = battle.stats.rows('enemy').find(r => r.name === 'Warlord').healed;
    assert.equal(healed, Math.round(boss.maxHp * 0.2), 'healed 20% of max HP');
    assert.ok(!boss.status.includes('poison'), 'cleansed');
    assert.ok(lackey.status.includes('haste'), 'its ally is hasted');
    assert.ok(!hero.status.includes('haste'), 'the party is not');
});

test('every act boss has at least one phase, and every boss fight with phases plays to the end', () => {
    const fielded = Object.values(ACT_REALMS).flat().flatMap(r => REALMS[r].bosses);
    const defs = Object.values(ENCOUNTERS).flatMap(z => z.boss);
    for (const id of fielded) assert.ok(defs.find(d => d.id === id)?.phases?.length, `${id} has phases`);

    for (const [act, realms] of Object.entries(ACT_REALMS)) {
        for (const realm of realms) {
            for (const { def, zone } of realmEncounters(realm, 'boss')) {
                const run = RunState.create({ jobs: ['warden', 'evoker', 'runebow'], seed: 5 });
                const encounter = buildEncounter(def, 'boss', Number(act), 3, false, realm, zone);
                const map = loadMapData(MAP_DATA[0]);
                const units = buildUnits({ party: run.party, encounter }, map.playerSpawns, map.enemySpawns);
                const battle = new TacticalBattle(map, units);
                runRealtimeBattle(battle);
                assert.equal(battle.state, STATES.BATTLE_OVER, `${def.id} finished`);
            }
        }
    }
});
