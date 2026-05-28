use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::SystemTime;
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use walkdir::WalkDir;
use lofty::prelude::*;
use lofty::probe::Probe;
use rusqlite::Connection;
use crate::error::{AppError, Result};
use crate::db::tracks::{TrackMetadata, upsert_track, soft_delete_track, get_active_file_paths, get_mtime};
use crate::db::artists::upsert_artist;
use crate::db::albums::{upsert_album, update_album_stats};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanResult {
    pub added: u32,
    pub updated: u32,
    pub removed: u32,
    pub skipped: u32,
    pub duration_ms: u64,
    pub errors: Vec<String>,
}

const SUPPORTED_EXTENSIONS: &[&str] = &[
    "flac", "alac", "m4a", "wav", "aiff", "aif",
    "wv", "ape", "dsf", "dff", "ogg", "opus", "mp3", "aac",
];

fn is_supported(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|e| SUPPORTED_EXTENSIONS.contains(&e.to_lowercase().as_str()))
        .unwrap_or(false)
}

fn detect_format(path: &Path) -> String {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
        .unwrap_or_else(|| "unknown".to_string())
}

fn get_mtime_secs(path: &Path) -> i64 {
    std::fs::metadata(path)
        .and_then(|m| m.modified())
        .map(|t| t.duration_since(SystemTime::UNIX_EPOCH).unwrap_or_default().as_secs() as i64)
        .unwrap_or(0)
}

fn extract_artwork(
    tagged_file: &lofty::file::TaggedFile,
    file_path: &Path,
    app_data_dir: &Path,
) -> Option<String> {
    let tag = tagged_file.primary_tag().or_else(|| tagged_file.first_tag())?;

    // Try embedded artwork first
    let picture_data: Option<Vec<u8>> = tag.pictures().first().map(|p| p.data().to_vec());

    // Try folder art if no embedded
    let art_bytes = picture_data.or_else(|| {
        let parent = file_path.parent()?;
        for name in &["cover.jpg", "cover.jpeg", "cover.png", "folder.jpg", "folder.jpeg"] {
            let candidate = parent.join(name);
            if candidate.exists() {
                return std::fs::read(candidate).ok();
            }
        }
        None
    })?;

    let hash = format!("{:x}", xxhash_rust::xxh3::xxh3_64(&art_bytes));
    let artwork_dir = app_data_dir.join("artwork");
    let _ = std::fs::create_dir_all(&artwork_dir);
    let dest = artwork_dir.join(format!("{}.jpg", hash));

    if dest.exists() {
        return Some(hash);
    }

    // Decode and resize to 300x300
    let img = image::load_from_memory(&art_bytes).ok()?;
    let thumb = img.thumbnail(300, 300);
    thumb.save_with_format(&dest, image::ImageFormat::Jpeg).ok()?;

    Some(hash)
}

pub struct ScanContext {
    pub db: Arc<Mutex<Connection>>,
    pub app_data_dir: PathBuf,
    pub force_rescan: bool,
}

pub async fn scan_library(
    ctx: Arc<ScanContext>,
    paths: Vec<String>,
    on_progress: impl Fn(u32, u32) + Send + 'static,
) -> Result<ScanResult> {
    let start = std::time::Instant::now();
    let mut all_files: Vec<PathBuf> = Vec::new();

    for root in &paths {
        for entry in WalkDir::new(root).follow_links(true).into_iter().flatten() {
            if entry.file_type().is_file() && is_supported(entry.path()) {
                all_files.push(entry.into_path());
            }
        }
    }

    let total = all_files.len() as u32;
    let mut added = 0u32;
    let mut updated = 0u32;
    let mut skipped = 0u32;
    let mut errors: Vec<String> = Vec::new();

    for (i, file_path) in all_files.iter().enumerate() {
        let path_str = match file_path.to_str() {
            Some(s) => s.to_string(),
            None => continue,
        };

        let current_mtime = get_mtime_secs(file_path);

        // Check if we need to process this file
        let needs_scan = {
            let conn = ctx.db.lock().unwrap();
            match get_mtime(&conn, &path_str) {
                Ok(Some(db_mtime)) => {
                    if !ctx.force_rescan && db_mtime == current_mtime {
                        skipped += 1;
                        if (i + 1) % 50 == 0 {
                            on_progress(i as u32 + 1, total);
                        }
                        false
                    } else {
                        true
                    }
                }
                Ok(None) => true,
                Err(_) => true,
            }
        };

        if !needs_scan {
            continue;
        }

        match process_file(file_path, &path_str, current_mtime, &ctx) {
            Ok(is_new) => {
                if is_new { added += 1; } else { updated += 1; }
            }
            Err(e) => {
                errors.push(format!("{}: {}", path_str, e));
            }
        }

        if (i + 1) % 50 == 0 {
            on_progress(i as u32 + 1, total);
        }
    }

    // Soft-delete tracks whose files no longer exist
    let removed = {
        let conn = ctx.db.lock().unwrap();
        let active_paths = get_active_file_paths(&conn)?;
        let mut removed_count = 0u32;
        for p in active_paths {
            if !Path::new(&p).exists() {
                let _ = soft_delete_track(&conn, &p);
                removed_count += 1;
            }
        }
        removed_count
    };

    Ok(ScanResult {
        added,
        updated,
        removed,
        skipped,
        duration_ms: start.elapsed().as_millis() as u64,
        errors,
    })
}

