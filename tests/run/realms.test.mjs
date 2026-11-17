// Realms: each act of a run is set in a realm picked at random, which decides the act's
// enemies, events and the look of its battle maps (js/run/data/realms.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { CHAINS, REALMS, ACT_REALMS, actOf, realmSources, rollRealms, pickRealmMap, realmLook } from '../../js/run/data/realms.js';
import { ENCOUNTERS, ACT_COUNT, rollEncounter, realmEncounters, retuneEncounter, rosterPower } from '../../js/run/data/encounters.js';
import { EVENTS, eventsFor } from '../../js/run/data/events.js';
import { REALM_EVENTS } from '../../js/run/data/realm-events.js';
import { RunState } from '../../js/run/run-state.js';
import { Rng } from '../../js/run/rng.js';
import { MATERIALS, loadMapData } from '../../js/tactical/battle-map.js';
import { TILE_RENDER, lookType, terrainTopY } from '../../js/tactical/tile-render.js';
import { MAP_DATA } from '../../js/tactical/data/maps/index.js';
import { JOB_STATS, ABILITIES } from '../../js/tactical/data-registry.js';
import { buildUnits } from '../../js/tactical/build-units.js';

// Sprite file names in the shipped skin. Zip entry names are stored as plain text.
const SKIN = readFileSync(new URL('../../skins/16x16_tiny_world.skin.zip', import.meta.url)).toString('latin1');
const skinHas = (category, key) => SKIN.includes(`${category}/${key}.png`);

const allEncounters = (realm) => ['normal', 'elite', 'boss'].flatMap(kind => ENCOUNTERS[realm][kind].map(def => ({ kind, def })));

test('every chain realm exists, belongs to its chain at its tier, and has fights of every kind', () => {
    for (const [chain, def] of Object.entries(CHAINS)) {
        def.realms.forEach((id, i) => {
            const realm = REALMS[id];
            assert.ok(realm, id);
            assert.equal(realm.chain, chain, id);
            assert.equal(realm.tier, i + 1, id);
            assert.ok(realm.name && realm.blurb, `${id} has a name and blurb`);
            assert.ok(ENCOUNTERS[id], `${id} has encounters`);
            assert.ok(ENCOUNTERS[id].normal.length >= 3, `${id} normal fights`);
            assert.ok(ENCOUNTERS[id].elite.length >= 1, `${id} elite fights`);
            assert.ok(ENCOUNTERS[id].boss.length >= 1, `${id} boss fights`);
        });
    }
    assert.deepEqual(Object.keys(ENCOUNTERS).sort(), Object.keys(REALMS).sort(), 'no encounters for unknown realms');
});

test('each act draws from its own list of realms', () => {
    assert.deepEqual(ACT_REALMS, {
        1: ['wild_frontiers', 'verdant_depths', 'crystal_caves'],
        2: ['arcane_library', 'void_abyss', 'void_sanctum'],
        3: ['palace_fortress', 'shifting_labyrinth'],
    });
    for (let act = 1; act <= ACT_COUNT; act++) {
        for (const id of ACT_REALMS[act]) {
            assert.ok(REALMS[id], id);
            assert.equal(actOf(id), act, `${id} is tuned for act ${act}`);
        }
    }
    assert.equal(actOf('crystal_mines'), 2, 'a realm in no list keeps its tier');
});

test('act 1 realms have gentle fights for the opening of a run', () => {
    for (const id of ACT_REALMS[1]) {
        assert.ok(ENCOUNTERS[id].normal.some(e => e.easy), `${id} has an easy fight`);
    }
});

test('encounter ids are unique, and every roster uses real jobs, abilities and skin sprites', () => {
    const ids = new Set();
    for (const realm of Object.keys(ENCOUNTERS)) {
        for (const { def } of allEncounters(realm)) {
            assert.ok(!ids.has(def.id), `duplicate encounter id ${def.id}`);
            ids.add(def.id);
            for (const r of def.roster) {
                assert.ok(JOB_STATS[r.job], `${def.id}: job ${r.job}`);
                for (const a of r.extraAbilities ?? []) assert.ok(ABILITIES[a], `${def.id}: ability ${a}`);
                if (r.sprite) assert.ok(skinHas('entities', r.sprite), `${def.id}: sprite ${r.sprite}`);
                assert.ok(Number.isFinite(r.ct), `${def.id}: ${r.name} has an opening gauge`);
            }
        }
    }
});

