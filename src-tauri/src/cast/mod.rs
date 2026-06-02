/// Google Cast (Chromecast) support.
///
/// Architecture
/// ────────────
/// 1. **Discovery** — mDNS browse for `_googlecast._tcp.local.` services.
///    Runs in a background task and populates a shared device list.
///
/// 2. **Local file server** — an axum HTTP server bound on a random port.
///    Chromecasts fetch audio from `http://{lan_ip}:{port}/track/{track_id}`.
///    The handler looks up the file path from the SQLite DB and streams it.
///
/// 3. **Cast session** — a blocking thread that uses `rust-cast` to connect
///    to the chosen device, launch Default Media Receiver, and load the URL.

use std::collections::{HashMap, HashSet};
use std::net::IpAddr;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use axum::body::Body;
use axum::extract::{Path, Query, State as AxumState};
use axum::http::{HeaderMap, StatusCode, header};
use axum::routing::{get, post};
use axum::Router;
use mdns_sd::{ServiceDaemon, ServiceEvent};
use rusqlite::{Connection, params};
use serde::{Deserialize, Serialize};
use tokio::fs::File;
use tokio::io::{AsyncReadExt, AsyncSeekExt, SeekFrom};
use tokio::sync::oneshot;
use tokio_util::io::ReaderStream;

// ─── Types ────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CastDevice {
    pub name:     String,
    pub host:     String,
    pub port:     u16,
    pub friendly: String, // display-friendly name from TXT record
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CastSession {
    pub device_name:    String,
    pub device_host:    String,
    pub local_port:     u16,
    pub current_track:  Option<String>,
}

// ─── Shared state ─────────────────────────────────────────────────────────────

pub struct CastState {
    /// Devices discovered via mDNS (refreshed by `discover_cast_devices` command)
    pub devices:         Arc<Mutex<Vec<CastDevice>>>,
    /// Active cast session info (if casting)
    pub session:         Arc<Mutex<Option<CastSession>>>,
    /// Shutdown sender for the local HTTP file server
    pub server_shutdown: Arc<Mutex<Option<oneshot::Sender<()>>>>,
    /// Port the local server is listening on (0 = not started)
    pub server_port:     Arc<Mutex<u16>>,
}

impl CastState {
    pub fn new() -> Arc<Self> {
        Arc::new(CastState {
            devices:         Arc::new(Mutex::new(Vec::new())),
            session:         Arc::new(Mutex::new(None)),
            server_shutdown: Arc::new(Mutex::new(None)),
            server_port:     Arc::new(Mutex::new(0)),
        })
    }
}

// ─── mDNS discovery ───────────────────────────────────────────────────────────

/// Browse the local network for `_googlecast._tcp.local.` services for up to
/// `timeout_ms` milliseconds and return all discovered devices.
pub fn discover(timeout_ms: u64) -> Vec<CastDevice> {
    let mdns = match ServiceDaemon::new() {
        Ok(d) => d,
        Err(e) => {
            log::error!("[cast] mDNS daemon error: {e}");
            return Vec::new();
        }
    };

    let receiver = match mdns.browse("_googlecast._tcp.local.") {
        Ok(r) => r,
        Err(e) => {
            log::error!("[cast] mDNS browse error: {e}");
            return Vec::new();
        }
    };

    let deadline = std::time::Instant::now() + Duration::from_millis(timeout_ms);
    let mut devices: HashMap<String, CastDevice> = HashMap::new();

    while std::time::Instant::now() < deadline {
        match receiver.recv_timeout(Duration::from_millis(200)) {
            Ok(ServiceEvent::ServiceResolved(info)) => {
                let host = info
                    .get_addresses()
                    .iter()
                    .next()
                    .map(|a| a.to_string())
                    .unwrap_or_default();

                if host.is_empty() { continue; }

                let friendly = info
                    .get_property_val_str("fn")
                    .unwrap_or_else(|| info.get_hostname())
                    .to_string();

                let entry = CastDevice {
                    name:     info.get_fullname().to_string(),
                    host:     host.clone(),
                    port:     info.get_port(),
                    friendly: friendly.clone(),
                };

                devices.insert(host, entry);
            }
            Err(_) => { /* timeout slot — keep polling */ }
            _ => {}
        }
    }

    // Drop the daemon first so its background thread stops completely,
    // then drain any leftover events and drop the receiver. Reversing the
    // order avoids "sending on a closed channel" errors from the daemon
    // thread trying to deliver SearchStarted events to a dropped receiver.
    drop(mdns);
    while receiver.try_recv().is_ok() {}
    drop(receiver);
    devices.into_values().collect()
}

// ─── Local HTTP file server ───────────────────────────────────────────────────

#[derive(Clone)]
struct ServerState {
    db:           Arc<Mutex<Connection>>,
    server_addr:  Arc<Mutex<Option<String>>>,
    app_data_dir: PathBuf,
}

async fn serve_track(
    AxumState(state): AxumState<ServerState>,
    Path(track_id): Path<String>,
) -> Result<axum::response::Response<Body>, StatusCode> {
    // Resolve file path from DB
    let file_path = {
        let conn = state.db.lock().unwrap();
        conn.query_row(
            "SELECT file_path FROM tracks WHERE id = ?1 AND removed_at IS NULL",
            params![track_id],
            |row| row.get::<_, String>(0),
        )
        .map_err(|_| StatusCode::NOT_FOUND)?
    };

    // Detect content type from extension
    let content_type = match std::path::Path::new(&file_path)
        .extension()
        .and_then(|e| e.to_str())
        .map(str::to_lowercase)
        .as_deref()
    {
        Some("mp3")                   => "audio/mpeg",
        Some("flac")                  => "audio/flac",
        Some("ogg") | Some("opus")   => "audio/ogg",
        Some("m4a") | Some("aac")    => "audio/mp4",
        Some("wav")                   => "audio/wav",
        Some("aiff") | Some("aif")   => "audio/aiff",
        _                             => "application/octet-stream",
    };

    let file = File::open(&file_path).await.map_err(|_| StatusCode::NOT_FOUND)?;
    let metadata = file.metadata().await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let stream = ReaderStream::new(file);
    let body = Body::from_stream(stream);

    let response = axum::response::Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, content_type)
        .header(header::CONTENT_LENGTH, metadata.len())
        .header(header::ACCEPT_RANGES, "bytes")
        .body(body)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(response)
}

/// Parse a single-range `Range: bytes=START-END` header.
/// Returns `Some((start, end_inclusive))` clamped to the file size, or
/// `None` if the header is absent or malformed.
fn parse_range(header_value: &str, total: u64) -> Option<(u64, u64)> {
    let spec = header_value.strip_prefix("bytes=")?;
    // Only honor the first range; AVPlayer never sends multipart anyway.
    let first = spec.split(',').next()?.trim();
    let (start_s, end_s) = first.split_once('-')?;
    let start_s = start_s.trim();
    let end_s   = end_s.trim();

    if start_s.is_empty() {
        // Suffix range: "bytes=-N" → last N bytes
        let n: u64 = end_s.parse().ok()?;
        if n == 0 || total == 0 { return None; }
        let n = n.min(total);
        return Some((total - n, total - 1));
    }

    let start: u64 = start_s.parse().ok()?;
    if start >= total { return None; }
    let end = if end_s.is_empty() {
        total - 1
    } else {
        end_s.parse::<u64>().ok()?.min(total - 1)
    };
    if end < start { return None; }
    Some((start, end))
}

