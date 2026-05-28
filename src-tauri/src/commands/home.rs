use tauri::State;
use serde::{Deserialize, Serialize};
use crate::error::Result;
use crate::state::AppState;

/// A genre mix card shown on the Home screen.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenreMix {
    pub genre:        String,
    pub track_count:  i64,
    pub artwork_hash: Option<String>,
}

/// A single recently-played item shown on the Home screen.
/// `kind` is either `"album"` or `"playlist"` so the frontend
/// knows which route to navigate to.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecentItem {
    pub id:             String,
    pub kind:           String,          // "album" | "playlist"
    pub title:          String,
    pub subtitle:       String,          // artist name or "N tracks"
    pub artwork_hash:   Option<String>,
    pub last_played_at: i64,
}

#[tauri::command]
pub async fn get_recently_played(
    state: State<'_, AppState>,
    limit: Option<u32>,
) -> Result<Vec<RecentItem>> {
    let n = limit.unwrap_or(8).min(32) as i64;
    let conn = state.db.lock().unwrap();

    // Albums with at least one played track, ordered by most-recently-played track.
    // Playlists: use the most-recently-played track that is in the playlist.
    // Both branches are UNIONed and sorted together.
    let mut stmt = conn.prepare(
        "SELECT id, kind, title, subtitle, artwork_hash, latest
         FROM (
             -- ── Albums ──────────────────────────────────────────────────
             SELECT
                 a.id,
                 'album'  AS kind,
                 a.title,
                 ar.name  AS subtitle,
                 COALESCE(
                     a.artwork_hash,
                     ( SELECT t2.artwork_hash
                       FROM   tracks t2
                       WHERE  t2.album_id = a.id
                         AND  t2.artwork_hash IS NOT NULL
                       LIMIT  1 )
                 ) AS artwork_hash,
                 MAX(t.last_played_at) AS latest
             FROM   albums  a
             JOIN   artists ar ON ar.id = a.artist_id
             JOIN   tracks  t  ON t.album_id = a.id
                               AND t.removed_at IS NULL
                               AND t.last_played_at IS NOT NULL
             GROUP  BY a.id

             UNION ALL

             -- ── Playlists ────────────────────────────────────────────────
             SELECT
                 p.id,
                 'playlist' AS kind,
                 p.name,
                 (COUNT(DISTINCT pt.id) || ' tracks') AS subtitle,
                 ( SELECT t2.artwork_hash
                   FROM   playlist_tracks pt2
                   JOIN   tracks t2 ON t2.id = pt2.track_id
                   WHERE  pt2.playlist_id = p.id
                     AND  t2.artwork_hash IS NOT NULL
                   LIMIT  1 ) AS artwork_hash,
                 MAX(t.last_played_at) AS latest
             FROM   playlists p
             JOIN   playlist_tracks pt ON pt.playlist_id = p.id
             JOIN   tracks t ON t.id = pt.track_id
                             AND t.removed_at IS NULL
                             AND t.last_played_at IS NOT NULL
             GROUP  BY p.id
         )
         ORDER  BY latest DESC
         LIMIT  ?1",
    )?;

    let items = stmt
        .query_map(rusqlite::params![n], |row| {
            Ok(RecentItem {
                id:             row.get(0)?,
                kind:           row.get(1)?,
                title:          row.get(2)?,
                subtitle:       row.get(3)?,
                artwork_hash:   row.get(4)?,
                last_played_at: row.get(5)?,
            })
        })?
        .collect::<std::result::Result<Vec<_>, _>>()?;

    Ok(items)
}

/// Returns genres that have at least 3 tracks, sorted by track count descending.
/// Includes a representative artwork_hash for display.
#[tauri::command]
pub async fn get_genre_mixes(
    state: State<'_, AppState>,
) -> Result<Vec<GenreMix>> {
    let conn = state.db.lock().unwrap();

    let mut stmt = conn.prepare(
        "SELECT
             t.genre,
             COUNT(*) AS track_count,
             (SELECT t2.artwork_hash
              FROM   tracks t2
              WHERE  t2.genre = t.genre
                AND  t2.artwork_hash IS NOT NULL
                AND  t2.removed_at  IS NULL
              LIMIT  1) AS artwork_hash
         FROM   tracks t
         WHERE  t.genre      IS NOT NULL
           AND  t.removed_at IS NULL
         GROUP  BY t.genre
         HAVING track_count >= 3
         ORDER  BY track_count DESC
         LIMIT  20",
    )?;

    let mixes = stmt
        .query_map([], |row| {
            Ok(GenreMix {
                genre:        row.get(0)?,
                track_count:  row.get(1)?,
                artwork_hash: row.get(2)?,
            })
        })?
        .collect::<std::result::Result<Vec<_>, _>>()?;

    Ok(mixes)
}
