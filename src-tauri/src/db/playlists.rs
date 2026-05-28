use rusqlite::{Connection, params};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use crate::error::{AppError, Result};
use super::tracks::Track;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Playlist {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub cover_path: Option<String>,
    pub track_count: i32,
    pub duration_secs: f64,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlaylistTrack {
    pub id: String,
    pub playlist_id: String,
    pub track_id: String,
    pub position: f64,
    pub track: Track,
}

pub fn get_all_playlists(conn: &Connection) -> Result<Vec<Playlist>> {
    let mut stmt = conn.prepare(
        "SELECT p.id, p.name, p.description, p.cover_path,
                COUNT(pt.id) as track_count,
                COALESCE(SUM(t.duration_secs), 0) as duration_secs,
                p.created_at, p.updated_at
         FROM playlists p
         LEFT JOIN playlist_tracks pt ON pt.playlist_id = p.id
         LEFT JOIN tracks t ON t.id = pt.track_id AND t.removed_at IS NULL
         GROUP BY p.id
         ORDER BY p.name COLLATE NOCASE"
    )?;

    let playlists = stmt.query_map([], |row| {
        Ok(Playlist {
            id: row.get(0)?,
            name: row.get(1)?,
            description: row.get(2)?,
            cover_path: row.get(3)?,
            track_count: row.get(4)?,
            duration_secs: row.get(5)?,
            created_at: row.get(6)?,
            updated_at: row.get(7)?,
        })
    })?
    .collect::<std::result::Result<Vec<_>, _>>()?;

    Ok(playlists)
}

pub fn get_playlist_by_id(conn: &Connection, id: &str) -> Result<Playlist> {
    conn.query_row(
        "SELECT p.id, p.name, p.description, p.cover_path,
                COUNT(pt.id) as track_count,
                COALESCE(SUM(t.duration_secs), 0) as duration_secs,
                p.created_at, p.updated_at
         FROM playlists p
         LEFT JOIN playlist_tracks pt ON pt.playlist_id = p.id
         LEFT JOIN tracks t ON t.id = pt.track_id AND t.removed_at IS NULL
         WHERE p.id = ?1
         GROUP BY p.id",
        params![id],
        |row| {
            Ok(Playlist {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                cover_path: row.get(3)?,
                track_count: row.get(4)?,
                duration_secs: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        },
    )
    .map_err(|e| match e {
        rusqlite::Error::QueryReturnedNoRows => AppError::NotFound(format!("Playlist {id} not found")),
        e => e.into(),
    })
}

pub fn create_playlist(conn: &Connection, name: &str, description: Option<&str>) -> Result<Playlist> {
    let id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO playlists (id, name, description) VALUES (?1, ?2, ?3)",
        params![id, name, description],
    )?;
    get_playlist_by_id(conn, &id)
}

pub fn update_playlist(conn: &Connection, id: &str, name: &str, description: Option<&str>) -> Result<Playlist> {
    let rows = conn.execute(
        "UPDATE playlists SET name = ?1, description = ?2, updated_at = unixepoch() WHERE id = ?3",
        params![name, description, id],
    )?;
    if rows == 0 {
        return Err(AppError::NotFound(format!("Playlist {id} not found")));
    }
    get_playlist_by_id(conn, id)
}

pub fn delete_playlist(conn: &Connection, id: &str) -> Result<()> {
    conn.execute("DELETE FROM playlists WHERE id = ?1", params![id])?;
    Ok(())
}

pub fn get_playlist_tracks(conn: &Connection, playlist_id: &str) -> Result<Vec<PlaylistTrack>> {
    let mut stmt = conn.prepare(
        "SELECT pt.id, pt.playlist_id, pt.track_id, pt.position,
                t.id, t.file_path, t.title, t.artist, t.album_artist,
                t.artist_id, t.album_id, al.title as album_title, t.track_number, t.disc_number,
                t.year, t.genre, t.duration_secs, t.sample_rate, t.bit_depth,
                t.channels, t.bitrate_kbps, t.format, t.artwork_hash,
                t.play_count, t.last_played_at
         FROM playlist_tracks pt
         JOIN tracks t ON t.id = pt.track_id
         LEFT JOIN albums al ON al.id = t.album_id
         WHERE pt.playlist_id = ?1 AND t.removed_at IS NULL
         ORDER BY pt.position"
    )?;

    let rows = stmt.query_map(params![playlist_id], |row| {
        Ok(PlaylistTrack {
            id: row.get(0)?,
            playlist_id: row.get(1)?,
            track_id: row.get(2)?,
            position: row.get(3)?,
            track: Track {
                id: row.get(4)?,
                file_path: row.get(5)?,
                title: row.get(6)?,
                artist: row.get(7)?,
                album_artist: row.get(8)?,
                artist_id: row.get(9)?,
                album_id: row.get(10)?,
                album_title: row.get(11)?,
                track_number: row.get(12)?,
                disc_number: row.get(13)?,
                year: row.get(14)?,
                genre: row.get(15)?,
                duration_secs: row.get(16)?,
                sample_rate: row.get(17)?,
                bit_depth: row.get(18)?,
                channels: row.get(19)?,
                bitrate_kbps: row.get(20)?,
                format: row.get(21)?,
                artwork_hash: row.get(22)?,
                play_count: row.get(23)?,
                last_played_at: row.get(24)?,
            },
        })
    })?
    .collect::<std::result::Result<Vec<_>, _>>()?;

    Ok(rows)
}

pub fn add_track_to_playlist(conn: &Connection, playlist_id: &str, track_id: &str) -> Result<PlaylistTrack> {
    let id = Uuid::new_v4().to_string();
    // Get next position
    let max_pos: f64 = conn.query_row(
        "SELECT COALESCE(MAX(position), 0.0) FROM playlist_tracks WHERE playlist_id = ?1",
        params![playlist_id],
        |row| row.get(0),
    )?;
    let position = max_pos + 1.0;

    conn.execute(
        "INSERT INTO playlist_tracks (id, playlist_id, track_id, position) VALUES (?1, ?2, ?3, ?4)",
        params![id, playlist_id, track_id, position],
    )?;

    // Update playlist updated_at
    conn.execute(
        "UPDATE playlists SET updated_at = unixepoch() WHERE id = ?1",
        params![playlist_id],
    )?;

    // Fetch the new row
    let tracks = get_playlist_tracks(conn, playlist_id)?;
    tracks.into_iter().find(|pt| pt.id == id)
        .ok_or_else(|| AppError::NotFound("Playlist track not found after insert".to_string()))
}

pub fn remove_track_from_playlist(conn: &Connection, entry_id: &str) -> Result<()> {
    conn.execute("DELETE FROM playlist_tracks WHERE id = ?1", params![entry_id])?;
    Ok(())
}

pub fn reorder_playlist_track(conn: &Connection, entry_id: &str, new_position: f64) -> Result<()> {
    conn.execute(
        "UPDATE playlist_tracks SET position = ?1 WHERE id = ?2",
        params![new_position, entry_id],
    )?;

    // Check if we need to renormalize
    let playlist_id: String = conn.query_row(
        "SELECT playlist_id FROM playlist_tracks WHERE id = ?1",
        params![entry_id],
        |row| row.get(0),
    )?;

    // Check minimum gap
    let min_gap: f64 = conn.query_row(
        "SELECT COALESCE(MIN(b.position - a.position), 1.0)
         FROM playlist_tracks a
         JOIN playlist_tracks b ON b.playlist_id = a.playlist_id AND b.position > a.position
         WHERE a.playlist_id = ?1",
        params![playlist_id],
        |row| row.get(0),
    ).unwrap_or(1.0);

    if min_gap < 1e-9 {
        renormalize_playlist_positions(conn, &playlist_id)?;
    }

    Ok(())
}

/// Persist the stored cover-image path (already processed & copied to app-data dir).
/// Pass `None` to clear the custom cover.
pub fn set_playlist_cover(conn: &Connection, id: &str, cover_path: Option<&str>) -> Result<Playlist> {
    let rows = conn.execute(
        "UPDATE playlists SET cover_path = ?1, updated_at = unixepoch() WHERE id = ?2",
        params![cover_path, id],
    )?;
    if rows == 0 {
        return Err(AppError::NotFound(format!("Playlist {id} not found")));
    }
    get_playlist_by_id(conn, id)
}

pub fn renormalize_playlist_positions(conn: &Connection, playlist_id: &str) -> Result<()> {
    let mut stmt = conn.prepare(
        "SELECT id FROM playlist_tracks WHERE playlist_id = ?1 ORDER BY position"
    )?;
    let ids: Vec<String> = stmt.query_map(params![playlist_id], |row| row.get(0))?
        .collect::<std::result::Result<Vec<_>, _>>()?;

    for (i, id) in ids.iter().enumerate() {
        conn.execute(
            "UPDATE playlist_tracks SET position = ?1 WHERE id = ?2",
            params![(i + 1) as f64, id],
        )?;
    }
    Ok(())
}
