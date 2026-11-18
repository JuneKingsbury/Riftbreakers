// The four added starting classes (Illusionist, Gravecaller, Alchemist, Warlord) and their
// promotions: their mechanics as battles play them, and the automatic tactics using them.
//   - splashes that reach both sides, and Steady Hands keeping them to one
//   - corpse rites on knocked-out enemies (raise, burst, ward)
//   - lures (Mirror Image), taunts and hiding (Vanish), as enemies see them
//   - orders: speed gauges (Rally, Delay), swapping places, undodgeable commands
//   - knockout and charge triggers, and the new supports
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { gridMap } from '../map-fixtures.mjs';
import { createUnit } from '../../js/tactical/units.js';
import { standZ } from '../../js/tactical/battle-map.js';
import { TacticalBattle } from '../../js/tactical/battle.js';
import { resolveAbility, getEffectiveStat } from '../../js/tactical/abilities.js';
import { ABILITIES, JOB_STATS, jobsOfTier } from '../../js/tactical/data-registry.js';
import { JOB_DATA } from '../../js/content/jobs.js';
import { planEnemyTurn } from '../../js/tactical/enemy-ai.js';
import { planTurn } from '../../js/tactical/ai/executor.js';
import { runScript } from '../../js/tactical/ai/script-runtime.js';
import { autoScriptFor } from '../../js/tactical/ai/default-scripts.js';
import { buildUnits } from '../../js/tactical/build-units.js';
import { UNLOCKS, runOptions, newProfile } from '../../js/run/profile.js';
import { STARTING_GEAR } from '../../js/run/data/recruits.js';

const NEW_CLASSES = ['illusionist', 'gravecaller', 'alchemist', 'warlord'];
const map = gridMap(Array.from({ length: 7 }, () => '.'.repeat(14)));

// A unit on the fixture map with exactly these abilities and passives, never dodging by luck.
function mk(name, job, team, x, y, { abilities = ['attack'], reaction = null, support = null, movement = null, ...extra } = {}) {
    const u = createUnit(name, job, team, x, y, { z: standZ(map, x, y) });
    return Object.assign(u, { abilities, reaction, support, movement, eva: 0 }, extra);
}
const knockOut = (u) => { u.hp = 0; u.status.push('unconscious'); u.deathTimer = 3; return u; };
const withRandom = (value, fn) => {
    const orig = Math.random;
    Math.random = () => value;
    try { return fn(); } finally { Math.random = orig; }
};

// ---- The classes ----------------------------------------------------------------------

test('ten starting classes, the four new ones unlocked with renown and dressed when they join', () => {
    const starters = jobsOfTier(1);
    assert.equal(starters.length, 10);
    for (const job of NEW_CLASSES) {
        assert.ok(starters.includes(job), job);
        const unlock = Object.values(UNLOCKS).find(u => u.job === job);
        assert.ok(unlock, `${job} unlock`);
        assert.equal(JOB_DATA[job].promotions.length, 2);
    }
    for (const job of starters) assert.ok(STARTING_GEAR[job], `${job} has starting gear`);
    assert.ok(!runOptions(newProfile()).jobs.includes('warlord'), 'locked at first');
    const profile = { ...newProfile(), unlocked: ['job_warlord', 'job_gravecaller'] };
    assert.ok(runOptions(profile).jobs.includes('warlord') && runOptions(profile).jobs.includes('gravecaller'));
});

test('the Alchemist line has no MP and its flasks cost none', () => {
    for (const job of ['alchemist', 'plaguewright', 'field_surgeon']) {
        assert.equal(JOB_STATS[job].maxMp, 0, job);
        for (const k of Object.keys(JOB_DATA[job].learnable)) {
            const ab = ABILITIES[k];
            assert.equal(ab.mpCost ?? 0, 0, `${k} costs MP`);
            if (ab.slot === 'support') assert.equal(ab.passiveMpCost ?? 0, 0, `${k} drains MP`);
        }
    }
});

// ---- Splashes ---------------------------------------------------------------------------

