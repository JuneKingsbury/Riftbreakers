// Development server: serves the game like `python3 -m http.server`, plus a small API the
// map editor uses to save maps straight into js/tactical/data/maps.
//
//   npm run dev               then open http://127.0.0.1:8000
//   PORT=9000 npm run dev     another port
//
//   GET    /api/maps          -> { maps: [{ id, name, width, depth }] }
//   PUT    /api/maps/:id      body: map JSON -> writes <id>.json and regenerates index.js
//   DELETE /api/maps/:id      removes <id>.json and regenerates index.js
//
// index.js is also regenerated at startup, so .json files copied into the folder by hand
// are picked up.
//
// Only listens on 127.0.0.1: it writes files, so it must not be reachable from the network.
import http from 'node:http';
import { readFile, writeFile, unlink, stat } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateMapJson } from '../js/tactical/battle-map.js';
import { listMapIds, writeMapIndex, formatMapJson } from './map-files.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js':   'text/javascript; charset=utf-8',
    '.mjs':  'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.css':  'text/css; charset=utf-8',
    '.png':  'image/png',
    '.jpg':  'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif':  'image/gif',
    '.svg':  'image/svg+xml',
    '.ico':  'image/x-icon',
    '.mp3':  'audio/mpeg',
    '.ogg':  'audio/ogg',
    '.wav':  'audio/wav',
    '.zip':  'application/zip',
    '.txt':  'text/plain; charset=utf-8',
    '.md':   'text/plain; charset=utf-8',
};

const ID_RE = /^[a-z0-9_]{1,40}$/;
const MAX_BODY = 2 * 1024 * 1024;

function send(res, status, body, type = 'application/json; charset=utf-8') {
    const data = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body);
    res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
    res.end(data);
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        let size = 0;
        const chunks = [];
        req.on('data', c => {
            size += c.length;
            if (size > MAX_BODY) { reject(new Error('body too large')); req.destroy(); return; }
            chunks.push(c);
        });
        req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        req.on('error', reject);
    });
}

async function handleApi(req, res, url, mapsDir) {
    if (url.pathname === '/api/maps' && req.method === 'GET') {
        const maps = listMapIds(mapsDir).map(id => {
            try {
                const json = JSON.parse(readFileSync(path.join(mapsDir, `${id}.json`), 'utf8'));
                return { id, name: json.name ?? id, width: json.width, depth: json.depth };
            } catch {
                return { id, name: id, broken: true };
            }
        });
        return send(res, 200, { maps });
    }
    const m = url.pathname.match(/^\/api\/maps\/([^/]+)$/);
    if (!m) return send(res, 404, { error: 'unknown endpoint' });
    const id = decodeURIComponent(m[1]);
    if (!ID_RE.test(id)) return send(res, 400, { error: 'map id must be 1-40 chars of a-z, 0-9, _' });
    const file = path.join(mapsDir, `${id}.json`);

    if (req.method === 'PUT') {
        let json;
        try {
            json = JSON.parse(await readBody(req));
        } catch (e) {
            return send(res, 400, { error: `bad JSON: ${e.message}` });
        }
        if (json.id !== id) return send(res, 400, { error: 'map id in the body does not match the URL' });
        const errors = validateMapJson(json);
        if (errors.length) return send(res, 400, { error: errors[0], errors });
        await writeFile(file, formatMapJson(json));
        writeMapIndex(mapsDir);
        return send(res, 200, { ok: true, id });
    }
    if (req.method === 'DELETE') {
        try { await unlink(file); } catch { return send(res, 404, { error: 'no such map' }); }
        writeMapIndex(mapsDir);
        return send(res, 200, { ok: true });
    }
    return send(res, 405, { error: 'method not allowed' });
}

async function handleStatic(req, res, url, root) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'method not allowed', 'text/plain');
    let rel;
    try { rel = decodeURIComponent(url.pathname); } catch { return send(res, 400, 'bad path', 'text/plain'); }
    let file = path.join(root, rel);
    // Refuse anything that resolves outside the served folder.
    if (file !== root && !file.startsWith(root + path.sep)) return send(res, 403, 'forbidden', 'text/plain');
    try {
        if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html');
        const data = await readFile(file);
        const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
        res.end(req.method === 'HEAD' ? undefined : data);
    } catch {
        send(res, 404, 'not found', 'text/plain');
    }
}

/**
 * @param {{root?: string, mapsDir?: string}} [opts]  Defaults to this repo.
 * @returns {http.Server}  Not yet listening.
 */
export function createDevServer({ root = ROOT, mapsDir = path.join(ROOT, 'js/tactical/data/maps') } = {}) {
    const absRoot = path.resolve(root);
    return http.createServer(async (req, res) => {
        const url = new URL(req.url, 'http://localhost');
        try {
            if (url.pathname.startsWith('/api/')) await handleApi(req, res, url, mapsDir);
            else await handleStatic(req, res, url, absRoot);
        } catch (e) {
            if (!res.headersSent) send(res, 500, { error: String(e.message || e) });
            else res.end();
        }
    });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const port = Number(process.env.PORT) || 8000;
    // Pick up map files dropped into the folder by hand (e.g. an editor download).
    writeMapIndex(path.join(ROOT, 'js/tactical/data/maps'));
    createDevServer().listen(port, '127.0.0.1', () => {
        console.log(`Riftbreakers dev server: http://127.0.0.1:${port}  (map editor saves enabled)`);
    });
}
