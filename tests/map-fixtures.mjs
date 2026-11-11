// Small hand-drawn maps for tests. Each row is a string, one char per column:
//   . grass   , dirt   : rubble   ~ water   # wall (three blocks tall, like converted maps)
// An optional elevation row of digits raises a column to that height.
import { createEmptyMap, setBlock, buildCells } from '../js/tactical/battle-map.js';

const CHAR_TO_TILE = { '.': 'grass', ',': 'dirt', ':': 'rubble', '~': 'water', '#': 'wall' };

export function gridMap(rows, elevRows = null) {
    const map = createEmptyMap(rows[0].length, rows.length);
    rows.forEach((row, y) => {
        [...row].forEach((ch, x) => {
            const type = CHAR_TO_TILE[ch] || 'grass';
            const e = elevRows ? parseInt(elevRows[y][x], 10) || 0 : 0;
            const top = type === 'wall' ? e + 2 : e;
            for (let z = 0; z <= top; z++) setBlock(map, x, y, z, type === 'water' && z < e ? 'dirt' : type);
        });
    });
    return buildCells(map);
}