test('a splash reaches both sides: Healing Draught heals the enemy too, and Acid Flask burns allies', () => {
    const alch = mk('Alch', 'alchemist', 'player', 1, 3, { abilities: ['healing_draught', 'acid_flask'] });
    const friend = mk('Friend', 'novice', 'player', 5, 3, { hp: 10 });
    const foe = mk('Foe', 'goblin', 'enemy', 6, 3, { hp: 10 });
    const battle = new TacticalBattle(map, [alch, friend, foe]);
    battle.applyEnemyAbility(alch, 'healing_draught', 5, 3);
    assert.ok(friend.hp > 10 && foe.hp > 10, 'both healed');

    const before = [friend.hp, foe.hp];
    withRandom(0.5, () => battle.applyEnemyAbility(alch, 'acid_flask', 5, 3));
    assert.ok(friend.hp < before[0] && foe.hp < before[1], 'both burned');
    assert.ok(getEffectiveStat(friend, 'def') < friend.def, 'and both lose DEF');
});

test('Steady Hands keeps a splash on the side it was meant for', () => {
    const alch = mk('Alch', 'field_surgeon', 'player', 1, 3, { abilities: ['healing_draught', 'acid_flask'], support: 'steady_hands' });
    const friend = mk('Friend', 'novice', 'player', 5, 3, { hp: 10 });
    const foe = mk('Foe', 'goblin', 'enemy', 6, 3, { hp: 10 });
    const battle = new TacticalBattle(map, [alch, friend, foe]);
    battle.applyEnemyAbility(alch, 'healing_draught', 5, 3);
    assert.ok(friend.hp > 10);
    assert.equal(foe.hp, 10, 'the heal skips the enemy');
    const hp = friend.hp;
    withRandom(0.5, () => battle.applyEnemyAbility(alch, 'acid_flask', 5, 3));
    assert.equal(friend.hp, hp, 'the acid skips the ally');
    assert.ok(foe.hp < 10);
});

test('the automatic Alchemist heals the group but never throws acid into its own side', () => {
    const alch = mk('Alch', 'alchemist', 'player', 1, 3, { abilities: ['attack', 'healing_draught', 'acid_flask'], mp: 0 });
    const hurt = mk('Hurt', 'novice', 'player', 3, 3, { hp: 8 });
    const foe = mk('Foe', 'goblin', 'enemy', 4, 3);
    const script = autoScriptFor('alchemist', alch.abilities);
    const units = [alch, hurt, foe];

    const healTurn = runScript(script, alch, units, map);
    assert.equal(healTurn.act.ability, 'healing_draught');

    hurt.hp = hurt.maxHp;
    const turn = runScript(script, alch, units, map);
    if (turn.act.ability === 'acid_flask') {
        const cx = turn.act.x, cy = turn.act.y;
        assert.ok(Math.abs(cx - hurt.x) + Math.abs(cy - hurt.y) > 1, 'no ally inside the splash');
    }
});

// ---- Corpse rites -----------------------------------------------------------------------

test('Raise Dead turns a knocked-out enemy into a skeleton for the caster, using up the body', () => {
    const gc = mk('Grave', 'gravecaller', 'player', 1, 3, { abilities: ['raise_dead'] });
    const body = knockOut(mk('Body', 'goblin', 'enemy', 3, 3));
    const other = mk('Other', 'goblin', 'enemy', 10, 3);
    const battle = new TacticalBattle(map, [gc, body, other]);
    battle.applyEnemyAbility(gc, 'raise_dead', 3, 3);
    gc._charging.ct = gc._charging.needed;
    battle.checkAndFireCharges();
    assert.ok(body.status.includes('dead'), 'the body is gone for good');
    const skeleton = battle.units.find(u => u.job === 'skeleton');
    assert.ok(skeleton, 'a skeleton rose');
    assert.equal(skeleton.team, 'player');
    assert.deepEqual([skeleton.x, skeleton.y], [3, 3]);
    assert.equal(skeleton.summonerId, gc.id);
});

