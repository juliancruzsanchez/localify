use tauri::State;
use serde::{Deserialize, Serialize};
use crate::cast;
use crate::error::{AppError, Result};
use crate::state::AppState;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemoteStreamInfo {
    pub port:     u16,
    pub local_ip: String,
    pub base_url: String,
}

#[tauri::command]
pub async fn remote_stream_start(state: State<'_, AppState>) -> Result<RemoteStreamInfo> {
    let existing_port = *state.cast.server_port.lock().unwrap();
    let port = if existing_port == 0 {
        let db = state.db.clone();
        let app_data_dir = state.app_data_dir.clone();
        let (p, shutdown_tx) = tokio::spawn(async move {
            cast::start_file_server(db, app_data_dir).await
        })
        .await
        .map_err(|e| AppError::Audio(e.to_string()))?;

        *state.cast.server_port.lock().unwrap()     = p;
        *state.cast.server_shutdown.lock().unwrap() = Some(shutdown_tx);
        p
    } else {
        existing_port
    };

    let local_ip = cast::local_ip()
        .ok_or_else(|| AppError::Audio("Could not determine local IP".to_string()))?
        .to_string();

    let base_url = format!("http://{}:{}", local_ip, port);

    Ok(RemoteStreamInfo { port, local_ip, base_url })
}

#[tauri::command]
pub async fn remote_stream_stop(state: State<'_, AppState>) -> Result<()> {
    let session = state.cast.session.lock().unwrap().clone();
    if session.is_some() {
        return Ok(());
    }

    let tx = state.cast.server_shutdown.lock().unwrap().take();
    if let Some(tx) = tx {
        let _ = tx.send(());
        *state.cast.server_port.lock().unwrap() = 0;
    }

    Ok(())
}

#[tauri::command]
pub async fn remote_stream_status(state: State<'_, AppState>) -> Result<Option<RemoteStreamInfo>> {
    let port = *state.cast.server_port.lock().unwrap();
    if port == 0 {
        return Ok(None);
    }

    let local_ip = cast::local_ip()
        .ok_or_else(|| AppError::Audio("Could not determine local IP".to_string()))?
        .to_string();

    let base_url = format!("http://{}:{}", local_ip, port);

    Ok(Some(RemoteStreamInfo { port, local_ip, base_url }))
}