async fn serve_stream(
    AxumState(state): AxumState<ServerState>,
    headers: HeaderMap,
    Path(track_id): Path<String>,
) -> Result<axum::response::Response<Body>, StatusCode> {
    let file_path = {
        let conn = state.db.lock().unwrap();
        conn.query_row(
            "SELECT file_path FROM tracks WHERE id = ?1 AND removed_at IS NULL",
            params![track_id],
            |row| row.get::<_, String>(0),
        )
        .map_err(|_| StatusCode::NOT_FOUND)?
    };

    let content_type = match std::path::Path::new(&file_path)
        .extension()
        .and_then(|e| e.to_str())
        .map(str::to_lowercase)
        .as_deref()
    {
        Some("mp3")                   => "audio/mpeg",
        Some("flac")                  => "audio/flac",
        Some("ogg") | Some("opus")   => "audio/ogg",
        Some("m4a") | Some("aac")    => "audio/mp4",
        Some("wav")                   => "audio/wav",
        Some("aiff") | Some("aif")   => "audio/aiff",
        _                             => "application/octet-stream",
    };

    let mut file = File::open(&file_path).await.map_err(|_| StatusCode::NOT_FOUND)?;
    let metadata = file.metadata().await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let total = metadata.len();

    let range = headers
        .get(header::RANGE)
        .and_then(|v| v.to_str().ok())
        .and_then(|s| parse_range(s, total));

    let builder = axum::response::Response::builder()
        .header(header::CONTENT_TYPE, content_type)
        .header(header::ACCEPT_RANGES, "bytes")
        .header(header::CONTENT_DISPOSITION, "inline")
        .header("Access-Control-Allow-Origin", "*");

    let response = if let Some((start, end)) = range {
        let length = end - start + 1;
        file.seek(SeekFrom::Start(start))
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        let limited = file.take(length);
        let body = Body::from_stream(ReaderStream::new(limited));
        builder
            .status(StatusCode::PARTIAL_CONTENT)
            .header(header::CONTENT_LENGTH, length)
            .header(header::CONTENT_RANGE, format!("bytes {}-{}/{}", start, end, total))
            .body(body)
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    } else {
        let body = Body::from_stream(ReaderStream::new(file));
        builder
            .status(StatusCode::OK)
            .header(header::CONTENT_LENGTH, total)
            .body(body)
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    };

    Ok(response)
}

#[derive(Deserialize)]
struct PlaylistQuery {
    ids: String,
}

async fn serve_playlist_m3u8(
    AxumState(state): AxumState<ServerState>,
    Query(query): Query<PlaylistQuery>,
) -> Result<axum::response::Response<Body>, StatusCode> {
    let ids: Vec<String> = query.ids
        .split(',')
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string())
        .collect();
    if ids.is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }

    let valid_ids: HashSet<String> = {
        let conn = state.db.lock().unwrap();
        let placeholders: String = ids.iter().enumerate()
            .map(|(i, _)| format!("?{}", i + 1))
            .collect::<Vec<_>>()
            .join(",");
        let sql = format!(
            "SELECT id FROM tracks WHERE id IN ({}) AND removed_at IS NULL",
            placeholders
        );
        let mut stmt = conn.prepare(&sql).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        let rows = stmt.query_map(rusqlite::params_from_iter(ids.iter()), |row| {
            row.get::<_, String>(0)
        }).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        rows.filter_map(|r| r.ok()).collect()
    };

    let base_url = state.server_addr.lock().unwrap()
        .clone()
        .unwrap_or_else(|| "http://localhost".to_string());

    let mut m3u8 = String::from("#EXTM3U\n");
    for id in &ids {
        if valid_ids.contains(id) {
            m3u8.push_str(&format!("{}/stream/{}\n", base_url, id));
        }
    }

    let response = axum::response::Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "application/x-mpegurl")
        .header(header::CONTENT_DISPOSITION, "attachment; filename=\"playlist.m3u8\"")
        .body(Body::from(m3u8))
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(response)
}

// ─── API response types ───────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
struct TrackSummary {
    id:           String,
    title:        String,
    artist:       String,
    album:        String,
    album_id:     Option<String>,
    artist_id:    Option<String>,
    duration_ms:  i64,
    track_number: Option<i32>,
    has_artwork:  bool,
}

#[derive(Debug, Serialize)]
struct AlbumSummary {
    id:          String,
    title:       String,
    artist:      String,
    artist_id:   String,
    year:        Option<i32>,
    track_count: i32,
}

#[derive(Debug, Serialize)]
struct ArtistSummary {
    id:          String,
    name:        String,
    album_count: i32,
    track_count: i32,
}

#[derive(Debug, Serialize)]
struct PlaylistSummary {
    id:          String,
    name:        String,
    track_count: i32,
}

#[derive(Debug, Serialize)]
struct AlbumDetail {
    id:          String,
    title:       String,
    artist:      String,
    artist_id:   String,
    year:        Option<i32>,
    track_count: i32,
    tracks:      Vec<TrackSummary>,
}

#[derive(Debug, Serialize)]
struct LibrarySnapshot {
    tracks:    Vec<TrackSummary>,
    albums:    Vec<AlbumSummary>,
    artists:   Vec<ArtistSummary>,
    playlists: Vec<PlaylistSummary>,
}

#[derive(Debug, Serialize)]
struct ArtistDetail {
    id:          String,
    name:        String,
    album_count: i32,
    track_count: i32,
    albums:      Vec<AlbumSummary>,
}

#[derive(Debug, Serialize)]
struct PlaylistDetail {
    id:          String,
    name:        String,
    track_count: i32,
    tracks:      Vec<TrackSummary>,
}

#[derive(Debug, Serialize)]
struct SearchResponse {
    tracks:  Vec<TrackSummary>,
    albums:  Vec<AlbumSummary>,
    artists: Vec<ArtistSummary>,
}

// ─── CORS helper ──────────────────────────────────────────────────────────────

fn cors_json<T: Serialize>(status: StatusCode, body: &T) -> axum::response::Response {
    let json = serde_json::to_vec(body).unwrap_or_default();
    axum::response::Response::builder()
        .status(status)
        .header(header::CONTENT_TYPE, "application/json")
        .header("Access-Control-Allow-Origin", "*")
        .body(Body::from(json))
        .unwrap()
}

fn cors_ok<T: Serialize>(body: &T) -> axum::response::Response {
    cors_json(StatusCode::OK, body)
}

fn cors_not_found() -> axum::response::Response {
    axum::response::Response::builder()
        .status(StatusCode::NOT_FOUND)
        .header("Access-Control-Allow-Origin", "*")
        .body(Body::empty())
        .unwrap()
}

