use tauri::State;
use crate::db::playlists::{
    Playlist, PlaylistTrack,
    get_all_playlists, get_playlist_by_id, create_playlist, update_playlist,
    delete_playlist, get_playlist_tracks, add_track_to_playlist,
    remove_track_from_playlist, reorder_playlist_track, set_playlist_cover,
};
use crate::error::{AppError, Result};
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

/// Set (or clear) a playlist's custom cover image.
///
/// `source_path` is the absolute path the user picked from the file dialog.
/// The image is copied and resized (600 × 600 max) into
/// `<app_data_dir>/covers/<playlist_id>.jpg` so the built-in `asset://`
/// protocol can always serve it, regardless of where the original was.
///
/// Pass `None` to remove the custom cover.
#[tauri::command]
pub async fn set_playlist_cover_cmd(
    state: State<'_, AppState>,
    id: String,
    source_path: Option<String>,
) -> Result<Playlist> {
    let stored_path: Option<String> = if let Some(ref src) = source_path {
        // Load, resize, save to covers dir
        let img = image::open(src)
            .map_err(|e| AppError::Io(format!("Cannot open image: {e}")))?;

        let thumb = img.thumbnail(600, 600);

        let covers_dir = state.app_data_dir.join("covers");
        std::fs::create_dir_all(&covers_dir)
            .map_err(|e| AppError::Io(format!("Cannot create covers dir: {e}")))?;

        let dest = covers_dir.join(format!("{id}.jpg"));
        thumb
            .save_with_format(&dest, image::ImageFormat::Jpeg)
            .map_err(|e| AppError::Io(format!("Cannot save cover: {e}")))?;

        Some(dest.to_string_lossy().to_string())
    } else {
        // Remove the stored file (best-effort)
        let dest = state.app_data_dir.join("covers").join(format!("{id}.jpg"));
        let _ = std::fs::remove_file(dest);
        None
    };

    let conn = state.db.lock().unwrap();
    set_playlist_cover(&conn, &id, stored_path.as_deref())
}
