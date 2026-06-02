/// Tauri commands for Last.fm integration.
///
/// Credentials (api_key, api_secret, session_key, username) are persisted in
/// the Tauri Store plugin under the key "lastfm".  The frontend owns the
/// session state (reads the store via `tauri-plugin-store` JS bindings) but
/// calls into Rust for all authenticated API calls so the api_secret never
/// leaks into the WebView.

use tauri::State;
use serde::{Deserialize, Serialize};
use crate::lastfm::{LastFmClient, LastFmError};
use crate::error::{AppError, Result};
use crate::state::AppState;
use crate::db::tracks::get_track_by_id;

// ─── Request / Response types ────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct LastFmCredentials {
    pub api_key:    String,
    pub api_secret: String,
    pub username:   String,
    pub password:   String,
}

#[derive(Debug, Serialize)]
pub struct LastFmSession {
    pub username:    String,
    pub session_key: String,
    pub api_key:     String,
}

// ─── Commands ────────────────────────────────────────────────────────────────

/// Authenticate with Last.fm and return a session that the frontend should
/// persist (username + session_key + api_key).
/// Also persists the api_key in the DB so the mobile HTTP server can use it.
#[tauri::command]
pub async fn lastfm_authenticate(
    state:       State<'_, AppState>,
    credentials: LastFmCredentials,
) -> Result<LastFmSession> {
    let client = LastFmClient::new(
        credentials.api_key.clone(),
        credentials.api_secret.clone(),
    );

    let session_key = client
        .get_mobile_session(&credentials.username, &credentials.password)
        .await
        .map_err(|e| AppError::InvalidArgument(e.to_string()))?;

    // Persist api_key so the HTTP streaming server can call Last.fm for mobile.
    {
        let conn = state.db.lock().unwrap();
        conn.execute(
            "INSERT OR REPLACE INTO app_settings (key, value, updated_at) \
             VALUES ('lastfm_api_key', ?1, unixepoch())",
            rusqlite::params![credentials.api_key],
        )?;
    }

    Ok(LastFmSession {
        username:    credentials.username,
        session_key,
        api_key:     credentials.api_key,
    })
}

/// Fire a "now playing" notification.  Called by the frontend as soon as a
/// track starts playing (if the user is authenticated).
#[tauri::command]
pub async fn lastfm_now_playing(
    state:       State<'_, AppState>,
    track_id:    String,
    api_key:     String,
    api_secret:  String,
    session_key: String,
) -> Result<()> {
    let (artist, title, album, duration_secs) = {
        let conn = state.db.lock().unwrap();
        let t    = get_track_by_id(&conn, &track_id)?;
        (t.artist, t.title, t.album_title, t.duration_secs as u64)
    };

    let client = LastFmClient::new(api_key, api_secret);
    client
        .update_now_playing(
            &session_key,
            &artist,
            &title,
            album.as_deref(),
            duration_secs,
        )
        .await
        .map_err(|e: LastFmError| AppError::InvalidArgument(e.to_string()))
}

// ─── Similar artists ─────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct SimilarArtistInfo {
    pub name:              String,
    pub library_artist_id: Option<String>,
}

/// Return similar artists for `artist_name`, annotated with library presence.
#[tauri::command]
pub async fn lastfm_get_similar_artists(
    state:       State<'_, AppState>,
    artist_name: String,
    api_key:     String,
    limit:       u32,
) -> Result<Vec<SimilarArtistInfo>> {
    let client = LastFmClient::new(api_key, String::new());
    let similar = client
        .get_similar_artists(&artist_name, limit)
        .await
        .map_err(|e| AppError::InvalidArgument(e.to_string()))?;

    let infos = {
        let conn = state.db.lock().unwrap();
        similar
            .iter()
            .map(|(name, _score)| {
                let id: Option<String> = conn
                    .query_row(
                        "SELECT id FROM artists \
                         WHERE lower(name) = lower(?1) LIMIT 1",
                        rusqlite::params![name],
                        |row| row.get(0),
                    )
                    .ok();
                SimilarArtistInfo { name: name.clone(), library_artist_id: id }
            })
            .collect()
    };

    Ok(infos)
}

// ─── Recommendations ────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct LastFmRecTrack {
    pub title:             String,
    pub artist:            String,
    pub similar_to:        String,
    pub library_track_id:  Option<String>,
}

#[derive(Debug, Serialize)]
pub struct LastFmRecArtist {
    pub name:              String,
    pub similar_to:        String,
    pub library_artist_id: Option<String>,
    pub top_tracks:        Vec<LastFmRecTrack>,
}

#[derive(Debug, Serialize)]
pub struct LastFmRecommendations {
    pub artists:   Vec<LastFmRecArtist>,
    pub based_on:  Vec<String>,
}

