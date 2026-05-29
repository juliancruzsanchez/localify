use tauri::State;
use rusqlite::params;
use crate::error::{AppError, Result};
use crate::lyrics::{LyricLine, get_lyrics_for_track};
use crate::state::AppState;

/// Resolve lyrics for a track: checks for a sibling .lrc file first,
/// then falls back to lrclib.net. Returns null when no lyrics are available.
#[tauri::command]
pub async fn get_lyrics(
    track_id: String,
    state: State<'_, AppState>,
) -> Result<Option<Vec<LyricLine>>> {
    let (file_path, title, artist, album, duration_secs) = {
        let conn = state.db.lock().unwrap();
        conn.query_row(
            "SELECT t.file_path, t.title, t.artist,
                    COALESCE(al.title, ''), t.duration_secs
             FROM tracks t
             LEFT JOIN albums al ON al.id = t.album_id
             WHERE t.id = ?1 AND t.removed_at IS NULL",
            params![track_id],
            |row| Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, f64>(4)?,
            )),
        )
        .map_err(|_| AppError::NotFound(format!("Track {} not found", track_id)))?
    };

    Ok(get_lyrics_for_track(&file_path, &title, &artist, &album, duration_secs).await)
}