fn cors_server_error() -> axum::response::Response {
    axum::response::Response::builder()
        .status(StatusCode::INTERNAL_SERVER_ERROR)
        .header("Access-Control-Allow-Origin", "*")
        .body(Body::empty())
        .unwrap()
}

// ─── DB → summary converters ──────────────────────────────────────────────────

fn row_to_track_summary(
    id: String,
    title: String,
    artist: String,
    album_title: Option<String>,
    album_id: Option<String>,
    artist_id: Option<String>,
    duration_secs: f64,
    track_number: Option<i32>,
    artwork_hash: Option<String>,
) -> TrackSummary {
    TrackSummary {
        id,
        title,
        artist,
        album: album_title.unwrap_or_default(),
        album_id,
        artist_id,
        duration_ms: (duration_secs * 1000.0) as i64,
        track_number,
        has_artwork: artwork_hash.is_some(),
    }
}

// ─── API handlers ─────────────────────────────────────────────────────────────

async fn api_tracks(
    AxumState(state): AxumState<ServerState>,
) -> axum::response::Response {
    let result: Result<Vec<TrackSummary>, _> = {
        let conn = state.db.lock().unwrap();
        let mut stmt = match conn.prepare(
            "SELECT t.id, t.title, t.artist, al.title, t.album_id, t.artist_id,
                    t.duration_secs, t.track_number, t.artwork_hash
             FROM tracks t
             LEFT JOIN albums al ON al.id = t.album_id
             WHERE t.removed_at IS NULL
             ORDER BY t.artist_sort, al.title_sort, t.disc_number, t.track_number",
        ) {
            Ok(s) => s,
            Err(_) => return cors_server_error(),
        };
        stmt.query_map([], |row| {
            Ok(row_to_track_summary(
                row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?,
                row.get(4)?, row.get(5)?, row.get(6)?, row.get(7)?, row.get(8)?,
            ))
        })
        .and_then(|rows| rows.collect())
    };
    match result {
        Ok(tracks) => cors_ok(&tracks),
        Err(_) => cors_server_error(),
    }
}

async fn api_liked(
    AxumState(state): AxumState<ServerState>,
) -> axum::response::Response {
    let result: Result<Vec<TrackSummary>, _> = {
        let conn = state.db.lock().unwrap();
        let mut stmt = match conn.prepare(
            "SELECT t.id, t.title, t.artist, al.title, t.album_id, t.artist_id,
                    t.duration_secs, t.track_number, t.artwork_hash
             FROM liked_tracks lt
             JOIN tracks t ON t.id = lt.track_id AND t.removed_at IS NULL
             LEFT JOIN albums al ON al.id = t.album_id
             ORDER BY lt.liked_at DESC",
        ) {
            Ok(s) => s,
            Err(_) => return cors_server_error(),
        };
        stmt.query_map([], |row| {
            Ok(row_to_track_summary(
                row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?,
                row.get(4)?, row.get(5)?, row.get(6)?, row.get(7)?, row.get(8)?,
            ))
        })
        .and_then(|rows| rows.collect())
    };
    match result {
        Ok(tracks) => cors_ok(&tracks),
        Err(_) => cors_server_error(),
    }
}

#[derive(Deserialize)]
struct LimitQuery {
    limit: Option<i64>,
}

async fn api_recent(
    AxumState(state): AxumState<ServerState>,
    Query(q): Query<LimitQuery>,
) -> axum::response::Response {
    let limit = q.limit.unwrap_or(20).min(100);
    let result: Result<Vec<TrackSummary>, _> = {
        let conn = state.db.lock().unwrap();
        let mut stmt = match conn.prepare(
            "SELECT t.id, t.title, t.artist, al.title, t.album_id, t.artist_id,
                    t.duration_secs, t.track_number, t.artwork_hash
             FROM tracks t
             LEFT JOIN albums al ON al.id = t.album_id
             WHERE t.removed_at IS NULL
             ORDER BY COALESCE(t.last_played_at, t.created_at) DESC
             LIMIT ?1",
        ) {
            Ok(s) => s,
            Err(_) => return cors_server_error(),
        };
        stmt.query_map(params![limit], |row| {
            Ok(row_to_track_summary(
                row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?,
                row.get(4)?, row.get(5)?, row.get(6)?, row.get(7)?, row.get(8)?,
            ))
        })
        .and_then(|rows| rows.collect())
    };
    match result {
        Ok(tracks) => cors_ok(&tracks),
        Err(_) => cors_server_error(),
    }
}

async fn api_albums(
    AxumState(state): AxumState<ServerState>,
) -> axum::response::Response {
    let result: Result<Vec<AlbumSummary>, _> = {
        let conn = state.db.lock().unwrap();
        let mut stmt = match conn.prepare(
            "SELECT al.id, al.title, ar.name, al.artist_id, al.year, al.track_count
             FROM albums al
             JOIN artists ar ON ar.id = al.artist_id
             ORDER BY al.title_sort",
        ) {
            Ok(s) => s,
            Err(_) => return cors_server_error(),
        };
        stmt.query_map([], |row| {
            Ok(AlbumSummary {
                id:          row.get(0)?,
                title:       row.get(1)?,
                artist:      row.get(2)?,
                artist_id:   row.get(3)?,
                year:        row.get(4)?,
                track_count: row.get(5)?,
            })
        })
        .and_then(|rows| rows.collect())
    };
    match result {
        Ok(albums) => cors_ok(&albums),
        Err(_) => cors_server_error(),
    }
}

async fn api_album(
    AxumState(state): AxumState<ServerState>,
    Path(album_id): Path<String>,
) -> axum::response::Response {
    let conn = state.db.lock().unwrap();

    // LEFT JOIN to artists so an orphaned artist_id (e.g. after a partial
    // rescan) still resolves the album with an empty artist name instead of
    // 404ing the mobile client.
    let summary = conn.query_row(
        "SELECT al.id, al.title, COALESCE(ar.name, '') AS artist_name,
                al.artist_id, al.year, al.track_count
         FROM albums al
         LEFT JOIN artists ar ON ar.id = al.artist_id
         WHERE al.id = ?1",
        params![album_id],
        |row| Ok(AlbumSummary {
            id:          row.get(0)?,
            title:       row.get(1)?,
            artist:      row.get(2)?,
            artist_id:   row.get(3)?,
            year:        row.get(4)?,
            track_count: row.get(5)?,
        }),
    );

    let summary = match summary {
        Ok(s) => s,
        Err(rusqlite::Error::QueryReturnedNoRows) => {
            log::warn!("[api_album] no album row for id={album_id}");
            return cors_not_found();
        }
        Err(e) => {
            log::warn!("[api_album] summary query failed for id={album_id}: {e}");
            return cors_server_error();
        }
    };

    let mut stmt = match conn.prepare(
        "SELECT t.id, t.title, t.artist, al.title, t.album_id, t.artist_id,
                t.duration_secs, t.track_number, t.artwork_hash
         FROM tracks t
         LEFT JOIN albums al ON al.id = t.album_id
         WHERE t.album_id = ?1 AND t.removed_at IS NULL
         ORDER BY t.disc_number, t.track_number",
    ) {
        Ok(s) => s,
        Err(e) => {
            log::warn!("[api_album] track stmt prepare failed: {e}");
            return cors_server_error();
        }
    };

    let tracks: Vec<TrackSummary> = match stmt.query_map(params![album_id], |row| {
        Ok(row_to_track_summary(
            row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?,
            row.get(4)?, row.get(5)?, row.get(6)?, row.get(7)?, row.get(8)?,
        ))
    }).and_then(|rows| rows.collect()) {
        Ok(v) => v,
        Err(e) => {
            log::warn!("[api_album] track query failed for id={album_id}: {e}");
            return cors_server_error();
        }
    };

    cors_ok(&AlbumDetail {
        id:          summary.id,
        title:       summary.title,
        artist:      summary.artist,
        artist_id:   summary.artist_id,
        year:        summary.year,
        track_count: summary.track_count,
        tracks,
    })
}