test('an extra ability on an enemy job comes with the MP to cast it', () => {
    for (const realm of Object.keys(ENCOUNTERS)) {
        for (const { def } of allEncounters(realm)) {
            for (const r of def.roster) {
                const mp = JOB_STATS[r.job].maxMp + (r.statMods?.maxMp ?? 0);
                for (const a of r.extraAbilities ?? []) {
                    assert.ok(mp >= (ABILITIES[a].mpCost ?? 0), `${def.id}: ${r.name} cannot afford ${a}`);
                }
            }
        }
    }
});

test('a roster sprite dresses the unit but the job still decides how it fights', () => {
    const map = loadMapData(MAP_DATA[0]);
    const def = ENCOUNTERS.crystal_caves.normal.find(e => e.id === 'crystal_bats');
    const units = buildUnits({ encounter: def }, map.playerSpawns, map.enemySpawns).filter(u => u.team === 'enemy');
    const bat = units.find(u => u.name === 'Crystal Bat');
    assert.equal(bat.spriteKey, 'crystal_bat');
    assert.equal(bat.job, 'wolf');
    assert.deepEqual(bat.abilities, JOB_STATS.wolf.abilities);
    const spider = units.find(u => u.name === 'Shard Spider');
    assert.equal(spider.spriteKey, JOB_STATS.shard_spider.spriteKey, 'no override: the job sprite');
});

test('a run sets each act in one of that act\'s realms, each from a different chain', () => {
    for (let seed = 1; seed <= 200; seed++) {
        const realms = rollRealms(new Rng(seed), ACT_COUNT);
        assert.equal(realms.length, ACT_COUNT);
        realms.forEach((id, i) => assert.ok(ACT_REALMS[i + 1].includes(id), `seed ${seed} act ${i + 1}: ${id}`));
        assert.equal(new Set(realms.map(id => REALMS[id].chain)).size, ACT_COUNT, `seed ${seed}: chains repeat`);
    }
});

test('over many runs every realm in an act\'s list comes up for that act', () => {
    const seen = Array.from({ length: ACT_COUNT }, () => new Set());
    for (let seed = 1; seed <= 400; seed++) rollRealms(new Rng(seed), ACT_COUNT).forEach((id, i) => seen[i].add(id));
    seen.forEach((set, i) => assert.deepEqual([...set].sort(), [...ACT_REALMS[i + 1]].sort(), `act ${i + 1}`));
});

test('a run\'s realms come from its seed, and its fights from the current act\'s realm', () => {
    const a = RunState.create({ jobs: ['warden', 'evoker', 'runebow'], seed: 42 });
    const b = RunState.create({ jobs: ['warden', 'evoker', 'runebow'], seed: 42 });
    assert.deepEqual(a.realms, b.realms);
    assert.equal(a.realmId, a.realms[0]);
    const id = a.reachable()[0];
    a.map.nodes[id].type = 'combat';
    a.enterNode(id);
    const enc = a.pending.encounter;
    assert.equal(enc.realm, a.realmId);
    assert.ok(realmSources(a.realmId).includes(enc.zone));
    assert.ok(ENCOUNTERS[enc.zone].normal.some(e => e.id === enc.id), 'the fight comes from the realm or one folded into it');

    a.act = 3;
    assert.equal(a.realm, REALMS[a.realms[2]]);
    const boss = rollEncounter(new Rng(1), a.realmId, 3, 'boss', 4);
    assert.equal(boss.realm, a.realms[2]);
    assert.ok(realmSources(a.realms[2]).includes(boss.zone), 'act 3 fights come from the act 3 realm\'s chain');
});

