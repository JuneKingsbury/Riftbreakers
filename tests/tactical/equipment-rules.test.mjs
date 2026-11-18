// Each class's equipment rules fit its role: what it can wear and wield, including what a
// promoted class adds to the class it came from.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { allowedEquipTypes, jobsOfTier, ABILITIES } from '../../js/tactical/data-registry.js';
import { JOB_DATA } from '../../js/content/jobs.js';
import { STARTING_GEAR } from '../../js/run/data/recruits.js';
import { EQUIPMENT } from '../../js/tactical/data/equipment.js';

const can = (job, slot, type, origin = null) => allowedEquipTypes(job, slot, origin)?.has(type) ?? true;

test('the Warden is an armored protector: medium armor and a shield, warding through a wand or staff', () => {
    assert.ok(can('warden', 'armor', 'medium') && can('warden', 'helmet', 'medium'));
    assert.ok(!can('warden', 'armor', 'cloth'), 'no robes');
    assert.ok(!can('warden', 'weapon', 'blade'), 'no physical skills, so no blades');
    assert.ok(can('warden', 'weapon', 'magic') && can('warden', 'tool', 'shield'));
});

test('every class starts in gear it is allowed to use', () => {
    for (const job of jobsOfTier(1)) {
        for (const [field, key] of Object.entries(STARTING_GEAR[job] || {})) {
            if (!key) continue;
            const item = EQUIPMENT[key];
            assert.ok(item, `${job}: unknown item ${key}`);
            assert.ok(can(job, item.slot, item.type), `${job} can't use its starting ${field} ${key}`);
        }
    }
});

test('a class whose skills are mostly magic can always hold a magic weapon, whichever class it came from', () => {
    for (const job of [...jobsOfTier(1), ...jobsOfTier(2)]) {
        const kit = Object.keys(JOB_DATA[job].learnable).map(k => ABILITIES[k]).filter(a => (a.slot ?? 'action') === 'action');
        const magic = kit.filter(a => a.type === 'magic').length;
        if (magic * 2 <= kit.length || job === 'spellblade') continue;   // Spellblades stay with runic blades
        const origins = JOB_DATA[job].tier === 2
            ? jobsOfTier(1).filter(t => JOB_DATA[t].promotions?.includes(job)) : [null];
        for (const origin of origins) assert.ok(can(job, 'weapon', 'magic', origin), `${job}${origin ? ` from ${origin}` : ''}`);
    }
});

test('archers keep to bows, and the front-line promotions get heavier armor', () => {
    assert.ok(!can('runebow', 'weapon', 'magic'));
    assert.ok(can('battlemage', 'weapon', 'blade', 'evoker') && can('battlemage', 'armor', 'light', 'evoker'));
    assert.ok(can('marshal', 'armor', 'heavy', 'warlord') && can('marshal', 'helmet', 'heavy', 'warlord'));
    assert.ok(can('gravewarden', 'armor', 'medium', 'gravecaller'));
    assert.ok(can('sanctifier', 'armor', 'cloth', 'spellblade'));
});