async fn api_artists(
    AxumState(state): AxumState<ServerState>,
) -> axum::response::Response {
    let result: Result<Vec<ArtistSummary>, _> = {
        let conn = state.db.lock().unwrap();
        let mut stmt = match conn.prepare(
            "SELECT ar.id, ar.name,
                    COUNT(DISTINCT al.id) as album_count,
                    COUNT(DISTINCT t.id) as track_count
             FROM artists ar
             LEFT JOIN albums al ON al.artist_id = ar.id
             LEFT JOIN tracks t ON t.artist_id = ar.id AND t.removed_at IS NULL
             GROUP BY ar.id
             ORDER BY ar.name_sort",
        ) {
            Ok(s) => s,
            Err(_) => return cors_server_error(),
        };
        stmt.query_map([], |row| {
            Ok(ArtistSummary {
                id:          row.get(0)?,
                name:        row.get(1)?,
                album_count: row.get(2)?,
                track_count: row.get(3)?,
            })
        })
        .and_then(|rows| rows.collect())
    };
    match result {
        Ok(artists) => cors_ok(&artists),
        Err(_) => cors_server_error(),
    }
}

async fn api_artist(
    AxumState(state): AxumState<ServerState>,
    Path(artist_id): Path<String>,
) -> axum::response::Response {
    let conn = state.db.lock().unwrap();

    let summary = conn.query_row(
        "SELECT ar.id, ar.name,
                COUNT(DISTINCT al.id) as album_count,
                COUNT(DISTINCT t.id) as track_count
         FROM artists ar
         LEFT JOIN albums al ON al.artist_id = ar.id
         LEFT JOIN tracks t ON t.artist_id = ar.id AND t.removed_at IS NULL
         WHERE ar.id = ?1
         GROUP BY ar.id",
        params![artist_id],
        |row| Ok(ArtistSummary {
            id:          row.get(0)?,
            name:        row.get(1)?,
            album_count: row.get(2)?,
            track_count: row.get(3)?,
        }),
    );

    let summary = match summary {
        Ok(s) => s,
        Err(rusqlite::Error::QueryReturnedNoRows) => return cors_not_found(),
        Err(_) => return cors_server_error(),
    };

    let mut stmt = match conn.prepare(
        "SELECT al.id, al.title, COALESCE(ar.name, '') AS artist_name,
                al.artist_id, al.year, al.track_count
         FROM albums al
         LEFT JOIN artists ar ON ar.id = al.artist_id
         WHERE al.artist_id = ?1
         ORDER BY al.year DESC, al.title_sort",
    ) {
        Ok(s) => s,
        Err(e) => {
            log::warn!("[api_artist] album stmt prepare failed: {e}");
            return cors_server_error();
        }
    };

    let albums: Vec<AlbumSummary> = match stmt.query_map(params![artist_id], |row| {
        Ok(AlbumSummary {
            id:          row.get(0)?,
            title:       row.get(1)?,
            artist:      row.get(2)?,
            artist_id:   row.get(3)?,
            year:        row.get(4)?,
            track_count: row.get(5)?,
        })
    }).and_then(|rows| rows.collect()) {
        Ok(v) => v,
        Err(e) => {
            log::warn!("[api_artist] album query failed for id={artist_id}: {e}");
            return cors_server_error();
        }
    };

    cors_ok(&ArtistDetail {
        id:          summary.id,
        name:        summary.name,
        album_count: summary.album_count,
        track_count: summary.track_count,
        albums,
    })
}

async fn api_playlists(
    AxumState(state): AxumState<ServerState>,
) -> axum::response::Response {
    let playlists: Result<Vec<PlaylistSummary>, _> = {
        let conn = state.db.lock().unwrap();
        let mut stmt = match conn.prepare(
            "SELECT p.id, p.name, COUNT(pt.id) as track_count
             FROM playlists p
             LEFT JOIN playlist_tracks pt ON pt.playlist_id = p.id
             GROUP BY p.id
             ORDER BY p.name COLLATE NOCASE",
        ) {
            Ok(s) => s,
            Err(_) => return cors_server_error(),
        };
        stmt.query_map([], |row| {
            Ok(PlaylistSummary {
                id:          row.get(0)?,
                name:        row.get(1)?,
                track_count: row.get(2)?,
            })
        })
        .and_then(|rows| rows.collect())
    };
    let mut playlists = match playlists {
        Ok(v) => v,
        Err(_) => return cors_server_error(),
    };
    // Synthetic "Liked Songs" entry
    let liked_count: i32 = {
        let conn = state.db.lock().unwrap();
        conn.query_row(
            "SELECT COUNT(*)
             FROM liked_tracks lt
             JOIN tracks t ON t.id = lt.track_id AND t.removed_at IS NULL",
            [],
            |row| row.get(0),
        ).unwrap_or(0)
    };
    playlists.insert(0, PlaylistSummary {
        id:          "liked".to_string(),
        name:        "Liked Songs".to_string(),
        track_count: liked_count,
    });
    cors_ok(&playlists)
}