test('a corpse rite with no body there fizzles, and does nothing', () => {
    const gc = mk('Grave', 'gravecaller', 'player', 1, 3, { abilities: ['corpse_burst'] });
    const foe = mk('Foe', 'goblin', 'enemy', 3, 3);
    const battle = new TacticalBattle(map, [gc, foe]);
    const hp = foe.hp;
    battle.applyEnemyAbility(gc, 'corpse_burst', 3, 3);
    assert.equal(foe.hp, hp, 'a standing enemy is not a body');
    assert.equal(battle.units.length, 2);
    assert.match(battle.log[0], /fizzles/);
});

test('Corpse Burst hits the enemies around the body and spares the caster\'s side', () => {
    const gc = mk('Grave', 'gravecaller', 'player', 1, 3, { abilities: ['corpse_burst'] });
    const body = knockOut(mk('Body', 'goblin', 'enemy', 5, 3));
    const nearFoe = mk('Near', 'goblin', 'enemy', 6, 3);
    const farFoe = mk('Far', 'goblin', 'enemy', 10, 3);
    const friend = mk('Friend', 'novice', 'player', 5, 4);
    const battle = new TacticalBattle(map, [gc, body, nearFoe, farFoe, friend]);
    const hp = [nearFoe.hp, farFoe.hp, friend.hp];
    withRandom(0.5, () => battle.applyEnemyAbility(gc, 'corpse_burst', 5, 3));
    assert.ok(nearFoe.hp < hp[0]);
    assert.equal(farFoe.hp, hp[1]);
    assert.equal(friend.hp, hp[2]);
    assert.ok(body.status.includes('dead'));
});

test('Bone Ward shields the allies around a body', () => {
    const gw = mk('Warden', 'gravewarden', 'player', 1, 3, { abilities: ['bone_ward'] });
    const body = knockOut(mk('Body', 'goblin', 'enemy', 4, 3));
    const friend = mk('Friend', 'novice', 'player', 4, 4);
    const battle = new TacticalBattle(map, [gw, body, friend]);
    battle.applyEnemyAbility(gw, 'bone_ward', 4, 3);
    assert.ok(friend.status.includes('protect'));
});

test('the automatic Gravecaller raises a fallen enemy in reach', () => {
    const gc = mk('Grave', 'gravecaller', 'player', 1, 3, { abilities: ['attack', 'life_drain', 'raise_dead'] });
    const body = knockOut(mk('Body', 'goblin', 'enemy', 3, 3));
    const foe = mk('Foe', 'goblin', 'enemy', 8, 3);
    const turn = runScript(autoScriptFor('gravecaller', gc.abilities), gc, [gc, body, foe], map);
    assert.equal(turn.act.ability, 'raise_dead');
    assert.equal(turn.act.targetId, body.id);
});

// ---- Lures, taunts and hiding -----------------------------------------------------------

test('enemies would rather strike a Mirror Image than the real Illusionist, and the copy never acts', () => {
    const ill = mk('Ill', 'illusionist', 'player', 4, 3, { abilities: ['mirror_image'] });
    const foe = mk('Foe', 'goblin', 'enemy', 6, 3, { abilities: ['attack'] });
    const battle = new TacticalBattle(map, [ill, foe]);
    battle.applyEnemyAbility(ill, 'mirror_image', 5, 3);
    const copy = battle.units.find(u => u.job === 'decoy');
    assert.ok(copy, 'a copy appeared');
    const plan = planEnemyTurn(foe, battle);
    assert.equal(plan.act.targetId, copy.id);
    assert.deepEqual(planTurn(copy, battle).act, { kind: 'wait' });
});

test('a taunted enemy goes after its taunter, and a hidden ally can\'t be picked', () => {
    const lord = mk('Lord', 'warlord', 'player', 3, 1, { abilities: ['taunt'] });
    const mage = mk('Mage', 'evoker', 'player', 6, 4, { hp: 5 });
    const foe = mk('Foe', 'goblin', 'enemy', 6, 3, { abilities: ['attack'] });
    const battle = new TacticalBattle(map, [lord, mage, foe]);
    assert.equal(planEnemyTurn(foe, battle).act.targetId, mage.id, 'goes for the weak mage first');
    withRandom(0.99, () => battle.applyEnemyAbility(lord, 'taunt', 5, 3));
    assert.ok(foe.status.includes('taunted'), 'orders can\'t be dodged');
    assert.equal(planEnemyTurn(foe, battle).act.targetId ?? null, planEnemyTurn(foe, battle).act.kind === 'ability' ? lord.id : null);
    assert.notEqual(planEnemyTurn(foe, battle).act.targetId, mage.id);

    foe.status = [];
    mage.status.push('hidden');
    assert.notEqual(planEnemyTurn(foe, battle).act.targetId, mage.id, 'hidden');
});

