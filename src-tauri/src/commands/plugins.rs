use tauri::State;
use serde_json::Value;
use crate::error::{AppError, Result};
use crate::plugins::loader::{copy_dir_all, load_one_plugin, validate_manifest};
use crate::plugins::registry::PluginManifest;
use crate::plugins::traits::{PluginBrowseItem, PluginTrack, ResolvedStream};
use crate::state::AppState;

// ─── Plugin management ───────────────────────────────────────────────────────

#[tauri::command]
pub async fn plugin_list(state: State<'_, AppState>) -> Result<Vec<PluginManifest>> {
    Ok(state.plugins.all_manifests())
}

#[tauri::command]
pub async fn plugin_install(
    state: State<'_, AppState>,
    source_dir: String,
) -> Result<PluginManifest> {
    let source_path = std::path::Path::new(&source_dir);
    if !source_path.exists() {
        return Err(AppError::NotFound(format!("Source directory not found: {source_dir}")));
    }

    let manifest_path = source_path.join("plugin.json");
    if !manifest_path.exists() {
        return Err(AppError::InvalidArgument(
            "No plugin.json found in the source directory".to_string()
        ));
    }

    let json_bytes = std::fs::read(&manifest_path)?;
    let manifest: PluginManifest = serde_json::from_slice(&json_bytes)
        .map_err(|e| AppError::InvalidArgument(format!("Invalid plugin.json: {e}")))?;

    validate_manifest(&manifest)?;

    if state.plugins.has(&manifest.id) {
        return Err(AppError::InvalidArgument(
            format!("Plugin '{}' is already installed", manifest.id)
        ));
    }

    let dest = state.app_data_dir.join("plugins").join(&manifest.id);
    copy_dir_all(source_path, &dest)?;

    let loaded = load_one_plugin(&dest)?;
    let result_manifest = loaded.manifest.clone();
    state.plugins.register(loaded);

    log::info!("[plugins] Installed: {} v{}", result_manifest.name, result_manifest.version);
    Ok(result_manifest)
}

#[tauri::command]
pub async fn plugin_uninstall(
    state: State<'_, AppState>,
    plugin_id: String,
) -> Result<()> {
    if !state.plugins.has(&plugin_id) {
        return Err(AppError::NotFound(format!("Plugin not found: {plugin_id}")));
    }

    state.plugins.remove(&plugin_id);

    let plugin_dir = state.app_data_dir.join("plugins").join(&plugin_id);
    if plugin_dir.exists() {
        std::fs::remove_dir_all(&plugin_dir)?;
    }

    log::info!("[plugins] Uninstalled: {plugin_id}");
    Ok(())
}

// ─── Settings (persisted in SQLite) ──────────────────────────────────────────

#[tauri::command]
pub async fn plugin_get_settings(
    state: State<'_, AppState>,
    plugin_id: String,
) -> Result<Value> {
    let conn = state.db.lock().unwrap();
    let json: Option<String> = conn.query_row(
        "SELECT settings FROM plugin_settings WHERE plugin_id = ?1",
        [&plugin_id],
        |row| row.get(0),
    ).ok();

    Ok(json
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or(Value::Object(Default::default())))
}

#[tauri::command]
pub async fn plugin_save_settings(
    state: State<'_, AppState>,
    plugin_id: String,
    settings: Value,
) -> Result<()> {
    let json = serde_json::to_string(&settings)
        .map_err(|e| AppError::InvalidArgument(e.to_string()))?;
    let conn = state.db.lock().unwrap();
    conn.execute(
        "INSERT INTO plugin_settings (plugin_id, settings, updated_at)
         VALUES (?1, ?2, unixepoch())
         ON CONFLICT(plugin_id) DO UPDATE
           SET settings   = excluded.settings,
               updated_at = excluded.updated_at",
        rusqlite::params![plugin_id, json],
    )?;
    Ok(())
}

// ─── Generic IPC dispatch ─────────────────────────────────────────────────────

#[tauri::command]
pub async fn plugin_dispatch(
    state: State<'_, AppState>,
    plugin_id: String,
    method: String,
    params: Value,
) -> Result<Value> {
    let ipc = state.plugins.ipc_command(&plugin_id)
        .ok_or_else(|| AppError::NotFound(
            format!("Plugin '{plugin_id}' not found or has no IPC handler")
        ))?;

    let manifest = state.plugins.manifest(&plugin_id)
        .ok_or_else(|| AppError::NotFound(format!("Plugin '{plugin_id}' not found")))?;

    if !manifest.capabilities.iter().any(|c| c == "ipc_commands") {
        return Err(AppError::InvalidArgument(
            format!("Plugin '{plugin_id}' does not declare the 'ipc_commands' capability")
        ));
    }

    ipc.dispatch(&method, params).await
}

// ─── Audio source commands ────────────────────────────────────────────────────

#[tauri::command]
pub async fn plugin_audio_source_search(
    state: State<'_, AppState>,
    plugin_id: String,
    query: String,
    limit: u32,
) -> Result<Vec<PluginTrack>> {
    let src = state.plugins.audio_source(&plugin_id)
        .ok_or_else(|| AppError::NotFound(
            format!("Plugin '{plugin_id}' not found or is not an audio source")
        ))?;
    src.search(&query, limit).await
}

#[tauri::command]
pub async fn plugin_audio_source_browse_root(
    state: State<'_, AppState>,
    plugin_id: String,
) -> Result<Vec<PluginBrowseItem>> {
    let src = state.plugins.audio_source(&plugin_id)
        .ok_or_else(|| AppError::NotFound(
            format!("Plugin '{plugin_id}' not found or is not an audio source")
        ))?;
    src.browse_root().await
}

#[tauri::command]
pub async fn plugin_audio_source_browse_collection(
    state: State<'_, AppState>,
    plugin_id: String,
    collection_id: String,
) -> Result<Vec<PluginTrack>> {
    let src = state.plugins.audio_source(&plugin_id)
        .ok_or_else(|| AppError::NotFound(
            format!("Plugin '{plugin_id}' not found or is not an audio source")
        ))?;
    src.browse_collection(&collection_id).await
}

#[tauri::command]
pub async fn plugin_audio_source_play(
    state: State<'_, AppState>,
    plugin_id: String,
    track_id: String,
) -> Result<ResolvedStream> {
    let src = state.plugins.audio_source(&plugin_id)
        .ok_or_else(|| AppError::NotFound(
            format!("Plugin '{plugin_id}' not found or is not an audio source")
        ))?;

    let stream = src.resolve_stream(&track_id).await?;

    state.player.send(crate::audio::engine::PlayerCommand::Play {
        file_path: stream.uri.clone(),
        track_id,
        start_ms: 0,
    });

    Ok(stream)
}