async fn api_playlist(
    AxumState(state): AxumState<ServerState>,
    Path(playlist_id): Path<String>,
) -> axum::response::Response {
    // Special case: "liked" returns liked tracks as a synthetic playlist
    if playlist_id == "liked" {
        let (track_count, tracks) = {
            let conn = state.db.lock().unwrap();
            let count: i32 = conn
                .query_row(
                    "SELECT COUNT(*)
                     FROM liked_tracks lt
                     JOIN tracks t ON t.id = lt.track_id AND t.removed_at IS NULL",
                    [],
                    |row| row.get(0),
                )
                .unwrap_or(0);
            let mut stmt = match conn.prepare(
                "SELECT t.id, t.title, t.artist, al.title, t.album_id, t.artist_id,
                        t.duration_secs, t.track_number, t.artwork_hash
                 FROM liked_tracks lt
                 JOIN tracks t ON t.id = lt.track_id AND t.removed_at IS NULL
                 LEFT JOIN albums al ON al.id = t.album_id
                 ORDER BY lt.liked_at DESC",
            ) {
                Ok(s) => s,
                Err(_) => return cors_server_error(),
            };
            let tracks: Vec<TrackSummary> = match stmt.query_map([], |row| {
                Ok(row_to_track_summary(
                    row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?,
                    row.get(4)?, row.get(5)?, row.get(6)?, row.get(7)?, row.get(8)?,
                ))
            }).and_then(|rows| rows.collect()) {
                Ok(v) => v,
                Err(_) => return cors_server_error(),
            };
            (count, tracks)
        };
        return cors_ok(&PlaylistDetail {
            id:          "liked".to_string(),
            name:        "Liked Songs".to_string(),
            track_count,
            tracks,
        });
    }

    let conn = state.db.lock().unwrap();

    let summary = conn.query_row(
        "SELECT p.id, p.name, COUNT(pt.id) as track_count
         FROM playlists p
         LEFT JOIN playlist_tracks pt ON pt.playlist_id = p.id
         WHERE p.id = ?1
         GROUP BY p.id",
        params![playlist_id],
        |row| Ok(PlaylistSummary {
            id:          row.get(0)?,
            name:        row.get(1)?,
            track_count: row.get(2)?,
        }),
    );

    let summary = match summary {
        Ok(s) => s,
        Err(rusqlite::Error::QueryReturnedNoRows) => return cors_not_found(),
        Err(_) => return cors_server_error(),
    };

    let mut stmt = match conn.prepare(
        "SELECT t.id, t.title, t.artist, al.title, t.album_id, t.artist_id,
                t.duration_secs, t.track_number, t.artwork_hash
         FROM playlist_tracks pt
         JOIN tracks t ON t.id = pt.track_id AND t.removed_at IS NULL
         LEFT JOIN albums al ON al.id = t.album_id
         WHERE pt.playlist_id = ?1
         ORDER BY pt.position",
    ) {
        Ok(s) => s,
        Err(_) => return cors_server_error(),
    };

    let tracks: Vec<TrackSummary> = match stmt.query_map(params![playlist_id], |row| {
        Ok(row_to_track_summary(
            row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?,
            row.get(4)?, row.get(5)?, row.get(6)?, row.get(7)?, row.get(8)?,
        ))
    }).and_then(|rows| rows.collect()) {
        Ok(v) => v,
        Err(_) => return cors_server_error(),
    };

    cors_ok(&PlaylistDetail {
        id:          summary.id,
        name:        summary.name,
        track_count: summary.track_count,
        tracks,
    })
}

#[derive(Deserialize)]
struct SearchQuery {
    q: Option<String>,
}

async fn api_search(
    AxumState(state): AxumState<ServerState>,
    Query(q): Query<SearchQuery>,
) -> axum::response::Response {
    let query = match q.q.as_deref() {
        Some(s) if !s.trim().is_empty() => s.trim().to_string(),
        _ => {
            return cors_ok(&SearchResponse { tracks: vec![], albums: vec![], artists: vec![] });
        }
    };
    let like = format!("%{}%", query);

    let conn = state.db.lock().unwrap();

    let tracks: Vec<TrackSummary> = {
        let mut stmt = match conn.prepare(
            "SELECT t.id, t.title, t.artist, al.title, t.album_id, t.artist_id,
                    t.duration_secs, t.track_number, t.artwork_hash
             FROM tracks t
             LEFT JOIN albums al ON al.id = t.album_id
             WHERE (t.title LIKE ?1 OR t.artist LIKE ?1) AND t.removed_at IS NULL
             LIMIT 20",
        ) {
            Ok(s) => s,
            Err(_) => return cors_server_error(),
        };
        match stmt.query_map(params![like], |row| {
            Ok(row_to_track_summary(
                row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?,
                row.get(4)?, row.get(5)?, row.get(6)?, row.get(7)?, row.get(8)?,
            ))
        }).and_then(|rows| rows.collect()) {
            Ok(v) => v,
            Err(_) => return cors_server_error(),
        }
    };

    let albums: Vec<AlbumSummary> = {
        let mut stmt = match conn.prepare(
            "SELECT al.id, al.title, ar.name, al.artist_id, al.year, al.track_count
             FROM albums al
             JOIN artists ar ON ar.id = al.artist_id
             WHERE al.title LIKE ?1 OR ar.name LIKE ?1
             ORDER BY al.title_sort
             LIMIT 20",
        ) {
            Ok(s) => s,
            Err(_) => return cors_server_error(),
        };
        match stmt.query_map(params![like], |row| {
            Ok(AlbumSummary {
                id:          row.get(0)?,
                title:       row.get(1)?,
                artist:      row.get(2)?,
                artist_id:   row.get(3)?,
                year:        row.get(4)?,
                track_count: row.get(5)?,
            })
        }).and_then(|rows| rows.collect()) {
            Ok(v) => v,
            Err(_) => return cors_server_error(),
        }
    };

    let artists: Vec<ArtistSummary> = {
        let mut stmt = match conn.prepare(
            "SELECT ar.id, ar.name,
                    COUNT(DISTINCT al.id) as album_count,
                    COUNT(DISTINCT t.id) as track_count
             FROM artists ar
             LEFT JOIN albums al ON al.artist_id = ar.id
             LEFT JOIN tracks t ON t.artist_id = ar.id AND t.removed_at IS NULL
             WHERE ar.name LIKE ?1
             GROUP BY ar.id
             ORDER BY ar.name_sort
             LIMIT 20",
        ) {
            Ok(s) => s,
            Err(_) => return cors_server_error(),
        };
        match stmt.query_map(params![like], |row| {
            Ok(ArtistSummary {
                id:          row.get(0)?,
                name:        row.get(1)?,
                album_count: row.get(2)?,
                track_count: row.get(3)?,
            })
        }).and_then(|rows| rows.collect()) {
            Ok(v) => v,
            Err(_) => return cors_server_error(),
        }
    };

    cors_ok(&SearchResponse { tracks, albums, artists })
}

async fn api_artwork(
    AxumState(state): AxumState<ServerState>,
    Path(id): Path<String>,
) -> axum::response::Response {
    let artwork_hash: Option<String> = {
        let conn = state.db.lock().unwrap();
        // Try as track ID first
        let by_track = conn.query_row(
            "SELECT artwork_hash FROM tracks WHERE id = ?1 AND removed_at IS NULL",
            params![id],
            |row| row.get::<_, Option<String>>(0),
        ).ok().flatten();
        if by_track.is_some() {
            by_track
        } else {
            // Fallback: treat as album ID — find any track in this album with artwork
            conn.query_row(
                "SELECT artwork_hash FROM tracks WHERE album_id = ?1 AND removed_at IS NULL AND artwork_hash IS NOT NULL LIMIT 1",
                params![id],
                |row| row.get::<_, String>(0),
            ).ok()
        }
    };

    let hash = match artwork_hash {
        Some(h) => h,
        None => return cors_not_found(),
    };

    let path = state.app_data_dir.join("artwork").join(format!("{}.jpg", hash));

    let file = match File::open(&path).await {
        Ok(f) => f,
        Err(_) => return cors_not_found(),
    };

    let metadata = match file.metadata().await {
        Ok(m) => m,
        Err(_) => return cors_server_error(),
    };

    let stream = ReaderStream::new(file);
    let body = Body::from_stream(stream);

    axum::response::Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "image/jpeg")
        .header(header::CONTENT_LENGTH, metadata.len())
        .header("Access-Control-Allow-Origin", "*")
        .body(body)
        .unwrap_or_else(|_| cors_server_error())
}

