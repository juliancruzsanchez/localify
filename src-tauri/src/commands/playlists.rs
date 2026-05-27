use tauri::State;
use crate::db::playlists::{
    Playlist, PlaylistTrack,
    get_all_playlists, get_playlist_by_id, create_playlist, update_playlist,
    delete_playlist, get_playlist_tracks, add_track_to_playlist,
    remove_track_from_playlist, reorder_playlist_track,
};
use crate::error::Result;
use crate::state::AppState;

#[tauri::command]
pub async fn get_playlists(state: State<'_, AppState>) -> Result<Vec<Playlist>> {
    let conn = state.db.lock().unwrap();
    get_all_playlists(&conn)
}

#[tauri::command]
pub async fn get_playlist(state: State<'_, AppState>, id: String) -> Result<Playlist> {
    let conn = state.db.lock().unwrap();
    get_playlist_by_id(&conn, &id)
}

#[tauri::command]
pub async fn create_playlist_cmd(
    state: State<'_, AppState>,
    name: String,
    description: Option<String>,
) -> Result<Playlist> {
    let conn = state.db.lock().unwrap();
    create_playlist(&conn, &name, description.as_deref())
}

#[tauri::command]
pub async fn update_playlist_cmd(
    state: State<'_, AppState>,
    id: String,
    name: String,
    description: Option<String>,
) -> Result<Playlist> {
    let conn = state.db.lock().unwrap();
    update_playlist(&conn, &id, &name, description.as_deref())
}

#[tauri::command]
pub async fn delete_playlist_cmd(state: State<'_, AppState>, id: String) -> Result<()> {
    let conn = state.db.lock().unwrap();
    delete_playlist(&conn, &id)
}

#[tauri::command]
pub async fn get_playlist_tracks_cmd(
    state: State<'_, AppState>,
    playlist_id: String,
) -> Result<Vec<PlaylistTrack>> {
    let conn = state.db.lock().unwrap();
    get_playlist_tracks(&conn, &playlist_id)
}

#[tauri::command]
pub async fn add_track_to_playlist_cmd(
    state: State<'_, AppState>,
    playlist_id: String,
    track_id: String,
) -> Result<PlaylistTrack> {
    let conn = state.db.lock().unwrap();
    add_track_to_playlist(&conn, &playlist_id, &track_id)
}

#[tauri::command]
pub async fn remove_track_from_playlist_cmd(
    state: State<'_, AppState>,
    entry_id: String,
) -> Result<()> {
    let conn = state.db.lock().unwrap();
    remove_track_from_playlist(&conn, &entry_id)
}

#[tauri::command]
pub async fn reorder_playlist_track_cmd(
    state: State<'_, AppState>,
    entry_id: String,
    new_position: f64,
) -> Result<()> {
    let conn = state.db.lock().unwrap();
    reorder_playlist_track(&conn, &entry_id, new_position)
}
