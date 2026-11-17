// Levels, skill points, learning and upgrading skills, loadout slots, and the
// reaction/support/movement effects they equip.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { gridMap } from '../map-fixtures.mjs';
import { createUnit, createUnitFromCharData } from '../../js/tactical/units.js';
import { resolveAbility, computeMoveRange, computeMovePath, inflictStatus } from '../../js/tactical/abilities.js';
import {
    canLearn, learnAbility, learnBlocker, buildLoadout, equippable, sanitizeLoadout, scaledLoadout,
    canPromote, promote, promotionOptions, learnableFor, canUpgrade, upgradeAbility, canSpendPoints,
    addXp, XP_PER_LEVEL, PROMOTION_LEVEL,
} from '../../js/tactical/loadout.js';
import { buildUnits } from '../../js/tactical/build-units.js';
import { JOB_DATA } from '../../js/tactical/data/jobs.js';
import { TacticalBattle } from '../../js/tactical/battle.js';

function field(rowChar = () => '.') {
    const rows = [];
    for (let y = 0; y < 7; y++) {
        rows.push(Array.from({ length: 16 }, (_, x) => rowChar(x, y)).join(''));
    }
    return gridMap(rows);
}

const member = (over = {}) => ({
    name: 'Test', job: 'spellblade', team: 'player', x: 3, y: 3,
    level: 1, xp: 0, sp: 0, origin: null, learned: ['hex'], ranks: {},
    loadout: { reaction: null, support: null, movement: null },
    ...over,
});

function withRandom(value, fn) {
    const orig = Math.random;
    Math.random = () => value;
    try { return fn(); } finally { Math.random = orig; }
}

test('XP levels a member up, and each level gives a skill point and a little HP', () => {
    const m = member();
    assert.equal(addXp(m, XP_PER_LEVEL - 1), 0);
    assert.equal(addXp(m, XP_PER_LEVEL + 1), 2);
    assert.equal(m.level, 3);
    assert.equal(m.sp, 2);
    assert.equal(m.xp, 0);
    assert.ok(createUnitFromCharData(m).maxHp > createUnitFromCharData(member()).maxHp);
});

test('learning spends skill points and follows the skill tree', () => {
    const m = member({ sp: 2 });
    assert.ok(!canLearn(m, 'hex'), 'already learned');
    assert.equal(learnBlocker(m, 'counter'), 'needs Sunder', 'Counter comes after Sunder');
    assert.ok(learnAbility(m, 'sunder'));
    assert.equal(m.sp, 1);
    assert.ok(learnAbility(m, 'counter'));
    assert.equal(m.sp, 0);
    assert.equal(learnBlocker(m, 'enfeeble'), '1 SP');
    m.sp = 1;
    assert.ok(learnAbility(m, 'enfeeble'));
    m.sp = 1;
    assert.equal(learnBlocker(m, 'mute'), '2 SP', 'the strong skills cost more');
    assert.ok(!learnAbility(m, 'fire'), 'fire is not a Spellblade skill');
    assert.ok(!learnAbility(m, 'draining_edge'), 'cut from the kit: only equipment grants it');
});

test('every skill tree starts from one root and only points at skills in reach', () => {
    for (const [job, def] of Object.entries(JOB_DATA)) {
        if (!def.learnable) continue;
        const keys = Object.keys(def.learnable);
        const parents = def.tier === 2 ? [...keys, ...Object.keys(JOB_DATA[Object.keys(JOB_DATA).find(j => JOB_DATA[j].promotions?.includes(job))].learnable)] : keys;
        for (const [k, s] of Object.entries(def.learnable)) {
            assert.ok(s.sp >= 1 && s.sp <= 2, `${job}.${k} cost`);
            if (s.requires) assert.ok(parents.includes(s.requires), `${job}.${k} requires ${s.requires}`);
        }
        assert.ok(!def.learnable[keys[0]].requires, `${job} root has no prerequisite`);
    }
});

