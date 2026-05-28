/// ID3 / tag editor commands.
///
/// `get_track_tags` — reads current tag values straight from the audio file.
///
/// `update_track_tags` — writes new tags to the file **and** runs a targeted
/// single-file rescan through the scanner pipeline so all DB relationships are
/// kept correct:
///   • artist name change → `artists` table updated, `artist_id` FK relinked
///   • album title change → `albums` table updated, `album_id` FK relinked
///   • album stats (track_count, duration_secs) recalculated for old + new albums
///
/// Returns the fully refreshed `Track` row so the frontend can patch the player
/// store and any open detail pages without an extra round-trip.

use std::sync::Arc;
use tauri::State;
use serde::{Deserialize, Serialize};
use lofty::prelude::*;
use lofty::probe::Probe;
use lofty::config::WriteOptions;
use rusqlite::params;

use crate::error::{AppError, Result};
use crate::state::AppState;
use crate::db::tracks::get_track_by_id;
use crate::db::albums::update_album_stats;
use crate::scanner::scan::{ScanContext, process_file};

// ─── Tag snapshot ─────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrackTags {
    pub title:        String,
    pub artist:       String,
    pub album_artist: Option<String>,
    pub album:        Option<String>,
    pub year:         Option<u32>,
    pub track_number: Option<u32>,
    pub disc_number:  Option<u32>,
    pub genre:        Option<String>,
    pub comment:      Option<String>,
}

// ─── Commands ─────────────────────────────────────────────────────────────────

/// Read the current tag values straight from the audio file (not from the DB).
#[tauri::command]
pub async fn get_track_tags(file_path: String) -> Result<TrackTags> {
    let tagged = Probe::open(&file_path)
        .map_err(|e| AppError::Io(e.to_string()))?
        .read()
        .map_err(|e| AppError::Io(e.to_string()))?;

    let tag = tagged
        .primary_tag()
        .or_else(|| tagged.first_tag())
        .ok_or_else(|| AppError::NotFound(format!("No tags found in {file_path}")))?;

    Ok(TrackTags {
        title:        tag.title().map(|s| s.to_string()).unwrap_or_default(),
        artist:       tag.artist().map(|s| s.to_string()).unwrap_or_default(),
        album_artist: tag.get_string(&ItemKey::AlbumArtist).map(|s| s.to_string()),
        album:        tag.album().map(|s| s.to_string()),
        year:         tag.year(),
        track_number: tag.track(),
        disc_number:  tag.disk(),
        genre:        tag.genre().map(|s| s.to_string()),
        comment:      tag.comment().map(|s| s.to_string()),
    })
}

/// Write new tag values to the audio file, run a targeted single-file rescan
/// through the scanner pipeline so all DB relationships stay correct (artist/
/// album tables updated, FKs relinked, stats recalculated), and return the
/// refreshed `Track` row for live UI updates.
#[tauri::command]
pub async fn update_track_tags(
    state:    State<'_, AppState>,
    track_id: String,
    tags:     TrackTags,
) -> Result<crate::db::tracks::Track> {
    // 1. Grab file path AND old album_id (for old-album stat refresh)
    let (file_path, old_album_id) = {
        let conn = state.db.lock().unwrap();
        conn.query_row(
            "SELECT file_path, album_id FROM tracks WHERE id = ?1",
            params![track_id],
            |row| Ok((row.get::<_, String>(0)?, row.get::<_, Option<String>>(1)?)),
        )
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => AppError::NotFound(format!("Track {track_id}")),
            e => e.into(),
        })?
    };

    // 2. Read + mutate tags
    let mut tagged = Probe::open(&file_path)
        .map_err(|e| AppError::Io(e.to_string()))?
        .read()
        .map_err(|e| AppError::Io(e.to_string()))?;

    {
        let has_primary = tagged.primary_tag().is_some();
        let tag = if has_primary {
            tagged.primary_tag_mut().unwrap()
        } else {
            tagged
                .first_tag_mut()
                .ok_or_else(|| AppError::Io(format!("File has no writable tag: {file_path}")))?
        };

        tag.set_title(tags.title.clone());
        tag.set_artist(tags.artist.clone());
        set_or_remove(tag, &ItemKey::AlbumArtist, tags.album_artist.as_deref());
        set_or_remove(tag, &ItemKey::AlbumTitle,  tags.album.as_deref());
        set_or_remove(tag, &ItemKey::Genre,       tags.genre.as_deref());
        set_or_remove(tag, &ItemKey::Comment,     tags.comment.as_deref());

        if let Some(y) = tags.year         { tag.set_year(y);  } else { tag.remove_key(&ItemKey::Year); }
        if let Some(n) = tags.track_number { tag.set_track(n); } else { tag.remove_key(&ItemKey::TrackNumber); }
        if let Some(d) = tags.disc_number  { tag.set_disk(d);  } else { tag.remove_key(&ItemKey::DiscNumber);  }
    }

    // 3. Flush tags to disk
    tagged
        .save_to_path(&file_path, WriteOptions::default())
        .map_err(|e| AppError::Io(format!("Failed to write tags to {file_path}: {e}")))?;

    // 4. Single-file rescan — re-reads the now-updated file, upserts artists/
    //    albums, re-links all FKs, recalculates new album stats.
    let fp_str  = file_path.clone();
    let fp_path = std::path::PathBuf::from(&file_path);
    let mtime: i64 = std::fs::metadata(&fp_path)
        .and_then(|m| m.modified())
        .map(|t| t.duration_since(std::time::SystemTime::UNIX_EPOCH).unwrap_or_default().as_secs() as i64)
        .unwrap_or(0);

    let ctx = Arc::new(ScanContext {
        db:           state.db.clone(),
        app_data_dir: state.app_data_dir.clone(),
        force_rescan: true,
    });

    tokio::task::spawn_blocking(move || process_file(&fp_path, &fp_str, mtime, &ctx))
        .await
        .map_err(|e| AppError::Io(e.to_string()))??;

    // 5. Refresh stats for the *old* album (now has one fewer / different track)
    if let Some(ref old_id) = old_album_id {
        let conn = state.db.lock().unwrap();
        let _ = update_album_stats(&conn, old_id);
    }

    // 6. Return the freshly-scanned track for the frontend
    let conn = state.db.lock().unwrap();
    get_track_by_id(&conn, &track_id)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

fn set_or_remove(tag: &mut lofty::tag::Tag, key: &ItemKey, value: Option<&str>) {
    match value {
        Some(v) if !v.is_empty() => {
            tag.insert_text(key.clone(), v.to_string());
        }
        _ => {
            tag.remove_key(key);
        }
    }
}
