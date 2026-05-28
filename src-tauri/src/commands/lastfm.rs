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
#[tauri::command]
pub async fn lastfm_authenticate(
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
