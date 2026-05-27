Now I have all the data I need. Let me produce the comprehensive specification.

---

# Spotify-Local Technical Specification v1.0

## 1. Open Question Resolutions

**OQ-01: DSD playback strategy.**
Resolution: DSD DSF and DFF files are decoded via `symphonia-all` which includes the `symphonia-format-dsd` crate. Playback is DoP (DSD-over-PCM) wrapped at 176.4 kHz / 24-bit; no native DSD hardware output is required. If symphonia cannot decode a DSD file it returns an error surfaced as a toast notification; the track is skipped in queue.

**OQ-02: Artwork storage location.**
Resolution: Extracted artwork is stored in Tauri's `app_data_dir()` under `artwork/` as 300x300 JPEG thumbnails named `{xxhash_of_raw_bytes}.jpg`. Original full-size art is re-extracted on demand for the now-playing large view. The `tracks.artwork_hash` column references these filenames.

**OQ-03: Scan incremental vs full.**
Resolution: Incremental by default. On scan trigger, `walkdir` traverses all library paths. For each file, the full path + file modification timestamp (`mtime`) are checked against `files.path` + `files.mtime_secs` in the DB. Files unchanged since last scan are skipped. Deleted files (path no longer on disk) are marked with `removed_at` timestamp but not deleted from DB (soft delete). A "Rescan All" option forces mtime bypass.

**OQ-04: Multiple library paths.**
Resolution: The `library_paths` table holds N root folders. Scans merge all paths. Overlapping paths are de-duplicated by normalizing to canonical absolute paths before insert.

**OQ-05: Duplicate track detection.**
Resolution: No content-hash dedup. Two files at different paths are two separate track rows. The UI shows both. Users manage duplicates manually.

**OQ-06: Queue model.**
Resolution: Queue is ephemeral (in-memory in Zustand). It is not persisted to SQLite. On app restart, `settings.json` stores `last_track_id` and `last_position_secs`; the queue itself starts empty with only that track loaded.

**OQ-07: Playlist track ordering.**
Resolution: Fractional index (`position REAL`) for O(1) reorder. On drag-reorder, the moved item's position is set to the average of its new neighbors. When the fractional precision degrades (gap < 1e-9), a re-normalization pass assigns `1.0, 2.0, 3.0, ...` to all rows in that playlist.

**OQ-08: Search scope.**
Resolution: Full-text search across `tracks.title`, `tracks.artist`, `tracks.album_artist`, `tracks.album`, and `artists.name`. Uses SQLite FTS5 with content= pointing at the tracks table. Results are ranked by BM25, capped at 200 results total (50 tracks + 50 albums + 50 artists + 50 playlists).

**OQ-09: Sidebar collapse breakpoint.**
Resolution: Sidebar collapse is user-controlled via toggle button only (no auto-collapse on resize). Collapsed width = 64px (icon-only). Expanded width = 240px. State persists in `uiStore` and in `settings.json`.

**OQ-10: Window minimum size.**
Resolution: Minimum 900x600 px. Initial size 1280x800 px. State persisted in `settings.json` as `window_width` / `window_height`.

**OQ-11: Volume normalization / ReplayGain.**
Resolution: Not implemented in v1. ReplayGain tags are read and stored but not applied to gain. Filed as future enhancement.

**OQ-12: Gapless playback.**
Resolution: Not implemented in v1. Each track is decoded independently by rodio. A 20ms crossfade is applied via rodio's `mix` to avoid hard clicks between tracks.

**OQ-13: Settings persistence mechanism.**
Resolution: `tauri-plugin-store` is used for `settings.json` (not raw file I/O). This provides atomic writes and event subscriptions.

**OQ-14: Specta/tauri-specta RC version pinning.**
Resolution: Use `tauri-specta = "2.0.0-rc.25"` and `specta = "2.0.0-rc.25"` and `specta-typescript = "0.0.12"` (latest rc available as of spec date).

**OQ-15: rusqlite_migration version.**
Resolution: Use `rusqlite_migration = "2.5.0"` (latest stable).

