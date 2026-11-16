# Riftbreakers
A tactics roguelike in the world of Rifthold.

## Running

No build step. Serve the repo root (`npm run serve`, or any static server) and open `index.html`.
Run the headless logic tests with `npm test` (Node 22+).

## Runs

A run is three acts (`js/run/`). Each act is a generated map of 15 floors (`map-gen.js`): pick a
path through battles, elites, events, shops, rest sites, treasure and recruits, ending in a boss.

- **Party:** start with three Tier 1 roles and recruit up to six. Battles are automatic, so the
  party fully heals after every win; damage from events lasts until then. Losing a battle ends the run.
- **Growth:** wins give XP; every level gives a skill point. Each role has a small skill tree
  (`data/jobs.js`: cost and prerequisite per skill), and learned skills can be upgraded to rank II
  and III (`data-registry.js` generates the ranked versions). At level 5 a member can promote once
  into one of two Tier 2 jobs, at a rest site or after a boss. Equipment adds stats and can grant
  abilities (`data/equipment.js`), and relics are party-wide modifiers (`js/run/data/relics.js`).
- **Behavior:** by default each character follows rules generated from their current skills
  (`ai/default-scripts.js` `autoScriptFor`). The Tactics editor lets you replace them with your own.
- **State:** `RunState` (`run-state.js`) holds the whole run as plain data and autosaves to
  localStorage, so a run can be continued from the title screen. Between runs, renown buys
  unlocks (`profile.js`).
- **Content:** encounters, events, relics and recruits live in `js/run/data/`.

## Tactical battle view

