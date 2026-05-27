use tauri::State;
use crate::db::artists::{Artist, get_all_artists, get_artist_by_id};
use crate::db::albums::{Album, get_albums_by_artist};
use crate::error::Result;
use crate::state::AppState;

#[tauri::command]
pub async fn get_artists(state: State<'_, AppState>) -> Result<Vec<Artist>> {
    let conn = state.db.lock().unwrap();
    get_all_artists(&conn)
}

#[tauri::command]
pub async fn get_artist(state: State<'_, AppState>, id: String) -> Result<Artist> {
    let conn = state.db.lock().unwrap();
    get_artist_by_id(&conn, &id)
}

#[tauri::command]
pub async fn get_artist_albums(state: State<'_, AppState>, artist_id: String) -> Result<Vec<Album>> {
    let conn = state.db.lock().unwrap();
    get_albums_by_artist(&conn, &artist_id)
}
