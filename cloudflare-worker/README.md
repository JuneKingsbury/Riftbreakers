# Riftbreak API Worker

One Cloudflare Worker serves both online features:

- **`POST /token`**: Google OAuth token exchanges for Drive cloud saves (`js/core/gdrive.js`). It adds the client secret server-side, the same way Rifthold's `rifthold-oauth.js` does.
- **`GET` / `POST /leaderboard`**: the high-score leaderboard (`js/run/leaderboard.js`), stored in Cloudflare D1.

The game expects the Worker at `API_BASE` in `js/core/cloud-config.js`, which defaults to `https://riftbreak-api.jurbanics.workers.dev`.

## One-time setup

Run these from the repo root, since the Worker imports `../js/run/leaderboard-rules.js` and wrangler bundles it.

1. Create the database, then paste the printed `database_id` into `cloudflare-worker/wrangler.toml`:
   ```
   npx wrangler d1 create riftbreak
   ```
2. Create the tables:
   ```
   npx wrangler d1 execute riftbreak --remote --file=cloudflare-worker/schema.sql
   ```
3. Add the secrets. `CLIENT_SECRET` is the `client_secret` value from Riftbreak's OAuth credential JSON (`client_secret_21621846056-….json` in the repo root, which git ignores: never commit it). `IP_SALT` is any random string, used to hash addresses for rate limiting.
   ```
   npx wrangler secret put CLIENT_SECRET -c cloudflare-worker/wrangler.toml
   npx wrangler secret put IP_SALT -c cloudflare-worker/wrangler.toml
   ```
4. Deploy:
   ```
   npx wrangler deploy -c cloudflare-worker/wrangler.toml
   ```
5. In Google Cloud Console, open Riftbreak's OAuth client and check it has this authorized redirect URI:
   - `https://junekingsbury.github.io/Riftbreakers/oauth-callback.html`
   - for local testing, also `http://localhost:8000/oauth-callback.html` (or whatever port you serve on)

   It also needs the authorized JavaScript origin `https://junekingsbury.github.io` (plus `http://localhost:8000` for local testing).
6. On the OAuth consent screen, set the privacy policy and terms links (Google requires them for verification):
   - `https://junekingsbury.github.io/Riftbreakers/privacy.html`
   - `https://junekingsbury.github.io/Riftbreakers/terms.html`
7. In the same Cloud project, enable the **Google Drive API** (APIs & Services > Library > Google Drive API > Enable).
   Without it, sign-in succeeds but every Drive call returns 403 `accessNotConfigured`.

## Notes

- **Separate from Rifthold.** Riftbreak has its own OAuth client, so its own consent screen and its own hidden Drive app folder. The page origin is shared with Rifthold, though, so the game's localStorage keys and auth channel are all prefixed `riftbreak`.
- **Allowed origins.** `ALLOWED_ORIGINS` in `riftbreak-api.js` allows `https://junekingsbury.github.io`, plus `localhost`/`127.0.0.1` on any port.
- **Leaderboard checks.** Entries are checked by `validateEntry` (shared with the game). Each run id is accepted once, and each address can submit 10 entries an hour. Scores are computed by the game, so a determined player could fake one. The plausibility cap (at most 2000 points per battle) only stops obvious nonsense.
- **Removing an entry:**
  ```
  npx wrangler d1 execute riftbreak --remote --command "DELETE FROM entries WHERE id = '...'"
  ```
