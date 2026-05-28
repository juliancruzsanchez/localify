use rusqlite::{Connection, params};
use crate::error::Result;
use super::tracks::Track;
use super::albums::Album;
use super::artists::Artist;
use super::playlists::Playlist;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResults {
    pub tracks: Vec<Track>,
    pub albums: Vec<Album>,
    pub artists: Vec<Artist>,
    pub playlists: Vec<Playlist>,
}

pub fn search(conn: &Connection, query: &str) -> Result<SearchResults> {
    if query.trim().is_empty() {
        return Ok(SearchResults {
            tracks: vec![],
            albums: vec![],
            artists: vec![],
            playlists: vec![],
        });
    }

    let fts_query = format!("{}*", query.trim());

    // Search tracks via FTS5
    let mut stmt = conn.prepare(
        "SELECT t.id, t.file_path, t.title, t.artist, t.album_artist,
                t.album_id, al.title, t.track_number, t.disc_number,
                t.year, t.genre, t.duration_secs, t.sample_rate, t.bit_depth,
                t.channels, t.bitrate_kbps, t.format, t.artwork_hash,
                t.play_count, t.last_played_at
         FROM tracks_fts
         JOIN tracks t ON t.rowid = tracks_fts.rowid
         LEFT JOIN albums al ON al.id = t.album_id
         WHERE tracks_fts MATCH ?1 AND t.removed_at IS NULL
         ORDER BY bm25(tracks_fts)
         LIMIT 50"
    )?;

    let tracks = stmt.query_map(params![fts_query], |row| {
        Ok(Track {
            id: row.get(0)?,
            file_path: row.get(1)?,
            title: row.get(2)?,
            artist: row.get(3)?,
            album_artist: row.get(4)?,
            album_id: row.get(5)?,
            album_title: row.get(6)?,
            track_number: row.get(7)?,
            disc_number: row.get(8)?,
            year: row.get(9)?,
            genre: row.get(10)?,
            duration_secs: row.get(11)?,
            sample_rate: row.get(12)?,
            bit_depth: row.get(13)?,
            channels: row.get(14)?,
            bitrate_kbps: row.get(15)?,
            format: row.get(16)?,
            artwork_hash: row.get(17)?,
            play_count: row.get(18)?,
            last_played_at: row.get(19)?,
        })
    })?
    .collect::<std::result::Result<Vec<_>, _>>()
    .unwrap_or_default();

    // Search albums
    let like_query = format!("%{}%", query.trim());
    let mut stmt = conn.prepare(
        "SELECT al.id, al.title, al.artist_id, ar.name,
                al.year, al.artwork_hash, al.track_count, al.duration_secs
         FROM albums al
         JOIN artists ar ON al.artist_id = ar.id
         WHERE al.title LIKE ?1 OR ar.name LIKE ?1
         ORDER BY al.title_sort
         LIMIT 50"
    )?;

    let albums = stmt.query_map(params![like_query], |row| {
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
    .collect::<std::result::Result<Vec<_>, _>>()
    .unwrap_or_default();

    // Search artists
    let mut stmt = conn.prepare(
        "SELECT ar.id, ar.name, ar.artwork_hash,
                COUNT(DISTINCT al.id) as album_count,
                COUNT(DISTINCT t.id) as track_count
         FROM artists ar
         LEFT JOIN albums al ON al.artist_id = ar.id
         LEFT JOIN tracks t ON t.album_id = al.id AND t.removed_at IS NULL
         WHERE ar.name LIKE ?1
         GROUP BY ar.id
         ORDER BY ar.name_sort
         LIMIT 50"
    )?;

    let artists = stmt.query_map(params![like_query], |row| {
        Ok(Artist {
            id: row.get(0)?,
            name: row.get(1)?,
            artwork_hash: row.get(2)?,
            album_count: row.get(3)?,
            track_count: row.get(4)?,
        })
    })?
    .collect::<std::result::Result<Vec<_>, _>>()
    .unwrap_or_default();

    // Search playlists
    let mut stmt = conn.prepare(
        "SELECT p.id, p.name, p.description, p.cover_path,
                COUNT(pt.id) as track_count,
                COALESCE(SUM(t.duration_secs), 0) as duration_secs,
                p.created_at, p.updated_at
         FROM playlists p
         LEFT JOIN playlist_tracks pt ON pt.playlist_id = p.id
         LEFT JOIN tracks t ON t.id = pt.track_id AND t.removed_at IS NULL
         WHERE p.name LIKE ?1
         GROUP BY p.id
         ORDER BY p.name
         LIMIT 50"
    )?;

    let playlists = stmt.query_map(params![like_query], |row| {
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
    .collect::<std::result::Result<Vec<_>, _>>()
    .unwrap_or_default();

    Ok(SearchResults { tracks, albums, artists, playlists })
}
