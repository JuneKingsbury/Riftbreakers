// Google Drive for the browser: OAuth2 PKCE sign-in in a popup, and reading/writing files in the
// app's hidden Drive folder (appDataFolder). Adapted from Rifthold's js/core/gdrive-web.js.
// Token exchanges go through the Worker (cloud-config.js), which adds the client secret.
//
// Riftbreak shares its origin (and so localStorage) with Rifthold: the token key and the auth
// channel are named for Riftbreak so the games never read each other's sign-in.
import { GOOGLE_CLIENT_ID, API_BASE } from './cloud-config.js';

const TOKEN_PROXY = `${API_BASE}/token`;
const SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const TOKEN_KEY = 'riftbreak.gdrive_tokens';
export const AUTH_CHANNEL = 'riftbreak_gdrive_auth';
const AUTH_TIMEOUT_MS = 5 * 60 * 1000;

// ---- PKCE helpers ----
function randomBase64Url(bytes) {
    const array = new Uint8Array(bytes);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode(...array)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function pkceChallenge() {
    const verifier = randomBase64Url(32);
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
    const challenge = btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    return { verifier, challenge };
}

function loadTokens() {
    try { return JSON.parse(localStorage.getItem(TOKEN_KEY)); } catch { return null; }
}

function saveTokens(t) {
    localStorage.setItem(TOKEN_KEY, JSON.stringify(t));
}

async function refreshTokens(tokens) {
    const resp = await fetch(TOKEN_PROXY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: GOOGLE_CLIENT_ID, refresh_token: tokens.refresh_token, grant_type: 'refresh_token' }),
    });
    // Only a refusal from Google means the sign-in is gone; a network blip keeps it for next time.
    if (resp.status === 400 || resp.status === 401) localStorage.removeItem(TOKEN_KEY);
    if (!resp.ok) throw new Error('Google sign-in refresh failed');
    const data = await resp.json();
    const updated = { ...tokens, access_token: data.access_token, expiry_date: Date.now() + (data.expires_in - 60) * 1000 };
    saveTokens(updated);
    return updated;
}

async function accessToken() {
    let tokens = loadTokens();
    if (!tokens) throw new Error('Not signed in to Google Drive');
    if (Date.now() >= tokens.expiry_date) tokens = await refreshTokens(tokens);
    return tokens.access_token;
}

async function driveRequest(method, url, opts = {}) {
    const token = await accessToken();
    return fetch(url, { method, headers: { Authorization: `Bearer ${token}`, ...opts.headers }, body: opts.body });
}

// The file's id, or null only when Drive reports no such file. HTTP errors throw, so a failed
// lookup never reads as "not found" (which would make a write create a duplicate).
async function findFileId(filename) {
    const escaped = String(filename).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const q = encodeURIComponent(`name='${escaped}' and trashed=false`);
    const resp = await driveRequest('GET', `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${q}&fields=files(id)`);
    if (!resp.ok) throw new Error(`Drive lookup failed (${resp.status})`);
    const data = await resp.json();
    return data.files?.[0]?.id || null;
}

// One queue for all writes, so overlapping saves run in order instead of racing the
// lookup-then-create step.
let queue = Promise.resolve();
const enqueue = (task) => (queue = queue.then(task, task));

/** The file's text, or null if it doesn't exist. Throws when Drive can't be reached. */
export async function cloudRead(filename) {
    const fileId = await findFileId(filename);
    if (!fileId) return null;
    const resp = await driveRequest('GET', `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`);
    if (!resp.ok) throw new Error(`Drive read failed (${resp.status})`);
    return resp.text();
}