test('saves keep the realms, and saves from before realms still load with realms rolled from the seed', () => {
    const run = RunState.create({ jobs: ['warden', 'evoker', 'runebow'], seed: 7 });
    assert.deepEqual(RunState.deserialize(run.serialize()).realms, run.realms);

    const old = JSON.parse(run.serialize());
    old.version = 3;
    delete old.realms;
    const loaded = RunState.deserialize(old);
    assert.ok(loaded, 'version 3 save loads');
    assert.deepEqual(loaded.realms, RunState.realmsForSeed(7));

    const bad = JSON.parse(run.serialize());
    bad.realms = ['nowhere', 'nowhere', 'nowhere'];
    assert.equal(RunState.deserialize(bad), null, 'unknown realms are refused');
});

test('realm events come up in their realm or the act realm it is folded into; road events stay out of caves and halls', () => {
    const ids = new Set();
    for (const ev of REALM_EVENTS) {
        assert.ok(!ids.has(ev.id), `duplicate event ${ev.id}`);
        ids.add(ev.id);
        assert.ok(ev.realms.length && ev.realms.every(r => REALMS[r]), `${ev.id} realms`);
        assert.ok(ev.choices.length >= 1 && ev.choices.length <= 3, ev.id);
    }
    assert.equal(new Set(EVENTS.map(e => e.id)).size, EVENTS.length, 'event ids are unique across all events');
    for (const id of Object.keys(REALMS)) {
        assert.ok(REALM_EVENTS.filter(e => e.realms.includes(id)).length >= 2, `${id} has its own events`);
    }
    for (const [act, ids] of Object.entries(ACT_REALMS)) {
        for (const id of ids) {
            const { realm, general } = eventsFor(Number(act), id);
            const sources = realmSources(id);
            assert.ok(realm.length >= 5, `${id} has at least five realm events`);
            assert.ok(realm.every(e => e.realms.some(r => sources.includes(r))), `${id}: only its chain's events`);
            for (const src of sources) assert.ok(realm.some(e => e.realms.includes(src)), `${id} brings in ${src}'s events`);
            assert.ok(general.length >= 5, `${id} still has general events`);
        }
    }
    const cave = eventsFor(1, 'crystal_caves').general.map(e => e.id);
    const road = eventsFor(1, 'wild_frontiers').general.map(e => e.id);
    assert.ok(road.includes('ambush') && !cave.includes('ambush'), 'bandits on the road, not in the caves');
});

test('a run rolls realm events and general events, without repeats while fresh ones remain', () => {
    const run = RunState.create({ jobs: ['warden', 'evoker', 'runebow'], seed: 5 });
    const { realm, general } = eventsFor(1, run.realmId);
    const allowed = new Set([...realm, ...general].map(e => e.id));
    const rolled = [];
    for (let i = 0; i < realm.length + 4; i++) rolled.push(run._rollEvent());
    assert.ok(rolled.every(id => allowed.has(id)), 'only events for this act and realm');
    assert.equal(new Set(rolled).size, rolled.length, 'no repeats');
    assert.ok(rolled.some(id => realm.some(e => e.id === id)), 'realm events come up');
});

test('every material has a look, and its skin textures exist', () => {
    for (const type of Object.keys(MATERIALS)) {
        const def = TILE_RENDER[type];
        assert.ok(def?.label && def.color && def.side, `${type} look`);
        for (const ref of [def.tex, def.fx?.tex].filter(Boolean)) {
            const [category, key] = ref.split(':');
            assert.ok(skinHas(category, key), `${type}: ${ref}`);
        }
        // Liquids are drawn a little low and can't be stood on; nothing else is drawn low.
        assert.equal(!!def.liquid, !MATERIALS[type].standable && !MATERIALS[type].opaque, `${type} liquid`);
    }
    assert.ok(terrainTopY({ type: 'lava', z: 1 }) < terrainTopY({ type: 'stone', z: 1 }));
});

test('realm looks only swap a material for one with the same rules, and their maps exist', () => {
    const same = (a, b) => ['standable', 'moveCost', 'opaque'].every(k => MATERIALS[a][k] === MATERIALS[b][k]);
    for (const [id, realm] of Object.entries(REALMS)) {
        for (const [from, swap] of Object.entries(realm.look?.blocks ?? {})) {
            assert.ok(MATERIALS[from], `${id}: ${from}`);
            const targets = typeof swap === 'string' ? [swap] : swap.map(([t]) => t);
            for (const t of targets) {
                assert.ok(MATERIALS[t] && TILE_RENDER[t], `${id}: ${from} -> ${t}`);
                assert.ok(same(from, t), `${id}: ${from} -> ${t} changes the rules`);
            }
        }
        assert.ok(realm.maps.length >= 3, `${id} maps`);
        for (const m of realm.maps) assert.ok(MAP_DATA.some(d => d.id === m), `${id}: map ${m}`);
        assert.ok(realm.maps.includes(pickRealmMap(id, () => 0.999).id));
    }
    assert.ok(MAP_DATA.includes(pickRealmMap('nowhere')), 'an unknown realm falls back to any map');
    assert.equal(realmLook('nowhere'), null);
});

