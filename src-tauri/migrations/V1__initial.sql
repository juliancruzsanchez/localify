-- ─── library_paths ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS library_paths (
    id         TEXT PRIMARY KEY NOT NULL,
    path       TEXT NOT NULL UNIQUE,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- ─── artists ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS artists (
    id           TEXT PRIMARY KEY NOT NULL,
    name         TEXT NOT NULL,
    name_sort    TEXT NOT NULL,
    artwork_hash TEXT,
    created_at   INTEGER NOT NULL DEFAULT (unixepoch()),
    UNIQUE(name)
);
CREATE INDEX IF NOT EXISTS idx_artists_name_sort ON artists(name_sort);

-- ─── albums ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS albums (
    id            TEXT PRIMARY KEY NOT NULL,
    title         TEXT NOT NULL,
    title_sort    TEXT NOT NULL,
    artist_id     TEXT NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
    year          INTEGER,
    artwork_hash  TEXT,
    track_count   INTEGER NOT NULL DEFAULT 0,
    duration_secs REAL NOT NULL DEFAULT 0,
    created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
    UNIQUE(title, artist_id)
);
CREATE INDEX IF NOT EXISTS idx_albums_artist_id ON albums(artist_id);
CREATE INDEX IF NOT EXISTS idx_albums_title_sort ON albums(title_sort);
CREATE INDEX IF NOT EXISTS idx_albums_year ON albums(year);

-- ─── tracks ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tracks (
    id               TEXT PRIMARY KEY NOT NULL,
    file_path        TEXT NOT NULL UNIQUE,
    title            TEXT NOT NULL,
    title_sort       TEXT NOT NULL,
    artist           TEXT NOT NULL,
    artist_sort      TEXT NOT NULL,
    album_artist     TEXT,
    album_id         TEXT REFERENCES albums(id) ON DELETE SET NULL,
    track_number     INTEGER,
    disc_number      INTEGER,
    year             INTEGER,
    genre            TEXT,
    duration_secs    REAL NOT NULL DEFAULT 0,
    sample_rate      INTEGER,
    bit_depth        INTEGER,
    channels         INTEGER,
    bitrate_kbps     INTEGER,
    format           TEXT NOT NULL,
    artwork_hash     TEXT,
    file_size_bytes  INTEGER NOT NULL DEFAULT 0,
    mtime_secs       INTEGER NOT NULL DEFAULT 0,
    removed_at       INTEGER,
    play_count       INTEGER NOT NULL DEFAULT 0,
    last_played_at   INTEGER,
    created_at       INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at       INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_tracks_album_id   ON tracks(album_id);
CREATE INDEX IF NOT EXISTS idx_tracks_artist     ON tracks(artist_sort);
CREATE INDEX IF NOT EXISTS idx_tracks_title_sort ON tracks(title_sort);
CREATE INDEX IF NOT EXISTS idx_tracks_format     ON tracks(format);
CREATE INDEX IF NOT EXISTS idx_tracks_removed    ON tracks(removed_at) WHERE removed_at IS NULL;

-- ─── playlists ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS playlists (
    id          TEXT PRIMARY KEY NOT NULL,
    name        TEXT NOT NULL,
    description TEXT,
    created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

-- ─── playlist_tracks ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS playlist_tracks (
    id          TEXT PRIMARY KEY NOT NULL,
    playlist_id TEXT NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
    track_id    TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    position    REAL NOT NULL,
    added_at    INTEGER NOT NULL DEFAULT (unixepoch()),
    UNIQUE(playlist_id, position)
);
CREATE INDEX IF NOT EXISTS idx_pt_playlist_pos ON playlist_tracks(playlist_id, position);

-- ─── FTS5 virtual table ──────────────────────────────────────────────────────
CREATE VIRTUAL TABLE IF NOT EXISTS tracks_fts USING fts5(
    title,
    artist,
    album_artist,
    album,
    content='tracks',
    content_rowid='rowid',
    tokenize='unicode61'
);

-- ─── FTS triggers ────────────────────────────────────────────────────────────
CREATE TRIGGER IF NOT EXISTS tracks_ai AFTER INSERT ON tracks BEGIN
    INSERT INTO tracks_fts(rowid, title, artist, album_artist, album)
    SELECT NEW.rowid, NEW.title, NEW.artist, NEW.album_artist,
           (SELECT title FROM albums WHERE id = NEW.album_id);
END;

CREATE TRIGGER IF NOT EXISTS tracks_ad AFTER DELETE ON tracks BEGIN
    INSERT INTO tracks_fts(tracks_fts, rowid, title, artist, album_artist, album)
    VALUES('delete', OLD.rowid, OLD.title, OLD.artist, OLD.album_artist,
           (SELECT title FROM albums WHERE id = OLD.album_id));
END;

CREATE TRIGGER IF NOT EXISTS tracks_au AFTER UPDATE ON tracks BEGIN
    INSERT INTO tracks_fts(tracks_fts, rowid, title, artist, album_artist, album)
    VALUES('delete', OLD.rowid, OLD.title, OLD.artist, OLD.album_artist,
           (SELECT title FROM albums WHERE id = OLD.album_id));
    INSERT INTO tracks_fts(rowid, title, artist, album_artist, album)
    SELECT NEW.rowid, NEW.title, NEW.artist, NEW.album_artist,
           (SELECT title FROM albums WHERE id = NEW.album_id);
END;