// ─── Stats types ─────────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
struct PlayHistoryEntry {
    track_id:    String,
    title:       String,
    artist:      String,
    album:       String,
    played_at:   i64,
    listen_ms:   i64,
    completed:   bool,
    source:      String,
}

#[derive(Debug, Serialize)]
struct TopItem {
    id:     String,
    name:   String,
    count:  i64,
    ms:     i64,
}

#[derive(Debug, Serialize)]
struct StatsSummary {
    total_plays:      i64,
    total_listen_ms:  i64,
    unique_tracks:    i64,
    unique_artists:   i64,
    top_tracks:       Vec<TopItem>,
    top_artists:      Vec<TopItem>,
}

#[derive(Debug, Deserialize)]
struct RecordPlayBody {
    track_id:   String,
    listen_ms:  Option<i64>,
    completed:  Option<bool>,
    source:     Option<String>,
}

// ─── Stats handlers ───────────────────────────────────────────────────────────

async fn api_stats_summary(
    AxumState(state): AxumState<ServerState>,
) -> axum::response::Response {
    let conn = state.db.lock().unwrap();

    let total_plays: i64 = conn.query_row(
        "SELECT COUNT(*) FROM play_history", [], |r| r.get(0)
    ).unwrap_or(0);

    let total_listen_ms: i64 = conn.query_row(
        "SELECT COALESCE(SUM(listen_ms),0) FROM play_history", [], |r| r.get(0)
    ).unwrap_or(0);

    let unique_tracks: i64 = conn.query_row(
        "SELECT COUNT(DISTINCT track_id) FROM play_history", [], |r| r.get(0)
    ).unwrap_or(0);

    let unique_artists: i64 = conn.query_row(
        "SELECT COUNT(DISTINCT t.artist) FROM play_history ph JOIN tracks t ON t.id = ph.track_id",
        [], |r| r.get(0)
    ).unwrap_or(0);

    let top_tracks: Vec<TopItem> = {
        let mut stmt = match conn.prepare(
            "SELECT ph.track_id, t.title, COUNT(*) as plays, COALESCE(SUM(ph.listen_ms),0) as ms
             FROM play_history ph
             JOIN tracks t ON t.id = ph.track_id
             GROUP BY ph.track_id
             ORDER BY plays DESC
             LIMIT 20",
        ) {
            Ok(s) => s,
            Err(_) => return cors_server_error(),
        };
        match stmt.query_map([], |row| {
            Ok(TopItem { id: row.get(0)?, name: row.get(1)?, count: row.get(2)?, ms: row.get(3)? })
        }).and_then(|rows| rows.collect()) {
            Ok(v) => v,
            Err(_) => vec![],
        }
    };

    let top_artists: Vec<TopItem> = {
        let mut stmt = match conn.prepare(
            "SELECT t.artist_id, t.artist, COUNT(*) as plays, COALESCE(SUM(ph.listen_ms),0) as ms
             FROM play_history ph
             JOIN tracks t ON t.id = ph.track_id
             GROUP BY t.artist
             ORDER BY plays DESC
             LIMIT 20",
        ) {
            Ok(s) => s,
            Err(_) => return cors_server_error(),
        };
        match stmt.query_map([], |row| {
            Ok(TopItem { id: row.get(0).unwrap_or_default(), name: row.get(1)?, count: row.get(2)?, ms: row.get(3)? })
        }).and_then(|rows| rows.collect()) {
            Ok(v) => v,
            Err(_) => vec![],
        }
    };

    cors_ok(&StatsSummary { total_plays, total_listen_ms, unique_tracks, unique_artists, top_tracks, top_artists })
}

#[derive(Deserialize)]
struct HistoryQuery {
    limit: Option<i64>,
}

async fn api_stats_history(
    AxumState(state): AxumState<ServerState>,
    Query(q): Query<HistoryQuery>,
) -> axum::response::Response {
    let limit = q.limit.unwrap_or(100).min(1000);
    let conn = state.db.lock().unwrap();

    let mut stmt = match conn.prepare(
        "SELECT ph.track_id, t.title, t.artist, COALESCE(al.title,'') as album,
                ph.played_at, ph.listen_ms, ph.completed, ph.source
         FROM play_history ph
         JOIN tracks t ON t.id = ph.track_id
         LEFT JOIN albums al ON al.id = t.album_id
         ORDER BY ph.played_at DESC
         LIMIT ?1",
    ) {
        Ok(s) => s,
        Err(_) => return cors_server_error(),
    };

    let entries: Vec<PlayHistoryEntry> = match stmt.query_map(params![limit], |row| {
        Ok(PlayHistoryEntry {
            track_id:  row.get(0)?,
            title:     row.get(1)?,
            artist:    row.get(2)?,
            album:     row.get(3)?,
            played_at: row.get(4)?,
            listen_ms: row.get(5)?,
            completed: row.get::<_, i32>(6)? != 0,
            source:    row.get(7)?,
        })
    }).and_then(|rows| rows.collect()) {
        Ok(v) => v,
        Err(_) => return cors_server_error(),
    };

    cors_ok(&entries)
}

async fn api_stats_record(
    AxumState(state): AxumState<ServerState>,
    axum::extract::Json(body): axum::extract::Json<RecordPlayBody>,
) -> axum::response::Response {
    let conn = state.db.lock().unwrap();

    // Verify track exists
    let exists: bool = conn.query_row(
        "SELECT 1 FROM tracks WHERE id = ?1 AND removed_at IS NULL",
        params![body.track_id],
        |_| Ok(true),
    ).unwrap_or(false);

    if !exists {
        return cors_not_found();
    }

    let listen_ms  = body.listen_ms.unwrap_or(0);
    let completed  = body.completed.unwrap_or(false) as i32;
    let source     = body.source.unwrap_or_else(|| "mobile".to_string());

    let result = conn.execute(
        "INSERT INTO play_history (track_id, played_at, listen_ms, completed, source)
         VALUES (?1, strftime('%s','now')*1000, ?2, ?3, ?4)",
        params![body.track_id, listen_ms, completed, source],
    );

    if result.is_err() {
        return cors_server_error();
    }

    // Also update the tracks table play_count / last_played_at
    let _ = conn.execute(
        "UPDATE tracks SET play_count = play_count + 1, last_played_at = unixepoch() WHERE id = ?1",
        params![body.track_id],
    );

    axum::response::Response::builder()
        .status(StatusCode::CREATED)
        .header("Access-Control-Allow-Origin", "*")
        .body(Body::empty())
        .unwrap()
}

