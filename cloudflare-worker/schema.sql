-- Riftbreak leaderboard (Cloudflare D1). Apply with:
--   npx wrangler d1 execute riftbreak --remote --file=cloudflare-worker/schema.sql
CREATE TABLE IF NOT EXISTS entries (
    id         TEXT PRIMARY KEY,     -- the win's id (profile.js winSummary): each run once
    name       TEXT NOT NULL,
    score      INTEGER NOT NULL,
    date       TEXT NOT NULL,        -- when the run was won (ISO)
    data       TEXT NOT NULL,        -- the whole entry as JSON (party, realms, mode)
    created_at INTEGER NOT NULL      -- when it was submitted (ms)
);
CREATE INDEX IF NOT EXISTS entries_by_score ON entries (score DESC, date ASC);

-- Submissions per (hashed) address, for rate limiting.
CREATE TABLE IF NOT EXISTS submissions (
    ip_hash    TEXT NOT NULL,
    created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS submissions_by_ip ON submissions (ip_hash, created_at);
