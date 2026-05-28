/// Tauri commands for Google Cast (Chromecast) support.

use tauri::State;
use crate::cast::{self, CastDevice, CastSession};
use crate::error::{AppError, Result};
use crate::state::AppState;

// ─── Commands ─────────────────────────────────────────────────────────────────

/// Scan the local network for Chromecast devices.
/// Blocks for ~3 s while mDNS collects responses.
#[tauri::command]
pub async fn discover_cast_devices(
    state: State<'_, AppState>,
) -> Result<Vec<CastDevice>> {
    // Run blocking mDNS discovery off the async executor
    let devices = tokio::task::spawn_blocking(|| cast::discover(3000))
        .await
        .map_err(|e| AppError::Audio(e.to_string()))?;

    // Cache the result
    *state.cast.devices.lock().unwrap() = devices.clone();
    Ok(devices)
}

/// Return the cached device list (populated by the last `discover_cast_devices` call).
#[tauri::command]
pub async fn get_cast_devices(state: State<'_, AppState>) -> Result<Vec<CastDevice>> {
    Ok(state.cast.devices.lock().unwrap().clone())
}

/// Start casting the given track to the named Chromecast device.
///
/// 1. Starts a local HTTP file server (if not already running).
/// 2. Connects to the Cast device and loads the media URL.
#[tauri::command]
pub async fn cast_track(
    state:       State<'_, AppState>,
    track_id:    String,
    device_name: String,
) -> Result<()> {
    // Find the device in the cache
    let device = {
        let devices = state.cast.devices.lock().unwrap();
        devices.iter().find(|d| d.name == device_name).cloned()
    }
    .ok_or_else(|| AppError::NotFound(format!("Cast device '{device_name}' not found")))?;

    // Ensure the local file server is running.
    // Read the port WITHOUT holding the guard across the .await point (not Send).
    let existing_port = *state.cast.server_port.lock().unwrap();
    let port = if existing_port == 0 {
        let db = state.db.clone();
        let app_data_dir = state.app_data_dir.clone();
        let (p, shutdown_tx) = tokio::spawn(async move {
            cast::start_file_server(db, app_data_dir).await
        })
        .await
        .map_err(|e| AppError::Audio(e.to_string()))?;

        // Re-lock after the await — guard is no longer live at the await point.
        *state.cast.server_port.lock().unwrap()     = p;
        *state.cast.server_shutdown.lock().unwrap() = Some(shutdown_tx);
        p
    } else {
        existing_port
    };

    // Build the media URL
    let lan_ip = cast::local_ip()
        .ok_or_else(|| AppError::Audio("Could not determine local IP".to_string()))?;
    let media_url = format!("http://{}:{}/track/{}", lan_ip, port, track_id);

    eprintln!("[cast] → {device_name} ({}) : {media_url}", device.host);

    let host       = device.host.clone();
    let cast_port  = device.port;
    let url_clone  = media_url.clone();

    tokio::task::spawn_blocking(move || {
        cast::start_cast_session(&host, cast_port, &url_clone)
    })
    .await
    .map_err(|e| AppError::Audio(e.to_string()))?
    .map_err(AppError::Audio)?;

    // Update session state
    *state.cast.session.lock().unwrap() = Some(CastSession {
        device_name:   device_name.clone(),
        device_host:   device.host.clone(),
        local_port:    port,
        current_track: Some(track_id),
    });

    Ok(())
}

/// Stop casting and tear down the session.
#[tauri::command]
pub async fn stop_cast(state: State<'_, AppState>) -> Result<()> {
    let session = state.cast.session.lock().unwrap().clone();

    if let Some(s) = session {
        let host       = s.device_host.clone();
        let cast_port  = {
            let devices = state.cast.devices.lock().unwrap();
            devices.iter()
                .find(|d| d.host == s.device_host)
                .map(|d| d.port)
                .unwrap_or(8009)
        };

        tokio::task::spawn_blocking(move || cast::stop_cast_session(&host, cast_port))
            .await
            .map_err(|e| AppError::Audio(e.to_string()))?
            .map_err(AppError::Audio)?;
    }

    // Clear session
    *state.cast.session.lock().unwrap() = None;

    // Shut down the local server
    let tx = state.cast.server_shutdown.lock().unwrap().take();
    if let Some(tx) = tx {
        let _ = tx.send(());
        *state.cast.server_port.lock().unwrap() = 0;
    }

    Ok(())
}

/// Return the current cast session (or `None` if not casting).
#[tauri::command]
pub async fn get_cast_session(state: State<'_, AppState>) -> Result<Option<CastSession>> {
    Ok(state.cast.session.lock().unwrap().clone())
}
