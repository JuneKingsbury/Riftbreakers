# Riftbreakers
A tactics roguelike in the world of Rifthold.

## Running

No build step. Serve the repo root (`npm run serve`, or any static server) and open `index.html`.
Run the headless logic tests with `npm test` (Node 22+).

## Runs

A run is three acts (`js/run/`). Each act is a generated map of 15 floors (`map-gen.js`): pick a
path through battles, elites, events, shops, rest sites, treasure and recruits, ending in a boss.

- **Realms:** each act is set in a realm from Rifthold (`data/realms.js`), picked at random from that
  act's list (`ACT_REALMS`), never two from the same chain. Act 1: The Wild Frontiers, Verdant Depths
  or Crystal Caves. Act 2: Arcane Library, Sunken Abyss or Void Sanctum. Act 3: Palace Fortress or
  Shifting Labyrinth. The other realms of each chain are folded into the listed one
  (`realmSources`): Crystal Caves also fields Crystal Mines and Crystal Depths fights and events.
  Folded-in fights keep their rosters and their own look and maps, but are retuned for the act
  (`retuneEncounter` in `data/encounters.js`): levels move to the act's, and stats scale so the
  roster's power matches the home realm's own fights, with small per-realm corrections
  (`RETUNE_BIAS`) measured in simulated battles. Putting a realm back in a list stops folding it.
  An act ends at the heart of its realm: each listed realm names its two bosses (`bosses`), so a
  boss from a realm's outer reaches isn't fielded as its finale.
  The realm decides the act's
  enemies (`data/encounters.js`, keyed by realm; a roster entry's `sprite` dresses a job as a realm
  creature), about half of its events (`data/realm-events.js`), which battle maps its fights use, and
  how they look: a realm's `look` swaps map materials for ones with the same rules (moss for grass,
  bookshelves for walls) and sets the battle and act map backgrounds.

- **Classes:** ten starting roles (`data/jobs.js`), each promoting into one of two Tier 2 jobs.
  Warden, Evoker and Runebow are open from the start; the rest are bought with renown.
  The six schools of magic (Evocation, Enchantment, Abjuration, Conjuration, Transmutation,
  Divination) are joined by:
  - **Illusionist** (Illusion): copies that enemies would rather strike (they stand still,
    shatter when broken, and allies walk through them), Blur and Vanish.
  - **Gravecaller** (Necromancy): drains, and rites on knocked-out enemies (raise them as
    skeletons, burst them among their friends).
  - **Alchemist** (no school, no MP): flasks that splash both sides, so where everyone stands
    matters. The Field Surgeon's Steady Hands keeps them to one side.
  - **Warlord** (no school): orders that move speed gauges (Rally, Delay), Taunt, and swapping
    places with an ally.
  Recruits met on the road can be any role, unlocked or not.
- **Party:** start with one to three Tier 1 roles (fewer is a challenge run) and recruit up to six. Battles are automatic, so the
  party fully heals after every win; damage from events lasts until then. Losing a battle ends the run.
- **Growth:** wins give XP; every level gives a skill point. Each role has a small skill tree
  (`data/jobs.js`: cost and prerequisite per skill), and learned skills can be upgraded to rank II
  and III (`data-registry.js` generates the ranked versions). At level 5 a member can promote once
  into one of two Tier 2 jobs, at any time from the Party menu (it costs nothing). Equipment adds stats and can grant
  abilities (`data/equipment.js`): actions join the skill list, and passives (e.g. Ghost Step) are
  always on, on top of the reaction/support/movement the character chose, and relics are party-wide modifiers (`js/run/data/relics.js`).
- **Equipment screen:** Equipment (G on the map, the Change buttons in the Party menu, or the
  button on node screens) shows one character on a paper doll beside the party's shared bag
  (`js/run/gear-screen.js`). Tabs or ← → switch characters. Hovering an item (a first tap on
  touch screens) previews it on the doll with every stat change; clicking it equips it. The
  numbers come from `member-stats.js`, the same calculation battles use.
