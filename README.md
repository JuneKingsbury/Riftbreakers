# Riftbreakers
A tactics RPG in the world of Rifthold.

## Running

No build step. Serve the repo root (`npm run serve`, or any static server) and open `index.html`.
Run the headless logic tests with `npm test` (Node 22+).

## Tactical battle view

Battles render in real 3D with [Three.js](https://threejs.org) (vendored in `lib/three/`, r186, MIT).
`js/tactical/battle-view3d.js` builds terrain meshes from the map's tile types and elevations, draws
characters as upright billboard sprites, and orbits the camera in 90 degree steps (Q/E).
Game rules never depend on the view: per-unit animation state lives in `js/tactical/view-state.js`.

`tests/harness/view3d.html` and `tests/harness/scenes.html` are manual pages for looking at the view
(serve the repo root, then open `/tests/harness/view3d.html?map=0`).