Battles render in real 3D with [Three.js](https://threejs.org) (vendored in `lib/three/`, r186, MIT).
`js/tactical/battle-view3d.js` builds terrain meshes from the map's blocks (`terrain-mesh.js`), draws
characters as upright billboard sprites, and orbits the camera in 90 degree steps (Q/E).
The camera starts in free mode, framing the whole map. V (or the ⤢ button) switches to tracking mode,
which follows the acting unit.
Game rules never depend on the view: per-unit animation state lives in `js/tactical/view-state.js`.

`tests/harness/view3d.html` and `tests/harness/scenes.html` are manual pages for looking at the view
(serve the repo root, then open `/tests/harness/view3d.html?map=0` or `?map=<map id>`).

## Battle maps

Maps are columns of stacked one-level blocks (`js/tactical/battle-map.js`). Height comes only from
where blocks are placed, never from the material, so blocks can float: units walk on top of a bridge
and underneath it. A unit needs two empty levels above a block to stand on it, so a bridge must be at
layer 3 or higher for units to pass under. Positions in the rules are cells `{x, y, z}`, and
range/occupancy sets use `"x,y,z"` keys.

Materials only set gameplay and look:

| Material | Standable | Move cost | Blocks sight |
|----------|-----------|-----------|--------------|
| grass    | yes       | 1         | yes          |
| dirt     | yes       | 1         | yes          |
| rubble   | yes       | 2         | yes          |
| water    | no        | -         | no           |
| wall     | no        | -         | yes          |

Each map is a JSON file in `js/tactical/data/maps/`. `index.js` in that folder imports them all and
is generated (don't edit it by hand). Every battle picks one of the maps at random.

## Map editor

### Running it

1. Start the dev server: `npm run dev` (Node 22+). It serves the game like `npm run serve`, and also
   lets the editor write map files to disk. Use `PORT=9000 npm run dev` for another port.
2. Open http://127.0.0.1:8000.
3. On the start screen, open **Settings > Dev Tools** and click **Map**.

The editor also opens under a plain static server (`npm run serve`), but then **Save** downloads the
`.json` file instead of writing it. To add a downloaded map, copy it into `js/tactical/data/maps/`
and start `npm run dev` once: the server regenerates `index.js` at startup.

Unsaved work is kept as a draft in the browser's local storage and comes back the next time the
editor opens.

### Controls

| Input | Action |
|-------|--------|
| Left click / drag | Use the current tool |
| Right drag | Orbit the camera |
| Middle drag, or Shift + right drag | Pan |
| Mouse wheel | Zoom |
| Q / E | Turn 90 degrees |
| F | Fit the whole map in view |
| W A S D / arrow keys | Pan |
| [ / ] | Active layer down / up |
| 1-7 | Pick a tool |
| X | Hide blocks above the active layer |
| G | Show / hide the layer grid |
| Ctrl+Z / Ctrl+Shift+Z (or Ctrl+Y) | Undo / redo |
| Ctrl+S | Save |

### Tools

Pick a material in the left panel first. A translucent box shows where the tool will act.

1. **Place** - click a block face to add a block against it: a top face stacks upward, a side face
   places next to it at the same level. When the blue layer grid is above the ground, click the grid
   to place a floating block on the active layer. Dragging lays a row on the level you started on.
2. **Erase** - click a block to remove it. Dragging stays on the level you started on.
3. **Paint** - change the material of blocks (brush 1x1, 3x3 or 5x5, same level).
4. **Height** - set **Target height**, then drag over columns to raise or lower the ground to it.
   Floating blocks above are kept. Brush sizes apply.
5. **Rect** - drag a rectangle on the layer grid to fill it with the material on the active layer
   (bridges, floors, roofs). Shift-drag clears the rectangle instead.
6. **Spawn** - choose **player** or **enemy**, then click a surface to add or remove a spawn point.
   Battles expect 6 per side.
7. **Pick** - click a block to make its material the current one.

**Layer** sets the level the grid, Place-on-grid and Rect work at. **Hide above** cuts away every block
above the active layer, so you can reach the ground under bridges and overhangs.

### Example: a bridge units can walk under

1. **New**, size `24x24`.
2. **Height** tool, target height 3, and drag two hills a few columns apart.
3. Set **Layer** to 3, choose **Rect**, and drag a strip between the hill tops to make the bridge deck.
   It sits level with the hills, so units can walk onto it, and layer 3 leaves two empty levels of
   headroom underneath.
4. **Spawn** six player and six enemy points. Put one under the bridge if you like
   (turn on **Hide above** to click the ground beneath it).
5. Check that the **Checks** panel says "ready to play", then **Save**.

### Saving, opening and testing

- **Save** writes `js/tactical/data/maps/<id>.json` and regenerates `index.js`. The **id** (a-z, 0-9,
  `_`) is the file name; **name** is the display name. If the map has problems, the editor asks before
  saving.
- **Save As** asks for a new id and name. **Open...** loads any saved map, including the built-in ones.
- **Export** downloads the current map as `.json`, and **Import** loads one from a file.
- **Resize** changes the width and depth and keeps what fits. **New** starts a flat grass map.
- **Test** opens the saved map in the battle view harness (`tests/harness/view3d.html?map=<id>`).
- Reload the game after saving so battles can pick the new map.

The **Checks** panel shows errors (spawns that can't be reached or stood on, duplicate spawns) and
warnings (wrong spawn counts, large walled-off areas). The same checks run in `npm test` for every
map in the folder.

### Map file format

```json
{ "format": 1, "id": "my_map", "name": "My Map", "width": 24, "depth": 24,
  "palette": ["grass", "dirt", "wall"],
  "playerSpawns": [{ "x": 2, "y": 2, "z": 0 }],
  "enemySpawns":  [{ "x": 20, "y": 20, "z": 0 }],
  "columns": [ [[0, 0, 0]], [[0, 2, 1]], [[0, 0, 0], [4, 4, 2]] ] }
```

`columns[y * width + x]` lists runs `[zFrom, zTo, paletteIndex]` (inclusive). In the example, the
second column is a dirt stack up to level 2, and the third column is ground plus a floating wall block
at level 4. Spawn `z` is the level of the surface the unit stands on.