async fn api_library(
    AxumState(state): AxumState<ServerState>,
) -> axum::response::Response {
    let conn = state.db.lock().unwrap();

    let tracks: Vec<TrackSummary> = {
        let mut stmt = match conn.prepare(
            "SELECT t.id, t.title, t.artist, al.title, t.album_id, t.artist_id,
                    t.duration_secs, t.track_number, t.artwork_hash
             FROM tracks t
             LEFT JOIN albums al ON al.id = t.album_id
             WHERE t.removed_at IS NULL
             ORDER BY t.artist_sort, al.title_sort, t.disc_number, t.track_number",
        ) {
            Ok(s) => s,
            Err(_) => return cors_server_error(),
        };
        match stmt.query_map([], |row| {
            Ok(row_to_track_summary(
                row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?,
                row.get(4)?, row.get(5)?, row.get(6)?, row.get(7)?, row.get(8)?,
            ))
        }).and_then(|rows| rows.collect()) {
            Ok(v) => v,
            Err(_) => return cors_server_error(),
        }
    };

    let albums: Vec<AlbumSummary> = {
        let mut stmt = match conn.prepare(
            "SELECT al.id, al.title, ar.name, al.artist_id, al.year, al.track_count
             FROM albums al
             JOIN artists ar ON ar.id = al.artist_id
             ORDER BY al.title_sort",
        ) {
            Ok(s) => s,
            Err(_) => return cors_server_error(),
        };
        match stmt.query_map([], |row| {
            Ok(AlbumSummary {
                id:          row.get(0)?,
                title:       row.get(1)?,
                artist:      row.get(2)?,
                artist_id:   row.get(3)?,
                year:        row.get(4)?,
                track_count: row.get(5)?,
            })
        }).and_then(|rows| rows.collect()) {
            Ok(v) => v,
            Err(_) => return cors_server_error(),
        }
    };

    let artists: Vec<ArtistSummary> = {
        let mut stmt = match conn.prepare(
            "SELECT ar.id, ar.name,
                    COUNT(DISTINCT al.id) as album_count,
                    COUNT(DISTINCT t.id) as track_count
             FROM artists ar
             LEFT JOIN albums al ON al.artist_id = ar.id
             LEFT JOIN tracks t ON t.artist_id = ar.id AND t.removed_at IS NULL
             GROUP BY ar.id
             ORDER BY ar.name_sort",
        ) {
            Ok(s) => s,
            Err(_) => return cors_server_error(),
        };
        match stmt.query_map([], |row| {
            Ok(ArtistSummary {
                id:          row.get(0)?,
                name:        row.get(1)?,
                album_count: row.get(2)?,
                track_count: row.get(3)?,
            })
        }).and_then(|rows| rows.collect()) {
            Ok(v) => v,
            Err(_) => return cors_server_error(),
        }
    };

    let mut playlists: Vec<PlaylistSummary> = {
        let mut stmt = match conn.prepare(
            "SELECT p.id, p.name, COUNT(pt.id) as track_count
             FROM playlists p
             LEFT JOIN playlist_tracks pt ON pt.playlist_id = p.id
             GROUP BY p.id
             ORDER BY p.name COLLATE NOCASE",
        ) {
            Ok(s) => s,
            Err(_) => return cors_server_error(),
        };
        match stmt.query_map([], |row| {
            Ok(PlaylistSummary {
                id:          row.get(0)?,
                name:        row.get(1)?,
                track_count: row.get(2)?,
            })
        }).and_then(|rows| rows.collect()) {
            Ok(v) => v,
            Err(_) => return cors_server_error(),
        }
    };
    // Synthetic "Liked Songs" entry
    let liked_count: i32 = conn
        .query_row(
            "SELECT COUNT(*)
             FROM liked_tracks lt
             JOIN tracks t ON t.id = lt.track_id AND t.removed_at IS NULL",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);
    playlists.insert(0, PlaylistSummary {
        id:          "liked".to_string(),
        name:        "Liked Songs".to_string(),
        track_count: liked_count,
    });

    cors_ok(&LibrarySnapshot { tracks, albums, artists, playlists })
}

/// Preferred port for the LAN file server. Stable across restarts so the
/// mobile client can reconnect to the saved URL after the desktop reboots.
/// If something else is holding the port, fall back to a random one.
const PREFERRED_LAN_PORT: u16 = 47823;

/// Start the local HTTP file server and return the bound port.
/// Tries `PREFERRED_LAN_PORT` first for URL stability, then falls back to a
/// random port.
/// Sends on `shutdown_tx` when the server should stop.
pub async fn start_file_server(
    db: Arc<Mutex<Connection>>,
    app_data_dir: PathBuf,
) -> (u16, oneshot::Sender<()>) {
    let server_state = ServerState {
        db,
        server_addr:  Arc::new(Mutex::new(None)),
        app_data_dir,
    };

    let listener = match tokio::net::TcpListener::bind(
        format!("0.0.0.0:{}", PREFERRED_LAN_PORT)
    ).await {
        Ok(l) => l,
        Err(e) => {
            log::warn!(
                "[remote-stream] preferred port {} unavailable ({}); falling back to random",
                PREFERRED_LAN_PORT, e
            );
            tokio::net::TcpListener::bind("0.0.0.0:0")
                .await
                .expect("Failed to bind file server")
        }
    };
    let port = listener.local_addr().unwrap().port();

    if let Some(ip) = local_ip() {
        *server_state.server_addr.lock().unwrap() = Some(format!("http://{}:{}", ip, port));
    }

    let app = Router::new()
        .route("/track/:track_id", get(serve_track))
        .route("/stream/:track_id", get(serve_stream))
        .route("/playlist.m3u8", get(serve_playlist_m3u8))
        .route("/api/tracks", get(api_tracks))
        .route("/api/liked", get(api_liked))
        .route("/api/recent", get(api_recent))
        .route("/api/albums", get(api_albums))
        .route("/api/album/:id", get(api_album))
        .route("/api/artists", get(api_artists))
        .route("/api/artist/:id", get(api_artist))
        .route("/api/playlists", get(api_playlists))
        .route("/api/playlist/:id", get(api_playlist))
        .route("/api/search", get(api_search))
        .route("/api/artwork/:track_id", get(api_artwork))
        .route("/api/library.json", get(api_library))
        .route("/api/stats", get(api_stats_summary))
        .route("/api/stats/history", get(api_stats_history))
        .route("/api/stats/record", post(api_stats_record))
        .with_state(server_state);

    let (shutdown_tx, shutdown_rx) = oneshot::channel::<()>();

    tokio::spawn(async move {
        axum::serve(listener, app)
            .with_graceful_shutdown(async { let _ = shutdown_rx.await; })
            .await
            .ok();
    });

    (port, shutdown_tx)
}

// ─── Cast session (blocking, runs in std::thread) ─────────────────────────────

/// Connect to a Chromecast, launch Default Media Receiver, and load a URL.
/// `start_time_secs` > 0 tells the receiver to begin playback at that offset.
pub fn start_cast_session(device_host: &str, device_port: u16, media_url: &str, start_time_secs: f64) -> Result<(), String> {
    use rust_cast::CastDevice;
    use rust_cast::channels::receiver::CastDeviceApp;
    use rust_cast::channels::media::{Media, StreamType};

    // Chromecasts use self-signed TLS certificates; connect_without_host_verification
    // skips cert validation, which is required for all consumer Cast devices.
    let cast = CastDevice::connect_without_host_verification(device_host, device_port)
        .map_err(|e| format!("Connect failed: {e}"))?;

    // Protocol handshake
    cast.connection
        .connect("receiver-0")
        .map_err(|e| format!("Connection channel failed: {e}"))?;

    cast.heartbeat
        .ping()
        .map_err(|e| format!("Heartbeat ping failed: {e}"))?;

    // Launch the default media receiver
    let app = cast.receiver
        .launch_app(&CastDeviceApp::DefaultMediaReceiver)
        .map_err(|e| format!("Launch app failed: {e}"))?;

    cast.connection
        .connect(&app.transport_id)
        .map_err(|e| format!("Media connection failed: {e}"))?;

    // Infer content type from URL
    let content_type = if media_url.contains(".flac") { "audio/flac" }
        else if media_url.contains(".ogg") || media_url.contains(".opus") { "audio/ogg" }
        else if media_url.contains(".m4a") || media_url.contains(".aac") { "audio/mp4" }
        else if media_url.contains(".wav") { "audio/wav" }
        else { "audio/mpeg" };

    // Load the media
    let status = cast.media
        .load(
            &app.transport_id,
            &app.session_id,
            &Media {
                content_id:   media_url.to_string(),
                stream_type:  StreamType::Buffered,
                content_type: content_type.to_string(),
                metadata:     None,
                duration:     None,
            },
        )
        .map_err(|e| format!("Media load failed: {e}"))?;

    // Seek to the start offset after loading (the Cast protocol loads from 0 by default)
    if start_time_secs > 0.5 {
        if let Some(entry) = status.entries.first() {
            let _ = cast.media.seek(
                &app.transport_id,
                entry.media_session_id,
                Some(start_time_secs as f32),
                Some(rust_cast::channels::media::ResumeState::PlaybackStart),
            );
        }
    }

    Ok(())
}

/// Pause the currently playing media on a Chromecast.
pub fn cast_pause_media(device_host: &str, device_port: u16) -> Result<(), String> {
    use rust_cast::CastDevice;
    let cast = CastDevice::connect_without_host_verification(device_host, device_port)
        .map_err(|e| format!("Connect failed: {e}"))?;
    cast.connection.connect("receiver-0").map_err(|e| format!("Connection failed: {e}"))?;
    cast.heartbeat.ping().map_err(|e| format!("Ping failed: {e}"))?;
    let app = cast.receiver.get_status().map_err(|e| format!("Get status failed: {e}"))?
        .applications.into_iter().next()
        .ok_or_else(|| "No active app".to_string())?;
    cast.connection.connect(&app.transport_id).map_err(|e| format!("Media connect failed: {e}"))?;
    let status = cast.media.get_status(&app.transport_id, None)
        .map_err(|e| format!("Get media status failed: {e}"))?;
    let msid = status.entries.into_iter().next()
        .ok_or_else(|| "No active media session".to_string())?.media_session_id;
    cast.media.pause(&app.transport_id, msid).map_err(|e| format!("Pause failed: {e}"))?;
    Ok(())
}

/// Resume the paused media on a Chromecast.
pub fn cast_resume_media(device_host: &str, device_port: u16) -> Result<(), String> {
    use rust_cast::CastDevice;
    let cast = CastDevice::connect_without_host_verification(device_host, device_port)
        .map_err(|e| format!("Connect failed: {e}"))?;
    cast.connection.connect("receiver-0").map_err(|e| format!("Connection failed: {e}"))?;
    cast.heartbeat.ping().map_err(|e| format!("Ping failed: {e}"))?;
    let app = cast.receiver.get_status().map_err(|e| format!("Get status failed: {e}"))?
        .applications.into_iter().next()
        .ok_or_else(|| "No active app".to_string())?;
    cast.connection.connect(&app.transport_id).map_err(|e| format!("Media connect failed: {e}"))?;
    let status = cast.media.get_status(&app.transport_id, None)
        .map_err(|e| format!("Get media status failed: {e}"))?;
    let msid = status.entries.into_iter().next()
        .ok_or_else(|| "No active media session".to_string())?.media_session_id;
    cast.media.play(&app.transport_id, msid).map_err(|e| format!("Resume failed: {e}"))?;
    Ok(())
}

/// Seek to `position_secs` on a Chromecast.
pub fn cast_seek_media(device_host: &str, device_port: u16, position_secs: f64) -> Result<(), String> {
    use rust_cast::CastDevice;
    use rust_cast::channels::media::ResumeState;
    let cast = CastDevice::connect_without_host_verification(device_host, device_port)
        .map_err(|e| format!("Connect failed: {e}"))?;
    cast.connection.connect("receiver-0").map_err(|e| format!("Connection failed: {e}"))?;
    cast.heartbeat.ping().map_err(|e| format!("Ping failed: {e}"))?;
    let app = cast.receiver.get_status().map_err(|e| format!("Get status failed: {e}"))?
        .applications.into_iter().next()
        .ok_or_else(|| "No active app".to_string())?;
    cast.connection.connect(&app.transport_id).map_err(|e| format!("Media connect failed: {e}"))?;
    let status = cast.media.get_status(&app.transport_id, None)
        .map_err(|e| format!("Get media status failed: {e}"))?;
    let msid = status.entries.into_iter().next()
        .ok_or_else(|| "No active media session".to_string())?.media_session_id;
    cast.media.seek(&app.transport_id, msid, Some(position_secs as f32), Some(ResumeState::PlaybackStart))
        .map_err(|e| format!("Seek failed: {e}"))?;
    Ok(())
}

/// Send a Stop command to the Chromecast.
pub fn stop_cast_session(device_host: &str, device_port: u16) -> Result<(), String> {
    use rust_cast::CastDevice;

    let cast = CastDevice::connect_without_host_verification(device_host, device_port)
        .map_err(|e| format!("Connect failed: {e}"))?;

    cast.connection
        .connect("receiver-0")
        .map_err(|e| format!("Connection channel failed: {e}"))?;

    let session_id = cast.receiver
        .get_status()
        .map_err(|e| format!("Get status failed: {e}"))?
        .applications
        .into_iter()
        .next()
        .map(|a| a.session_id)
        .unwrap_or_default();

    if !session_id.is_empty() {
        cast.receiver
            .stop_app(&session_id)
            .map_err(|e| format!("Stop app failed: {e}"))?;
    }

    Ok(())
}

/// Return the first non-loopback LAN IPv4 address of this machine.
pub fn local_ip() -> Option<IpAddr> {
    local_ip_address::local_ip().ok()
}