test('upgrading a learned skill puts its stronger rank in the loadout', () => {
    const m = member({ sp: 3, learned: ['hex', 'counter'], loadout: { reaction: 'counter' } });
    assert.ok(!canUpgrade(m, 'sunder'), 'not learned');
    assert.ok(upgradeAbility(m, 'hex'));               // 1 SP → II
    assert.ok(upgradeAbility(m, 'hex'));               // 2 SP → III
    assert.equal(m.sp, 0);
    assert.ok(!canUpgrade(m, 'hex'), 'max rank');
    const lo = buildLoadout(m);
    assert.deepEqual(lo.abilities, ['attack', 'hex@3']);
    m.sp = 1;
    assert.ok(upgradeAbility(m, 'counter'));
    assert.equal(buildLoadout(m).reaction, 'counter@2');
});

test('canSpendPoints is true only when something can actually be bought', () => {
    const m = member({ sp: 0 });
    assert.ok(!canSpendPoints(m));
    m.sp = 1;
    assert.ok(canSpendPoints(m));
});

test('loadout: the skillset holds only learned actions; slots hold learned abilities', () => {
    const m = member({ learned: ['hex', 'fire', 'counter', 'mana_surge', 'momentum'] });
    m.loadout = { reaction: 'counter', support: 'mana_surge', movement: 'momentum' };
    const lo = buildLoadout(m);
    assert.deepEqual(lo.abilities, ['attack', 'hex'], 'fire is learned but not in this kit');
    assert.deepEqual(lo.skillsets.map(s => s.name), ['Runeblade']);
    assert.equal(lo.reaction, 'counter');
    assert.equal(lo.support, 'mana_surge');
});

test('promotion needs a level, keeps learned skills and adds the Tier 2 skillset', () => {
    const m = member({ job: 'evoker', learned: ['fire', 'ice', 'mana_surge'], sp: 4, level: PROMOTION_LEVEL - 1 });
    assert.deepEqual(promotionOptions(m), ['battlemage', 'riftcaller']);
    assert.ok(!canPromote(m));
    m.level = PROMOTION_LEVEL;
    assert.ok(!promote(m, 'paladin'), 'not one of this role\'s promotions');
    assert.ok(promote(m, 'battlemage'));
    assert.equal(m.origin, 'evoker');
    assert.ok(!canPromote(m), 'only once per run');
    assert.deepEqual(promotionOptions(m), []);
    assert.ok('fire' in learnableFor(m) && 'arcane_strike' in learnableFor(m));
    assert.ok(learnAbility(m, 'arcane_strike'));
    const lo = buildLoadout(m);
    assert.deepEqual(lo.skillsets.map(s => s.name), ['Evocation', 'Battle Arts']);
    assert.deepEqual(lo.abilities, ['attack', 'fire', 'ice', 'arcane_strike']);
});

test('equipment grants actions, and passives that work on top of the chosen slots, only while worn', () => {
    const m = member({ learned: ['hex', 'sunder', 'counter'], appearance: { weaponKey: 'void_dagger', toolKey: 'iron_shield' } });
    m.loadout.reaction = 'counter';
    let lo = buildLoadout(m);
    assert.ok(lo.abilities.includes('draining_edge'));
    assert.equal(lo.reaction, 'counter', 'the learned reaction keeps its slot');
    assert.deepEqual(lo.bonusPassives, ['martyr'], "the shield's Martyr is active as well");
    assert.deepEqual(equippable(m, 'reaction'), ['counter'], 'gear passives are not slot options');

    // Wearing gear that grants the skill already in its slot doesn't count it twice.
    m.loadout.reaction = null;
    m.learned.push('martyr');
    m.loadout.reaction = 'martyr';
    assert.deepEqual(buildLoadout(m).bonusPassives, []);

    m.appearance = { weaponKey: 'iron_sword' };
    lo = buildLoadout(m);
    assert.ok(!lo.abilities.includes('draining_edge'));
    assert.deepEqual(lo.bonusPassives, []);
});

