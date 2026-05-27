use tauri::State;
use serde::{Deserialize, Serialize};
use crate::db::tracks::Track;
use crate::error::{AppError, Result};
use crate::state::AppState;

// ─── Types ────────────────────────────────────────────────────────────────────

/// Track enriched with the timestamp at which the user liked it.
/// Serialises flat (all Track fields + liked_at) thanks to serde(flatten).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LikedTrack {
    #[serde(flatten)]
    pub track: Track,
    pub liked_at: i64,
}

// ─── Commands ─────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn like_track(state: State<'_, AppState>, track_id: String) -> Result<()> {
    let conn = state.db.lock().unwrap();
    conn.execute(
        "INSERT OR IGNORE INTO liked_tracks (track_id) VALUES (?1)",
        rusqlite::params![track_id],
    )?;
    Ok(())
}

#[tauri::command]
pub async fn unlike_track(state: State<'_, AppState>, track_id: String) -> Result<()> {
    let conn = state.db.lock().unwrap();
    conn.execute(
        "DELETE FROM liked_tracks WHERE track_id = ?1",
        rusqlite::params![track_id],
    )?;
    Ok(())
}

/// Returns all liked track IDs — used by the UI to efficiently show the
/// heart-filled state on individual rows without a per-track query.
#[tauri::command]
pub async fn get_liked_track_ids(state: State<'_, AppState>) -> Result<Vec<String>> {
    let conn = state.db.lock().unwrap();
    let mut stmt = conn.prepare("SELECT track_id FROM liked_tracks")?;
    let ids = stmt
        .query_map([], |row| row.get(0))?
        .collect::<std::result::Result<Vec<String>, _>>()?;
    Ok(ids)
}

/// Returns liked tracks ordered by liked_at DESC, optionally filtered by genre.
/// `genre = None` → all liked tracks.
#[tauri::command]
pub async fn get_liked_tracks(
    state: State<'_, AppState>,
    genre: Option<String>,
) -> Result<Vec<LikedTrack>> {
    let conn = state.db.lock().unwrap();

    const COLS: &str =
        "t.id, t.file_path, t.title, t.artist, t.album_artist,
         t.album_id, a.title AS album_title, t.track_number, t.disc_number,
         t.year, t.genre, t.duration_secs, t.sample_rate, t.bit_depth,
         t.channels, t.bitrate_kbps, t.format, t.artwork_hash,
         t.play_count, t.last_played_at, lt.liked_at";

    const FROM: &str =
        "FROM liked_tracks lt
         JOIN tracks t  ON t.id = lt.track_id AND t.removed_at IS NULL
         LEFT JOIN albums a ON a.id = t.album_id";

    let map_row = |row: &rusqlite::Row| -> rusqlite::Result<LikedTrack> {
        Ok(LikedTrack {
            track: Track {
                id:             row.get(0)?,
                file_path:      row.get(1)?,
                title:          row.get(2)?,
                artist:         row.get(3)?,
                album_artist:   row.get(4)?,
                album_id:       row.get(5)?,
                album_title:    row.get(6)?,
                track_number:   row.get(7)?,
                disc_number:    row.get(8)?,
                year:           row.get(9)?,
                genre:          row.get(10)?,
                duration_secs:  row.get(11)?,
                sample_rate:    row.get(12)?,
                bit_depth:      row.get(13)?,
                channels:       row.get(14)?,
                bitrate_kbps:   row.get(15)?,
                format:         row.get(16)?,
                artwork_hash:   row.get(17)?,
                play_count:     row.get(18)?,
                last_played_at: row.get(19)?,
            },
            liked_at: row.get(20)?,
        })
    };

    // Build the query string first, then prepare + collect in one scope so the
    // borrowed `stmt` is never referenced after `collect()` completes.
    let sql = if genre.is_some() {
        format!("SELECT {COLS} {FROM} WHERE t.genre = ?1 ORDER BY lt.liked_at DESC")
    } else {
        format!("SELECT {COLS} {FROM} ORDER BY lt.liked_at DESC")
    };

    let mut stmt = conn.prepare(&sql)?;

    let items: Vec<LikedTrack> = if let Some(ref g) = genre {
        stmt.query_map(rusqlite::params![g], map_row)
    } else {
        stmt.query_map([], map_row)
    }?
    .collect::<std::result::Result<Vec<_>, _>>()?;

    Ok(items)
}

/// Returns the distinct genre values present in liked tracks (for filter pills).
#[tauri::command]
pub async fn get_liked_genres(state: State<'_, AppState>) -> Result<Vec<String>> {
    let conn = state.db.lock().unwrap();
    let mut stmt = conn.prepare(
        "SELECT DISTINCT t.genre
         FROM liked_tracks lt
         JOIN tracks t ON t.id = lt.track_id AND t.removed_at IS NULL
         WHERE t.genre IS NOT NULL
         ORDER BY t.genre COLLATE NOCASE",
    )?;
    let genres = stmt
        .query_map([], |row| row.get::<_, String>(0))?
        .collect::<std::result::Result<Vec<_>, _>>()?;
    Ok(genres)
}
