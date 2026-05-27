use rusqlite::{Connection, params};
use serde::{Deserialize, Serialize};
use crate::error::{AppError, Result};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Artist {
    pub id: String,
    pub name: String,
    pub artwork_hash: Option<String>,
    pub album_count: i32,
    pub track_count: i32,
}

pub fn get_all_artists(conn: &Connection) -> Result<Vec<Artist>> {
    let mut stmt = conn.prepare(
        "SELECT ar.id, ar.name, ar.artwork_hash,
                COUNT(DISTINCT al.id) as album_count,
                COUNT(DISTINCT t.id) as track_count
         FROM artists ar
         LEFT JOIN albums al ON al.artist_id = ar.id
         LEFT JOIN tracks t ON t.album_id = al.id AND t.removed_at IS NULL
         GROUP BY ar.id
         ORDER BY ar.name_sort"
    )?;

    let artists = stmt.query_map([], |row| {
        Ok(Artist {
            id: row.get(0)?,
            name: row.get(1)?,
            artwork_hash: row.get(2)?,
            album_count: row.get(3)?,
            track_count: row.get(4)?,
        })
    })?
    .collect::<std::result::Result<Vec<_>, _>>()?;

    Ok(artists)
}

pub fn get_artist_by_id(conn: &Connection, id: &str) -> Result<Artist> {
    conn.query_row(
        "SELECT ar.id, ar.name, ar.artwork_hash,
                COUNT(DISTINCT al.id) as album_count,
                COUNT(DISTINCT t.id) as track_count
         FROM artists ar
         LEFT JOIN albums al ON al.artist_id = ar.id
         LEFT JOIN tracks t ON t.album_id = al.id AND t.removed_at IS NULL
         WHERE ar.id = ?1
         GROUP BY ar.id",
        params![id],
        |row| {
            Ok(Artist {
                id: row.get(0)?,
                name: row.get(1)?,
                artwork_hash: row.get(2)?,
                album_count: row.get(3)?,
                track_count: row.get(4)?,
            })
        },
    )
    .map_err(|e| match e {
        rusqlite::Error::QueryReturnedNoRows => AppError::NotFound(format!("Artist {id} not found")),
        e => e.into(),
    })
}

pub fn upsert_artist(conn: &Connection, id: &str, name: &str) -> Result<()> {
    conn.execute(
        "INSERT OR IGNORE INTO artists (id, name, name_sort) VALUES (?1, ?2, ?3)",
        params![id, name, name.to_lowercase()],
    )?;
    Ok(())
}
