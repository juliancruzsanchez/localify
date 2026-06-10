use tauri::State;
use crate::db::albums::{Album, get_all_albums, get_album_by_id};
use crate::db::tracks::{Track, get_tracks_by_album};
use crate::error::Result;
use crate::state::AppState;

#[tauri::command]
pub async fn get_albums(state: State<'_, AppState>) -> Result<Vec<Album>> {
    let conn = state.db.lock().unwrap();
    get_all_albums(&conn)
}

#[tauri::command]
pub async fn get_album(state: State<'_, AppState>, id: String) -> Result<Album> {
    let conn = state.db.lock().unwrap();
    get_album_by_id(&conn, &id)
}

#[tauri::command]
pub async fn get_album_tracks(state: State<'_, AppState>, album_id: String) -> Result<Vec<Track>> {
    let conn = state.db.lock().unwrap();
    get_tracks_by_album(&conn, &album_id)
}
