use std::sync::Arc;
use tauri::{State, Emitter};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use crate::error::{AppError, Result};
use crate::state::AppState;
use crate::scanner::scan::{ScanContext, ScanResult, scan_library};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LibraryPath {
    pub id: String,
    pub path: String,
}

#[tauri::command]
pub async fn add_library_path(
    state: State<'_, AppState>,
    path: String,
) -> Result<LibraryPath> {
    let canonical = std::fs::canonicalize(&path)
        .map_err(|_| AppError::InvalidArgument(format!("Path does not exist: {path}")))?;

    if !canonical.is_dir() {
        return Err(AppError::InvalidArgument(format!("Not a directory: {path}")));
    }

    let canonical_str = canonical.to_string_lossy().to_string();
    let id = Uuid::new_v4().to_string();

    let (row, all_paths) = {
        let conn = state.db.lock().unwrap();
        conn.execute(
            "INSERT OR IGNORE INTO library_paths (id, path) VALUES (?1, ?2)",
            rusqlite::params![id, canonical_str],
        )?;

        let row = conn.query_row(
            "SELECT id, path FROM library_paths WHERE path = ?1",
            rusqlite::params![canonical_str],
            |row| Ok(LibraryPath { id: row.get(0)?, path: row.get(1)? }),
        )?;

        let mut stmt = conn.prepare("SELECT path FROM library_paths")?;
        let paths: Vec<String> = stmt.query_map([], |r| r.get(0))?
            .flatten()
            .collect();

        (row, paths)
    };

    if let Ok(mut guard) = state.watcher.lock() {
        if let Some(w) = guard.as_mut() {
            w.update_paths(all_paths);
        }
    }

    Ok(row)
}

#[tauri::command]
pub async fn remove_library_path(
    state: State<'_, AppState>,
    id: String,
) -> Result<()> {
    let all_paths = {
        let conn = state.db.lock().unwrap();
        conn.execute("DELETE FROM library_paths WHERE id = ?1", rusqlite::params![id])?;
        let mut stmt = conn.prepare("SELECT path FROM library_paths")?;
        let paths: Vec<String> = stmt.query_map([], |r| r.get(0))?
            .flatten()
            .collect();
        paths
    };

    if let Ok(mut guard) = state.watcher.lock() {
        if let Some(w) = guard.as_mut() {
            w.update_paths(all_paths);
        }
    }

    Ok(())
}

#[tauri::command]
pub async fn get_library_paths(
    state: State<'_, AppState>,
) -> Result<Vec<LibraryPath>> {
    let conn = state.db.lock().unwrap();
    let mut stmt = conn.prepare("SELECT id, path FROM library_paths ORDER BY created_at")?;
    let paths = stmt.query_map([], |row| {
        Ok(LibraryPath { id: row.get(0)?, path: row.get(1)? })
    })?
    .collect::<std::result::Result<Vec<_>, _>>()?;
    Ok(paths)
}

#[tauri::command]
pub async fn scan_library_cmd(
    state: State<'_, AppState>,
    app_handle: tauri::AppHandle,
    force_rescan: bool,
) -> Result<ScanResult> {
    let paths: Vec<String> = {
        let conn = state.db.lock().unwrap();
        let mut stmt = conn.prepare("SELECT path FROM library_paths")?;
        let result: std::result::Result<Vec<String>, _> = stmt.query_map([], |row| row.get(0))?
            .collect();
        result?
    };

    if paths.is_empty() {
        return Ok(ScanResult {
            added: 0,
            updated: 0,
            removed: 0,
            skipped: 0,
            duration_ms: 0,
            errors: vec!["No library paths configured".to_string()],
        });
    }

    let _ = app_handle.emit("scan:started", ());

    let ctx = Arc::new(ScanContext {
        db: state.db.clone(),
        app_data_dir: state.app_data_dir.clone(),
        force_rescan,
    });

    let app_handle_clone = app_handle.clone();
    let result = scan_library(ctx, paths, move |scanned, total| {
        let _ = app_handle_clone.emit("scan:progress", serde_json::json!({
            "scanned": scanned,
            "total": total,
        }));
    }).await?;

    let _ = app_handle.emit("scan:completed", &result);

    Ok(result)
}