/** Creates or replaces the file. Throws when the write fails. */
export function cloudWrite(filename, data) {
    return enqueue(async () => {
        const token = await accessToken();
        const fileId = await findFileId(filename);
        const metadata = fileId ? { name: filename } : { name: filename, parents: ['appDataFolder'] };
        const boundary = 'riftbreak_gdrive_boundary';
        const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`
            + `--${boundary}\r\nContent-Type: application/json\r\n\r\n${data}\r\n--${boundary}--`;
        const url = fileId
            ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`
            : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
        const resp = await fetch(url, {
            method: fileId ? 'PATCH' : 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary="${boundary}"` },
            body,
        });
        if (!resp.ok) throw new Error(`Drive write failed (${resp.status})`);
    });
}

/** Whether this browser is signed in to Google Drive for Riftbreak. */
export function isConnected() {
    const tokens = loadTokens();
    return !!(tokens && tokens.refresh_token);
}

/**
 * Signs in with a popup (PKCE, with a `state` check). Always settles: on success, on an error
 * or denial, when the popup is blocked or closed, or after AUTH_TIMEOUT_MS.
 */
export async function connect() {
    if (!globalThis.crypto?.subtle) throw new Error('Google sign-in needs a secure (https) page');
    const { verifier, challenge } = await pkceChallenge();
    const state = randomBase64Url(16);
    const redirectUri = new URL('oauth-callback.html', location.href).href;
    const authUrl = new URL('https://accounts.google.com/o/oauth2/auth');
    for (const [k, v] of Object.entries({
        client_id: GOOGLE_CLIENT_ID, redirect_uri: redirectUri, response_type: 'code', scope: SCOPE,
        access_type: 'offline', prompt: 'consent', code_challenge: challenge, code_challenge_method: 'S256', state,
    })) authUrl.searchParams.set(k, v);

    const popup = window.open(authUrl.toString(), 'riftbreak_gdrive_auth', 'width=520,height=620,menubar=no,toolbar=no,location=yes');
    if (!popup) throw new Error('The sign-in popup was blocked. Allow popups for this site and try again.');

    const qs = await new Promise((resolve, reject) => {
        let ch = null, finished = false, pollTimer = 0, timeoutTimer = 0;
        function finish(err, value) {
            if (finished) return;
            finished = true;
            ch?.close();
            clearInterval(pollTimer);
            clearTimeout(timeoutTimer);
            window.removeEventListener('message', onMessage);
            if (err) reject(err); else resolve(value);
        }
        // Results whose state doesn't match (a stale tab or a forged callback) are ignored.
        function onResult(raw) {
            if (typeof raw !== 'string') return;
            const params = new URLSearchParams(raw.startsWith('?') ? raw.slice(1) : raw);
            if (params.get('state') === state) finish(null, params);
        }
        function onMessage(e) {
            if (e.origin === location.origin && e.data?.riftbreakGdriveAuth) onResult(e.data.riftbreakGdriveAuth);
        }
        try {
            ch = new BroadcastChannel(AUTH_CHANNEL);
            ch.addEventListener('message', e => onResult(e.data));
        } catch { /* no BroadcastChannel: the postMessage fallback below */ }
        window.addEventListener('message', onMessage);
        pollTimer = setInterval(() => { if (popup.closed) finish(new Error('Sign-in was closed before it finished.')); }, 500);
        timeoutTimer = setTimeout(() => finish(new Error('Google sign-in timed out.')), AUTH_TIMEOUT_MS);
    });

    const code = qs.get('code');
    if (!code) throw new Error(qs.get('error') === 'access_denied' ? 'Google Drive access was not allowed.' : (qs.get('error') || 'Sign-in failed.'));
    const resp = await fetch(TOKEN_PROXY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ code, client_id: GOOGLE_CLIENT_ID, redirect_uri: redirectUri, grant_type: 'authorization_code', code_verifier: verifier }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data.access_token) throw new Error(data.error_description || data.error || 'Sign-in failed.');
    saveTokens({ access_token: data.access_token, refresh_token: data.refresh_token || null, expiry_date: Date.now() + (data.expires_in - 60) * 1000 });
    return true;
}

/** Signs out: revokes the token with Google and forgets it here. The cloud save stays. */
export async function disconnect() {
    try {
        const tokens = loadTokens();
        if (tokens?.access_token) {
            await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(tokens.access_token)}`, { method: 'POST' }).catch(() => {});
        }
    } finally {
        localStorage.removeItem(TOKEN_KEY);
    }
}

export const gdrive = { cloudRead, cloudWrite, isConnected, connect, disconnect };
