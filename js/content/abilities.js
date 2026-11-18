// ABILITY_DATA: every ability, keyed by id, gathered from the files that define them:
//   classes/<class>.js     the abilities of each class's skill tree
//   enemies/*.js           abilities only enemies fight with
//   items/abilities.js     abilities only equipment grants
//   abilities/common.js    Attack and the plain skills others extend
//   abilities/unused.js    abilities nothing uses yet
// An ability is defined once, wherever it belongs; anything else uses it by key. Every
// field is described in vocab.js (SCHEMAS.ability). data-registry.js resolves `extends`
// (against these and ABILITY_TEMPLATES) and adds the ranked versions.
import { CLASSES } from './classes/index.js';
import { ENEMY_FILES } from './enemies/index.js';
import * as common from './abilities/common.js';
import * as unused from './abilities/unused.js';
import * as itemAbilities from './items/abilities.js';

export { ABILITY_TEMPLATES } from './abilities/templates.js';

export const ABILITY_DATA = {};
const sources = [
    ['abilities/common.js', common],
    ...CLASSES.map(c => [`classes/${c.key}.js`, c]),
    ...Object.entries(ENEMY_FILES).map(([name, f]) => [`enemies/${name}.js`, f]),
    ['items/abilities.js', itemAbilities],
    ['abilities/unused.js', unused],
];
// Ability key → the file that defines it (for error messages and CONTENT.md).
export const ABILITY_FILE = {};
const definedIn = ABILITY_FILE;
for (const [file, mod] of sources) {
    for (const [key, ab] of Object.entries(mod.abilities)) {
        if (Object.hasOwn(ABILITY_DATA, key)) throw new Error(`content: ability '${key}' is defined in both ${definedIn[key]} and ${file}`);
        ABILITY_DATA[key] = ab;
        definedIn[key] = file;
    }
}
