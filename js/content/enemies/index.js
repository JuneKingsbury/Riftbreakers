// Enemy jobs and the abilities they fight with, grouped by kind. Encounters
// (js/content/realms/) put them in rosters by job key; see js/content/README.md.
//
// To add an enemy, add it to one of these files (or add a new file here).
import * as novice from './novice.js';
import * as monsters from './monsters.js';
import * as beasts from './beasts.js';
import * as humans from './humans.js';
import * as summons from './summons.js';

// File name → module, in the order their jobs are listed in JOB_DATA (after the classes).
export const ENEMY_FILES = { novice, monsters, beasts, humans, summons };