test('a weighted look mixes its materials per block, the same way every time', () => {
    const look = { blocks: { grass: [['moss', 3], ['swamp', 1]], wall: 'hedge' } };
    const counts = { moss: 0, swamp: 0 };
    for (let x = 0; x < 40; x++) for (let y = 0; y < 40; y++) counts[lookType(look, 'grass', x, y, 0)]++;
    assert.ok(counts.moss > counts.swamp && counts.swamp > 200, JSON.stringify(counts));
    assert.equal(lookType(look, 'grass', 3, 4, 1), lookType(look, 'grass', 3, 4, 1));
    assert.equal(lookType(look, 'wall', 0, 0, 0), 'hedge');
    assert.equal(lookType(look, 'dirt', 0, 0, 0), 'dirt', 'unlisted materials keep their look');
    assert.equal(lookType(null, 'grass', 0, 0, 0), 'grass');
});

test('each unlisted realm is folded into the one listed realm of its chain', () => {
    assert.deepEqual(realmSources('crystal_caves'), ['crystal_caves', 'crystal_mines', 'crystal_depths']);
    assert.deepEqual(realmSources('palace_fortress'), ['palace_fortress', 'kingdom_outskirts', 'crusader_barracks']);
    assert.deepEqual(realmSources('wild_frontiers'), ['wild_frontiers']);
    assert.deepEqual(realmSources('crystal_mines'), ['crystal_mines'], 'an unlisted realm draws only on itself');
    // Every realm's content is used by exactly one act realm.
    const owners = {};
    for (const ids of Object.values(ACT_REALMS)) for (const id of ids) for (const src of realmSources(id)) (owners[src] ??= []).push(id);
    assert.deepEqual(Object.keys(owners).sort(), Object.keys(REALMS).sort());
    for (const [src, by] of Object.entries(owners)) assert.equal(by.length, 1, `${src} is folded into ${by}`);
});

test('a folded-in fight keeps its roster but is refitted to the act it is fought in', () => {
    for (const ids of Object.values(ACT_REALMS)) {
        for (const realm of ids) {
            const act = actOf(realm);
            for (const kind of ['normal', 'elite', 'boss']) {
                const own = ENCOUNTERS[realm][kind].map(d => rosterPower(d, kind, act)).sort((x, y) => x - y);
                for (const { def, zone } of realmEncounters(realm, kind)) {
                    const original = ENCOUNTERS[zone][kind].find(d => d.id === def.id);
                    assert.ok(original, `${realm}: ${def.id} comes from ${zone}`);
                    if (zone === realm) { assert.equal(def, original, 'own fights are untouched'); continue; }
                    assert.deepEqual(def.roster.map(r => [r.job, r.name, r.sprite]), original.roster.map(r => [r.job, r.name, r.sprite]));
                    assert.ok(!def.easy, 'only act 1 realms\' own fights are easy');
                    // Close to the home realm's range: within the calibration factor (at most 1.5x)
                    // and rounding of its own weakest and strongest fights.
                    const p = rosterPower(def, kind, act);
                    assert.ok(p >= own[0] * 0.6 && p <= own[own.length - 1] * 1.7, `${realm} ${kind} ${def.id}: ${Math.round(p)} vs ${own.map(Math.round)}`);
                }
            }
        }
    }
});