test('a hidden unit shows itself when it acts', () => {
    const ill = mk('Ill', 'illusionist', 'player', 1, 3, { abilities: ['phantasm'] });
    const foe = mk('Foe', 'goblin', 'enemy', 4, 3);
    const battle = new TacticalBattle(map, [ill, foe]);
    ill.status.push('hidden');
    battle.applyEnemyAbility(ill, 'phantasm', 4, 3);
    assert.ok(!ill.status.includes('hidden'));
});

// ---- Orders -----------------------------------------------------------------------------

test('Rally speeds an ally\'s gauge, Delay sets an enemy\'s back, and Reposition swaps places', () => {
    const lord = mk('Lord', 'warlord', 'player', 1, 3, { abilities: ['rally', 'reposition'] });
    const tac = mk('Tac', 'tactician', 'player', 2, 1, { abilities: ['delay'] });
    const ally = mk('Ally', 'novice', 'player', 3, 3, { ct: 10 });
    const foe = mk('Foe', 'goblin', 'enemy', 6, 3, { ct: 50 });
    const battle = new TacticalBattle(map, [lord, tac, ally, foe]);
    battle.applyEnemyAbility(lord, 'rally', 3, 3);
    assert.equal(ally.ct, 40);
    battle.applyEnemyAbility(tac, 'delay', 6, 3);
    assert.equal(foe.ct, 10);
    battle.applyEnemyAbility(lord, 'reposition', 3, 3);
    assert.deepEqual([lord.x, ally.x], [3, 1]);
});

test('the automatic Warlord rallies an ally once the fight is near', () => {
    const lord = mk('Lord', 'warlord', 'player', 1, 3, { abilities: ['attack', 'rally'] });
    const ally = mk('Ally', 'novice', 'player', 2, 3);
    const foe = mk('Foe', 'goblin', 'enemy', 6, 3);
    const turn = runScript(autoScriptFor('warlord', lord.abilities), lord, [lord, ally, foe], map);
    assert.equal(turn.act.ability, 'rally');
    assert.equal(turn.act.targetId, ally.id);
});

// ---- Triggers ---------------------------------------------------------------------------

test('Lingering Spite bursts at adjacent enemies when the Gravecaller is knocked out', () => {
    const gc = mk('Grave', 'gravecaller', 'player', 3, 3, { reaction: 'lingering_spite', hp: 1 });
    const foe = mk('Foe', 'orc_captain', 'enemy', 4, 3, { atk: 60 });
    const battle = new TacticalBattle(map, [gc, foe]);
    const hp = foe.hp;
    withRandom(0.5, () => battle.applyEnemyAbility(foe, 'attack', 3, 3));
    assert.ok(gc.status.includes('unconscious'));
    assert.ok(foe.hp < hp, 'the spite burst hit back');
});

test('Phylactery brings the Lich back once, and only once', () => {
    const lich = mk('Lich', 'lich', 'player', 3, 3, { reaction: 'phylactery', hp: 1 });
    const foe = mk('Foe', 'orc_captain', 'enemy', 4, 3, { atk: 60 });
    const battle = new TacticalBattle(map, [lich, foe]);
    withRandom(0.5, () => battle.applyEnemyAbility(foe, 'attack', 3, 3));
    assert.ok(!lich.status.includes('unconscious') && lich.hp === Math.round(lich.maxHp * 0.3));
    withRandom(0.5, () => battle.applyEnemyAbility(foe, 'attack', 3, 3));
    assert.ok(lich.status.includes('unconscious'), 'the second fall sticks');
});

