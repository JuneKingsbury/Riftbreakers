// Run with: node --test "tests/**/*.test.mjs"
// The game's skin is a folder of PNGs, and the game loads only the sprites its manifest.json
// lists. These checks catch a PNG added without updating the manifest (it would silently never
// appear) and a manifest entry whose file is gone (it would silently fall back to ASCII).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { listSkinSprites, buildSkinManifest } from '../../tools/skin-files.mjs';

const SKIN_DIR = fileURLToPath(new URL('../../skins/16x16_tiny_world/', import.meta.url));
const manifest = JSON.parse(readFileSync(path.join(SKIN_DIR, 'manifest.json'), 'utf8'));
const asSet = sprites => new Set(Object.entries(sprites).flatMap(([c, keys]) => keys.map(k => `${c}/${k}`)));

test('every PNG in the game skin folder is listed in its manifest', () => {
    // GIVEN: the PNG files on disk and the manifest the game reads
    const onDisk = asSet(listSkinSprites(SKIN_DIR));
    const listed = asSet(manifest.sprites);

    // THEN: none is missing from the manifest (run npm run skin-manifest to fix)
    const unlisted = [...onDisk].filter(s => !listed.has(s));
    assert.deepEqual(unlisted, [], 'PNGs the game would never load; run npm run skin-manifest');
});

test('every sprite the manifest lists has its PNG', () => {
    const missing = Object.entries(manifest.sprites)
        .flatMap(([c, keys]) => keys.map(k => `${c}/${k}.png`))
        .filter(f => !existsSync(path.join(SKIN_DIR, f)));
    assert.deepEqual(missing, [], 'listed sprites with no file; run npm run skin-manifest');
});

test('the shipped manifest is exactly what npm run skin-manifest would write', () => {
    // Catches stale colonist variant counts as well as sprite lists.
    assert.deepEqual(manifest, buildSkinManifest(SKIN_DIR));
});

test('rebuilding a manifest picks up a new PNG and recounts colonist variants', () => {
    // GIVEN: a skin with two hair styles listed, then a third hair PNG dropped into the folder
    const dir = mkdtempSync(path.join(tmpdir(), 'skin-'));
    try {
        mkdirSync(path.join(dir, 'entities'));
        for (const n of [1, 2, 3]) writeFileSync(path.join(dir, 'entities', `colonist_hair_${n}.png`), '');
        writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({
            sprites: { entities: ['colonist_hair_1', 'colonist_hair_2'] }, hairVariants: 2, bodyVariants: 1,
        }));

        // WHEN: the manifest is rebuilt
        const rebuilt = buildSkinManifest(dir);

        // THEN: the new sprite is listed and counted; a legacy count with no sprites is kept
        assert.deepEqual(rebuilt.sprites.entities, ['colonist_hair_1', 'colonist_hair_2', 'colonist_hair_3']);
        assert.equal(rebuilt.hairVariants, 3);
        assert.equal(rebuilt.bodyVariants, 1);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});
