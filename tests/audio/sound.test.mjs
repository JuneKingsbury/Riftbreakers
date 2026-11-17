// Sound: the manager's rules (volumes, pitch spread, cooldown, voice cap, missing files,
// music fallback and crossfade) on a fake Web Audio backend, the manifest against the files
// on disk, and which sounds and music the game picks for its moments.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

import { SoundManager, SFX_COOLDOWN_MS, MAX_CONCURRENT_SFX, MUSIC_TRIM_DB } from '../../js/audio/sound.js';
import { SOUND_MANIFEST } from '../../js/audio/sound-manifest.js';
import {
    mapMusic, battleMusic, abilitySound, battleEventSound, downSound, downChanges, battleOpensWithAlert,
} from '../../js/audio/game-sounds.js';
import { REALMS } from '../../js/run/data/realms.js';
import { createUnit } from '../../js/tactical/units.js';
import { standZ } from '../../js/tactical/battle-map.js';
import { TacticalBattle } from '../../js/tactical/battle.js';
import { gridMap } from '../map-fixtures.mjs';

// ---- A fake Web Audio backend ----------------------------------------------------------

function fakeAudio({ files = [], slow = new Map() } = {}) {
    const sources = [];
    const param = (value = 1) => ({ value, ramps: [], setValueAtTime(v) { this.value = v; }, linearRampToValueAtTime(v) { this.ramps.push(v); } });
    const ctx = {
        state: 'suspended', currentTime: 0, destination: {},
        resume() { this.state = 'running'; },
        createGain: () => ({ gain: param(1), connect() {} }),
        createBufferSource: () => {
            const s = { detune: param(0), loop: false, connect() {}, started: false, stopped: false,
                start() { this.started = true; }, stop() { this.stopped = true; } };
            sources.push(s);
            return s;
        },
        decodeAudioData: async (data) => ({ duration: 1, data }),
    };
    const fetched = [];
    const fetch = async (url) => {
        fetched.push(url);
        if (slow.has(url)) await slow.get(url);
        return files.includes(url)
            ? { ok: true, arrayBuffer: async () => url }
            : { ok: false, status: 404 };
    };
    return { ctx, sources, fetched, fetch };
}

const manifest = {
    sfx: {
        blip:  { file: 'a/blip.ogg', gain: 0.5, pitch: 200 },
        boop:  { file: 'a/boop.ogg' },
        ghost: { file: 'a/missing.ogg' },
    },
    music: { realm: 'm/realm.ogg', general: 'm/general.ogg', other: 'm/other.ogg', none: 'm/none.ogg' },
};
const ALL_FILES = ['a/blip.ogg', 'a/boop.ogg', 'm/realm.ogg', 'm/general.ogg', 'm/other.ogg'];

function manager(opts = {}) {
    const audio = fakeAudio({ files: ALL_FILES, ...opts });
    let now = 1000;
    let rnd = 0.5;
    const sm = new SoundManager({
        createContext: () => audio.ctx, fetch: audio.fetch, manifest,
        now: () => now, random: () => rnd, setTimeout: (fn) => fn(),
    });
    return { sm, audio, tick: (ms) => { now += ms; }, setRandom: (r) => { rnd = r; } };
}

// ---- Manager rules ------------------------------------------------------------------------

test('nothing plays until the player has interacted; music asked for earlier starts then', async () => {
    const { sm, audio } = manager();
    assert.equal(await sm.playSfx('blip'), false, 'no audio context yet');
    await sm.playMusic(['realm']);
    assert.equal(audio.sources.length, 0);

    sm.unlock();
    assert.equal(audio.ctx.state, 'running', 'a suspended context is resumed');
    await new Promise(r => setTimeout(r, 0));
    assert.equal(sm.currentMusic, 'realm');
    assert.ok(audio.sources[0].loop && audio.sources[0].started);
});