test('gear passives stack with the chosen ones in battle', () => {
    const map = field();
    // Support: Mana Surge (chosen) + Iron Will (gear) both apply.
    const caster = Object.assign(createUnit('Evo', 'evoker', 'player', 3, 3), { support: 'mana_surge', bonusPassives: ['iron_will'] });
    const plain = createUnit('Plain', 'evoker', 'player', 3, 3);
    const foe = () => createUnit('Foe', 'goblin', 'enemy', 5, 3);
    const dmg = (u) => withRandom(0.5, () => resolveAbility(u, foe(), 'fire', map).damage);
    assert.ok(dmg(caster) > dmg(plain), 'Mana Surge still boosts magic');
    assert.equal(inflictStatus(caster, 'stun', 1), false, 'and Iron Will blocks stun');

    // Movement: a chosen Move +1 and gear Ghost Step add their Move and keep pass-through.
    const walker = createUnitFromCharData(member({
        x: 7, y: 3, learned: ['hex', 'momentum'], loadout: { movement: 'momentum' },
        appearance: { armorKey: 'cloak_of_shadows' },
    }));
    assert.deepEqual(walker.bonusPassives, ['ghost_step']);
    assert.equal(walker.move, createUnit('X', 'spellblade', 'player', 0, 0).move + 1, 'Ghost Step adds its Move');
    const ring = [[6, 3], [8, 3], [7, 2], [7, 4]].map(([x, y], i) => createUnit(`R${i}`, 'novice', 'player', x, y));
    assert.ok(computeMoveRange(walker, map, [walker, ...ring]).size > 0, 'and lets it pass through allies');
});

test('with two reactions, each gets a chance but only one fires per hit', () => {
    const map = field();
    const blade = Object.assign(createUnit('Blade', 'spellblade', 'player', 4, 3), {
        reaction: 'counter', bonusPassives: ['brace'], eva: 0,
    });
    const gob = Object.assign(createUnit('Gob', 'goblin', 'enemy', 5, 3), { eva: 0 });
    const battle = new TacticalBattle(map, [blade, gob]);
    withRandom(0.01, () => battle.applyEnemyAbility(gob, 'goblin_slash', blade.x, blade.y));
    assert.equal(battle.log.filter(l => l.includes('reacts')).length, 1, 'one reaction');
    assert.ok(battle.log.some(l => l.includes('reacts with Counter')), 'the chosen one goes first');
});

test('Mana Surge only boosts magic when equipped as Support', () => {
    const map = field();
    const foe = () => createUnit('Foe', 'goblin', 'enemy', 5, 3);
    const plain = createUnit('A', 'evoker', 'player', 3, 3);
    const surged = Object.assign(createUnit('B', 'evoker', 'player', 3, 3), { support: 'mana_surge' });
    const dmgPlain = withRandom(0.5, () => resolveAbility(plain, foe(), 'fire', map).damage);
    const dmgSurge = withRandom(0.5, () => resolveAbility(surged, foe(), 'fire', map).damage);
    assert.ok(dmgSurge > dmgPlain, `${dmgSurge} > ${dmgPlain}`);
});

test('Counter strikes back once, and a counter never triggers another counter', () => {
    const map = field();
    const blade = Object.assign(createUnit('Blade', 'spellblade', 'player', 4, 3), { reaction: 'counter', eva: 0 });
    const gob   = Object.assign(createUnit('Gob', 'goblin', 'enemy', 5, 3), { reaction: 'counter', eva: 0 });
    const battle = new TacticalBattle(map, [blade, gob]);
    const gobHp = gob.hp;
    withRandom(0.1, () => battle.applyEnemyAbility(gob, 'goblin_slash', blade.x, blade.y));
    assert.ok(gob.hp < gobHp, 'goblin took counter damage');
    assert.equal(battle.log.filter(l => l.includes('reacts')).length, 1);

    // Out of reach: a ranged hit cannot be countered in melee.
    const far = Object.assign(createUnit('Archer', 'raider_archer', 'enemy', 8, 3), { eva: 0 });
    const b2 = new TacticalBattle(map, [blade, far]);
    withRandom(0.1, () => b2.applyEnemyAbility(far, 'long_shot', blade.x, blade.y));
    assert.equal(b2.log.filter(l => l.includes('reacts')).length, 0);
});

