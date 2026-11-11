// One-off: converts the old string-grid maps (data/maps.js) into block map files.
// Run with: node tools/convert-legacy-maps.mjs <old maps.js> (from git history, before the block format)
// Kept for reference after the old grids were deleted; it needs a copy of the old maps.js.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { buildCells, serializeMap } from '../js/tactical/battle-map.js';
import { writeMapIndex, formatMapJson } from './map-files.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MAPS_DIR = path.join(ROOT, 'js/tactical/data/maps');
const legacyPath = process.argv[2];
if (!legacyPath) throw new Error("usage: node tools/convert-legacy-maps.mjs <old maps.js>");
const { MAP_DATA } = await import(path.resolve(legacyPath));

const CHAR_TO_TILE = { '.': 'grass', ',': 'dirt', '~': 'water', '#': 'wall', ':': 'rubble', '^': 'grass' };
// Walls used to be drawn about two levels taller than their elevation.
const WALL_EXTRA_LEVELS = 2;

for (const def of MAP_DATA) {
    const map = { id: def.id, name: def.name, width: def.width, height: def.height };
    map.columns = [];
    for (let y = 0; y < def.height; y++) {
        for (let x = 0; x < def.width; x++) {
            const type = CHAR_TO_TILE[def.tiles[y][x]] || 'grass';
            const e = parseInt(def.elevation[y][x], 10) || 0;
            const col = {};
            if (type === 'wall') {
                for (let z = 0; z <= e + WALL_EXTRA_LEVELS; z++) col[z] = 'wall';
            } else if (type === 'water') {
                for (let z = 0; z < e; z++) col[z] = 'dirt';
                col[e] = 'water';
            } else {
                for (let z = 0; z <= e; z++) col[z] = type;
            }
            map.columns.push(col);
        }
    }
    buildCells(map);
    const elev = s => parseInt(def.elevation[s.y][s.x], 10) || 0;
    map.playerSpawns = def.playerSpawns.map(s => ({ x: s.x, y: s.y, z: elev(s) }));
    map.enemySpawns  = def.enemySpawns.map(s => ({ x: s.x, y: s.y, z: elev(s) }));
    writeFileSync(path.join(MAPS_DIR, `${def.id}.json`), formatMapJson(serializeMap(map)));
    console.log('wrote', def.id);
}
writeMapIndex(MAPS_DIR);

