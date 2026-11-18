// Online services: Google Drive cloud saves (core/gdrive.js) and the leaderboard
// (run/leaderboard.js). Both go through one Cloudflare Worker (cloudflare-worker/riftbreak-api.js),
// which keeps the OAuth client secret out of the page and stores leaderboard entries.
//
// The game is hosted at https://junekingsbury.github.io/Riftbreakers/, the same origin as
// Rifthold (/Rifthold/). The two share localStorage, so every key here is Riftbreak-specific.

// Riftbreak's Google OAuth client. The id is public; its secret is only in the Worker
// (never in this repo: client_secret_*.json is git-ignored).
// Authorized redirect URI: https://junekingsbury.github.io/Riftbreakers/oauth-callback.html
export const GOOGLE_CLIENT_ID = '21621846056-7d4r73spike1s8ib1p13ss46vif9jprf.apps.googleusercontent.com';

// The deployed Worker (see cloudflare-worker/README.md). No trailing slash.
export const API_BASE = 'https://riftbreak-api.jurbanics.workers.dev';