test('a deep realm\'s boss fought in act 1 loses levels and stats; a shallow realm\'s fight in act 3 gains them', () => {
    const colossus = ENCOUNTERS.crystal_depths.boss[0];
    const early = retuneEncounter(colossus, 'boss', 3, 'crystal_caves', 'crystal_depths');
    assert.ok(early.enemyLevel < colossus.enemyLevel);
    assert.ok(early.roster[0].level < colossus.roster[0].level);
    assert.ok(rosterPower(early, 'boss', 1) < rosterPower(colossus, 'boss', 1));

    const patrol = ENCOUNTERS.kingdom_outskirts.normal.find(e => e.id === 'road_patrol');
    const late = retuneEncounter(patrol, 'normal', 1, 'palace_fortress', 'kingdom_outskirts');
    assert.ok(late.enemyLevel > patrol.enemyLevel);
    assert.ok(rosterPower(late, 'normal', 3) > rosterPower(patrol, 'normal', 3));
});

test('over many fights an act realm fields fights from every realm folded into it, each in its own look', () => {
    const zones = new Set();
    const rng = new Rng(9);
    for (let i = 0; i < 200; i++) {
        const enc = rollEncounter(rng, 'crystal_caves', 1, 'normal', 4);
        zones.add(enc.zone);
        assert.equal(enc.realm, 'crystal_caves');
    }
    assert.deepEqual([...zones].sort(), ['crystal_caves', 'crystal_depths', 'crystal_mines']);
    assert.notDeepEqual(realmLook('crystal_depths'), realmLook('crystal_caves'), 'a Crystal Depths fight looks like the Depths');
});

test('each act ends with one of two bosses that belong at the heart of its realm', () => {
    const names = id => realmEncounters(id, 'boss').map(e => e.def.name);
    assert.deepEqual(Object.fromEntries(Object.values(ACT_REALMS).flat().map(id => [id, names(id)])), {
        wild_frontiers:     ['The Bandit King', 'The Dire Wolf'],
        verdant_depths:     ['The Thorn Warden', 'The Ancient Treant'],
        crystal_caves:      ['The Crystal Warden', 'The Crystal Colossus'],
        arcane_library:     ['The Arcane Sentinel', 'The Arcane Construct'],
        void_abyss:         ['The Gloom Sentinel', 'The Oblivion Sovereign'],
        void_sanctum:       ['The Hollow Abbot', 'The Void Arbiter'],
        palace_fortress:    ['The High King', 'The High Priest'],
        shifting_labyrinth: ['The Shifting Horror', 'The Unraveler'],
    });
    for (const id of Object.values(ACT_REALMS).flat()) {
        // Every listed boss exists in the realm or a realm folded into it.
        const known = realmSources(id).flatMap(z => ENCOUNTERS[z].boss.map(e => e.id));
        for (const b of REALMS[id].bosses) assert.ok(known.includes(b), `${id}: ${b}`);
        // The two bosses fight differently.
        const jobs = realmEncounters(id, 'boss').map(e => e.def.roster[0].job);
        assert.equal(new Set(jobs).size, jobs.length, `${id} bosses share a job: ${jobs}`);
    }
    const rng = new Rng(3);
    const seen = new Set();
    for (let i = 0; i < 50; i++) seen.add(rollEncounter(rng, 'palace_fortress', 3, 'boss', 6).id);
    assert.deepEqual([...seen].sort(), ['boss_high_king', 'boss_high_priest'], 'the act boss is never one that was dropped');
});

test('the Dire Wolf is a darker wolf than its pack', () => {
    const map = loadMapData(MAP_DATA[0]);
    const def = ENCOUNTERS.wild_frontiers.boss.find(e => e.id === 'boss_dire_wolf');
    const units = buildUnits({ encounter: def }, map.playerSpawns, map.enemySpawns).filter(u => u.team === 'enemy');
    const boss = units.find(u => u.name === 'Dire Wolf');
    const pack = units.filter(u => u.name === 'Pack Wolf');
    assert.equal(boss.spriteKey, 'wolf');
    assert.ok(pack.length && pack.every(u => u.spriteKey === 'wolf' && u.tint === null), 'the pack keeps the plain sprite');
    assert.match(boss.tint, /^#[0-9a-f]{6}$/i);
    const luma = hex => [1, 3, 5].reduce((s, i, k) => s + parseInt(hex.slice(i, i + 2), 16) * [0.3, 0.59, 0.11][k], 0);
    assert.ok(luma(boss.tint) < 160, 'the tint darkens');
});
