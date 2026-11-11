// The dev server's map API: saving writes the file and the index, bad input is refused,
// and static files cannot be read from outside the served folder.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { createDevServer } from '../../tools/dev-server.mjs';
import { createEmptyMap, serializeMap } from '../../js/tactical/battle-map.js';

let server, base, root, mapsDir;

before(async () => {
    root = mkdtempSync(path.join(tmpdir(), 'rb-dev-'));
    mapsDir = path.join(root, 'maps');
    mkdirSync(mapsDir);
    writeFileSync(path.join(root, 'hello.txt'), 'hi');
    server = createDevServer({ root, mapsDir });
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
    server.close();
    rmSync(root, { recursive: true, force: true });
});

function sampleMap(id) {
    const map = createEmptyMap(4, 3);
    map.id = id;
    map.name = 'Sample';
    return serializeMap(map);
}

test('PUT saves the map file and regenerates index.js; GET lists it', async () => {
    const res = await fetch(`${base}/api/maps/sample_map`, { method: 'PUT', body: JSON.stringify(sampleMap('sample_map')) });
    assert.equal(res.status, 200);
    const saved = JSON.parse(readFileSync(path.join(mapsDir, 'sample_map.json'), 'utf8'));
    assert.deepEqual(saved, sampleMap('sample_map'));
    assert.match(readFileSync(path.join(mapsDir, 'index.js'), 'utf8'), /import m_sample_map from '\.\/sample_map\.json' with \{ type: 'json' \}/);

    const list = await (await fetch(`${base}/api/maps`)).json();
    assert.deepEqual(list.maps, [{ id: 'sample_map', name: 'Sample', width: 4, depth: 3 }]);
});

test('bad ids, mismatched ids and invalid maps are refused without writing', async () => {
    for (const id of ['..%2Fevil', 'Upper', 'a-b']) {
        const res = await fetch(`${base}/api/maps/${id}`, { method: 'PUT', body: JSON.stringify(sampleMap('x')) });
        assert.equal(res.status, 400, id);
    }
    let res = await fetch(`${base}/api/maps/other`, { method: 'PUT', body: JSON.stringify(sampleMap('sample_map')) });
    assert.equal(res.status, 400, 'body id must match the URL');
    res = await fetch(`${base}/api/maps/broken`, { method: 'PUT', body: JSON.stringify({ ...sampleMap('broken'), columns: [] }) });
    assert.equal(res.status, 400);
    assert.match((await res.json()).error, /columns/);
    res = await fetch(`${base}/api/maps/broken`, { method: 'PUT', body: '{not json' });
    assert.equal(res.status, 400);
    assert.ok(!existsSync(path.join(mapsDir, 'broken.json')));
    assert.ok(!existsSync(path.join(root, 'evil.json')));
});

test('DELETE removes a map', async () => {
    await fetch(`${base}/api/maps/gone`, { method: 'PUT', body: JSON.stringify(sampleMap('gone')) });
    const res = await fetch(`${base}/api/maps/gone`, { method: 'DELETE' });
    assert.equal(res.status, 200);
    assert.ok(!existsSync(path.join(mapsDir, 'gone.json')));
    assert.doesNotMatch(readFileSync(path.join(mapsDir, 'index.js'), 'utf8'), /gone/);
});

test('static files are served from the root and never from above it', async () => {
    const ok = await fetch(`${base}/hello.txt`);
    assert.equal(ok.status, 200);
    assert.equal(await ok.text(), 'hi');
    const out = await fetch(`${base}/%2e%2e/%2e%2e/etc/passwd`);
    assert.notEqual(out.status, 200);
    const out2 = await fetch(`${base}/..%2f..%2fetc%2fpasswd`);
    assert.notEqual(out2.status, 200);
});