test('the volume sliders set the music and SFX buses (0-100), and muted SFX play nothing', async () => {
    const { sm } = manager();
    sm.unlock();
    sm.setMusicVolume(40);
    sm.setSfxVolume(0);
    // Music sits MUSIC_TRIM_DB below the slider, to balance its loud mastering against the effects.
    assert.ok(Math.abs(sm.musicBus.gain.value - 0.4 * 10 ** (MUSIC_TRIM_DB / 20)) < 1e-9);
    assert.ok(MUSIC_TRIM_DB < 0, 'music is turned down, not up');
    assert.equal(sm.sfxBus.gain.value, 0);
    assert.equal(await sm.playSfx('blip'), false);
    sm.setSfxVolume(250);
    assert.equal(sm.sfxBus.gain.value, 1, 'clamped');
    sm.setMusicVolume('abc');
    assert.equal(sm.musicBus.gain.value, 0, 'garbage counts as silent, not as loud');
});

test('each play of a sound shifts its pitch randomly within its spread, plus any fixed offset', async () => {
    const { sm, audio, tick, setRandom } = manager();
    sm.unlock();
    setRandom(0);
    await sm.playSfx('blip');
    assert.equal(audio.sources.at(-1).detune.value, -200);
    tick(SFX_COOLDOWN_MS);
    setRandom(0.999999);
    await sm.playSfx('blip');
    assert.ok(Math.abs(audio.sources.at(-1).detune.value - 200) < 0.01);
    tick(SFX_COOLDOWN_MS);
    setRandom(0.5);
    await sm.playSfx('blip', { semitones: 2 });
    assert.equal(audio.sources.at(-1).detune.value, 200, 'two semitones up, no random part at the middle');
    tick(SFX_COOLDOWN_MS);
    setRandom(1 - 1e-9);
    await sm.playSfx('boop');
    assert.ok(audio.sources.at(-1).detune.value > 299, 'the default spread is Rifthold\'s 300 cents');
});

test('a sound cannot restart within the cooldown, but other sounds can play meanwhile', async () => {
    const { sm, tick } = manager();
    sm.unlock();
    assert.equal(await sm.playSfx('blip'), true);
    tick(SFX_COOLDOWN_MS - 1);
    assert.equal(await sm.playSfx('blip'), false);
    assert.equal(await sm.playSfx('boop'), true);
    tick(1);
    assert.equal(await sm.playSfx('blip'), true);
});

test('at most eight sounds play at once; a finished one frees its voice', async () => {
    const big = { sfx: Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`s${i}`, { file: 'a/blip.ogg' }])), music: {} };
    const audio = fakeAudio({ files: ['a/blip.ogg'] });
    const sm = new SoundManager({ createContext: () => audio.ctx, fetch: audio.fetch, manifest: big, now: () => 0, random: () => 0.5 });
    sm.unlock();
    const played = [];
    for (let i = 0; i < 10; i++) played.push(await sm.playSfx(`s${i}`));
    assert.equal(played.filter(Boolean).length, MAX_CONCURRENT_SFX);
    audio.sources[0].onended();
    assert.equal(await sm.playSfx('s9'), true);
});

test('a missing file is skipped quietly and only looked up once', async () => {
    const { sm, audio, tick } = manager();
    sm.unlock();
    assert.equal(await sm.playSfx('ghost'), false);
    tick(SFX_COOLDOWN_MS);
    assert.equal(await sm.playSfx('ghost'), false);
    assert.equal(audio.fetched.filter(f => f === 'a/missing.ogg').length, 1);
    assert.equal(await sm.playSfx('unknown_name'), false);
});

