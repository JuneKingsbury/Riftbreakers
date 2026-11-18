// JOB_DATA: every job, keyed by id: the player classes (classes/) and the enemy and summon
// jobs (enemies/). data-registry.js resolves it into JOB_STATS for combat.
//
// Order matters: the Novice first, then the classes in CLASSES order, then the enemies.
// jobsOfTier() and the recruit and class lists follow it.
import { CLASSES } from './classes/index.js';
import { ENEMY_FILES } from './enemies/index.js';

const { novice, ...enemies } = ENEMY_FILES;

export const JOB_DATA = {};
const add = (key, job, file) => {
    if (Object.hasOwn(JOB_DATA, key)) throw new Error(`content: job '${key}' is defined twice (${file})`);
    JOB_DATA[key] = job;
};
for (const [key, job] of Object.entries(novice.jobs)) add(key, job, 'enemies/novice.js');
for (const c of CLASSES) add(c.key, c.job, `classes/${c.key}.js`);
for (const [name, file] of Object.entries(enemies)) for (const [key, job] of Object.entries(file.jobs)) add(key, job, `enemies/${name}.js`);
