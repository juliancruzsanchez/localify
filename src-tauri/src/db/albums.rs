use rusqlite::{Connection, params};
use serde::{Deserialize, Serialize};
use crate::error::{AppError, Result};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Album {
    pub id: String,
    pub title: String,
    pub artist_id: String,
    pub artist_name: String,
    pub year: Option<i32>,
    pub artwork_hash: Option<String>,
    pub track_count: i32,
    pub duration_secs: f64,
}

pub fn get_all_albums(conn: &Connection) -> Result<Vec<Album>> {
    let mut stmt = conn.prepare(
        "SELECT al.id, al.title, al.artist_id, ar.name,
                al.year, al.artwork_hash, al.track_count, al.duration_secs
         FROM albums al
         JOIN artists ar ON al.artist_id = ar.id
         ORDER BY al.title_sort"
    )?;

    let albums = stmt.query_map([], |row| {
        Ok(Album {
            id: row.get(0)?,
            title: row.get(1)?,
            artist_id: row.get(2)?,
            artist_name: row.get(3)?,
            year: row.get(4)?,
            artwork_hash: row.get(5)?,
            track_count: row.get(6)?,
            duration_secs: row.get(7)?,
        })
    })?
    .collect::<std::result::Result<Vec<_>, _>>()?;

    Ok(albums)
}

pub fn get_album_by_id(conn: &Connection, id: &str) -> Result<Album> {
    conn.query_row(
        "SELECT al.id, al.title, al.artist_id, ar.name,
                al.year, al.artwork_hash, al.track_count, al.duration_secs
         FROM albums al
         JOIN artists ar ON al.artist_id = ar.id
         WHERE al.id = ?1",
        params![id],
        |row| {
            Ok(Album {
                id: row.get(0)?,
                title: row.get(1)?,
                artist_id: row.get(2)?,
                artist_name: row.get(3)?,
                year: row.get(4)?,
                artwork_hash: row.get(5)?,
                track_count: row.get(6)?,
                duration_secs: row.get(7)?,
            })
        },
    )
    .map_err(|e| match e {
        rusqlite::Error::QueryReturnedNoRows => AppError::NotFound(format!("Album {id} not found")),
        e => e.into(),
    })
}

pub fn get_albums_by_artist(conn: &Connection, artist_id: &str) -> Result<Vec<Album>> {
    let mut stmt = conn.prepare(
        "SELECT al.id, al.title, al.artist_id, ar.name,
                al.year, al.artwork_hash, al.track_count, al.duration_secs
         FROM albums al
         JOIN artists ar ON al.artist_id = ar.id
         WHERE al.artist_id = ?1
         ORDER BY al.year DESC, al.title_sort"
    )?;

    let albums = stmt.query_map(params![artist_id], |row| {
        Ok(Album {
            id: row.get(0)?,
            title: row.get(1)?,
            artist_id: row.get(2)?,
            artist_name: row.get(3)?,
            year: row.get(4)?,
            artwork_hash: row.get(5)?,
            track_count: row.get(6)?,
            duration_secs: row.get(7)?,
        })
    })?
    .collect::<std::result::Result<Vec<_>, _>>()?;

    Ok(albums)
}

pub fn upsert_album(conn: &Connection, id: &str, title: &str, artist_id: &str, year: Option<i32>, artwork_hash: Option<&str>) -> Result<()> {
    conn.execute(
        "INSERT OR IGNORE INTO albums (id, title, title_sort, artist_id, year, artwork_hash)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![id, title, title.to_lowercase(), artist_id, year, artwork_hash],
    )?;
    // Update artwork if we have it now and didn't before
    if let Some(hash) = artwork_hash {
        conn.execute(
            "UPDATE albums SET artwork_hash = ?1 WHERE id = ?2 AND artwork_hash IS NULL",
            params![hash, id],
        )?;
    }
    Ok(())
}

pub fn update_album_stats(conn: &Connection, album_id: &str) -> Result<()> {
    conn.execute(
        "UPDATE albums SET
            track_count = (SELECT COUNT(*) FROM tracks WHERE album_id = ?1 AND removed_at IS NULL),
            duration_secs = (SELECT COALESCE(SUM(duration_secs), 0) FROM tracks WHERE album_id = ?1 AND removed_at IS NULL)
         WHERE id = ?1",
        params![album_id],
    )?;
    Ok(())
}