test('music plays the first track that exists, crossfades on change, and stays put when asked again', async () => {
    const { sm, audio } = manager();
    sm.unlock();
    await sm.playMusic(['none', 'general']);
    assert.equal(sm.currentMusic, 'general', 'falls back past a missing track');
    const first = audio.sources.at(-1);

    await sm.playMusic(['none', 'general']);
    assert.equal(audio.sources.at(-1), first, 'already playing: not restarted');

    await sm.playMusic(['realm', 'general']);
    assert.equal(sm.currentMusic, 'realm');
    assert.ok(first.stopped, 'the old track faded out and stopped');
    assert.deepEqual(sm.music.gain.gain.ramps, [1], 'the new one fades in');

    await sm.playMusic(['none']);
    assert.equal(sm.currentMusic, null, 'no track exists: silence rather than the wrong music');
});

test('the latest music request wins, even if an earlier track finishes loading later', async () => {
    let release;
    const gate = new Promise(r => { release = r; });
    const { sm } = manager({ slow: new Map([['m/realm.ogg', gate]]) });
    sm.unlock();
    const slow = sm.playMusic(['realm']);
    await sm.playMusic(['other']);
    assert.equal(sm.currentMusic, 'other');
    release();
    await slow;
    assert.equal(sm.currentMusic, 'other', 'the slow, older request did not take over');

    sm.stopMusic();
    assert.equal(sm.currentMusic, null);
});

// ---- The manifest ------------------------------------------------------------------------

test('every sound and music file in the manifest exists, and every realm has its own track', () => {
    const root = new URL('../../', import.meta.url);
    for (const [name, spec] of Object.entries(SOUND_MANIFEST.sfx)) {
        assert.ok(existsSync(new URL(spec.file, root)), `sfx ${name}: ${spec.file}`);
        if (spec.pitch != null) assert.ok(spec.pitch >= 0 && spec.pitch <= 300, `${name} pitch spread`);
    }
    for (const [name, file] of Object.entries(SOUND_MANIFEST.music)) {
        if (name === 'expedition') continue;   // optional generic fallback, not shipped
        assert.ok(existsSync(new URL(file, root)), `music ${name}: ${file}`);
    }
    for (const id of Object.keys(REALMS)) assert.ok(SOUND_MANIFEST.music[`expedition_${id}`], `${id} has a track`);
});

// ---- What the game plays when ------------------------------------------------------------

test('the act realm\'s track plays on the map and carries on through deploying and battles', () => {
    const run = { realmId: 'crystal_caves' };
    assert.deepEqual(mapMusic(run), ['expedition_crystal_caves', 'expedition']);
    // Even a fight from a realm folded into the act keeps the act's track going.
    const fight = { realm: 'crystal_caves', zone: 'crystal_depths', kind: 'boss' };
    assert.equal(battleMusic(fight, run)[0], mapMusic(run)[0]);
    assert.deepEqual(battleMusic(null, null), ['combat'], 'a battle outside a run');
});

test('moving from the map into a battle and back never restarts the realm track', async () => {
    const audio = fakeAudio({ files: ['m/expedition_crystal_caves.ogg'] });
    const sm = new SoundManager({
        createContext: () => audio.ctx, fetch: audio.fetch, now: () => 0, random: () => 0.5, setTimeout: (fn) => fn(),
        manifest: { sfx: {}, music: { expedition_crystal_caves: 'm/expedition_crystal_caves.ogg', combat: 'm/combat.ogg' } },
    });
    sm.unlock();
    const run = { realmId: 'crystal_caves' };
    const fight = { realm: 'crystal_caves', zone: 'crystal_depths' };
    await sm.playMusic(mapMusic(run));
    await sm.playMusic(battleMusic(fight, run));   // deploy
    await sm.playMusic(battleMusic(fight, run));   // battle
    await sm.playMusic(mapMusic(run));             // back on the map
    assert.equal(audio.sources.length, 1, 'one track, started once');
    assert.ok(!audio.sources[0].stopped);
});

