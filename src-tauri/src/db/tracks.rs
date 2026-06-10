use rusqlite::{Connection, params};
use serde::{Deserialize, Serialize};
use crate::error::{AppError, Result};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Track {
    pub id: String,
    pub file_path: String,
    pub title: String,
    pub artist: String,
    pub album_artist: Option<String>,
    pub artist_id: Option<String>,
    pub album_id: Option<String>,
    pub album_title: Option<String>,
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

pub struct TrackMetadata {
    pub id: String,
    pub file_path: String,
    pub title: String,
    pub artist: String,
    pub album_artist: Option<String>,
    #[allow(dead_code)]
    pub album_title: Option<String>,
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
    pub file_size_bytes: i64,
    pub mtime_secs: i64,
    pub artist_id: String,
    pub album_id: Option<String>,
}

pub fn get_all_tracks(conn: &Connection) -> Result<Vec<Track>> {
    let mut stmt = conn.prepare(
        "SELECT t.id, t.file_path, t.title, t.artist, t.album_artist,
                t.artist_id, t.album_id, a.title as album_title, t.track_number, t.disc_number,
                t.year, t.genre, t.duration_secs, t.sample_rate, t.bit_depth,
                t.channels, t.bitrate_kbps, t.format, t.artwork_hash,
                t.play_count, t.last_played_at
         FROM tracks t
         LEFT JOIN albums a ON t.album_id = a.id
         WHERE t.removed_at IS NULL
         ORDER BY t.artist_sort, a.title_sort, t.disc_number, t.track_number"
    )?;

    let tracks = stmt.query_map([], |row| {
        Ok(Track {
            id: row.get(0)?,
            file_path: row.get(1)?,
            title: row.get(2)?,
            artist: row.get(3)?,
            album_artist: row.get(4)?,
            artist_id: row.get(5)?,
            album_id: row.get(6)?,
            album_title: row.get(7)?,
            track_number: row.get(8)?,
            disc_number: row.get(9)?,
            year: row.get(10)?,
            genre: row.get(11)?,
            duration_secs: row.get(12)?,
            sample_rate: row.get(13)?,
            bit_depth: row.get(14)?,
            channels: row.get(15)?,
            bitrate_kbps: row.get(16)?,
            format: row.get(17)?,
            artwork_hash: row.get(18)?,
            play_count: row.get(19)?,
            last_played_at: row.get(20)?,
        })
    })?
    .collect::<std::result::Result<Vec<_>, _>>()?;

    Ok(tracks)
}

pub fn get_track_by_id(conn: &Connection, id: &str) -> Result<Track> {
    let mut stmt = conn.prepare(
        "SELECT t.id, t.file_path, t.title, t.artist, t.album_artist,
                t.artist_id, t.album_id, a.title as album_title, t.track_number, t.disc_number,
                t.year, t.genre, t.duration_secs, t.sample_rate, t.bit_depth,
                t.channels, t.bitrate_kbps, t.format, t.artwork_hash,
                t.play_count, t.last_played_at
         FROM tracks t
         LEFT JOIN albums a ON t.album_id = a.id
         WHERE t.id = ?1 AND t.removed_at IS NULL"
    )?;

    stmt.query_row(params![id], |row| {
        Ok(Track {
            id: row.get(0)?,
            file_path: row.get(1)?,
            title: row.get(2)?,
            artist: row.get(3)?,
            album_artist: row.get(4)?,
            artist_id: row.get(5)?,
            album_id: row.get(6)?,
            album_title: row.get(7)?,
            track_number: row.get(8)?,
            disc_number: row.get(9)?,
            year: row.get(10)?,
            genre: row.get(11)?,
            duration_secs: row.get(12)?,
            sample_rate: row.get(13)?,
            bit_depth: row.get(14)?,
            channels: row.get(15)?,
            bitrate_kbps: row.get(16)?,
            format: row.get(17)?,
            artwork_hash: row.get(18)?,
            play_count: row.get(19)?,
            last_played_at: row.get(20)?,
        })
    })
    .map_err(|e| match e {
        rusqlite::Error::QueryReturnedNoRows => AppError::NotFound(format!("Track {id} not found")),
        e => e.into(),
    })
}

pub fn get_tracks_by_album(conn: &Connection, album_id: &str) -> Result<Vec<Track>> {
    let mut stmt = conn.prepare(
        "SELECT t.id, t.file_path, t.title, t.artist, t.album_artist,
                t.artist_id, t.album_id, a.title as album_title, t.track_number, t.disc_number,
                t.year, t.genre, t.duration_secs, t.sample_rate, t.bit_depth,
                t.channels, t.bitrate_kbps, t.format, t.artwork_hash,
                t.play_count, t.last_played_at
         FROM tracks t
         LEFT JOIN albums a ON t.album_id = a.id
         WHERE t.album_id = ?1 AND t.removed_at IS NULL
         ORDER BY t.disc_number, t.track_number"
    )?;

    let tracks = stmt.query_map(params![album_id], |row| {
        Ok(Track {
            id: row.get(0)?,
            file_path: row.get(1)?,
            title: row.get(2)?,
            artist: row.get(3)?,
            album_artist: row.get(4)?,
            artist_id: row.get(5)?,
            album_id: row.get(6)?,
            album_title: row.get(7)?,
            track_number: row.get(8)?,
            disc_number: row.get(9)?,
            year: row.get(10)?,
            genre: row.get(11)?,
            duration_secs: row.get(12)?,
            sample_rate: row.get(13)?,
            bit_depth: row.get(14)?,
            channels: row.get(15)?,
            bitrate_kbps: row.get(16)?,
            format: row.get(17)?,
            artwork_hash: row.get(18)?,
            play_count: row.get(19)?,
            last_played_at: row.get(20)?,
        })
    })?
    .collect::<std::result::Result<Vec<_>, _>>()?;

    Ok(tracks)
}

pub fn increment_play_count(conn: &Connection, track_id: &str) -> Result<()> {
    conn.execute(
        "UPDATE tracks SET play_count = play_count + 1, last_played_at = unixepoch() WHERE id = ?1",
        params![track_id],
    )?;
    Ok(())
}

pub fn get_mtime(conn: &Connection, file_path: &str) -> Result<Option<i64>> {
    let result = conn.query_row(
        "SELECT mtime_secs FROM tracks WHERE file_path = ?1 AND removed_at IS NULL",
        params![file_path],
        |row| row.get::<_, i64>(0),
    );
    match result {
        Ok(v) => Ok(Some(v)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.into()),
    }
}

pub fn upsert_track(conn: &Connection, meta: &TrackMetadata) -> Result<()> {
    conn.execute(
        "INSERT INTO tracks (id, file_path, title, title_sort, artist, artist_sort, album_artist,
                             artist_id, album_id, track_number, disc_number, year, genre, duration_secs,
                             sample_rate, bit_depth, channels, bitrate_kbps, format, artwork_hash,
                             file_size_bytes, mtime_secs)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22)
         ON CONFLICT(file_path) DO UPDATE SET
             title = excluded.title,
             title_sort = excluded.title_sort,
             artist = excluded.artist,
             artist_sort = excluded.artist_sort,
             album_artist = excluded.album_artist,
             artist_id = excluded.artist_id,
             album_id = excluded.album_id,
             track_number = excluded.track_number,
             disc_number = excluded.disc_number,
             year = excluded.year,
             genre = excluded.genre,
             duration_secs = excluded.duration_secs,
             sample_rate = excluded.sample_rate,
             bit_depth = excluded.bit_depth,
             channels = excluded.channels,
             bitrate_kbps = excluded.bitrate_kbps,
             format = excluded.format,
             artwork_hash = excluded.artwork_hash,
             file_size_bytes = excluded.file_size_bytes,
             mtime_secs = excluded.mtime_secs,
             removed_at = NULL,
             updated_at = unixepoch()",
        params![
            meta.id,
            meta.file_path,
            meta.title,
            meta.title.to_lowercase(),
            meta.artist,
            meta.artist.to_lowercase(),
            meta.album_artist,
            meta.artist_id,
            meta.album_id,
            meta.track_number,
            meta.disc_number,
            meta.year,
            meta.genre,
            meta.duration_secs,
            meta.sample_rate,
            meta.bit_depth,
            meta.channels,
            meta.bitrate_kbps,
            meta.format,
            meta.artwork_hash,
            meta.file_size_bytes,
            meta.mtime_secs,
        ],
    )?;
    Ok(())
}

pub fn soft_delete_track(conn: &Connection, file_path: &str) -> Result<()> {
    conn.execute(
        "UPDATE tracks SET removed_at = unixepoch() WHERE file_path = ?1",
        params![file_path],
    )?;
    Ok(())
}

pub fn get_active_file_paths(conn: &Connection) -> Result<Vec<String>> {
    let mut stmt = conn.prepare(
        "SELECT file_path FROM tracks WHERE removed_at IS NULL"
    )?;
    let paths = stmt.query_map([], |row| row.get(0))?
        .collect::<std::result::Result<Vec<_>, _>>()?;
    Ok(paths)
}
