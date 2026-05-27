use tauri::State;
use crate::error::{AppError, Result};
use crate::state::AppState;

#[tauri::command]
pub async fn get_artwork_path(
    state: State<'_, AppState>,
    hash: String,
) -> Result<String> {
    let path = state.app_data_dir.join("artwork").join(format!("{}.jpg", hash));
    if path.exists() {
        Ok(path.to_string_lossy().to_string())
    } else {
        Err(AppError::NotFound(format!("Artwork {} not found", hash)))
    }
}