test('abilities sound by kind: shots, spells and terrain; melee is heard on impact; summons on arrival', () => {
    assert.equal(abilitySound('long_shot'), 'arrow_fire');
    assert.equal(abilitySound('fire'), 'spell_cast');
    assert.equal(abilitySound('attack'), null);
    assert.equal(abilitySound('call_wisp'), null);
    assert.equal(abilitySound('stone_wall'), 'terraform');
    assert.equal(abilitySound('no_such_ability'), null);
});

test('battle events map to sounds by what happened and to whom', () => {
    const party = { team: 'player' }, foe = { team: 'enemy' };
    assert.equal(battleEventSound('hit', { target: party }), 'hit_party');
    assert.equal(battleEventSound('hit', { target: foe }), 'hit_enemy');
    assert.equal(battleEventSound('miss'), 'miss');
    assert.equal(battleEventSound('heal'), 'spell_heal');
    assert.equal(battleEventSound('revive'), 'spell_revive');
    assert.equal(battleEventSound('status', { status: 'protect' }), 'spell_shield');
    assert.equal(battleEventSound('status', { status: 'haste' }), 'spell_buff');
    assert.equal(battleEventSound('status', { status: 'stun' }), 'spell_affliction');
    assert.equal(battleEventSound('status', { status: 'poison' }), null, 'minor afflictions stay quiet');
    assert.equal(downSound(party), 'party_down');
    assert.equal(downSound(foe), 'enemy_down');
    assert.ok(battleOpensWithAlert({ kind: 'boss' }) && battleOpensWithAlert({ kind: 'elite' }));
    assert.ok(!battleOpensWithAlert({ kind: 'normal' }));
    for (const name of ['hit_party', 'hit_enemy', 'miss', 'spell_heal', 'spell_revive', 'spell_shield', 'spell_buff',
        'spell_affliction', 'party_down', 'enemy_down', 'arrow_fire', 'spell_cast', 'terraform', 'summon', 'battle_alert']) {
        assert.ok(SOUND_MANIFEST.sfx[name], `${name} is in the manifest`);
    }
});

test('each unit that goes down sounds once, and again only if it gets back up and falls again', () => {
    const a = { id: 1, status: [] }, b = { id: 2, status: [] };
    let { down, fresh } = downChanges([a, b]);
    assert.equal(fresh.length, 0);
    a.status.push('unconscious');
    ({ down, fresh } = downChanges([a, b], down));
    assert.deepEqual(fresh, [a]);
    ({ down, fresh } = downChanges([a, b], down));
    assert.deepEqual(fresh, [], 'still down: no repeat');
    a.status = [];
    ({ down } = downChanges([a, b], down));
    a.status.push('dead');
    ({ fresh } = downChanges([a, b], down));
    assert.deepEqual(fresh, [a]);
});

test('a battle reports hits, misses and ally buffs to its listener, and a failing listener can\'t break the fight', () => {
    const map = gridMap(['........']);
    const mk = (name, job, team, x, extra = []) => createUnit(name, job, team, x, 0, { z: standZ(map, x, 0), extraAbilities: extra });
    const drummer = mk('Drummer', 'novice', 'player', 1, ['rallying_beat']);
    const ally = mk('Ally', 'novice', 'player', 2);
    const foe = mk('Foe', 'goblin', 'enemy', 3);
    const battle = new TacticalBattle(map, [drummer, ally, foe]);
    const events = [];
    battle.onEvent = (type, data) => events.push([type, data.target?.name]);

    battle.applyEnemyAbility(drummer, 'rallying_beat', ally.x, ally.y);
    assert.ok(events.some(([t, who]) => t === 'buff' && who === 'Ally'));

    events.length = 0;
    battle.applyEnemyAbility(foe, 'goblin_slash', ally.x, ally.y);
    assert.ok(events.some(([t, who]) => (t === 'hit' || t === 'miss') && who === 'Ally'), JSON.stringify(events));

    battle.onEvent = () => { throw new Error('listener bug'); };
    assert.doesNotThrow(() => battle.applyEnemyAbility(foe, 'goblin_slash', ally.x, ally.y));
});