/// Exposed so the ID3 tag editor can do a targeted single-file rescan after
/// writing new tags, keeping all DB relationships (artist/album FKs) correct.
pub fn process_file(
    file_path: &Path,
    path_str: &str,
    mtime_secs: i64,
    ctx: &ScanContext,
) -> Result<bool> {
    let tagged = Probe::open(file_path)
        .map_err(|e| AppError::Scan(e.to_string()))?
        .guess_file_type()
        .map_err(|e| AppError::Scan(e.to_string()))?
        .read()
        .map_err(|e| AppError::Scan(e.to_string()))?;

    let tag = tagged.primary_tag().or_else(|| tagged.first_tag());

    let title = tag.and_then(|t| t.title().map(|s| s.to_string()))
        .unwrap_or_else(|| {
            file_path.file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("Unknown Title")
                .to_string()
        });

    let artist = tag.and_then(|t| t.artist().map(|s| s.to_string()))
        .unwrap_or_else(|| "Unknown Artist".to_string());

    let album_artist = tag.and_then(|t| t.get_string(&lofty::tag::ItemKey::AlbumArtist).map(|s| s.to_string()));

    let album_title = tag.and_then(|t| t.album().map(|s| s.to_string()));

    let track_number = tag.and_then(|t| t.track()).map(|n| n as i32);
    let disc_number = tag.and_then(|t| t.disk()).map(|n| n as i32);
    let year = tag.and_then(|t| t.year()).map(|n| n as i32);
    let genre = tag.and_then(|t| t.genre().map(|s| s.to_string()));

    let props = tagged.properties();
    let duration_secs = props.duration().as_secs_f64();
    let sample_rate = props.sample_rate().map(|r| r as i32);
    let bit_depth = props.bit_depth().map(|b| b as i32);
    let channels = props.channels().map(|c| c as i32);
    let bitrate_kbps = props.audio_bitrate().map(|b| b as i32);

    let format = detect_format(file_path);
    let file_size_bytes = std::fs::metadata(file_path).map(|m| m.len() as i64).unwrap_or(0);

    // Extract artwork
    let artwork_hash = extract_artwork(&tagged, file_path, &ctx.app_data_dir);

    // Build IDs
    let artist_key = artist.clone();
    let album_artist_for_album = album_artist.as_deref().unwrap_or(&artist);

    let conn = ctx.db.lock().unwrap();

    // Upsert artist
    let artist_id = get_or_create_artist_id(&conn, &artist_key)?;

    // Upsert album artist (may differ)
    let album_artist_id = get_or_create_artist_id(&conn, album_artist_for_album)?;

    // Upsert album
    let album_id = if let Some(ref album_name) = album_title {
        let al_id = get_or_create_album_id(&conn, album_name, &album_artist_id, year, artwork_hash.as_deref())?;
        Some(al_id)
    } else {
        None
    };

    // Check if track already exists
    let is_new = get_mtime(&conn, path_str)?.is_none();

    let track_id = {
        // Try to fetch existing ID
        match conn.query_row(
            "SELECT id FROM tracks WHERE file_path = ?1",
            rusqlite::params![path_str],
            |row| row.get::<_, String>(0),
        ) {
            Ok(id) => id,
            Err(rusqlite::Error::QueryReturnedNoRows) => Uuid::new_v4().to_string(),
            Err(e) => return Err(e.into()),
        }
    };

    let meta = TrackMetadata {
        id: track_id,
        file_path: path_str.to_string(),
        title,
        artist,
        album_artist,
        album_title,
        track_number,
        disc_number,
        year,
        genre,
        duration_secs,
        sample_rate,
        bit_depth,
        channels,
        bitrate_kbps,
        format,
        artwork_hash,
        file_size_bytes,
        mtime_secs,
        artist_id,
        album_id: album_id.clone(),
    };

    upsert_track(&conn, &meta)?;

    // Update album stats
    if let Some(ref al_id) = album_id {
        let _ = update_album_stats(&conn, al_id);
    }

    Ok(is_new)
}

fn get_or_create_artist_id(conn: &Connection, name: &str) -> Result<String> {
    match conn.query_row(
        "SELECT id FROM artists WHERE name = ?1",
        rusqlite::params![name],
        |row| row.get::<_, String>(0),
    ) {
        Ok(id) => Ok(id),
        Err(rusqlite::Error::QueryReturnedNoRows) => {
            let id = Uuid::new_v4().to_string();
            upsert_artist(conn, &id, name)?;
            Ok(id)
        }
        Err(e) => Err(e.into()),
    }
}

fn get_or_create_album_id(conn: &Connection, title: &str, artist_id: &str, year: Option<i32>, artwork_hash: Option<&str>) -> Result<String> {
    match conn.query_row(
        "SELECT id FROM albums WHERE title = ?1 AND artist_id = ?2",
        rusqlite::params![title, artist_id],
        |row| row.get::<_, String>(0),
    ) {
        Ok(id) => {
            let _ = upsert_album(conn, &id, title, artist_id, year, artwork_hash);
            Ok(id)
        }
        Err(rusqlite::Error::QueryReturnedNoRows) => {
            let id = Uuid::new_v4().to_string();
            upsert_album(conn, &id, title, artist_id, year, artwork_hash)?;
            Ok(id)
        }
        Err(e) => Err(e.into()),
    }
}