test('Soul Harvest refills MP when anyone falls; Death Ward can save an adjacent ally from a knockout', () => {
    const gc = mk('Grave', 'gravewarden', 'player', 1, 3, { support: 'soul_harvest', reaction: 'death_ward', mp: 0 });
    const ally = mk('Ally', 'novice', 'player', 2, 3, { hp: 1 });
    const foe = mk('Foe', 'orc_captain', 'enemy', 3, 3, { atk: 60 });
    const battle = new TacticalBattle(map, [gc, ally, foe]);
    withRandom(0.1, () => battle.applyEnemyAbility(foe, 'attack', 2, 3));
    assert.equal(gc.mp, 8, 'Soul Harvest');
    assert.equal(ally.hp, 1);
    assert.ok(!ally.status.includes('unconscious'), 'Death Ward held them up');
});

test('Hold the Line strikes back for an adjacent ally; Triage patches up one left badly hurt', () => {
    const lord = mk('Lord', 'warlord', 'player', 4, 2, { reaction: 'hold_the_line' });
    const surgeon = mk('Surgeon', 'field_surgeon', 'player', 4, 4, { reaction: 'triage', mp: 0 });
    const ally = mk('Ally', 'novice', 'player', 4, 3, { hp: 30, maxHp: 40 });
    const foe = mk('Foe', 'goblin', 'enemy', 5, 3, { atk: 14 });
    const battle = new TacticalBattle(map, [lord, surgeon, ally, foe]);
    const foeHp = foe.hp;
    withRandom(0.1, () => battle.applyEnemyAbility(foe, 'attack', 4, 3));
    assert.ok(foe.hp < foeHp, 'Hold the Line counterattacked');
    // Triage: an ally left below 35% gets patched up at once.
    lord.reaction = null;
    ally.hp = 27;   // the hit leaves them below 35%, still standing
    withRandom(0.1, () => battle.applyEnemyAbility(foe, 'attack', 4, 3));
    assert.ok(surgeon._reactionsUsed?.triage, 'Triage fired');
    assert.ok(ally.hp > 0 && !ally.status.includes('unconscious'));
});

test('Reflex Tonic heals once below 30% HP', () => {
    const alch = mk('Alch', 'alchemist', 'player', 3, 3, { reaction: 'reflex_tonic', mp: 0, hp: 20 });
    const foe = mk('Foe', 'goblin', 'enemy', 4, 3, { atk: 8 });   // leaves it hurt, not knocked out
    const battle = new TacticalBattle(map, [alch, foe]);
    withRandom(0.5, () => battle.applyEnemyAbility(foe, 'attack', 3, 3));
    assert.ok(alch._reactionsUsed?.reflex_tonic, 'drank');
    assert.ok(alch.hp > alch.maxHp * 0.3, 'and is back above the line');
    const hp = alch.hp;
    alch.hp = 5;
    withRandom(0.5, () => battle.applyEnemyAbility(foe, 'attack', 3, 3));
    assert.ok(alch.hp < 5 || alch.status.includes('unconscious'), 'only once per battle');
    assert.ok(hp > 5);
});

test('Read the Battle disrupts an enemy who starts charging a spell nearby', () => {
    const tac = mk('Tac', 'tactician', 'player', 2, 3, { reaction: 'read_the_battle' });
    const mage = mk('Mage', 'evoker', 'enemy', 5, 3, { abilities: ['fire'] });
    const battle = new TacticalBattle(map, [tac, mage]);
    withRandom(0.1, () => battle.applyEnemyAbility(mage, 'fire', 2, 3));
    assert.ok(mage._charging.needed > battle._chargeTime(mage, ABILITIES.fire), 'the charge takes longer');
});

test('Shattered Image slows whoever breaks a copy', () => {
    const oracle = mk('Oracle', 'mirage_oracle', 'player', 2, 3, { abilities: ['mirror_image'], reaction: 'shattered_image' });
    const foe = mk('Foe', 'orc_captain', 'enemy', 4, 3, { atk: 60 });
    const battle = new TacticalBattle(map, [oracle, foe]);
    battle.applyEnemyAbility(oracle, 'mirror_image', 3, 3);
    withRandom(0.5, () => battle.applyEnemyAbility(foe, 'attack', 3, 3));
    assert.ok(foe.status.includes('slow'));
});