/// Build personalised recommendations.
///
/// Flow:
///   1. Fetch user's top-10 artists from Last.fm.
///   2. For each seed artist fetch up to 8 similar artists (concurrently).
///   3. Deduplicate, remove seeds, check library for artist presence.
///   4. For each unique similar artist (up to 15) fetch top-5 tracks.
///   5. Check each track against the library by lower-cased (artist, title).
#[tauri::command]
pub async fn lastfm_get_recommendations(
    state:    State<'_, AppState>,
    username: String,
    api_key:  String,
) -> Result<LastFmRecommendations> {
    let client = LastFmClient::new(api_key.clone(), String::new());

    // ── 1. User's top artists ─────────────────────────────────────────────────
    let seeds = client
        .get_user_top_artists(&username, 10)
        .await
        .map_err(|e| AppError::InvalidArgument(e.to_string()))?;

    if seeds.is_empty() {
        return Ok(LastFmRecommendations { artists: vec![], based_on: vec![] });
    }

    // ── 2. Similar artists for each seed ─────────────────────────────────────
    let seeds_lower: std::collections::HashSet<String> =
        seeds.iter().map(|s| s.to_lowercase()).collect();

    let mut similar_by_seed: Vec<(String, Vec<(String, f32)>)> = Vec::new();
    for seed in seeds.iter().take(5) {
        let list = client.get_similar_artists(seed, 8).await.unwrap_or_default();
        similar_by_seed.push((seed.clone(), list));
    }

    // ── 3. Deduplicate, remove seeds ──────────────────────────────────────────
    let mut seen: std::collections::HashSet<String> = std::collections::HashSet::new();
    let mut candidates: Vec<(String, String)> = Vec::new();
    for (seed, list) in &similar_by_seed {
        for (name, _score) in list {
            let key = name.to_lowercase();
            if seeds_lower.contains(&key) { continue; }
            if seen.contains(&key) { continue; }
            seen.insert(key);
            candidates.push((name.clone(), seed.clone()));
            if candidates.len() >= 20 { break; }
        }
        if candidates.len() >= 20 { break; }
    }

    // ── 4. Check library for each similar artist ──────────────────────────────
    let artist_check: Vec<(String, String, Option<String>)> = {
        let conn = state.db.lock().unwrap();
        candidates.iter().take(15).map(|(name, seed)| {
            let id: Option<String> = conn.query_row(
                "SELECT id FROM artists WHERE lower(name) = lower(?1) LIMIT 1",
                rusqlite::params![name],
                |row| row.get(0),
            ).ok();
            (name.clone(), seed.clone(), id)
        }).collect()
    };

    // ── 5. Top tracks for each similar artist ────────────────────────────────
    let mut artist_tracks: Vec<(String, String, Option<String>, Vec<(String, String)>)> = Vec::new();
    for (name, seed, artist_id) in &artist_check {
        let tracks = client.get_artist_top_tracks(name, 5).await.unwrap_or_default();
        artist_tracks.push((name.clone(), seed.clone(), artist_id.clone(), tracks));
    }

    // ── 6. Check each track against the library ───────────────────────────────
    let rec_artists: Vec<LastFmRecArtist> = {
        let conn = state.db.lock().unwrap();
        artist_tracks.into_iter().map(|(name, seed, artist_id, tracks)| {
            let top_tracks = tracks.into_iter().map(|(title, artist)| {
                let tid: Option<String> = conn.query_row(
                    "SELECT t.id FROM tracks t
                     WHERE lower(t.title) = lower(?1)
                       AND lower(t.artist) = lower(?2)
                       AND t.removed_at IS NULL
                     LIMIT 1",
                    rusqlite::params![title, artist],
                    |row| row.get(0),
                ).ok();
                LastFmRecTrack {
                    title,
                    artist,
                    similar_to: seed.clone(),
                    library_track_id: tid,
                }
            }).collect();

            LastFmRecArtist {
                name,
                similar_to: seed,
                library_artist_id: artist_id,
                top_tracks,
            }
        }).collect()
    };

    Ok(LastFmRecommendations {
        artists:  rec_artists,
        based_on: seeds,
    })
}

/// Scrobble a track.  Called by the frontend when the track reaches the
/// scrobble threshold (50 % played, or 4 minutes, whichever is smaller).
#[tauri::command]
pub async fn lastfm_scrobble(
    state:         State<'_, AppState>,
    track_id:      String,
    api_key:       String,
    api_secret:    String,
    session_key:   String,
    timestamp_secs: u64,
) -> Result<()> {
    let (artist, title, album, duration_secs) = {
        let conn = state.db.lock().unwrap();
        let t    = get_track_by_id(&conn, &track_id)?;
        (t.artist, t.title, t.album_title, t.duration_secs as u64)
    };

    let client = LastFmClient::new(api_key, api_secret);
    client
        .scrobble(
            &session_key,
            &artist,
            &title,
            album.as_deref(),
            timestamp_secs,
            duration_secs,
        )
        .await
        .map_err(|e: LastFmError| AppError::InvalidArgument(e.to_string()))
}
