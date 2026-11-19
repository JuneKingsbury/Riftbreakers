// Content validation: every class, ability, enemy, item, relic, event, realm and encounter
// uses only fields and values the game knows (js/content/vocab.js), and refers only to
// content that exists. A typo in a content file fails here, naming the entry and field.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

import { validateContent } from '../../js/content/validate.js';
import { ABILITY_DATA, ABILITY_TEMPLATES } from '../../js/content/abilities.js';
import { JOB_DATA } from '../../js/content/jobs.js';
import { EQUIPMENT } from '../../js/tactical/data/equipment.js';
import { RELICS } from '../../js/run/data/relics.js';
import { AFFIXES } from '../../js/content/affixes.js';
import { EVENTS } from '../../js/run/data/events.js';
import { ENCOUNTERS } from '../../js/run/data/encounters.js';
import { REALMS, CHAINS, ACT_REALMS } from '../../js/run/data/realms.js';
import { MAP_DATA } from '../../js/tactical/data/maps/index.js';
import { MATERIALS } from '../../js/tactical/battle-map.js';

const SKIN = JSON.parse(readFileSync(new URL('../../skins/16x16_tiny_world/manifest.json', import.meta.url), 'utf8'));

const content = () => ({
    abilities: ABILITY_DATA, templates: ABILITY_TEMPLATES, jobs: JOB_DATA, items: EQUIPMENT, relics: RELICS, affixes: AFFIXES, events: EVENTS,
    encounters: ENCOUNTERS, realms: REALMS, chains: CHAINS, maps: MAP_DATA.map(m => m.id), materials: MATERIALS,
    actRealms: ACT_REALMS, sprites: SKIN.sprites.entities,
});

test('all content uses known fields and values, and refers only to content that exists', () => {
    const errors = validateContent(content());
    assert.deepEqual(errors, [], `\n${errors.join('\n')}`);
});

// Browsers can't list a folder, so each content folder has an index that imports its files.
// A file left out of its index silently never loads; this catches it.
test('every content file is listed in its folder\'s index', () => {
    for (const dir of ['classes', 'enemies', 'realms', 'items']) {
        const url = new URL(`../../js/content/${dir}/`, import.meta.url);
        const index = readFileSync(new URL('index.js', url), 'utf8');
        for (const file of readdirSync(url).filter(f => f.endsWith('.js') && !['index.js', 'helpers.js', 'abilities.js'].includes(f))) {
            assert.match(index, new RegExp(`from '\\./${file.replace('.', '\\.')}'`), `${dir}/${file} is not imported by ${dir}/index.js`);
        }
    }
});
