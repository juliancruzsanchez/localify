-- ── Play history ──────────────────────────────────────────────────────────────
-- Detailed per-play event log, usable for AI recommendation and analytics.
CREATE TABLE IF NOT EXISTS play_history (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    track_id    TEXT    NOT NULL,
    played_at   INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    listen_ms   INTEGER NOT NULL DEFAULT 0,
    completed   INTEGER NOT NULL DEFAULT 0,   -- 1 = played to natural end
    source      TEXT    NOT NULL DEFAULT 'desktop'  -- 'desktop' | 'mobile'
);

CREATE INDEX IF NOT EXISTS idx_play_history_track   ON play_history(track_id);
CREATE INDEX IF NOT EXISTS idx_play_history_time    ON play_history(played_at DESC);
CREATE INDEX IF NOT EXISTS idx_play_history_source  ON play_history(source);