test('movement abilities change the move range', () => {
    const map = field();
    const base = createUnit('A', 'novice', 'player', 7, 3);
    const plus = Object.assign(createUnit('B', 'novice', 'player', 7, 3, { loadout: { abilities: ['attack'], movement: 'move_plus_1' } }));
    assert.ok(computeMoveRange(plus, map, [plus]).size > computeMoveRange(base, map, [base]).size);

    // Stone Stride: rubble costs 1 instead of 2.
    const rubble = field(() => ':');
    const walker = createUnit('C', 'stoneshaper', 'player', 7, 3);
    const strider = Object.assign(createUnit('D', 'stoneshaper', 'player', 7, 3), { movement: 'stone_stride' });
    assert.ok(computeMoveRange(strider, rubble, [strider]).size > computeMoveRange(walker, rubble, [walker]).size);

    // Blink: walk through a ring of allies, but never stop on one.
    const blinker = Object.assign(createUnit('E', 'riftcaller', 'player', 7, 3), { movement: 'blink' });
    const ring = [[6, 3], [8, 3], [7, 2], [7, 4]].map(([x, y], i) => createUnit(`R${i}`, 'novice', 'player', x, y));
    const stuck = createUnit('F', 'riftcaller', 'player', 7, 3);
    assert.equal(computeMoveRange(stuck, map, [stuck, ...ring]).size, 0);
    const range = computeMoveRange(blinker, map, [blinker, ...ring]);
    assert.ok(range.size > 0);
    for (const r of ring) assert.ok(!range.has(`${r.x},${r.y},${r.z}`));
});

test('climb abilities reach ledges the base climb limit cannot', () => {
    // Unit at (1,1) on the ground; a 2-high ledge at x=3 and a 4-high one at x=5.
    const rows = ['.......', '.......', '.......'];
    const elev = ['0002204', '0002204', '0002204'];
    const ledges = gridMap(rows, elev);
    const at = (unit, x, y) => [...computeMoveRange(unit, ledges, [unit])].some(k => k.startsWith(`${x},${y},`));
    const mk = (movement) => Object.assign(createUnit('U', 'seer', 'player', 1, 1), { move: 6, movement });

    assert.ok(!at(mk(null), 3, 1), 'base climb (1) cannot step up 2');
    assert.ok(at(mk('fleet_step'), 3, 1), 'Climb +1 reaches a 2-high ledge');
    assert.ok(!at(mk('fleet_step'), 6, 1), 'but not a 4-high one');
    assert.ok(at(mk('featherstep'), 3, 1), 'Climb +2 reaches the 2-high ledge');
    assert.ok(at(mk('blink'), 6, 1), 'Blink ignores elevation entirely');

    const climber = mk('featherstep');
    const path = computeMovePath(climber, ledges, [climber], 3, 1);
    assert.ok(path && path.at(-1).z === 2, 'path ends on top of the ledge');
});

test('enemies on player jobs know only what a player could have learned by the encounter level', () => {
    assert.deepEqual(scaledLoadout('evoker', 1).abilities, ['attack', 'fire']);
    assert.deepEqual(scaledLoadout('evoker', 2).abilities, ['attack', 'fire', 'ice'], 'fire free + 1 SP');
    assert.deepEqual(scaledLoadout('evoker', 3).abilities, ['attack', 'fire', 'ice', 'thunder'], 'fire free + 2 SP');
    assert.ok(!scaledLoadout('evoker', 3).abilities.includes('flare'), 'no Flare at Lv.3');
    const strong = scaledLoadout('evoker', 9);
    assert.ok(strong.abilities.includes('flare'));
    assert.equal(strong.support, 'mana_surge');
    assert.equal(scaledLoadout('evoker', 1).support, null);

    // A bare createUnit on a player job defaults to Lv.1, not the whole skillset.
    assert.deepEqual(createUnit('E', 'paladin', 'enemy', 0, 0).abilities, ['attack', 'smite']);
    assert.deepEqual(createUnit('E', 'paladin', 'enemy', 0, 0, { level: 2 }).abilities, ['attack', 'smite', 'heal']);
});

test('roster entries on player jobs use the encounter enemyLevel, or their own level', () => {
    const encounter = {
        enemyLevel: 1,
        roster: [{ job: 'evoker', name: 'Weak' }, { job: 'evoker', name: 'Boss', level: 6 }],
    };
    const units = buildUnits({ encounter }, [], []);
    const weak = units.find(u => u.name === 'Weak');
    const boss = units.find(u => u.name === 'Boss');
    assert.deepEqual(weak.abilities, ['attack', 'fire']);
    assert.ok(boss.abilities.includes('thunder'));
    assert.ok(!weak.jpEligible && !boss.jpEligible, 'enemies earn no JP');
});
