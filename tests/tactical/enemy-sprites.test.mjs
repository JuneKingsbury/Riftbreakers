// Run with: node --test "tests/**/*.test.mjs"
// Every enemy and item has sprite slots of its own in the game skin, so each can be redrawn
// in the skin editor without changing any other. The enemy and item lists come from the
// game's data, so these checks fail as soon as an enemy or item is added without its sprite.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { enemySpriteKey, listEnemies } from '../../js/tactical/enemy-sprites.js';
import { UnitSprites } from '../../js/tactical/unit-sprites.js';
import { EQUIPMENT } from '../../js/tactical/data/equipment.js';

const MANIFEST = JSON.parse(readFileSync(new URL('../../skins/16x16_tiny_world/manifest.json', import.meta.url), 'utf8'));
const inSkin = (category, key) => MANIFEST.sprites[category]?.includes(key) ?? false;

// A skin holding just the named sprites (category:key), each a distinct stand-in image.
function fakeSkin(keys) {
    const images = new Map(keys.map(k => [k, { id: k, width: 16, height: 16 }]));
    return { getSprite: (category, key) => images.get(`${category}:${key}`) ?? null };
}

test('an enemy name becomes a plain file name for its sprite', () => {
    assert.equal(enemySpriteKey('Gray Wolf'), 'enemy_gray_wolf');
    assert.equal(enemySpriteKey("King's Guard"), 'enemy_kings_guard');
    assert.equal(enemySpriteKey('Shadow-Touched Delver'), 'enemy_shadow_touched_delver');
});

test('no two enemies would share a sprite file', () => {
    // GIVEN: every enemy in the encounters and default enemies
    const enemies = listEnemies();

    // WHEN: each gets its sprite key
    const keys = enemies.map(e => e.key);

    // THEN: the keys are all different
    assert.equal(new Set(keys).size, keys.length);
});

test('every enemy has a sprite of its own in the game skin', () => {
    const missing = listEnemies().filter(e => !inSkin('entities', e.key)).map(e => `${e.name} (entities/${e.key}.png)`);
    assert.deepEqual(missing, [], 'copy the enemy\'s current sprite to this name in the skin editor (pick it under Enemies, Save PNG)');
});

test('an enemy drawn with several looks starts from the look it uses most', () => {
    // GIVEN: the Enforcer, a void brute in three fights and a kingdom guard in two
    const enforcer = listEnemies().find(e => e.name === 'Enforcer');

    // THEN: it is listed once, with the common look first
    assert.equal(enforcer.sprite, 'void_brute');
    assert.deepEqual(enforcer.looks.map(l => l.count), [3, 2]);
});

test('the Arcane Construct boss keeps its boss art apart from the ordinary constructs', () => {
    // GIVEN: the construct rank and file, and the realm boss built on the same frame
    const enemies = new Map(listEnemies().map(e => [e.name, e]));

    // THEN: each has its own slot, starting from its own art
    assert.equal(enemies.get('Arcane Construct').sprite, 'construct');
    assert.equal(enemies.get('Arcane Construct Prime').sprite, 'boss_arcane_construct');
    assert.equal(enemies.get('Arcane Construct').looks.length, 1, 'no boss look mixed into the ordinary constructs');
});

test('every item has an icon in the game skin', () => {
    const missing = Object.keys(EQUIPMENT).filter(k => !inSkin('items', k));
    assert.deepEqual(missing, []);
});

test('every item drawn on a character has a worn sprite in the game skin', () => {
    const drawn = new Set(['armor', 'helmet', 'weapon', 'tool']);
    const missing = Object.entries(EQUIPMENT).filter(([k, d]) => drawn.has(d.slot) && !inSkin('equipment_worn', k)).map(([k]) => k);
    assert.deepEqual(missing, []);
});

test('an enemy with its own sprite is drawn with it, untinted', () => {
    // GIVEN: a tinted wolf enemy, and a skin with both the shared wolf and its own sprite
    const sprites = new UnitSprites(fakeSkin(['entities:wolf', 'entities:enemy_dire_wolf']));
    const unit = { name: 'Dire Wolf', team: 'enemy', spriteKey: 'wolf', tint: '#6a6272' };

    // WHEN: the game picks its image
    const img = sprites.get(unit);

    // THEN: it is the enemy's own sprite as drawn (an untinted copy would be a new canvas)
    assert.equal(img.id, 'entities:enemy_dire_wolf');
});

test('an enemy without its own sprite yet still shows the shared one', () => {
    // GIVEN: a skin with only the shared sprite
    const sprites = new UnitSprites(fakeSkin(['entities:raider']));
    const unit = { name: 'Brand New Bandit', team: 'enemy', spriteKey: 'raider', tint: null };

    // WHEN / THEN: the shared sprite is used
    assert.equal(sprites.get(unit).id, 'entities:raider');
});

test('a party member who shares an enemy\'s name keeps their own look', () => {
    // GIVEN: a player unit named like an enemy that has its own sprite
    const sprites = new UnitSprites(fakeSkin(['entities:npc_ally', 'entities:enemy_deserter']));
    const unit = { name: 'Deserter', team: 'player', spriteKey: 'npc_ally', tint: null };

    // WHEN / THEN: the enemy art is not used for them
    assert.equal(sprites.get(unit).id, 'entities:npc_ally');
});

test('every enemy sprite in the game skin still belongs to an enemy', () => {
    // A renamed or removed enemy leaves its old sprite behind; this names those files.
    const keys = new Set(listEnemies().map(e => e.key));
    const stale = (MANIFEST.sprites.entities ?? []).filter(k => k.startsWith('enemy_') && !keys.has(k));
    assert.deepEqual(stale, [], 'enemy sprites no enemy uses; rename or delete them');
});

test('enemies built from body and gear layers get no sprite slot', () => {
    // The default enemies (Grok and company) are layered like party members.
    assert.equal(listEnemies().some(e => e.name === 'Grok'), false);
});