- **Equipment rules:** each class's `allowedEquipment` (`data/jobs.js`) fits its role, and a
  promoted class adds to its starting class's list with `equipmentExpansions` (e.g. Battlemage
  gains blades, Marshal heavy armor). `tests/tactical/equipment-rules.test.mjs` checks that
  starting gear is wearable and that magic-heavy classes can always hold a magic weapon.
- **Skill plans:** Settings > Skill Plans (or Edit skill plan in the Party menu) sets, per starting
  class, a whole build: one promotion and an ordered list of skills to learn and upgrade from
  both kits (`js/run/skill-plans.js`). With auto-allocate on, members spend points on the next
  step as soon as they can afford it, saving up when it costs more than they have or needs a
  promotion they haven't reached, and promote into the planned class at level 5. A member who
  promotes into the other class by hand skips the plan's promotion steps. Plans are stored on
  the device (`riftbreak.skillplans.v1`; older per-promotion plans are merged on load) and
  travel with save exports.
- **Rest sites and enchanting:** a rest site offers Train (XP for everyone) or Enchant: one owned
  item, equipped or in the bag, gains a level, up to +2 (about +20% of its main stats per level).
  An enchanted item is its own key (`iron_sword+1`, registered in `data/equipment.js` and hidden
  from loops over `EQUIPMENT`), so it equips, sells and saves like any item. Found items are
  rarely already enchanted: 3% +1 and 0.5% +2, doubled from elites and bosses (`run-state.js`).
- **Real time:** battles run in real time (`js/tactical/realtime.js`). Everyone acts at the
  opening, then each unit acts whenever its speed gauge fills, while others are still moving.
  A move-and-attack lands when the walker arrives. Commanding units by hand (the manual test
  harness) keeps the turn-by-turn flow.
- **Behavior:** by default each character follows rules generated from their current skills
  (`ai/default-scripts.js` `autoScriptFor`). The Tactics editor lets you replace them with your own.
  Each ability or move rule has a positioning style (`positionStyle` in `ai/script-runtime.js`):
  ranged roles default to Careful (stay out of enemy reach, attack from near max range, don't run
  ahead of the group, melee only as a last resort); everyone else defaults to Bold.
- **Rift Tiers and renown bonuses:** after a first win, the New Run screen offers Rift Tiers
  (`RIFT_TIERS` in `profile.js`): each keeps the ones below and adds a twist (tougher elites and
  bosses, dearer shops, fewer reward choices, then tougher enemies everywhere and bigger boss
  fights), for +25% to +100% renown. Winning at a tier opens the next. Starting with one or two
  members adds +50% or +25%. The enemy and shop effects live in `run-state.js` (`riftTierMods`).
