use tauri::State;
use crate::db::tracks::{Track, get_all_tracks, get_track_by_id};
use crate::error::{AppError, Result};
use crate::state::AppState;

#[tauri::command]
pub async fn get_all_genres(state: State<'_, AppState>) -> Result<Vec<String>> {
    let conn = state.db.lock().unwrap();
    let mut stmt = conn.prepare(
        "SELECT DISTINCT genre
         FROM tracks
         WHERE genre IS NOT NULL AND removed_at IS NULL
         ORDER BY genre COLLATE NOCASE",
    )?;
    let genres = stmt
        .query_map([], |row| row.get::<_, String>(0))?
        .collect::<std::result::Result<Vec<_>, _>>()?;
    Ok(genres)
}

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

/// Open the system file manager and highlight the given file.
///
/// - macOS:   `open -R <path>`          — reveals in Finder
/// - Windows: `explorer /select,<path>` — reveals in Explorer
/// - Linux:   dbus `ShowItems` (Nautilus/Dolphin/Thunar), falls back to
///            `xdg-open <parent-dir>`
#[tauri::command]
pub async fn reveal_in_folder(file_path: String) -> Result<()> {
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg("-R")
            .arg(&file_path)
            .spawn()
            .map_err(|e| AppError::Io(e.to_string()))?;
    }

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(format!("/select,{file_path}"))
            .spawn()
            .map_err(|e| AppError::Io(e.to_string()))?;
    }

    #[cfg(target_os = "linux")]
    {
        let uri = format!("file://{file_path}");
        let ok = std::process::Command::new("dbus-send")
            .args([
                "--session",
                "--dest=org.freedesktop.FileManager1",
                "--type=method_call",
                "/org/freedesktop/FileManager1",
                "org.freedesktop.FileManager1.ShowItems",
                &format!("array:string:{uri}"),
                "string:",
            ])
            .spawn()
            .is_ok();

        if !ok {
            // Fallback: open parent directory
            if let Some(parent) = std::path::Path::new(&file_path).parent() {
                std::process::Command::new("xdg-open")
                    .arg(parent)
                    .spawn()
                    .map_err(|e| AppError::Io(e.to_string()))?;
            }
        }
    }

    Ok(())
}