// ---- Supports and damage modifiers ------------------------------------------------------

test('Field Command gives the whole party a head start, and the best of several counts once', () => {
    const party = ['warlord', 'tactician', 'evoker'].map((job, i) => ({
        name: `M${i}`, job, team: 'player', level: 6, learned: [], ranks: {}, appearance: {},
        loadout: { support: job === 'warlord' ? 'field_command' : job === 'tactician' ? 'initiative' : null },
    }));
    party[0].learned = ['cleave', 'rally', 'field_command'];
    party[1] = { ...party[1], job: 'tactician', origin: 'warlord', learned: ['cleave', 'rally', 'field_command', 'seize_the_moment', 'delay', 'initiative'] };
    const units = buildUnits({ party, encounter: { roster: [{ job: 'goblin', name: 'G', ct: 0 }] } },
        [{ x: 1, y: 1 }, { x: 1, y: 2 }, { x: 1, y: 3 }], [{ x: 10, y: 3 }]);
    const players = units.filter(u => u.team === 'player');
    assert.ok(players.every(u => u.ct === 30), JSON.stringify(players.map(u => [u.support, u.ct])));
    assert.equal(units.find(u => u.team === 'enemy').ct, 0);
});

test('Nightmare hits a sleeper twice as hard; Necrotic Power drains more', () => {
    const dw = mk('Dream', 'dreamweaver', 'player', 1, 3);
    const awake = mk('Awake', 'orc_captain', 'enemy', 3, 3, { hp: 999, maxHp: 999 });
    const asleep = mk('Asleep', 'orc_captain', 'enemy', 3, 4, { hp: 999, maxHp: 999 });
    asleep.status.push('sleep');
    const a = withRandom(0.5, () => resolveAbility(dw, awake, 'nightmare', map)).damage;
    const b = withRandom(0.5, () => resolveAbility(dw, asleep, 'nightmare', map)).damage;
    assert.ok(Math.abs(b - 2 * a) <= 1, `${a} vs ${b}`);

    const plain = mk('Plain', 'lich', 'player', 1, 3, { hp: 1 });
    const strong = mk('Strong', 'lich', 'player', 1, 4, { hp: 1, support: 'necrotic_power' });
    const target = () => mk('T', 'orc_captain', 'enemy', 3, 3, { hp: 999, maxHp: 999 });
    const d1 = withRandom(0.5, () => resolveAbility(plain, target(), 'wither', map)).drained;
    const d2 = withRandom(0.5, () => resolveAbility(strong, target(), 'wither', map)).drained;
    assert.ok(d2 > d1, `${d1} vs ${d2}`);
});

// ---- Whole battles ----------------------------------------------------------------------

test('parties of the new classes and their promotions play whole battles to the end, using their new skills', async () => {
    const { MAP_DATA } = await import('../../js/tactical/data/maps/index.js');
    const { loadMapData } = await import('../../js/tactical/battle-map.js');
    const { runRealtimeBattle } = await import('../../js/tactical/realtime.js');
    const { createMember } = await import('../../js/run/data/recruits.js');
    const { Rng } = await import('../../js/run/rng.js');
    const { learnAbility, promote } = await import('../../js/tactical/loadout.js');
    const { ENCOUNTERS, buildEncounter } = await import('../../js/run/data/encounters.js');

    const used = new Set();
    const lines = [['illusionist', 'gravecaller', 'alchemist', 'warlord', 'warden', 'evoker'], [0, 1]];
    let battles = 0;
    MAP_DATA.forEach((mapDef, i) => {
        const promo = lines[1][i % 2];
        const rng = new Rng(100 + i);
        const party = [];
        for (const job of lines[0]) {
            const m = createMember(rng, job, party.map(p => p.name), { level: 7 });
            promote(m, JOB_DATA[job].promotions[promo]);
            m.sp = 99;   // enough to learn both kits
            for (let pass = 0; pass < 3; pass++) for (const j of [m.origin, m.job]) for (const k of Object.keys(JOB_DATA[j].learnable)) learnAbility(m, k);
            party.push(m);
        }
        const encounter = buildEncounter(ENCOUNTERS.crystal_caves.elite[0], 'elite', 2, party.length, false, 'crystal_caves');
        const map = loadMapData(mapDef);
        const battle = new TacticalBattle(map, buildUnits({ party, encounter }, map.playerSpawns, map.enemySpawns));
        const orig = battle.applyEnemyAbility.bind(battle);
        battle.applyEnemyAbility = (u, key, ...rest) => { if (u.team === 'player') used.add(key.split('@')[0]); return orig(u, key, ...rest); };
        const rt = runRealtimeBattle(battle, {});
        assert.ok(rt.over, `${mapDef.id}: the battle ended`);
        battles++;
    });
    const newSkills = NEW_CLASSES.flatMap(j => [j, ...JOB_DATA[j].promotions])
        .flatMap(j => Object.keys(JOB_DATA[j].learnable)).filter(k => (ABILITIES[k].slot ?? 'action') === 'action');
    const usedNew = newSkills.filter(k => used.has(k));
    console.log(`${battles} battles; new action skills used: ${usedNew.length}/${newSkills.length}; unused: ${newSkills.filter(k => !used.has(k)).join(', ')}`);
    // Some are situational by design (Panacea Mist needs afflicted allies, Bone Ward a body beside one).
    assert.ok(usedNew.length >= newSkills.length * 0.6, 'most of the new skills see use');
});

