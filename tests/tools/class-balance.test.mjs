// The class balance sim (tools/class-balance.mjs) on a small sample: it plays real fights,
// gives the same numbers for the same seed, and no starting class runs away from the others.
// The full tables (npm run balance) are what tuning goes by; this only catches a big slip.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { simClass, simScenario, SCENARIOS, TIER1, TIER2 } from '../../tools/class-balance.mjs';

test('the balance sim covers every class and plays the same fights for the same seed', () => {
    assert.equal(TIER1.length, 10);
    assert.equal(TIER2.length, 20);
    const a = simClass('warden', SCENARIOS.a1elite, { battles: 6, seed: 3 });
    const b = simClass('warden', SCENARIOS.a1elite, { battles: 6, seed: 3 });
    assert.deepEqual(a, b);
    assert.equal(a.battles, 6);
});

test('no starting class is far ahead of or behind the others on the Act 1 boss', () => {
    const rows = simScenario(SCENARIOS.a1boss, { battles: 30, seed: 2 });
    const rates = rows.map(r => r.rate);
    const spread = Math.max(...rates) - Math.min(...rates);
    // About 25 points with the current classes at this sample size; the full sim keeps
    // them within ~10 of the median.
    assert.ok(spread <= 0.35, `Act 1 boss win rates spread ${Math.round(spread * 100)} points: ${rows.map(r => `${r.job} ${Math.round(r.rate * 100)}%`).join(', ')}`);
    assert.ok(rates.every(r => r >= 0.5), 'every starting class wins most Act 1 boss fights');
});
