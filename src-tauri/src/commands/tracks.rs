use tauri::State;
use crate::db::tracks::{Track, get_all_tracks, get_track_by_id};
use crate::error::Result;
use crate::state::AppState;

#[tauri::command]
pub async fn get_tracks(state: State<'_, AppState>) -> Result<Vec<Track>> {
    let conn = state.db.lock().unwrap();
    get_all_tracks(&conn)
}

#[tauri::command]
pub async fn get_track(state: State<'_, AppState>, id: String) -> Result<Track> {
    let conn = state.db.lock().unwrap();
    get_track_by_id(&conn, &id)
}
