// Relics that change how a party plays (js/content/relics.js): battle triggers every member
// has (tactical/triggers.js), passives every member gains, and rare relics with a drawback.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { gridMap } from '../map-fixtures.mjs';
import { RunState } from '../../js/run/run-state.js';
import { buildUnits } from '../../js/tactical/build-units.js';
import { TacticalBattle } from '../../js/tactical/battle.js';
import { inflictStatus } from '../../js/tactical/abilities.js';
import { sourceName } from '../../js/tactical/battle-breakdown.js';

const field = () => gridMap(Array.from({ length: 6 }, () => '.'.repeat(10)));

function withRandom(value, fn) {
    const orig = Math.random;
    Math.random = () => value;
    try { return fn(); } finally { Math.random = orig; }
}

// A three-member party with `relics`, against two sturdy goblins, side by side.
function fight(relics) {
    const run = RunState.create({ jobs: ['warden', 'evoker', 'runebow'], seed: 11 });
    const encounter = { enemyLevel: 1, roster: [{ job: 'goblin', name: 'Goblin A' }, { job: 'goblin', name: 'Goblin B' }] };
    const units = buildUnits({ party: run.party, encounter, relics },
        [{ x: 0, y: 0 }, { x: 0, y: 2 }, { x: 0, y: 4 }], [{ x: 1, y: 0 }, { x: 9, y: 5 }]);
    for (const u of units) u.eva = 0;
    const battle = new TacticalBattle(field(), units);
    const party = units.filter(u => u.team === 'player');
    const [foeA, foeB] = units.filter(u => u.team === 'enemy');
    return { run, battle, party, foeA, foeB };
}

// Drops a unit to 0 HP through a real hit, so the battle sees the knockout.
function knockOutWithHit(battle, attacker, target) {
    target.hp = 1;
    attacker.atk = 999;
    withRandom(0.5, () => battle.applyEnemyAbility(attacker, 'attack', target.x, target.y));
    assert.equal(target.hp, 0, 'knocked out');
}

test("Martyr's Locket: when a member is knocked out, the others gain Haste", () => {
    // GIVEN: a party with the locket, one member next to an enemy
    const { battle, party, foeA } = fight(['martyrs_locket']);
    const [fallen, ...others] = party;

    // WHEN: the enemy knocks that member out
    knockOutWithHit(battle, foeA, fallen);

    // THEN: the rest of the party is hasted, and the fallen member isn't
    assert.ok(others.every(u => u.status.includes('haste')));
    assert.ok(!fallen.status.includes('haste'));
});

test('Bloodied Banner: Protect the first time a member drops below half HP, and only the first', () => {
    // GIVEN: a member at full HP with the banner
    const { battle, party, foeA } = fight(['bloodied_banner']);
    const tank = party[0];
    tank.maxHp = 1000;
    foeA.atk = 60;

    // WHEN: a hit takes it from just over half to below (but not out)
    tank.hp = 510;
    withRandom(0.5, () => battle.applyEnemyAbility(foeA, 'attack', tank.x, tank.y));

    // THEN: it gains Protect, and not again after it wears off and it is hit once more
    assert.ok(tank.hp < 500 && tank.hp > 0);
    assert.ok(tank.status.includes('protect'));
    tank.status = tank.status.filter(s => s !== 'protect');
    withRandom(0.5, () => battle.applyEnemyAbility(foeA, 'attack', tank.x, tank.y));
    assert.ok(!tank.status.includes('protect'), 'once per battle');
});

test("Executioner's Mark heals the member who lands the knockout; Soul Lantern gives everyone MP", () => {
    // GIVEN: a wounded, drained party with both relics, one member next to an enemy
    const { battle, party, foeA } = fight(['executioners_mark', 'soul_lantern']);
    const [killer, other] = party;
    killer.hp = 10;
    for (const u of party) u.mp = 0;

    // WHEN: that member knocks the enemy out
    knockOutWithHit(battle, killer, foeA);

    // THEN: the killer heals 15% of max HP, and every member has 5 MP
    assert.equal(killer.hp, 10 + Math.round(killer.maxHp * 0.15));
    assert.equal(other.hp, other.maxHp);
    assert.ok(party.every(u => u.mp === 5));
    // The breakdown lists the heal under the relic's name.
    const row = battle.stats.rows('player').find(r => r.name === killer.name);
    assert.deepEqual(row.abilities.filter(a => a.healed).map(a => sourceName(a.key)), ["Executioner's Mark"]);
});

test("a summoned creature or a copy falling doesn't set off knockout triggers", () => {
    // GIVEN: a party with the locket and a summoned wolf
    const { battle, party, foeA } = fight(['martyrs_locket']);
    const wolf = battle._resolveSummon(party[1], { summonJob: 'summoned_wolf', summonName: 'Wolf' }, 2, 0);
    wolf.eva = 0;

    // WHEN: the wolf is knocked out
    knockOutWithHit(battle, foeA, wolf);

    // THEN: nobody gains Haste
    assert.ok(party.every(u => !u.status.includes('haste')));
});

test('Leech Fang: every member heals for 10% of the damage they deal, on top of their own support', () => {
    // GIVEN: a wounded member with the fang next to a sturdy enemy
    const { battle, party, foeA } = fight(['leech_fang']);
    const hitter = party[0];
    hitter.hp = 10;
    foeA.maxHp = foeA.hp = 500;

    // WHEN: it strikes
    withRandom(0.5, () => battle.applyEnemyAbility(hitter, 'attack', foeA.x, foeA.y));

    // THEN: it healed 10% of the damage dealt
    const dealt = 500 - foeA.hp;
    assert.ok(dealt > 0);
    assert.equal(hitter.hp, 10 + Math.round(dealt * 0.1));
});

test('Glass Sigil: more power for less max HP, and a wounded member is never taken below 1 HP', () => {
    // GIVEN: a member down to 5 HP
    const run = RunState.create({ jobs: ['warden', 'evoker', 'runebow'], seed: 11 });
    const m = run.party[0];
    const maxBefore = run.maxHp(m);
    m.hp = 5;

    // WHEN: the party takes the sigil
    run.addRelic('glass_sigil');

    // THEN: max HP is 15 lower, and the wounded member is at 1 HP, not below
    assert.equal(run.maxHp(m), maxBefore - 15);
    assert.equal(run.hp(m), 1);
});

test("Gambler's Crown: shop prices are 30% higher", () => {
    const run = RunState.create({ jobs: ['warden', 'evoker', 'runebow'], seed: 11 });
    const before = run._discount(100);
    run.addRelic('gamblers_crown');
    assert.equal(run._discount(100), Math.round(before * 1.3));
});

test("statuses from triggers respect the holder's immunities", () => {
    // A trigger gives its status through the same rules as any other (inflictStatus).
    const { party } = fight([]);
    party[0].bonusPassives = ['iron_will'];
    assert.equal(inflictStatus(party[0], 'stun', 2), false);
});
