use std::fs;
use base64::Engine;
use tauri::State;
use crate::error::{AppError, Result};
use crate::state::AppState;

/// Return the absolute filesystem path for a given artwork hash.
/// The frontend converts this to a URL via the Tauri asset protocol.
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

/// Return artwork as a base64 data URL (data:image/jpeg;base64,...).
/// Using a data URL lets the canvas read pixel data without taint restrictions.
#[tauri::command]
pub async fn get_artwork_data_url(
    state: State<'_, AppState>,
    hash: String,
) -> Result<String> {
    let path = state.app_data_dir.join("artwork").join(format!("{}.jpg", hash));
    let bytes = fs::read(&path)
        .map_err(|e| AppError::Io(format!("Cannot read artwork: {e}")))?;
    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
    Ok(format!("data:image/jpeg;base64,{b64}"))
}

/// Read a cover image file (playlist custom cover) and return it as a
/// base64-encoded data URL so the frontend can display it without relying on
/// the Tauri asset protocol (which has scope/permission issues in v2).
#[tauri::command]
pub async fn get_cover_image(
    _state: State<'_, AppState>,
    cover_path: String,
) -> Result<String> {
    let bytes = fs::read(&cover_path)
        .map_err(|e| AppError::Io(format!("Cannot read cover file: {e}")))?;
    let mime = if cover_path.to_lowercase().ends_with(".png") {
        "image/png"
    } else {
        "image/jpeg"
    };
    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
    Ok(format!("data:{mime};base64,{b64}"))
}