test('Hall of Mirrors makes two copies, and the automatic Illusionist only makes more once they are gone', () => {
    const oracle = mk('Oracle', 'mirage_oracle', 'player', 4, 3, { abilities: ['attack', 'phantasm', 'hall_of_mirrors'] });
    const foe = mk('Foe', 'goblin', 'enemy', 8, 3);
    const battle = new TacticalBattle(map, [oracle, foe]);
    battle.applyEnemyAbility(oracle, 'hall_of_mirrors', 5, 3);
    const copies = battle.units.filter(u => u.job === 'decoy');
    assert.equal(copies.length, 2);
    assert.ok(copies.every(c => c.summonerId === oracle.id && c.team === 'player'));
    assert.notDeepEqual([copies[0].x, copies[0].y], [copies[1].x, copies[1].y]);

    const script = autoScriptFor('mirage_oracle', oracle.abilities);
    assert.notEqual(runScript(script, oracle, battle.livingUnits, map).act.ability, 'hall_of_mirrors', 'copies still standing');
    for (const c of copies) { c.hp = 0; c.status.push('dead'); }
    assert.equal(runScript(script, oracle, battle.livingUnits, map).act.ability, 'hall_of_mirrors', 'both gone: make more');
});

test('a Beastcaller has one wolf out at a time, and can call another once it falls', async () => {
    const { summonCapped } = await import('../../js/tactical/abilities.js');
    const { canUse } = await import('../../js/tactical/ai/queries.js');
    const caller = mk('Bea', 'beastcaller', 'player', 2, 3, { abilities: ['attack', 'call_wolf'], mp: 999, maxMp: 999 });
    const foe = mk('Gob', 'goblin', 'enemy', 12, 3);
    const battle = new TacticalBattle(map, [caller, foe]);
    assert.ok(canUse(caller, 'call_wolf'));
    battle._resolveSummon(caller, ABILITIES.call_wolf, 3, 3);
    const wolf = battle.units.find(u => u.job === 'summoned_wolf');
    assert.ok(wolf, 'a wolf answers');
    assert.ok(summonCapped(caller, 'call_wolf') && !canUse(caller, 'call_wolf'), 'no second wolf while the first stands');
    knockOut(wolf);
    assert.ok(canUse(caller, 'call_wolf'), 'once it falls, another can be called');
    assert.equal(ABILITIES.call_wolf.summonLimit, 1);
    assert.equal(wolf.spd, JOB_STATS.summoned_wolf.spd - 6, 'Call Wolf slows its wolf');
    assert.equal(wolf.maxHp, JOB_STATS.summoned_wolf.maxHp, 'its other stats are a summoned wolf\'s');
    assert.ok(ABILITIES.call_wolf.mpCost >= 24);
});
