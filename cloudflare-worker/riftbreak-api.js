// Riftbreak API Worker.
//
//   POST /token        Google OAuth token exchanges (authorization_code, refresh_token) for
//                      Drive cloud saves. Adds CLIENT_SECRET from Cloudflare's secret store so it
//                      never appears in the page. Same as Rifthold's rifthold-oauth.js.
//   GET  /leaderboard  ?limit=N (1-100): { entries: [...] }, highest score first
//   POST /leaderboard  An entry (js/run/leaderboard-rules.js) → { rank, total }
//
// Setup: see README.md in this folder (D1 database, CLIENT_SECRET, deploy).
import { validateEntry } from '../js/run/leaderboard-rules.js';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

// The game is served from https://junekingsbury.github.io/Riftbreakers/ (the origin is the host
// only). Local dev hosts may use any port.
const ALLOWED_ORIGINS = ['https://junekingsbury.github.io'];
const ALLOWED_DEV_HOSTS = ['localhost', '127.0.0.1'];

const SUBMISSIONS_PER_HOUR = 10;
const MAX_BODY_BYTES = 8 * 1024;

function isAllowedOrigin(origin) {
    if (!origin) return false;
    if (ALLOWED_ORIGINS.includes(origin)) return true;
    let url;
    try { url = new URL(origin); } catch { return false; }
    if (url.origin !== origin) return false;   // an Origin header is scheme://host[:port] only
    return url.protocol === 'http:' && ALLOWED_DEV_HOSTS.includes(url.hostname);
}

function corsHeaders(origin) {
    return {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
        Vary: 'Origin',
    };
}

const json = (body, status, origin) => new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
});

async function sha256(text) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function handleToken(request, env, origin) {
    const params = new URLSearchParams(await request.text());
    params.set('client_secret', env.CLIENT_SECRET);
    const resp = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params.toString(),
    });
    return new Response(await resp.text(), { status: resp.status, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) } });
}

async function listEntries(env, url, origin) {
    const limit = Math.max(1, Math.min(100, parseInt(url.searchParams.get('limit'), 10) || 50));
    const { results } = await env.DB.prepare('SELECT data FROM entries ORDER BY score DESC, date ASC LIMIT ?').bind(limit).all();
    const entries = results.map(r => { try { return JSON.parse(r.data); } catch { return null; } }).filter(Boolean);
    return json({ entries }, 200, origin);
}

async function submitEntry(request, env, origin) {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) return json({ error: 'That entry is too big.' }, 413, origin);
    let body;
    try { body = JSON.parse(text); } catch { return json({ error: 'Not JSON.' }, 400, origin); }
    const { entry, error } = validateEntry(body);
    if (error) return json({ error }, 400, origin);

    // Rate limit by address (stored only as a salted hash).
    const now = Date.now();
    const ipHash = await sha256(`${env.IP_SALT || 'riftbreak'}:${request.headers.get('CF-Connecting-IP') || 'unknown'}`);
    const recent = await env.DB.prepare('SELECT COUNT(*) AS n FROM submissions WHERE ip_hash = ? AND created_at > ?')
        .bind(ipHash, now - 3600_000).first();
    if ((recent?.n ?? 0) >= SUBMISSIONS_PER_HOUR) return json({ error: 'Too many submissions. Try again in a while.' }, 429, origin);

    const inserted = await env.DB.prepare('INSERT OR IGNORE INTO entries (id, name, score, date, data, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(entry.id, entry.name, entry.score, entry.date, JSON.stringify(entry), now).run();
    if (!inserted.meta?.changes) return json({ error: 'This run is already on the leaderboard.' }, 409, origin);
    await env.DB.batch([
        env.DB.prepare('INSERT INTO submissions (ip_hash, created_at) VALUES (?, ?)').bind(ipHash, now),
        env.DB.prepare('DELETE FROM submissions WHERE created_at < ?').bind(now - 86_400_000),
    ]);
    const higher = await env.DB.prepare('SELECT COUNT(*) AS n FROM entries WHERE score > ?').bind(entry.score).first();
    const total = await env.DB.prepare('SELECT COUNT(*) AS n FROM entries').first();
    return json({ rank: (higher?.n ?? 0) + 1, total: total?.n ?? 1 }, 201, origin);
}

export default {
    async fetch(request, env) {
        const origin = request.headers.get('Origin') || '';
        if (request.method === 'OPTIONS') {
            if (!isAllowedOrigin(origin)) return new Response(null, { status: 403 });
            return new Response(null, { status: 204, headers: corsHeaders(origin) });
        }
        if (!isAllowedOrigin(origin)) return new Response('Forbidden', { status: 403 });

        const url = new URL(request.url);
        try {
            if (request.method === 'POST' && url.pathname === '/token') return await handleToken(request, env, origin);
            if (request.method === 'GET' && url.pathname === '/leaderboard') return await listEntries(env, url, origin);
            if (request.method === 'POST' && url.pathname === '/leaderboard') return await submitEntry(request, env, origin);
        } catch {
            return json({ error: 'The server had a problem. Try again later.' }, 500, origin);
        }
        return new Response('Not found', { status: 404, headers: corsHeaders(origin) });
    },
};