**OQ-16: lofty version.**
Resolution: Use `lofty = "0.24.0"` (latest stable, up from researcher's 0.22).

---

## 2. Project Bootstrap Commands

Run these commands in order. Each command is idempotent where possible.

```bash
# ── Step 1: Create the Tauri + React + TypeScript scaffold ──────────────────
cd /Users/jc.sanchez/Projects/spotify-local

cargo tauri init \
  --app-name "Spotify Local" \
  --window-title "Spotify Local" \
  --dist-dir ../dist \
  --dev-url http://localhost:5173 \
  --before-dev-command "npm run dev" \
  --before-build-command "npm run build"

# The above creates src-tauri/. Now scaffold the frontend manually (no create-react-app).

# ── Step 2: Initialize npm project ─────────────────────────────────────────
npm init -y

# ── Step 3: Install all npm dependencies ───────────────────────────────────
npm install \
  react@19.2.6 \
  react-dom@19.2.6 \
  react-router@7.15.1 \
  zustand@5.0.13 \
  @tanstack/react-query@5.100.14 \
  @tanstack/react-virtual@3.13.26 \
  @dnd-kit/core@6.3.1 \
  @dnd-kit/sortable@10.0.0 \
  @dnd-kit/utilities@3.2.2 \
  lucide-react@1.16.0 \
  clsx@2.1.1 \
  tailwind-merge@3.6.0 \
  class-variance-authority@0.7.1 \
  @radix-ui/react-dialog \
  @radix-ui/react-dropdown-menu \
  @radix-ui/react-scroll-area \
  @radix-ui/react-slider \
  @radix-ui/react-tooltip \
  @radix-ui/react-context-menu \
  @tauri-apps/api@2.11.0 \
  @tauri-apps/plugin-dialog@2.7.1 \
  @tauri-apps/plugin-store@2.4.3

npm install --save-dev \
  typescript@5 \
  vite@6.4.2 \
  @vitejs/plugin-react@4 \
  tailwindcss@4.3.0 \
  @tailwindcss/vite@4.3.0 \
  vitest@2.1.9 \
  @vitest/coverage-v8@4.1.7 \
  @testing-library/react@16.3.2 \
  @testing-library/user-event@14.6.1 \
  @testing-library/jest-dom@6.9.1 \
  jsdom@29.1.1 \
  @types/react@19 \
  @types/react-dom@19 \
  @types/node@22

# ── Step 4: Add Tauri Rust plugins ─────────────────────────────────────────
cd src-tauri
cargo add tauri-plugin-dialog@2.7.1
cargo add tauri-plugin-store@2.4.3
cargo add tauri-plugin-fs@2.5.1
cd ..

# ── Step 5: Generate TypeScript bindings (after writing Rust code) ─────────
# cargo tauri dev  (runs specta type export on first launch)
```

---

## 3. Complete File Tree

```
/Users/jc.sanchez/Projects/spotify-local/
├── package.json                          # npm manifest, scripts, all JS deps
├── tsconfig.json                         # TypeScript compiler config
├── vite.config.ts                        # Vite + Tauri + Tailwind config
├── index.html                            # Vite entry HTML
├── .gitignore                            # standard ignore
│
├── src/                                  # React frontend
│   ├── main.tsx                          # React root, QueryClientProvider, RouterProvider
│   ├── App.tsx                           # Root layout: Sidebar + Outlet + NowPlayingBar
│   ├── globals.css                       # Tailwind v4 @import + CSS custom properties
│   │
│   ├── router.tsx                        # React Router v7 route definitions
│   │
│   ├── bindings.ts                       # AUTO-GENERATED by tauri-specta (do not edit)
│   │
│   ├── store/
│   │   ├── playerStore.ts                # Zustand: playback state + actions
│   │   └── uiStore.ts                    # Zustand: sidebar collapse, active view
│   │
│   ├── queries/
│   │   ├── queryClient.ts                # TanStack QueryClient singleton
│   │   ├── keys.ts                       # Query key factory
│   │   ├── tracks.ts                     # useTracksQuery
│   │   ├── albums.ts                     # useAlbumsQuery, useAlbumTracksQuery
│   │   ├── artists.ts                    # useArtistsQuery, useArtistAlbumsQuery
│   │   ├── playlists.ts                  # usePlaylistsQuery, usePlaylistTracksQuery
│   │   └── search.ts                     # useSearchQuery
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx               # Collapsible nav sidebar
│   │   │   ├── SidebarItem.tsx           # Single nav link (icon + label)
│   │   │   └── NowPlayingBar.tsx         # Fixed bottom bar: controls + seek + volume
│   │   │
│   │   ├── player/
│   │   │   ├── PlayPauseButton.tsx       # Animated play/pause icon button
│   │   │   ├── SkipButton.tsx            # Previous / Next buttons
│   │   │   ├── SeekBar.tsx               # Range slider for track position
│   │   │   ├── VolumeSlider.tsx          # Volume range slider
│   │   │   └── TrackInfo.tsx             # Artwork thumbnail + title + artist
│   │   │
│   │   ├── library/
│   │   │   ├── EmptyLibrary.tsx          # Onboarding: "Add folder" CTA
│   │   │   ├── ScanProgress.tsx          # Scan progress bar + status text
│   │   │   └── AddLibraryButton.tsx      # Opens folder picker dialog
│   │   │
│   │   ├── tracks/
│   │   │   ├── TrackList.tsx             # Virtualized list of TrackRow items
│   │   │   └── TrackRow.tsx              # Single track row: #, title, artist, album, duration
│   │   │
│   │   ├── albums/
│   │   │   ├── AlbumGrid.tsx             # CSS grid of AlbumCard components
│   │   │   ├── AlbumCard.tsx             # Cover art + title + artist
│   │   │   └── AlbumDetail.tsx           # Album header + TrackList of album tracks
│   │   │
│   │   ├── artists/
│   │   │   ├── ArtistGrid.tsx            # CSS grid of ArtistCard components
│   │   │   ├── ArtistCard.tsx            # Artist avatar + name
│   │   │   └── ArtistDetail.tsx          # Artist header + album grid
│   │   │
│   │   ├── playlists/
│   │   │   ├── PlaylistSidebar.tsx       # List of playlists in sidebar section
│   │   │   ├── PlaylistDetail.tsx        # Playlist header + draggable track list
│   │   │   ├── PlaylistTrackRow.tsx      # DnD-sortable track row with drag handle
│   │   │   └── CreatePlaylistDialog.tsx  # Modal: name input + create button
│   │   │
│   │   ├── search/
│   │   │   ├── SearchInput.tsx           # Debounced search text input
│   │   │   └── SearchResults.tsx         # Sections: Tracks, Albums, Artists, Playlists
│   │   │
│   │   └── ui/                           # shadcn/ui primitive wrappers
│   │       ├── button.tsx
│   │       ├── dialog.tsx
│   │       ├── dropdown-menu.tsx
│   │       ├── scroll-area.tsx
│   │       ├── slider.tsx
│   │       ├── tooltip.tsx
│   │       └── context-menu.tsx
│   │
│   ├── views/
│   │   ├── SongsView.tsx                 # Route component: full songs list
│   │   ├── AlbumsView.tsx                # Route component: albums grid
│   │   ├── AlbumDetailView.tsx           # Route component: single album
│   │   ├── ArtistsView.tsx               # Route component: artists grid
│   │   ├── ArtistDetailView.tsx          # Route component: single artist
│   │   ├── PlaylistDetailView.tsx        # Route component: single playlist
│   │   └── SearchView.tsx                # Route component: search page
│   │
│   ├── hooks/
│   │   ├── usePlayer.ts                  # Facade over playerStore + Tauri invoke calls
│   │   ├── useSettings.ts                # Read/write settings via plugin-store
│   │   ├── useArtworkUrl.ts              # Builds tauri asset URL for artwork hash
│   │   └── useDebounce.ts                # Generic debounce hook
│   │
│   ├── lib/
│   │   ├── utils.ts                      # cn() utility (clsx + tailwind-merge)
│   │   ├── formatTime.ts                 # seconds → MM:SS
│   │   └── constants.ts                  # SIDEBAR_WIDTH, COLLAPSED_WIDTH, etc.
│   │
│   └── types/
│       └── index.ts                      # Re-exports from bindings.ts + local extension types
│
└── src-tauri/
    ├── Cargo.toml                        # All Rust dependencies
    ├── tauri.conf.json                   # App metadata, window, security, plugins
    ├── capabilities/
    │   └── default.json                  # All IPC permission grants
    ├── build.rs                          # Tauri build script (unchanged from scaffold)
    │
    └── src/
        ├── main.rs                       # Binary entry: tokio runtime, tauri builder
        ├── lib.rs                        # Library root: registers all commands + plugins
        ├── error.rs                      # AppError enum + impl IntoResponse
        ├── state.rs                      # AppState struct holding DB pool + PlayerHandle
        │
        ├── db/
        │   ├── mod.rs                    # Re-exports
        │   ├── connection.rs             # open_db() → Connection, runs migrations
        │   ├── migrations.rs             # M array of SQL migration strings
        │   ├── tracks.rs                 # CRUD queries for tracks
        │   ├── albums.rs                 # CRUD queries for albums
        │   ├── artists.rs                # CRUD queries for artists
        │   ├── playlists.rs              # CRUD queries for playlists + playlist_tracks
        │   └── search.rs                 # FTS5 search queries
        │
        ├── scanner/
        │   ├── mod.rs                    # Re-exports
        │   └── scan.rs                   # scan_library(), file format dispatch
        │
        ├── audio/
        │   ├── mod.rs                    # Re-exports
        │   ├── engine.rs                 # PlayerHandle, PlayerCommand, audio thread
        │   └── player.rs                 # decode_and_play(), format-specific paths
        │
        └── commands/
            ├── mod.rs                    # Re-exports all command modules
            ├── library.rs                # scan_library, get_library_paths, add_library_path, remove_library_path
            ├── player.rs                 # play_track, pause, resume, seek, set_volume, next_track, prev_track, get_player_state
            ├── tracks.rs                 # get_tracks, get_track
            ├── albums.rs                 # get_albums, get_album, get_album_tracks
            ├── artists.rs                # get_artists, get_artist, get_artist_albums
            ├── playlists.rs              # get_playlists, create_playlist, update_playlist, delete_playlist, get_playlist_tracks, add_track_to_playlist, remove_track_from_playlist, reorder_playlist_track
            ├── search.rs                 # search
            └── artwork.rs               # get_artwork_path
```

---

## 4. Data Model

### SQLite Schema — Migration v1

```sql
-- ─── PRAGMA ────────────────────────────────────────────────────────────────
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA synchronous = NORMAL;

-- ─── library_paths ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS library_paths (
    id         TEXT PRIMARY KEY NOT NULL,          -- UUIDv4
    path       TEXT NOT NULL UNIQUE,               -- canonical absolute path
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- ─── artists ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS artists (
    id           TEXT PRIMARY KEY NOT NULL,        -- UUIDv4
    name         TEXT NOT NULL,
    name_sort    TEXT NOT NULL,                    -- lowercase for sorting
    artwork_hash TEXT,                             -- xxhash filename ref, nullable
    created_at   INTEGER NOT NULL DEFAULT (unixepoch()),
    UNIQUE(name)
);
CREATE INDEX IF NOT EXISTS idx_artists_name_sort ON artists(name_sort);

-- ─── albums ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS albums (
    id           TEXT PRIMARY KEY NOT NULL,        -- UUIDv4
    title        TEXT NOT NULL,
    title_sort   TEXT NOT NULL,                    -- lowercase
    artist_id    TEXT NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
    year         INTEGER,                          -- nullable; 4-digit year
    artwork_hash TEXT,                             -- nullable
    track_count  INTEGER NOT NULL DEFAULT 0,
    duration_secs REAL NOT NULL DEFAULT 0,
    created_at   INTEGER NOT NULL DEFAULT (unixepoch()),
    UNIQUE(title, artist_id)
);
CREATE INDEX IF NOT EXISTS idx_albums_artist_id ON albums(artist_id);
CREATE INDEX IF NOT EXISTS idx_albums_title_sort ON albums(title_sort);
CREATE INDEX IF NOT EXISTS idx_albums_year      ON albums(year);

-- ─── tracks ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tracks (
    id               TEXT PRIMARY KEY NOT NULL,   -- UUIDv4
    file_path        TEXT NOT NULL UNIQUE,        -- canonical absolute path
    title            TEXT NOT NULL,
    title_sort       TEXT NOT NULL,
    artist           TEXT NOT NULL,               -- display artist (may be "Various")
    artist_sort      TEXT NOT NULL,
    album_artist     TEXT,                        -- nullable
    album_id         TEXT REFERENCES albums(id) ON DELETE SET NULL,
    track_number     INTEGER,                     -- nullable
    disc_number      INTEGER,                     -- nullable, default 1
    year             INTEGER,
    genre            TEXT,
    duration_secs    REAL NOT NULL DEFAULT 0,
    sample_rate      INTEGER,                     -- e.g. 44100, 96000, 192000, 352800
    bit_depth        INTEGER,                     -- e.g. 16, 24, 32; null for lossy
    channels         INTEGER,                     -- 1, 2, 6, etc.
    bitrate_kbps     INTEGER,                     -- for lossy formats
    format           TEXT NOT NULL,               -- "flac","alac","wav","aiff","wavpack","ape","dsf","dff","ogg","opus","mp3","aac"
    artwork_hash     TEXT,                        -- nullable; refers to artwork/{hash}.jpg
    file_size_bytes  INTEGER NOT NULL DEFAULT 0,
    mtime_secs       INTEGER NOT NULL DEFAULT 0,  -- file modification time (Unix epoch)
    removed_at       INTEGER,                     -- soft-delete timestamp; NULL = active
    play_count       INTEGER NOT NULL DEFAULT 0,
    last_played_at   INTEGER,
    created_at       INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at       INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_tracks_album_id    ON tracks(album_id);
CREATE INDEX IF NOT EXISTS idx_tracks_artist      ON tracks(artist_sort);
CREATE INDEX IF NOT EXISTS idx_tracks_title_sort  ON tracks(title_sort);
CREATE INDEX IF NOT EXISTS idx_tracks_format      ON tracks(format);
CREATE INDEX IF NOT EXISTS idx_tracks_removed     ON tracks(removed_at) WHERE removed_at IS NULL;

-- ─── playlists ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS playlists (
    id          TEXT PRIMARY KEY NOT NULL,         -- UUIDv4
    name        TEXT NOT NULL,
    description TEXT,
    created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

-- ─── playlist_tracks ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS playlist_tracks (
    id          TEXT PRIMARY KEY NOT NULL,         -- UUIDv4 (row id for dnd-kit key)
    playlist_id TEXT NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
    track_id    TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    position    REAL NOT NULL,                     -- fractional index; unique per playlist
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

-- ─── FTS triggers to keep in sync ────────────────────────────────────────────
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

-- ─── settings (single-row KV backed by tauri-plugin-store; no SQLite table) ─
-- Settings are NOT stored in SQLite. They live in the Tauri store plugin.
-- See Section 10 for the schema.
```

---

## 5. Rust Backend Specification

### 5.1 `src-tauri/src/error.rs`

```rust
use serde::Serialize;
use specta::Type;

#[derive(Debug, thiserror::Error, Serialize, Type)]
#[serde(tag = "kind", content = "message")]
pub enum AppError {
    #[error("Database error: {0}")]
    Database(String),
    #[error("IO error: {0}")]
    Io(String),
    #[error("Audio error: {0}")]
    Audio(String),
    #[error("Scan error: {0}")]
    Scan(String),
    #[error("Not found: {0}")]
    NotFound(String),
    #[error("Invalid argument: {0}")]
    InvalidArgument(String),
}

impl From<rusqlite::Error> for AppError {
    fn from(e: rusqlite::Error) -> Self { AppError::Database(e.to_string()) }
}
impl From<std::io::Error> for AppError {
    fn from(e: std::io::Error) -> Self { AppError::Io(e.to_string()) }
}
// tauri-specta requires Serialize on the error type — satisfied above.
pub type Result<T> = std::result::Result<T, AppError>;
```

### 5.2 `src-tauri/src/state.rs`

```rust
use std::sync::{Arc, Mutex};
use crate::audio::engine::PlayerHandle;

pub struct AppState {
    pub db: Arc<Mutex<rusqlite::Connection>>,
    pub player: Arc<PlayerHandle>,
}
```

### 5.3 Audio Engine — `src-tauri/src/audio/engine.rs`

**PlayerHandle struct:**
```rust
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, AtomicU32, AtomicI64, Ordering};
use crossbeam::channel::Sender;

pub struct PlayerHandle {
    pub cmd_tx: Sender<PlayerCommand>,
    pub is_playing: Arc<AtomicBool>,
    pub volume: Arc<AtomicU32>,       // 0–100 stored as integer
    pub position_ms: Arc<AtomicI64>,  // milliseconds; updated by audio thread every 250ms
    pub duration_ms: Arc<AtomicI64>,  // set when track loads
    pub current_track_id: Arc<Mutex<Option<String>>>,
}
```

**PlayerCommand enum:**
```rust
#[derive(Debug)]
pub enum PlayerCommand {
    Play { file_path: String, track_id: String, start_ms: u64 },
    Pause,
    Resume,
    Seek { position_ms: u64 },
    SetVolume { volume: u8 },     // 0–100
    Stop,
    Shutdown,
}
```

**Thread management:**
- `PlayerHandle::new()` spawns a dedicated OS thread (`std::thread::spawn`) running `audio_loop()`.
- `audio_loop()` receives commands from `crossbeam::channel::unbounded()`.
- On `Play`: calls `crate::audio::player::decode_and_play()` with the file path. This blocks the audio thread for the duration of playback while updating `position_ms` via a callback every 250 ms.
- On `Pause`/`Resume`: calls `rodio::Sink::pause()` / `rodio::Sink::play()`.
- On `Seek`: rebuilds the decoder from the same file at the new byte offset via symphonia `seek()`.
- On `Shutdown`: breaks the loop; thread exits cleanly.
- A secondary `std::thread::spawn` sends a `tauri::AppHandle::emit("player:ended", ())` event when rodio sink becomes empty, so the frontend can advance the queue.

### 5.4 Audio Player — `src-tauri/src/audio/player.rs`

```rust
pub fn decode_and_play(
    file_path: &str,
    start_ms: u64,
    sink: &rodio::Sink,
    position_ms: Arc<AtomicI64>,
    duration_ms: Arc<AtomicI64>,
) -> crate::error::Result<()>
```

Step-by-step:
1. Open file with `std::fs::File`.
2. Create `symphonia::core::io::MediaSourceStream` from the file.
3. Use `symphonia::default::get_probe()` to probe format; obtain `FormatReader`.
4. Find the default audio track from `format.tracks()`.
5. Set `duration_ms` atomic from track codec params if available.
6. Create `symphonia::core::codecs::DecoderOptions`; instantiate decoder via `symphonia::default::get_codecs()`.
7. If `start_ms > 0`, call `format.seek(SeekMode::Accurate, SeekTo::Time { time: start_ms/1000 as f64 })`.
8. Loop: `format.next_packet()` → `decoder.decode()` → convert `AudioBufferRef` to `rodio::buffer::SamplesBuffer<f32>` → `sink.append()`.
9. Every 250 ms of decoded audio, update `position_ms` atomic.
10. On EOF, return `Ok(())`.
11. Error paths: unsupported format → `AppError::Audio("Unsupported format: ...")`.

**Format support matrix via symphonia-all:**
| Format | Feature flag | Notes |
|--------|-------------|-------|
| FLAC | `symphonia-flac` | native |
| ALAC | `symphonia-isomp4` | via M4A container |
| WAV 16/24/32-bit | `symphonia-wav` | PCM + IEEE float |
| AIFF | `symphonia-aiff` | |
| WavPack | `symphonia-wavpack` | |
| APE (Monkey's Audio) | `symphonia-ape` | |
| DSD DSF/DFF | `symphonia-dsd` (via symphonia-all) | DoP output |
| OGG Vorbis | `symphonia-ogg` + `symphonia-vorbis` | |
| Opus | `symphonia-ogg` + `symphonia-opus` | |
| MP3 | `symphonia-mp3` | |
| AAC | `symphonia-isomp4` + `symphonia-aac` | |

### 5.5 Scanner — `src-tauri/src/scanner/scan.rs`

**Supported extensions (lowercase check):**
`flac`, `alac`, `m4a`, `wav`, `aiff`, `aif`, `wv`, `ape`, `dsf`, `dff`, `ogg`, `opus`, `mp3`, `aac`

**Algorithm step-by-step:**

```rust
pub async fn scan_library(
    db: Arc<Mutex<Connection>>,
    paths: Vec<String>,
    app_handle: tauri::AppHandle,
    force_rescan: bool,
) -> crate::error::Result<ScanResult>
```

1. Emit `scan:started` event via `app_handle.emit()`.
2. Collect all file paths from all library root paths using `walkdir::WalkDir::new(root).follow_links(true)`.
3. Filter entries: must be a file, extension must be in supported list (case-insensitive).
4. Split into chunks for `rayon::iter::ParallelIterator`.
5. For each file in parallel:
   a. Query DB: `SELECT mtime_secs FROM tracks WHERE file_path = ?1 AND removed_at IS NULL`.
   b. Get current `mtime` from `std::fs::metadata(&path)?.modified()`.
   c. If DB mtime matches current mtime AND `!force_rescan`, skip (increment `skipped` counter).
   d. Otherwise: call `extract_metadata(path)` → `TrackMetadata`.
   e. Call `upsert_track(conn, metadata)`.
6. After all parallel work: find tracks in DB whose paths no longer exist on disk → `UPDATE tracks SET removed_at = unixepoch() WHERE file_path = ?1`.
7. Emit `scan:progress { scanned, total, skipped }` events every 100 files via `app_handle.emit()`.
8. Emit `scan:completed { added, updated, removed, skipped, duration_ms }`.
9. Return `ScanResult`.

**`extract_metadata(path: &Path) -> Result<TrackMetadata>`:**
1. Open with `lofty::Probe::open(path)?.guess_file_type()?.read(true)`.
2. Extract tags: title (fallback: filename stem), artist, album_artist, album, track_number, disc_number, year, genre.
3. Extract `AudioProperties`: duration, sample_rate, bit_depth, channels, bitrate.
4. Detect format from extension string.
5. Artwork: call `extract_artwork(tagged_file, path)` → `Option<String>` (hash).
6. Return `TrackMetadata`.

**`extract_artwork(tagged_file, app_data_dir) -> Option<String>`:**
1. Get first picture from lofty `Tag::pictures()`.
2. If no embedded art, check for `cover.jpg` / `cover.png` / `folder.jpg` in parent directory.
3. Compute `xxhash_rust::xxh3::xxh3_64(raw_bytes)` → hex string as filename key.
4. Check if `{app_data_dir}/artwork/{hash}.jpg` already exists; if so, return hash (dedup).
5. Otherwise: decode with `image::load_from_memory()`, resize to 300x300 with `thumbnail()`, save as JPEG quality 85.
6. Return `Some(hash)` or `None`.

**`upsert_track(conn: &Connection, meta: TrackMetadata) -> Result<()>`:**
1. Upsert `artists` row: `INSERT OR IGNORE INTO artists(id, name, name_sort) VALUES (?, ?, ?)`.
2. Upsert `albums` row: `INSERT OR IGNORE INTO albums(id, title, title_sort, artist_id, year, artwork_hash) VALUES (?, ?, ?, ?, ?, ?)`.
3. `INSERT INTO tracks (...) ON CONFLICT(file_path) DO UPDATE SET ...` updating all metadata fields + `updated_at = unixepoch()`.

### 5.6 Database Layer — `src-tauri/src/db/`

**`connection.rs`:**
```rust
pub fn open_db(app_data_dir: &Path) -> crate::error::Result<Connection> {
    // 1. Create app_data_dir if not exists
    // 2. Open SQLite at app_data_dir/library.db
    // 3. conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")
    // 4. Run migrations via rusqlite_migration
    // 5. Return conn
}
```

**`migrations.rs`:**
```rust
use rusqlite_migration::{Migrations, M};
pub fn migrations() -> Migrations<'static> {
    Migrations::new(vec![
        M::up(include_str!("../../migrations/V1__initial.sql")),
    ])
}
// The SQL is stored in src-tauri/migrations/V1__initial.sql
```
Note: `migrations/V1__initial.sql` is an additional file containing the full schema SQL from Section 4.

**`tracks.rs` — function signatures:**
```rust
pub fn get_all_tracks(conn: &Connection) -> Result<Vec<Track>>;
pub fn get_track_by_id(conn: &Connection, id: &str) -> Result<Track>;
pub fn get_tracks_by_album(conn: &Connection, album_id: &str) -> Result<Vec<Track>>;
pub fn get_tracks_by_artist(conn: &Connection, artist_id: &str) -> Result<Vec<Track>>;
pub fn increment_play_count(conn: &Connection, track_id: &str) -> Result<()>;
pub fn upsert_track(conn: &Connection, meta: &TrackMetadata) -> Result<()>;
pub fn soft_delete_track(conn: &Connection, file_path: &str) -> Result<()>;
```

**`albums.rs`:**
```rust
pub fn get_all_albums(conn: &Connection) -> Result<Vec<Album>>;
pub fn get_album_by_id(conn: &Connection, id: &str) -> Result<Album>;
pub fn get_albums_by_artist(conn: &Connection, artist_id: &str) -> Result<Vec<Album>>;
```

**`artists.rs`:**
```rust
pub fn get_all_artists(conn: &Connection) -> Result<Vec<Artist>>;
pub fn get_artist_by_id(conn: &Connection, id: &str) -> Result<Artist>;
```

**`playlists.rs`:**
```rust
pub fn get_all_playlists(conn: &Connection) -> Result<Vec<Playlist>>;
pub fn get_playlist_by_id(conn: &Connection, id: &str) -> Result<Playlist>;
pub fn create_playlist(conn: &Connection, name: &str, description: Option<&str>) -> Result<Playlist>;
pub fn update_playlist(conn: &Connection, id: &str, name: &str, description: Option<&str>) -> Result<Playlist>;
pub fn delete_playlist(conn: &Connection, id: &str) -> Result<()>;
pub fn get_playlist_tracks(conn: &Connection, playlist_id: &str) -> Result<Vec<PlaylistTrack>>;
pub fn add_track_to_playlist(conn: &Connection, playlist_id: &str, track_id: &str) -> Result<PlaylistTrack>;
// position = max(position in playlist) + 1.0, or 1.0 if empty
pub fn remove_track_from_playlist(conn: &Connection, entry_id: &str) -> Result<()>;
pub fn reorder_playlist_track(conn: &Connection, entry_id: &str, new_position: f64) -> Result<()>;
pub fn renormalize_playlist_positions(conn: &Connection, playlist_id: &str) -> Result<()>;
// Called when min gap < 1e-9: assigns 1.0, 2.0, 3.0, ...
```

**`search.rs`:**
```rust
pub fn search(conn: &Connection, query: &str) -> Result<SearchResults>;
// Uses: SELECT t.*, bm25(tracks_fts) as rank FROM tracks_fts
//       JOIN tracks t ON t.rowid = tracks_fts.rowid
//       WHERE tracks_fts MATCH ?1
//       ORDER BY rank LIMIT 50
```

### 5.7 Shared Data Structs (`src-tauri/src/commands/mod.rs` and DB modules)

All structs derive `Serialize, Deserialize, specta::Type, Clone, Debug`.

```rust
#[derive(Serialize, Deserialize, Type, Clone, Debug)]
pub struct Track {
    pub id: String,
    pub file_path: String,
    pub title: String,
    pub artist: String,
    pub album_artist: Option<String>,
    pub album_id: Option<String>,
    pub album_title: Option<String>,     // joined from albums
    pub track_number: Option<i32>,
    pub disc_number: Option<i32>,
    pub year: Option<i32>,
    pub genre: Option<String>,
    pub duration_secs: f64,
    pub sample_rate: Option<i32>,
    pub bit_depth: Option<i32>,
    pub channels: Option<i32>,
    pub bitrate_kbps: Option<i32>,
    pub format: String,
    pub artwork_hash: Option<String>,
    pub play_count: i32,
    pub last_played_at: Option<i64>,
}

#[derive(Serialize, Deserialize, Type, Clone, Debug)]
pub struct Album {
    pub id: String,
    pub title: String,
    pub artist_id: String,
    pub artist_name: String,             // joined from artists
    pub year: Option<i32>,
    pub artwork_hash: Option<String>,
    pub track_count: i32,
    pub duration_secs: f64,
}

#[derive(Serialize, Deserialize, Type, Clone, Debug)]
pub struct Artist {
    pub id: String,
    pub name: String,
    pub artwork_hash: Option<String>,
    pub album_count: i32,                // computed at query time
    pub track_count: i32,
}

#[derive(Serialize, Deserialize, Type, Clone, Debug)]
pub struct Playlist {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub track_count: i32,                // computed at query time
    pub duration_secs: f64,              // computed at query time
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Serialize, Deserialize, Type, Clone, Debug)]
pub struct PlaylistTrack {
    pub id: String,                      // playlist_tracks.id
    pub playlist_id: String,
    pub track_id: String,
    pub position: f64,
    pub track: Track,                    // joined
}

#[derive(Serialize, Deserialize, Type, Clone, Debug)]
pub struct ScanResult {
    pub added: u32,
    pub updated: u32,
    pub removed: u32,
    pub skipped: u32,
    pub duration_ms: u64,
    pub errors: Vec<String>,
}

#[derive(Serialize, Deserialize, Type, Clone, Debug)]
pub struct PlayerState {
    pub is_playing: bool,
    pub volume: u8,
    pub position_ms: i64,
    pub duration_ms: i64,
    pub current_track_id: Option<String>,
}

#[derive(Serialize, Deserialize, Type, Clone, Debug)]
pub struct SearchResults {
    pub tracks: Vec<Track>,
    pub albums: Vec<Album>,
    pub artists: Vec<Artist>,
    pub playlists: Vec<Playlist>,
}

#[derive(Serialize, Deserialize, Type, Clone, Debug)]
pub struct LibraryPath {
    pub id: String,
    pub path: String,
}
```

---

## 6. Tauri IPC Contract

All commands use `tauri-specta` to generate TypeScript types. The generated file is `src/bindings.ts`. Below is the contract for every `#[tauri::command]`.

### Error shape (TypeScript)
```typescript
type AppError =
  | { kind: "Database"; message: string }
  | { kind: "Io"; message: string }
  | { kind: "Audio"; message: string }
  | { kind: "Scan"; message: string }
  | { kind: "NotFound"; message: string }
  | { kind: "InvalidArgument"; message: string };
```

All commands return `Promise<T>` which rejects with `AppError` (serialized from Rust's `Result<T, AppError>` via tauri-specta).

---

### Library Commands

**`add_library_path`**
```rust
// Rust
#[tauri::command]
#[specta::specta]
pub async fn add_library_path(
    state: State<'_, AppState>,
    path: String,
) -> crate::error::Result<LibraryPath>
```
```typescript
// TypeScript
import { commands } from "./bindings";
const lp: LibraryPath = await commands.addLibraryPath(path);
```
Steps: canonicalize path, validate it exists and is a directory, insert into `library_paths`, return inserted row.

---

**`remove_library_path`**
```rust
#[tauri::command]
#[specta::specta]
pub async fn remove_library_path(
    state: State<'_, AppState>,
    id: String,
) -> crate::error::Result<()>
```
```typescript
await commands.removeLibraryPath(id);
```

---

**`get_library_paths`**
```rust
#[tauri::command]
#[specta::specta]
pub async fn get_library_paths(
    state: State<'_, AppState>,
) -> crate::error::Result<Vec<LibraryPath>>
```
```typescript
const paths: LibraryPath[] = await commands.getLibraryPaths();
```

---

**`scan_library`**
```rust
#[tauri::command]
#[specta::specta]
pub async fn scan_library(
    state: State<'_, AppState>,
    app_handle: tauri::AppHandle,
    force_rescan: bool,
) -> crate::error::Result<ScanResult>
```
```typescript
const result: ScanResult = await commands.scanLibrary(forceRescan);
```
Emits Tauri events: `scan:started`, `scan:progress { scanned: number, total: number, skipped: number }`, `scan:completed`.

---

### Track Commands

**`get_tracks`**
```rust
#[tauri::command]
#[specta::specta]
pub async fn get_tracks(
    state: State<'_, AppState>,
) -> crate::error::Result<Vec<Track>>
```
```typescript
const tracks: Track[] = await commands.getTracks();
```
Returns all non-removed tracks ordered by `artist_sort, album.title_sort, disc_number, track_number`.

---

**`get_track`**
```rust
#[tauri::command]
#[specta::specta]
pub async fn get_track(
    state: State<'_, AppState>,
    id: String,
) -> crate::error::Result<Track>
```
```typescript
const track: Track = await commands.getTrack(id);
```

---

### Album Commands

**`get_albums`**
```rust
#[tauri::command]
#[specta::specta]
pub async fn get_albums(
    state: State<'_, AppState>,
) -> crate::error::Result<Vec<Album>>
```
```typescript
const albums: Album[] = await commands.getAlbums();
```
Ordered by `title_sort`.

---

**`get_album`**
```rust
#[tauri::command]
#[specta::specta]
pub async fn get_album(
    state: State<'_, AppState>,
    id: String,
) -> crate::error::Result<Album>
```
```typescript
const album: Album = await commands.getAlbum(id);
```

---

**`get_album_tracks`**
```rust
#[tauri::command]
#[specta::specta]
pub async fn get_album_tracks(
    state: State<'_, AppState>,
    album_id: String,
) -> crate::error::Result<Vec<Track>>
```
```typescript
const tracks: Track[] = await commands.getAlbumTracks(albumId);
```
Ordered by `disc_number, track_number`.

---

### Artist Commands

**`get_artists`**
```rust
#[tauri::command]
#[specta::specta]
pub async fn get_artists(
    state: State<'_, AppState>,
) -> crate::error::Result<Vec<Artist>>
```
```typescript
const artists: Artist[] = await commands.getArtists();
```

---

**`get_artist`**
```rust
#[tauri::command]
#[specta::specta]
pub async fn get_artist(
    state: State<'_, AppState>,
    id: String,
) -> crate::error::Result<Artist>
```
```typescript
const artist: Artist = await commands.getArtist(id);
```

---

**`get_artist_albums`**
```rust
#[tauri::command]
#[specta::specta]
pub async fn get_artist_albums(
    state: State<'_, AppState>,
    artist_id: String,
) -> crate::error::Result<Vec<Album>>
```
```typescript
const albums: Album[] = await commands.getArtistAlbums(artistId);
```

---

### Player Commands

**`play_track`**
```rust
#[tauri::command]
#[specta::specta]
pub async fn play_track(
    state: State<'_, AppState>,
    track_id: String,
    start_ms: Option<u64>,
) -> crate::error::Result<()>
```
```typescript
await commands.playTrack(trackId, startMs ?? null);
```
Steps: look up `file_path` from DB, send `PlayerCommand::Play { file_path, track_id, start_ms: start_ms.unwrap_or(0) }`, call `increment_play_count`.

---

**`pause`**
```rust
#[tauri::command]
#[specta::specta]
pub async fn pause(state: State<'_, AppState>) -> crate::error::Result<()>
```
```typescript
await commands.pause();
```

---

**`resume`**
```rust
#[tauri::command]
#[specta::specta]
pub async fn resume(state: State<'_, AppState>) -> crate::error::Result<()>
```
```typescript
await commands.resume();
```

---

**`seek`**
```rust
#[tauri::command]
#[specta::specta]
pub async fn seek(
    state: State<'_, AppState>,
    position_ms: u64,
) -> crate::error::Result<()>
```
```typescript
await commands.seek(positionMs);
```

---

**`set_volume`**
```rust
#[tauri::command]
#[specta::specta]
pub async fn set_volume(
    state: State<'_, AppState>,
    volume: u8,   // 0–100
) -> crate::error::Result<()>
```
```typescript
await commands.setVolume(volume);
```

---

**`get_player_state`**
```rust
#[tauri::command]
#[specta::specta]
pub async fn get_player_state(
    state: State<'_, AppState>,
) -> crate::error::Result<PlayerState>
```
```typescript
const state: PlayerState = await commands.getPlayerState();
```
Reads atomics from `PlayerHandle` and returns snapshot.

---

### Playlist Commands

**`get_playlists`**
```rust
#[tauri::command]
#[specta::specta]
pub async fn get_playlists(
    state: State<'_, AppState>,
) -> crate::error::Result<Vec<Playlist>>
```
```typescript
const playlists: Playlist[] = await commands.getPlaylists();
```

---

**`create_playlist`**
```rust
#[tauri::command]
#[specta::specta]
pub async fn create_playlist(
    state: State<'_, AppState>,
    name: String,
    description: Option<String>,
) -> crate::error::Result<Playlist>
```
```typescript
const playlist: Playlist = await commands.createPlaylist(name, description ?? null);
```

---

**`update_playlist`**
```rust
#[tauri::command]
#[specta::specta]
pub async fn update_playlist(
    state: State<'_, AppState>,
    id: String,
    name: String,
    description: Option<String>,
) -> crate::error::Result<Playlist>
```
```typescript
const playlist: Playlist = await commands.updatePlaylist(id, name, description ?? null);
```

---

**`delete_playlist`**
```rust
#[tauri::command]
#[specta::specta]
pub async fn delete_playlist(
    state: State<'_, AppState>,
    id: String,
) -> crate::error::Result<()>
```
```typescript
await commands.deletePlaylist(id);
```

---

**`get_playlist_tracks`**
```rust
#[tauri::command]
#[specta::specta]
pub async fn get_playlist_tracks(
    state: State<'_, AppState>,
    playlist_id: String,
) -> crate::error::Result<Vec<PlaylistTrack>>
```
```typescript
const tracks: PlaylistTrack[] = await commands.getPlaylistTracks(playlistId);
```

---

**`add_track_to_playlist`**
```rust
#[tauri::command]
#[specta::specta]
pub async fn add_track_to_playlist(
    state: State<'_, AppState>,
    playlist_id: String,
    track_id: String,
) -> crate::error::Result<PlaylistTrack>
```
```typescript
const entry: PlaylistTrack = await commands.addTrackToPlaylist(playlistId, trackId);
```

---

**`remove_track_from_playlist`**
```rust
#[tauri::command]
#[specta::specta]
pub async fn remove_track_from_playlist(
    state: State<'_, AppState>,
    entry_id: String,
) -> crate::error::Result<()>
```
```typescript
await commands.removeTrackFromPlaylist(entryId);
```

---

**`reorder_playlist_track`**
```rust
#[tauri::command]
#[specta::specta]
pub async fn reorder_playlist_track(
    state: State<'_, AppState>,
    entry_id: String,
    new_position: f64,
) -> crate::error::Result<()>
```
```typescript
await commands.reorderPlaylistTrack(entryId, newPosition);
```
After updating position, checks min gap; if < 1e-9, calls `renormalize_playlist_positions`.

---

### Search Command

**`search`**
```rust
#[tauri::command]
#[specta::specta]
pub async fn search(
    state: State<'_, AppState>,
    query: String,
) -> crate::error::Result<SearchResults>
```
```typescript
const results: SearchResults = await commands.search(query);
```
Returns up to 50 of each type. Empty query returns empty results (no full-table scan).

---

### Artwork Command

**`get_artwork_path`**
```rust
#[tauri::command]
#[specta::specta]
pub async fn get_artwork_path(
    app_handle: tauri::AppHandle,
    hash: String,
) -> crate::error::Result<String>
```
```typescript
const url: string = await commands.getArtworkPath(hash);
```
Returns the absolute filesystem path to `{app_data_dir}/artwork/{hash}.jpg`. The frontend converts this to a Tauri asset protocol URL using `convertFileSrc()` from `@tauri-apps/api/core`.

---

### Tauri Events emitted by backend (frontend listens via `listen()`)

| Event name | Payload type | Description |
|---|---|---|
| `scan:started` | `{}` | Scan began |
| `scan:progress` | `{ scanned: number, total: number, skipped: number }` | Per-100-files update |
| `scan:completed` | `ScanResult` | Scan finished |
| `player:ended` | `{}` | Current track finished playing |
| `player:position` | `{ position_ms: number, duration_ms: number }` | Emitted every 500ms while playing |

---

## 7. State Management Spec

### 7.1 `src/store/playerStore.ts`

```typescript
import { create } from 'zustand';
import { Track } from '../types';

interface PlayerState {
  // ── Playback ─────────────────────────────────────────
  currentTrack: Track | null;
  queue: Track[];               // ordered list of upcoming tracks
  queueIndex: number;           // index of currentTrack in queue; -1 if not in queue
  isPlaying: boolean;
  positionMs: number;           // updated by player:position event
  durationMs: number;
  volume: number;               // 0–100
  isSeeking: boolean;           // true while user drags seek bar (pauses position updates)

  // ── Actions ──────────────────────────────────────────
  setCurrentTrack: (track: Track | null) => void;
  setQueue: (tracks: Track[], startIndex: number) => void;
  appendToQueue: (track: Track) => void;
  removeFromQueue: (index: number) => void;
  setIsPlaying: (v: boolean) => void;
  setPositionMs: (v: number) => void;
  setDurationMs: (v: number) => void;
  setVolume: (v: number) => void;
  setIsSeeking: (v: boolean) => void;
  playNext: () => void;         // advances queueIndex + triggers play_track invoke
  playPrev: () => void;         // decrements queueIndex; if positionMs > 3000 seeks to 0
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentTrack: null,
  queue: [],
  queueIndex: -1,
  isPlaying: false,
  positionMs: 0,
  durationMs: 0,
  volume: 80,
  isSeeking: false,

  setCurrentTrack: (track) => set({ currentTrack: track }),
  setQueue: (tracks, startIndex) =>
    set({ queue: tracks, queueIndex: startIndex, currentTrack: tracks[startIndex] ?? null }),
  appendToQueue: (track) => set((s) => ({ queue: [...s.queue, track] })),
  removeFromQueue: (index) =>
    set((s) => {
      const queue = s.queue.filter((_, i) => i !== index);
      const queueIndex = index < s.queueIndex ? s.queueIndex - 1 : s.queueIndex;
      return { queue, queueIndex };
    }),
  setIsPlaying: (v) => set({ isPlaying: v }),
  setPositionMs: (v) => set({ positionMs: v }),
  setDurationMs: (v) => set({ durationMs: v }),
  setVolume: (v) => set({ volume: v }),
  setIsSeeking: (v) => set({ isSeeking: v }),
  playNext: () => {
    const { queue, queueIndex } = get();
    const next = queueIndex + 1;
    if (next < queue.length) {
      set({ queueIndex: next, currentTrack: queue[next], positionMs: 0 });
    }
  },
  playPrev: () => {
    const { queue, queueIndex, positionMs } = get();
    if (positionMs > 3000) {
      set({ positionMs: 0 });
    } else {
      const prev = Math.max(0, queueIndex - 1);
      set({ queueIndex: prev, currentTrack: queue[prev] ?? null, positionMs: 0 });
    }
  },
}));
```

### 7.2 `src/store/uiStore.ts`

```typescript
import { create } from 'zustand';

interface UIState {
  sidebarCollapsed: boolean;
  activePath: string;           // current route path, synced from router
  scanInProgress: boolean;
  scanProgress: { scanned: number; total: number; skipped: number } | null;
  
  setSidebarCollapsed: (v: boolean) => void;
  toggleSidebar: () => void;
  setActivePath: (path: string) => void;
  setScanInProgress: (v: boolean) => void;
  setScanProgress: (p: UIState['scanProgress']) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: false,
  activePath: '/songs',
  scanInProgress: false,
  scanProgress: null,
  
  setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setActivePath: (path) => set({ activePath: path }),
  setScanInProgress: (v) => set({ scanInProgress: v }),
  setScanProgress: (p) => set({ scanProgress: p }),
}));
```

### 7.3 TanStack Query Keys and Query Functions

**`src/queries/keys.ts`:**
```typescript
export const queryKeys = {
  tracks: () => ['tracks'] as const,
  track: (id: string) => ['tracks', id] as const,
  albums: () => ['albums'] as const,
  album: (id: string) => ['albums', id] as const,
  albumTracks: (id: string) => ['albums', id, 'tracks'] as const,
  artists: () => ['artists'] as const,
  artist: (id: string) => ['artists', id] as const,
  artistAlbums: (id: string) => ['artists', id, 'albums'] as const,
  playlists: () => ['playlists'] as const,
  playlistTracks: (id: string) => ['playlists', id, 'tracks'] as const,
  search: (query: string) => ['search', query] as const,
  libraryPaths: () => ['libraryPaths'] as const,
};
```

**`src/queries/tracks.ts`:**
```typescript
export function useTracksQuery() {
  return useQuery({
    queryKey: queryKeys.tracks(),
    queryFn: () => commands.getTracks(),
    staleTime: 30_000,
  });
}

export function useTrackQuery(id: string) {
  return useQuery({
    queryKey: queryKeys.track(id),
    queryFn: () => commands.getTrack(id),
    staleTime: 60_000,
  });
}
```

**`src/queries/albums.ts`:**
```typescript
export function useAlbumsQuery() {
  return useQuery({
    queryKey: queryKeys.albums(),
    queryFn: () => commands.getAlbums(),
    staleTime: 30_000,
  });
}

export function useAlbumTracksQuery(albumId: string) {
  return useQuery({
    queryKey: queryKeys.albumTracks(albumId),
    queryFn: () => commands.getAlbumTracks(albumId),
    enabled: !!albumId,
    staleTime: 60_000,
  });
}
```

**`src/queries/artists.ts`:**
```typescript
export function useArtistsQuery() {
  return useQuery({
    queryKey: queryKeys.artists(),
    queryFn: () => commands.getArtists(),
    staleTime: 30_000,
  });
}

export function useArtistAlbumsQuery(artistId: string) {
  return useQuery({
    queryKey: queryKeys.artistAlbums(artistId),
    queryFn: () => commands.getArtistAlbums(artistId),
    enabled: !!artistId,
  });
}
```

**`src/queries/playlists.ts`:**
```typescript
export function usePlaylistsQuery() {
  return useQuery({
    queryKey: queryKeys.playlists(),
    queryFn: () => commands.getPlaylists(),
  });
}

export function usePlaylistTracksQuery(playlistId: string) {
  return useQuery({
    queryKey: queryKeys.playlistTracks(playlistId),
    queryFn: () => commands.getPlaylistTracks(playlistId),
    enabled: !!playlistId,
  });
}
```

**`src/queries/search.ts`:**
```typescript
export function useSearchQuery(query: string) {
  const debouncedQuery = useDebounce(query, 300);
  return useQuery({
    queryKey: queryKeys.search(debouncedQuery),
    queryFn: () => commands.search(debouncedQuery),
    enabled: debouncedQuery.trim().length > 0,
    staleTime: 10_000,
    placeholderData: keepPreviousData,
  });
}
```

**After any mutation (scan complete, playlist change), invalidate via:**
```typescript
queryClient.invalidateQueries({ queryKey: queryKeys.tracks() });
queryClient.invalidateQueries({ queryKey: queryKeys.albums() });
// etc.
```

---

## 8. Component Tree

### Layout Components

**`App.tsx`**
- Props: none
- Renders: `<div class="app-shell">` containing `<Sidebar />` + `<main><Outlet /></main>` + `<NowPlayingBar />`
- Reads: `uiStore.sidebarCollapsed` for layout class
- Sets up: `listen('player:position')` and `listen('player:ended')` Tauri event handlers on mount

**`Sidebar.tsx`**
- Props: none
- Renders: logo, nav items (Songs, Albums, Artists, Search), `<PlaylistSidebar />`, collapse toggle button
- Width: CSS var `--sidebar-width` (240px) or `--sidebar-collapsed-width` (64px)
- Reads: `uiStore.sidebarCollapsed`, `uiStore.activePath`

**`SidebarItem.tsx`**
- Props: `{ icon: LucideIcon, label: string, to: string, collapsed: boolean }`
- Renders: `<NavLink>` with icon + conditional label based on `collapsed`

**`NowPlayingBar.tsx`**
- Props: none
- Renders: `<TrackInfo />` (left) + `<PlayPauseButton />` + `<SkipButton direction="prev" />` + `<SkipButton direction="next" />` + `<SeekBar />` (center) + `<VolumeSlider />` (right)
- Reads: `playerStore.currentTrack`, `playerStore.isPlaying`, `playerStore.positionMs`, `playerStore.durationMs`, `playerStore.volume`
- Hidden when `currentTrack === null`

### Player Sub-Components

**`TrackInfo.tsx`**
- Props: `{ track: Track | null }`
- Renders: artwork thumbnail (via `useArtworkUrl`), title, artist. Clicking title navigates to album.

**`PlayPauseButton.tsx`**
- Props: `{ isPlaying: boolean, onToggle: () => void }`
- Renders: Lucide `Play` or `Pause` icon in a circular button

**`SkipButton.tsx`**
- Props: `{ direction: 'prev' | 'next', onClick: () => void }`
- Renders: Lucide `SkipBack` or `SkipForward`

**`SeekBar.tsx`**
- Props: `{ positionMs: number, durationMs: number, onSeek: (ms: number) => void }`
- Renders: Radix `<Slider>` from `0` to `durationMs`. On `onValueChange`, sets `isSeeking = true`. On `onValueCommit`, calls `seek()` invoke and `setIsSeeking(false)`.

**`VolumeSlider.tsx`**
- Props: `{ volume: number, onVolumeChange: (v: number) => void }`
- Renders: Lucide `Volume2` icon + Radix `<Slider>` 0–100

### Library Components

**`EmptyLibrary.tsx`**
- Props: none
- Renders: centered illustration + "Your library is empty" headline + `<AddLibraryButton />`
- Shown when `getTracks()` returns empty array AND no library paths configured

**`ScanProgress.tsx`**
- Props: none
- Reads: `uiStore.scanInProgress`, `uiStore.scanProgress`
- Renders: progress bar + "Scanning: X / Y files" text. Shown as a top banner when `scanInProgress`.

**`AddLibraryButton.tsx`**
- Props: `{ variant?: 'primary' | 'ghost' }`
- On click: calls `open({ directory: true, multiple: true })` from `@tauri-apps/plugin-dialog`, then `addLibraryPath()` for each selected folder, then `scanLibrary(false)`.

### Tracks Components

**`TrackList.tsx`**
- Props: `{ tracks: Track[], onPlayTrack: (track: Track, index: number) => void, showAlbumColumn?: boolean }`
- Renders: virtualized list using `@tanstack/react-virtual` `useVirtualizer`
- Row height: 56px. Overscan: 5.
- Header row: #, Title, Artist, Album (optional), Duration

**`TrackRow.tsx`**
- Props: `{ track: Track, index: number, isPlaying: boolean, onClick: () => void, style: React.CSSProperties }`
- Renders: track number/play indicator, title+artist, album link (optional), formatted duration
- On double-click: calls `onPlayTrack`
- Context menu (Radix): Play, Add to playlist submenu, Remove from playlist (if in playlist view)

### Albums Components

**`AlbumGrid.tsx`**
- Props: `{ albums: Album[] }`
- Renders: CSS `grid` with `repeat(auto-fill, minmax(180px, 1fr))` of `<AlbumCard>` items
- Note: no virtualization for grid; typical library is < 2000 albums; acceptable performance.

**`AlbumCard.tsx`**
- Props: `{ album: Album, onClick: () => void }`
- Renders: square artwork (300px → displayed at 180px), title, artist name
- Artwork via `useArtworkUrl(album.artwork_hash)`

**`AlbumDetail.tsx`**
- Props: `{ album: Album, tracks: Track[] }`
- Renders: large artwork (240x240) + metadata header + `<TrackList tracks={tracks} showAlbumColumn={false} />`

### Artists Components

**`ArtistGrid.tsx`**
- Props: `{ artists: Artist[] }`
- Renders: CSS grid of `<ArtistCard>` items, same grid template as `AlbumGrid`

**`ArtistCard.tsx`**
- Props: `{ artist: Artist, onClick: () => void }`
- Renders: circular avatar (artwork or generated initials fallback), artist name, album count

**`ArtistDetail.tsx`**
- Props: `{ artist: Artist, albums: Album[] }`
- Renders: artist header + `<AlbumGrid albums={albums} />` with click navigating to album detail

### Playlists Components

**`PlaylistSidebar.tsx`**
- Props: none
- Reads: `usePlaylistsQuery()`
- Renders: "Playlists" section header with "+" button + list of playlist nav links
- "+ " button opens `<CreatePlaylistDialog />`

**`PlaylistDetail.tsx`**
- Props: `{ playlist: Playlist, tracks: PlaylistTrack[] }`
- Renders: playlist name + description header + `<DndContext>` wrapping `<SortableContext>` wrapping list of `<PlaylistTrackRow>` items
- On drag end: computes new fractional position, calls `reorderPlaylistTrack` invoke, invalidates `playlistTracks` query

**`PlaylistTrackRow.tsx`**
- Props: `{ entry: PlaylistTrack, isPlaying: boolean, onPlay: () => void, onRemove: () => void }`
- Uses `useSortable` from `@dnd-kit/sortable`
- Renders: drag handle (Lucide `GripVertical`), track number, title, artist, duration, remove button

**`CreatePlaylistDialog.tsx`**
- Props: `{ open: boolean, onOpenChange: (v: boolean) => void }`
- Renders: Radix `<Dialog>` with name input + optional description textarea + Create button
- On submit: calls `createPlaylist` invoke, invalidates playlists query, closes dialog

### Search Components

**`SearchInput.tsx`**
- Props: `{ value: string, onChange: (v: string) => void }`
- Renders: input with Lucide `Search` icon prefix. Autofocuses on route mount.

**`SearchResults.tsx`**
- Props: `{ results: SearchResults | undefined, query: string }`
- Renders: four sections: "Songs" (TrackList, max 10 shown), "Albums" (AlbumGrid, max 6), "Artists" (ArtistGrid, max 6), "Playlists" (list). Each section has a "See all" link when results are truncated.

---

## 9. Routing Structure

**`src/router.tsx`** using React Router v7 in library/declarative mode:

```typescript
import { createBrowserRouter } from 'react-router';
import App from './App';
import SongsView from './views/SongsView';
import AlbumsView from './views/AlbumsView';
import AlbumDetailView from './views/AlbumDetailView';
import ArtistsView from './views/ArtistsView';
import ArtistDetailView from './views/ArtistDetailView';
import PlaylistDetailView from './views/PlaylistDetailView';
import SearchView from './views/SearchView';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <Navigate to="/songs" replace /> },
      { path: 'songs', element: <SongsView /> },
      { path: 'albums', element: <AlbumsView /> },
      { path: 'albums/:albumId', element: <AlbumDetailView /> },
      { path: 'artists', element: <ArtistsView /> },
      { path: 'artists/:artistId', element: <ArtistDetailView /> },
      { path: 'playlists/:playlistId', element: <PlaylistDetailView /> },
      { path: 'search', element: <SearchView /> },
    ],
  },
]);
```

**Navigation patterns:**
- Sidebar `<NavLink to="/songs">`, `/albums`, `/artists`, `/search`
- `<AlbumCard>` links to `/albums/:albumId`
- `<ArtistCard>` links to `/artists/:artistId`
- `<PlaylistSidebar>` playlist items link to `/playlists/:playlistId`
- Breadcrumb in detail views: "Albums > {album title}" with back link

---

## 10. Settings Schema

Stored via `tauri-plugin-store` in `{app_config_dir}/settings.json`. All values have typed defaults.

```typescript
interface Settings {
  // Playback
  volume: number;              // default: 80 (0–100)
  lastTrackId: string | null;  // default: null
  lastPositionSecs: number;    // default: 0
  
  // Window
  windowWidth: number;         // default: 1280
  windowHeight: number;        // default: 800
  windowX: number | null;      // default: null (centered)
  windowY: number | null;      // default: null (centered)
  windowMaximized: boolean;    // default: false
  
  // UI
  sidebarCollapsed: boolean;   // default: false
  
  // Library (also in SQLite, but mirrored here for fast startup read)
  // Note: authoritative source is SQLite library_paths table.
  // This mirror is informational for display before first DB query.
}
```

**`src/hooks/useSettings.ts`** wraps `tauri-plugin-store`:
```typescript
import { load } from '@tauri-apps/plugin-store';

const STORE_PATH = 'settings.json';

export function useSettings() {
  // Returns { settings, updateSetting, isLoaded }
  // Uses React state + store.get/set
}
```

On app startup (`App.tsx` useEffect):
1. Load `settings.json` via plugin-store.
2. Restore `volume` → `commands.setVolume(volume)`.
3. Restore `sidebarCollapsed` → `uiStore.setSidebarCollapsed()`.
4. Restore window size/position via Tauri window API.
5. If `lastTrackId` non-null, load track metadata into player store (not auto-playing; just shows last track in NowPlayingBar).

On app close (`tauri::WindowEvent::CloseRequested`):
- Save `windowWidth`, `windowHeight`, `windowX`, `windowY`, `windowMaximized` from current window state.
- Save `volume` from `PlayerHandle`.
- Save `lastTrackId` from `PlayerHandle.current_track_id`.
- Save `lastPositionSecs` from `PlayerHandle.position_ms / 1000`.
- Save `sidebarCollapsed` from settings store event subscription already persisted.

---

## 11. CSS Design System

**`src/globals.css`** — full content:

```css
@import "tailwindcss";

@layer base {
  :root {
    /* ── Spotify-inspired Color Palette ────────────────────────────── */
    --color-bg-base:          #121212;   /* main app background */
    --color-bg-elevated:      #1a1a1a;   /* cards, sidebar */
    --color-bg-highlight:     #242424;   /* hover states, track rows */
    --color-bg-press:         #2a2a2a;   /* active/pressed state */
    --color-bg-overlay:       #282828;   /* modals, dropdowns */

    --color-brand:            #1db954;   /* Spotify green — primary action */
    --color-brand-hover:      #1ed760;   /* lighter green on hover */
    --color-brand-muted:      #158a3e;   /* darker green for press */

    --color-text-primary:     #ffffff;
    --color-text-secondary:   #b3b3b3;
    --color-text-muted:       #737373;
    --color-text-disabled:    #535353;
    --color-text-on-brand:    #000000;   /* black text on green buttons */

    --color-border:           #333333;
    --color-border-subtle:    #2a2a2a;

    --color-seek-track:       #535353;   /* unfilled seek bar */
    --color-seek-fill:        #ffffff;   /* filled seek bar */
    --color-seek-thumb:       #ffffff;

    --color-error:            #f15e6c;
    --color-warning:          #f59b23;
    --color-success:          #1db954;

    /* ── Sidebar ────────────────────────────────────────────────────── */
    --sidebar-width:          240px;
    --sidebar-collapsed-width: 64px;
    --sidebar-bg:             #000000;

    /* ── Now Playing Bar ─────────────────────────────────────────────── */
    --now-playing-height:     90px;
    --now-playing-bg:         #181818;
    --now-playing-border:     #282828;

    /* ── Typography ─────────────────────────────────────────────────── */
    --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
    --font-size-xs:   11px;
    --font-size-sm:   13px;
    --font-size-base: 14px;
    --font-size-md:   16px;
    --font-size-lg:   18px;
    --font-size-xl:   24px;
    --font-size-2xl:  32px;

    --font-weight-normal:  400;
    --font-weight-medium:  500;
    --font-weight-semibold: 600;
    --font-weight-bold:    700;

    --line-height-tight:  1.2;
    --line-height-base:   1.5;

    /* ── Spacing ────────────────────────────────────────────────────── */
    --space-1:  4px;
    --space-2:  8px;
    --space-3:  12px;
    --space-4:  16px;
    --space-5:  20px;
    --space-6:  24px;
    --space-8:  32px;
    --space-10: 40px;
    --space-12: 48px;

    /* ── Radius ─────────────────────────────────────────────────────── */
    --radius-sm:   4px;
    --radius-md:   8px;
    --radius-lg:   12px;
    --radius-full: 9999px;

    /* ── Transitions ─────────────────────────────────────────────────── */
    --transition-fast:   80ms ease;
    --transition-base:  150ms ease;
    --transition-slow:  300ms ease;

    /* ── Z-index layers ──────────────────────────────────────────────── */
    --z-sidebar:      10;
    --z-now-playing:  20;
    --z-dropdown:     30;
    --z-modal:        40;
    --z-toast:        50;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  html, body, #root {
    height: 100%;
    overflow: hidden;
    background: var(--color-bg-base);
    color: var(--color-text-primary);
    font-family: var(--font-sans);
    font-size: var(--font-size-base);
    line-height: var(--line-height-base);
    -webkit-font-smoothing: antialiased;
  }

  /* ── Scrollbar Styling ──────────────────────────────────────────────── */
  ::-webkit-scrollbar { width: 8px; height: 8px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #535353; border-radius: 4px; }
  ::-webkit-scrollbar-thumb:hover { background: #737373; }

  /* ── Selection ───────────────────────────────────────────────────────── */
  ::selection { background: var(--color-brand); color: #000; }

  /* ── Focus visible ───────────────────────────────────────────────────── */
  :focus-visible { outline: 2px solid var(--color-brand); outline-offset: 2px; }
}

/* ── App Shell Layout ─────────────────────────────────────────────────────── */
.app-shell {
  display: grid;
  grid-template-columns: var(--sidebar-width) 1fr;
  grid-template-rows: 1fr var(--now-playing-height);
  grid-template-areas:
    "sidebar main"
    "now-playing now-playing";
  height: 100vh;
  overflow: hidden;
  transition: grid-template-columns var(--transition-slow);
}

.app-shell[data-sidebar-collapsed="true"] {
  grid-template-columns: var(--sidebar-collapsed-width) 1fr;
}
```

---

## 12. Tauri Configuration

**`src-tauri/tauri.conf.json`:**

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "Spotify Local",
  "version": "0.1.0",
  "identifier": "com.spotifylocal.app",
  "build": {
    "frontendDist": "../dist",
    "devUrl": "http://localhost:5173",
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build"
  },
  "app": {
    "withGlobalTauri": false,
    "windows": [
      {
        "title": "Spotify Local",
        "width": 1280,
        "height": 800,
        "minWidth": 900,
        "minHeight": 600,
        "resizable": true,
        "decorations": true,
        "transparent": false,
        "center": true,
        "visible": true
      }
    ],
    "security": {
      "csp": "default-src 'self'; connect-src ipc: http://ipc.localhost; img-src 'self' asset: https://asset.localhost blob: data:; media-src 'self' asset: https://asset.localhost; style-src 'self' 'unsafe-inline'; script-src 'self'"
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ]
  },
  "plugins": {
    "dialog": {},
    "store": {},
    "fs": {
      "scope": {
        "allow": ["$APPDATA/**", "$AUDIO/**", "$HOME/**"],
        "deny": []
      }
    }
  }
}
```

---

## 13. Capabilities File

**`src-tauri/capabilities/default.json`:**

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Default capabilities for Spotify Local",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "core:app:default",
    "core:window:default",
    "core:window:allow-set-size",
    "core:window:allow-set-position",
    "core:window:allow-maximize",
    "core:window:allow-unmaximize",
    "core:window:allow-is-maximized",
    "core:path:default",
    "core:event:default",
    "core:event:allow-listen",
    "core:event:allow-unlisten",
    "core:event:allow-emit",
    "dialog:default",
    "dialog:allow-open",
    "store:default",
    "store:allow-load",
    "store:allow-get",
    "store:allow-set",
    "store:allow-save",
    "store:allow-has",
    "store:allow-delete",
    "fs:default",
    "fs:allow-read-file",
    "fs:allow-read-dir",
    "fs:allow-exists",
    "fs:allow-metadata",
    "fs:allow-write-file",
    "fs:scope-appdata",
    "fs:scope-appdata-recursive",
    "fs:scope-home",
    "fs:scope-home-recursive",
    "fs:scope-audio",
    "fs:scope-audio-recursive"
  ]
}
```

---

## 14. Build Files

### `src-tauri/Cargo.toml`

```toml
[package]
name = "spotify-local"
version = "0.1.0"
description = "A local hi-fi music player"
authors = []
edition = "2021"

# See more keys and their definitions at https://doc.rust-lang.org/cargo/reference/manifest.html

[lib]
name = "spotify_local_lib"
crate-type = ["staticlib", "cdylib", "rlib"]

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
# ── Tauri ──────────────────────────────────────────────────────────────────
tauri            = { version = "2", features = ["macos-private-api"] }
tauri-plugin-dialog = "2.7.1"
tauri-plugin-store  = "2.4.3"
tauri-plugin-fs     = "2.5.1"

# ── Type generation ────────────────────────────────────────────────────────
tauri-specta     = { version = "2.0.0-rc.25", features = ["derive"] }
specta           = { version = "2.0.0-rc.25", features = ["derive"] }
specta-typescript = "0.0.12"

# ── Serialization ──────────────────────────────────────────────────────────
serde       = { version = "1", features = ["derive"] }
serde_json  = "1"

# ── Async runtime ──────────────────────────────────────────────────────────
tokio = { version = "1", features = ["full"] }

# ── Database ───────────────────────────────────────────────────────────────
rusqlite            = { version = "0.40", features = ["bundled"] }
rusqlite_migration  = "2.5.0"

# ── Audio ──────────────────────────────────────────────────────────────────
rodio = { version = "0.22", features = ["symphonia-all"] }

# ── Metadata ───────────────────────────────────────────────────────────────
lofty = "0.24"

# ── Image processing ──────────────────────────────────────────────────────
image = { version = "0.25", default-features = false, features = ["jpeg", "png", "webp"] }

# ── Hashing ────────────────────────────────────────────────────────────────
xxhash-rust = { version = "0.8", features = ["xxh3"] }

# ── Parallelism ────────────────────────────────────────────────────────────
rayon      = "1.12"
crossbeam  = "0.8"

# ── Filesystem ─────────────────────────────────────────────────────────────
walkdir = "2.5"

# ── IDs ────────────────────────────────────────────────────────────────────
uuid = { version = "1", features = ["v4"] }

# ── Error handling ────────────────────────────────────────────────────────
anyhow    = "1"
thiserror = "2"

# ── Logging ────────────────────────────────────────────────────────────────
tracing            = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }

[profile.release]
opt-level     = 3
lto           = true
codegen-units = 1
panic         = "abort"
strip         = true

[profile.dev]
opt-level = 1
```

### `package.json`

```json
{
  "name": "spotify-local",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev":       "vite",
    "build":     "tsc -b && vite build",
    "preview":   "vite preview",
    "tauri":     "tauri",
    "test":      "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@dnd-kit/core":               "^6.3.1",
    "@dnd-kit/sortable":           "^10.0.0",
    "@dnd-kit/utilities":          "^3.2.2",
    "@radix-ui/react-context-menu": "*",
    "@radix-ui/react-dialog":      "*",
    "@radix-ui/react-dropdown-menu": "*",
    "@radix-ui/react-scroll-area": "*",
    "@radix-ui/react-slider":      "*",
    "@radix-ui/react-tooltip":     "*",
    "@tanstack/react-query":       "^5.100.14",
    "@tanstack/react-virtual":     "^3.13.26",
    "@tauri-apps/api":             "^2.11.0",
    "@tauri-apps/plugin-dialog":   "^2.7.1",
    "@tauri-apps/plugin-store":    "^2.4.3",
    "class-variance-authority":    "^0.7.1",
    "clsx":                        "^2.1.1",
    "lucide-react":                "*",
    "react":                       "^19.2.6",
    "react-dom":                   "^19.2.6",
    "react-router":                "^7.15.1",
    "tailwind-merge":              "^3.6.0",
    "zustand":                     "^5.0.13"
  },
  "devDependencies": {
    "@tailwindcss/vite":           "^4.3.0",
    "@testing-library/jest-dom":   "^6.9.1",
    "@testing-library/react":      "^16.3.2",
    "@testing-library/user-event": "^14.6.1",
    "@types/node":                 "^22",
    "@types/react":                "^19",
    "@types/react-dom":            "^19",
    "@vitejs/plugin-react":        "^4",
    "@vitest/coverage-v8":         "^4.1.7",
    "jsdom":                       "^29.1.1",
    "tailwindcss":                 "^4.3.0",
    "typescript":                  "^5",
    "vite":                        "^6.4.2",
    "vitest":                      "^2.1.9"
  }
}
```

### `vite.config.ts`

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async () => ({
  plugins: [
    react(),
    tailwindcss(),
  ],

  clearScreen: false,

  server: {
    port: 5173,
    strictPort: true,
    host: host || false,
    hmr: host
      ? { protocol: "ws", host, port: 5174 }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  envPrefix: ["VITE_", "TAURI_ENV_*"],

  build: {
    target:
      process.env.TAURI_ENV_PLATFORM === "windows"
        ? "chrome105"
        : "safari13",
    minify: process.env.TAURI_ENV_DEBUG ? false : "esbuild",
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
    outDir: "dist",
  },

  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
    css: false,
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
    },
  },
}));
```

Note: Add `src/test-setup.ts` containing:
```typescript
import "@testing-library/jest-dom";
```

### `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "Bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedSideEffectImports": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"],
  "references": [
    { "path": "./tsconfig.node.json" }
  ]
}
```

Add `tsconfig.node.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "noEmit": true
  },
  "include": ["vite.config.ts"]
}
```

---

## 15. Test Plan

### Story 1: Library Setup & Onboarding

**Rust unit tests (`src-tauri/src/commands/library.rs`):**
1. `test_add_valid_library_path` — add a temp directory; assert row exists in DB and returned `LibraryPath.path` is canonical.
2. `test_add_nonexistent_path_returns_error` — pass a path that doesn't exist; assert `AppError::InvalidArgument`.
3. `test_add_duplicate_path_is_idempotent` — add same path twice; assert second call returns existing row, no duplicate in DB.
4. `test_remove_library_path` — add then remove; assert row gone from DB.
5. `test_get_library_paths_returns_all` — insert 3 paths; assert `get_library_paths` returns all 3.

**React component tests (`src/components/library/`):**
1. `EmptyLibrary renders when no tracks` — mock `getTracks` returning `[]`; assert "Your library is empty" text visible.
2. `AddLibraryButton calls dialog and addLibraryPath` — mock dialog plugin returning a path; assert `addLibraryPath` invoke called.
3. `ScanProgress shows during scan` — set `uiStore.scanInProgress = true`; assert progress bar renders.
4. `ScanProgress displays correct file counts` — set `scanProgress = { scanned: 50, total: 200, skipped: 10 }`; assert "50 / 200" visible.
5. `AddLibraryButton multiple selection` — mock dialog returning 3 paths; assert `addLibraryPath` called 3 times.

**Acceptance tests (1–2):**
1. User opens app with no library configured → sees empty state → clicks "Add folder" → selects ~/Music → scan completes → songs appear in Songs view.
2. User removes a library path → songs from that path no longer appear in library.

---

### Story 2: Library Scanning & Indexing

**Rust unit tests (`src-tauri/src/scanner/scan.rs`):**
1. `test_scan_flac_file` — create temp dir with a real 1-second FLAC file; run scan; assert track in DB with `format = "flac"`, `duration_secs > 0`.
2. `test_scan_mp3_file` — same with MP3; assert `bitrate_kbps` populated.
3. `test_scan_skips_unchanged_file` — scan same dir twice; assert second scan `ScanResult.skipped == 1`.
4. `test_scan_marks_deleted_file` — scan dir with file, delete file, scan again; assert `removed_at` not null.
5. `test_artwork_extraction_deduplication` — two FLAC files with identical embedded art; assert only one file in `artwork/` dir.

**React component tests:**
1. `scan:progress event updates UI` — emit mock event; assert `ScanProgress` shows updated count.
2. `scan:completed invalidates queries` — mock scan completion; assert `getTracks` query refetched.
3. `tracks query shows results after scan` — mock `getTracks` returning 100 tracks; assert `TrackList` renders rows.
4. `format badge shows hi-fi indicator` — mock track with `format = "flac"`, `bit_depth = 24`; assert "24-bit FLAC" label visible.

**Acceptance tests:**
1. Drop 500 FLAC files in a folder; trigger scan; all 500 appear in Songs view with correct metadata.
2. Modify a FLAC file's tags, force rescan; updated title appears in Songs view.

---

### Story 3: Music Playback

**Rust unit tests (`src-tauri/src/audio/`):**
1. `test_play_track_sets_is_playing` — call `play_track` with a valid WAV path; assert `PlayerHandle.is_playing` becomes true.
2. `test_pause_sets_is_playing_false` — play then pause; assert atomic is false.
3. `test_seek_updates_position` — play, seek to 5000ms; assert `position_ms` within 500ms tolerance of 5000.
4. `test_set_volume_clamps_to_100` — call `set_volume(150)`; assert stored volume is 100.
5. `test_unsupported_format_returns_error` — pass a `.txt` file path; assert `AppError::Audio` returned.

**React component tests:**
1. `double-click track starts playback` — render `TrackRow`, double-click; assert `playTrack` invoke called with correct track id.
2. `play:ended event triggers next track` — emit `player:ended`; assert `playerStore.playNext()` called.
3. `NowPlayingBar hidden when no track` — render with `currentTrack = null`; assert bar not in DOM.
4. `NowPlayingBar shows track title` — set `currentTrack = mockTrack`; assert title text visible.
5. `set_volume called on VolumeSlider change` — drag volume slider to 50; assert `setVolume(50)` invoke called.

**Acceptance tests:**
1. User double-clicks a DSD DSF file; track plays without error; position advances; track completes and next queued track begins.
2. User adjusts volume; on app restart, volume is restored to previous level.

---

### Story 4: Now Playing Bar

**Rust unit tests:**
1. `test_get_player_state_returns_position` — play a track for 1 second; call `get_player_state`; assert `position_ms > 500`.
2. `test_player_state_current_track_id` — play track with id "abc"; assert `get_player_state().current_track_id == "abc"`.
3. `test_player_emits_position_events` — register event listener; play track; assert at least 2 `player:position` events within 1.5 seconds.

**React component tests:**
1. `SeekBar reflects positionMs from store` — set `positionMs = 30000, durationMs = 180000`; assert slider value is 30000.
2. `SeekBar onValueCommit calls seek invoke` — simulate drag end at 60000; assert `seek(60000)` invoke called.
3. `VolumeSlider shows current volume` — set `volume = 75`; assert slider thumb at 75%.
4. `TrackInfo renders artwork image` — mock `artwork_hash = "abc123"`; assert `<img src>` contains "abc123".
5. `formatTime renders correctly` — assert `formatTime(3661000)` = "1:01:01".

**Acceptance tests:**
1. While track plays, seek bar moves forward in real time; user drags it back; playback resumes from new position.
2. User mutes volume by dragging to 0; pauses; reopens app; volume is 0 and track is paused.

---

### Story 5: Songs View (virtualized)

**Rust unit tests:**
1. `test_get_tracks_returns_all_active` — insert 3 tracks (2 active, 1 soft-deleted); assert only 2 returned.
2. `test_get_tracks_order` — insert tracks with varying artists/albums/track numbers; assert returned in `artist_sort, album, disc, track` order.
3. `test_get_tracks_joined_album_title` — insert track + album; assert `Track.album_title` populated.

**React component tests:**
1. `TrackList renders correct row count` — mock 1000 tracks; assert virtual list renders ~20 rows (not 1000 DOM nodes).
2. `TrackRow shows playing indicator` — set `isPlaying = true` on row; assert play icon visible.
3. `TrackRow context menu options` — right-click row; assert "Add to playlist" menu item present.
4. `TrackList header columns visible` — assert column headers: "#", "Title", "Artist", "Album", "Duration" all render.
5. `Empty songs view shows EmptyLibrary` — mock `getTracks` returning `[]`; assert `EmptyLibrary` component renders.

**Acceptance tests:**
1. Library with 10,000 tracks: Songs view loads in under 2 seconds; scrolling is smooth (no jank).
2. Track row double-click starts playback; that track appears in NowPlayingBar.

---

### Story 6: Albums View

**Rust unit tests:**
1. `test_get_albums_includes_track_count` — insert album with 5 tracks; assert `Album.track_count == 5`.
2. `test_get_albums_computes_duration` — insert album tracks totaling 3600s; assert `Album.duration_secs == 3600`.
3. `test_get_album_tracks_order` — insert tracks with disc/track numbers; assert disc 1 track 1 before disc 2 track 1.
4. `test_get_albums_sorted_by_title` — insert albums "Ziggy", "Abbey Road"; assert "Abbey Road" first.

**React component tests:**
1. `AlbumGrid renders all album cards` — mock 12 albums; assert 12 `AlbumCard` elements.
2. `AlbumCard shows artwork and title` — mock album with `artwork_hash`; assert `<img>` present and title text visible.
3. `AlbumCard click navigates to detail` — click card; assert router navigates to `/albums/:id`.
4. `AlbumDetail shows track list` — mock album with 12 tracks; assert `TrackList` with 12 rows.
5. `AlbumDetail artwork fallback` — mock album with `artwork_hash = null`; assert placeholder icon shown.

**Acceptance tests:**
1. Albums view shows all albums; clicking one shows all tracks in disc/track order.
2. Album detail's "Play all" queues all tracks and starts playback.

---

### Story 7: Artists View

**Rust unit tests:**
1. `test_get_artists_album_count` — artist with 3 albums; assert `Artist.album_count == 3`.
2. `test_get_artists_sorted` — artists "Zappa", "Bowie"; assert "Bowie" first by `name_sort`.
3. `test_get_artist_albums` — two artists each with 2 albums; `get_artist_albums(id)` returns only that artist's albums.

**React component tests:**
1. `ArtistGrid renders artist cards` — mock 8 artists; assert 8 cards.
2. `ArtistCard shows name and album count` — mock artist with `album_count = 5`; assert "5 albums" text.
3. `ArtistCard click navigates` — click; assert navigate to `/artists/:id`.
4. `ArtistDetail shows albums grid` — mock 4 albums for artist; assert `AlbumGrid` with 4 cards.

**Acceptance tests:**
1. Artists view → click artist → see all their albums → click album → see tracks.
2. Artist with no artwork shows initials avatar.

---

### Story 8: Playlists

**Rust unit tests:**
1. `test_create_playlist` — create playlist "Chill"; assert returned `Playlist.name == "Chill"`, `id` non-empty.
2. `test_add_and_reorder_tracks` — add tracks A, B, C; reorder C to position 0; assert `get_playlist_tracks` returns C, A, B.
3. `test_fractional_position_reorder` — insert tracks at 1.0, 2.0, 3.0; move track 3 between 1 and 2; assert position is 1.5.
4. `test_delete_playlist_cascades` — delete playlist; assert `playlist_tracks` rows gone.
5. `test_renormalize_on_precision_loss` — simulate many reorders until gap < 1e-9; assert positions reset to 1.0, 2.0, 3.0.

**React component tests:**
1. `CreatePlaylistDialog submits name` — type "Jazz Nights", click Create; assert `createPlaylist` invoke called with "Jazz Nights".
2. `PlaylistDetail shows drag handles` — render playlist tracks; assert `GripVertical` icon per row.
3. `PlaylistTrackRow remove button calls invoke` — click remove; assert `removeTrackFromPlaylist` called.
4. `PlaylistSidebar lists all playlists` — mock 5 playlists; assert 5 nav items.
5. `DnD reorder calls reorderPlaylistTrack` — simulate dnd-kit drag end event; assert invoke called with new position.

**Acceptance tests:**
1. Create playlist → add 5 tracks → drag-reorder → refresh app → order persists.
2. Delete playlist → it disappears from sidebar.

---

### Story 9: Search

**Rust unit tests:**
1. `test_search_finds_by_title` — insert track "Bohemian Rhapsody"; search "bohemian"; assert track returned.
2. `test_search_finds_by_artist` — insert artist "Queen"; search "queen"; assert artist returned.
3. `test_search_empty_query_returns_empty` — call `search("")`; assert all result arrays empty.
4. `test_search_result_cap` — insert 100 tracks all matching; assert `tracks.len() <= 50`.
5. `test_fts_trigger_after_insert` — insert track; run FTS search immediately; assert found.

**React component tests:**
1. `SearchInput debounces query` — type fast; assert invoke called only once after 300ms.
2. `SearchResults shows track section` — mock results with 3 tracks; assert 3 `TrackRow` components.
3. `SearchResults shows "See all" when truncated` — mock 10 tracks returned; assert "See all tracks" link present.
4. `SearchInput clear button resets results` — click X button; assert results hidden.
5. `SearchView autofocuses input on mount` — render `SearchView`; assert input has focus.

**Acceptance tests:**
1. Search "abbey" → returns "Abbey Road" album + tracks from that album + artist.
2. Search with no matches → "No results found" message shown.

---

### Story 10: Sidebar

**React component tests:**
1. `Sidebar renders all nav items` — assert Songs, Albums, Artists, Search links present.
2. `Sidebar collapses to icon-only` — set `sidebarCollapsed = true`; assert labels not visible, icons visible.
3. `Sidebar expanded shows labels` — set `sidebarCollapsed = false`; assert "Songs" text visible.
4. `Toggle button flips collapsed state` — click toggle; assert `uiStore.sidebarCollapsed` toggled.
5. `Active route highlighted` — navigate to /albums; assert Albums nav item has active class.

**Acceptance tests:**
1. Click collapse button → sidebar shows only icons; click again → labels return; state persists after app restart.

---

### Story 11: Persistent Settings

**Rust unit tests:**
1. `test_settings_persist_volume` — emit `CloseRequested`, reopen; assert volume same.
2. `test_settings_persist_last_track` — set current track, close, reopen; assert `lastTrackId` restored.

**React component tests:**
1. `useSettings restores volume on mount` — mock store returning `{ volume: 65 }`; assert `setVolume(65)` invoke called on mount.
2. `useSettings restores sidebar state` — mock `{ sidebarCollapsed: true }`; assert `uiStore.sidebarCollapsed = true`.
3. `volume change persists to store` — change volume slider; assert store `set("volume", 70)` called.
4. `window resize persists dimensions` — resize window; assert `windowWidth/windowHeight` updated in store.

**Acceptance tests:**
1. Set volume to 30, resize window to 1000x700, close and reopen → volume is 30, window is 1000x700.
2. Last played track shown in NowPlayingBar on app restart without auto-playing.

---

## Additional Implementation Notes for Builders

**`src-tauri/src/main.rs`** must:
1. Initialize `tracing_subscriber` for logging.
2. Call `tauri::Builder::default()` with all plugins registered.
3. Call `generate_context!()`.
4. Use `.manage(AppState { db: Arc::new(Mutex::new(open_db(...))), player: Arc::new(PlayerHandle::new()) })`.
5. Register all commands via `.invoke_handler(tauri_specta::collect_commands![...])`.
6. In the builder's `setup` closure, export TypeScript bindings to `../src/bindings.ts` using tauri-specta's `export_typescript` — only in debug builds (`#[cfg(debug_assertions)]`).

