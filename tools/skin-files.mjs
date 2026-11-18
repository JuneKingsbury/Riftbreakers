// Keeps a skin folder's manifest.json in step with the PNGs in it. The game only loads the
// sprites the manifest lists, so a PNG dropped into skins/<name>/<category>/ shows up once
// this has run.
//
//   npm run skin-manifest          rewrites the manifest of every skin in skins/index.json
//   npm run dev                    does the same at startup
//
// Sprite lists are sorted so the file diffs cleanly. The colonist variant counts the skin
// editor reads (hairVariants and friends) are recounted from the files; any other manifest
// field is kept as it was.
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const SKINS_DIR = path.join(ROOT, 'skins');

// Manifest field -> sprite key prefix; the count is how many of prefix1, prefix2, ... exist.
const VARIANT_PREFIXES = {
    bodyVariants:        'colonist_body_',
    humanBodyVariants:   'colonist_human_body_',
    nymphBodyVariants:   'colonist_nymph_body_',
    ferinBodyVariants:   'colonist_ferin_body_',
    kobalosBodyVariants: 'colonist_kobalos_body_',
    bufosBodyVariants:   'colonist_bufos_body_',
    hairVariants:        'colonist_hair_',
    shirtVariants:       'colonist_shirt_',
};

/** { category: [key, ...] } for every <category>/<key>.png in a skin folder, sorted. */
export function listSkinSprites(skinDir) {
    const sprites = {};
    for (const category of readdirSync(skinDir).sort()) {
        const dir = path.join(skinDir, category);
        if (category.startsWith('.') || !statSync(dir).isDirectory()) continue;
        const keys = readdirSync(dir).filter(f => f.endsWith('.png')).map(f => f.slice(0, -4)).sort();
        if (keys.length) sprites[category] = keys;
    }
    return sprites;
}

/** The manifest a skin folder should have: its PNGs, recounted variants, other fields kept. */
export function buildSkinManifest(skinDir) {
    const file = path.join(skinDir, 'manifest.json');
    const old = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
    const sprites = listSkinSprites(skinDir);
    const entities = new Set(sprites.entities ?? []);
    const manifest = { ...old, sprites };
    for (const [field, prefix] of Object.entries(VARIANT_PREFIXES)) {
        let n = 0;
        while (entities.has(`${prefix}${n + 1}`)) n++;
        // A count with no matching sprites (an old field the art moved away from) stays as it was.
        if (n > 0 || !(field in old)) manifest[field] = n;
    }
    return manifest;
}

/** Rewrites skinDir/manifest.json from its PNGs. Returns how many sprites it lists. */
export function writeSkinManifest(skinDir) {
    const manifest = buildSkinManifest(skinDir);
    writeFileSync(path.join(skinDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
    return Object.values(manifest.sprites).reduce((n, keys) => n + keys.length, 0);
}

/** Skin folders named in skins/index.json ('ascii' is built in and has none). */
export function listSkinFolders() {
    const names = JSON.parse(readFileSync(path.join(SKINS_DIR, 'index.json'), 'utf8'));
    return names.map(n => path.join(SKINS_DIR, n)).filter(d => existsSync(d));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    for (const dir of listSkinFolders()) {
        console.log(`skins/${path.basename(dir)}/manifest.json: ${writeSkinManifest(dir)} sprites`);
    }
}