- **More unlocks:** Traveler's Pack, Masterwork, Haggler, Relic Codex (after Heirloom), Scout's
  Report (`data/scouting.js`: a line on each act's boss, chosen when the act begins), Tactician's
  Codex (24 rules and a shared template, `script-store.js`) and title backdrops
  (`data/backdrops.js`, picked in Settings > Graphics). The tile skin is fixed to the game's own.
- **Collection rewards:** in Feats, finding 33% of all items pays 50 renown once, and 66% earns
  the Collector's Loupe, a trinket that only drops once earned (`COLLECTION_REWARDS`).
- **Feats:** a title-screen panel (`js/run/feats.js`) with three tabs: every item in the game,
  found or not yet found, with a completion percentage; a bestiary of the 16 bosses with how
  often each has been beaten; and the last 5 winning runs. The profile keeps `items` (noted
  whenever the run changes), `bossKills` (counted from `run.bossesDefeated`) and `recentWins`
  (added by `recordRun`), all cleaned on load and included in save exports.
- **Splash:** the studio splash from Rifthold plays on load (`js/ui/splash.js`, with
  `icons/splash.gif`, `icons/splashBackgroundTile.png` and Pixelify Sans in `fonts/`). Any key
  or tap skips it.
- **State:** `RunState` (`run-state.js`) holds the whole run as plain data and autosaves to
  localStorage, so a run can be continued from the title screen. Between runs, renown buys
  unlocks (`profile.js`). The profile is saved separately, and loading cleans up damaged or
  edited data (`sanitizeProfile`).
- **Backups:** Settings > Save Data exports progress (the profile, skill plans and any run in progress) to a
  `.json` file or a copyable save code, and imports it back on any device (`save-transfer.js`).
  Importing checks the save and asks before replacing current progress. Browsers can clear
  local storage, mobile Safari after about a week of not visiting, so a backup is the only
  way to keep progress safe.
- **Content:** encounters, events, relics and recruits live in `js/run/data/`.

## Audio

Music and sound effects follow Rifthold's sound system (`js/audio/`): looping music that
crossfades between scenes, with each realm's own track on its act map, and short sound effects
with a slight random pitch shift so repeated sounds don't grate. The Music and SFX sliders in
Settings control them. `audio/README.md` lists every track and sound and when it plays.

## Tactical battle view

Battles render in real 3D with [Three.js](https://threejs.org) (vendored in `lib/three/`, r186, MIT).
`js/tactical/battle-view3d.js` builds terrain meshes from the map's blocks (`terrain-mesh.js`), draws
characters as upright billboard sprites, and orbits the camera in 90 degree steps (Q/E).
The camera starts in free mode, framing the whole map. V (or the ⤢ button) switches to tracking mode,
which follows the acting unit.
Game rules never depend on the view: per-unit animation state lives in `js/tactical/view-state.js`.

Battle effects follow Rifthold's combat views. The battle reports what happens through
`TacticalBattle.onEvent`, and the view answers with:
- **Unit motion:** lunges, recoil from hits with a white flash, dodge hops, falling over when
  knocked out (and getting back up when revived), and a victory bounce.
- **Particles:** square-pixel sparks, debris and motes in each element's colors.
- **Effect sprites:** the skin's effect images, animated in code.
- **Projectiles** that point along their flight and leave trails, plus camera shake.

Area abilities play out on every tile they cover, rippling out from the center: a glow on each
tile plus a style per element (fx-presets `areaStyle`: dust, flames, frost, sparks, light, spores,
splashes). Earth spells make the tiles themselves heave (`TerrainShaker` in `terrain-mesh.js`),
with units and grass riding them.
Hits land when the arrow, spell or swing arrives. The mechanics are in
`js/tactical/battle-fx.js` and the per-ability choices in `js/tactical/fx-presets.js`. Camera
shake is off for players whose system asks for reduced motion.

`tests/harness/view3d.html` and `tests/harness/scenes.html` are manual pages for looking at the view
(serve the repo root, then open `/tests/harness/view3d.html?map=0` or `?map=<map id>`). Add
`&realm=<realm id>` to see a map in a realm's look with that realm's boss fight.

## Battle maps

Maps are columns of stacked one-level blocks (`js/tactical/battle-map.js`). Height comes only from
where blocks are placed, never from the material, so blocks can float: units walk on top of a bridge
and underneath it. A unit needs two empty levels above a block to stand on it, so a bridge must be at
layer 3 or higher for units to pass under. Positions in the rules are cells `{x, y, z}`, and
range/occupancy sets use `"x,y,z"` keys.

Materials only set gameplay and look (`MATERIALS` in `battle-map.js`, looks in `tile-render.js`):

| Kind     | Materials | Standable | Move cost | Blocks sight |
|----------|-----------|-----------|-----------|--------------|
| Ground   | grass, dirt, sand, moss, autumn, swamp, fungal, stone, redrock | yes | 1 | yes |
| Rough    | rubble, snow, mud, shallows | yes | 2 | yes |
| Floors   | cobble, brick, planks, marble, carpet, gravel_path, verdant_tile, crystal_floor, abyss_tile, glyph | yes | 1 | yes |
| Walls    | wall, stone_wall, brick_wall, wood_wall, kingdom_wall, bookshelf, hedge, crystal, abyss_wall, void_wall, warded_wall | no | - | yes |
| Liquids  | water, bog, void_water, lava | no | - | no |

Each map is a JSON file in `js/tactical/data/maps/`. `index.js` in that folder imports them all and
is generated (don't edit it by hand). A battle picks one of its realm's maps (the realm's `maps` list) at random. A new map only shows up in runs once a realm lists it.

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
