-- ─── liked_tracks ────────────────────────────────────────────────────────────
-- Stores which tracks the user has "liked", along with a timestamp.
-- Separate table (not a column on tracks) so the Track struct / all existing
-- queries stay unchanged.
CREATE TABLE IF NOT EXISTS liked_tracks (
    track_id TEXT PRIMARY KEY REFERENCES tracks(id) ON DELETE CASCADE,
    liked_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_liked_tracks_at ON liked_tracks(liked_at DESC);