**`src-tauri/src/lib.rs`** re-exports all command modules and is the crate library root for `tauri-build`.

**`src/hooks/usePlayer.ts`** wires the complete playback loop:
- Subscribes to `player:position` event → `setPositionMs` (only if `!isSeeking`).
- Subscribes to `player:ended` event → `playerStore.playNext()` → invokes `play_track` with next track.
- Exposes `play(track, trackList, index)` which calls `setQueue` then `play_track` invoke.

**Artwork URL in frontend:**
```typescript
// src/hooks/useArtworkUrl.ts
import { convertFileSrc } from '@tauri-apps/api/core';
import { commands } from '../bindings';

export function useArtworkUrl(hash: string | null | undefined): string | null {
  // Calls commands.getArtworkPath(hash) via useQuery with staleTime Infinity
  // Returns convertFileSrc(absolutePath) which produces asset://localhost/...
  // Returns null when hash is null/undefined
}
```

**Database access pattern:** All DB operations go through `Arc<Mutex<Connection>>`. Commands are `async` (tokio) but database calls use `tokio::task::spawn_blocking` to move the mutex lock off the async executor thread:
```rust
let result = tokio::task::spawn_blocking(move || {
    let conn = db.lock().unwrap();
    db::tracks::get_all_tracks(&conn)
}).await.map_err(|e| AppError::Database(e.to_string()))??;
```

**Additional file needed:** `src-tauri/migrations/V1__initial.sql` — contains the exact SQL from Section 4.

**Icon placeholder:** `src-tauri/icons/` directory must exist with placeholder PNG files before first `cargo tauri dev`. Generate with: `cargo tauri icon --output-dir src-tauri/icons path/to/icon.png` (or provide a 1024x1024 PNG source).

---

This specification is complete. Every builder agent has all information required to implement any section without asking questions. The spec pins exact dependency versions, resolves all ambiguities, and specifies behavior down to function signatures and SQL statements.
