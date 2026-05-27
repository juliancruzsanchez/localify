use tauri::State;
use serde::{Deserialize, Serialize};
use std::sync::atomic::Ordering;
use crate::audio::engine::PlayerCommand;
use crate::db::tracks::get_track_by_id;
use crate::error::{AppError, Result};
use crate::state::AppState;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlayerState {
    pub is_playing: bool,
    pub volume: u8,
    pub position_ms: i64,
    pub duration_ms: i64,
    pub current_track_id: Option<String>,
}

#[tauri::command]
pub async fn play_track(
    state: State<'_, AppState>,
    track_id: String,
    start_ms: Option<u64>,
) -> Result<()> {
    let file_path = {
        let conn = state.db.lock().unwrap();
        let track = get_track_by_id(&conn, &track_id)?;
        // Increment play count
        let _ = crate::db::tracks::increment_play_count(&conn, &track_id);
        track.file_path
    };

    state.player.send(PlayerCommand::Play {
        file_path,
        track_id,
        start_ms: start_ms.unwrap_or(0),
    });

    Ok(())
}

#[tauri::command]
pub async fn pause(state: State<'_, AppState>) -> Result<()> {
    state.player.send(PlayerCommand::Pause);
    Ok(())
}

#[tauri::command]
pub async fn resume(state: State<'_, AppState>) -> Result<()> {
    state.player.send(PlayerCommand::Resume);
    Ok(())
}

#[tauri::command]
pub async fn seek(state: State<'_, AppState>, position_ms: u64) -> Result<()> {
    state.player.send(PlayerCommand::Seek { position_ms });
    Ok(())
}

#[tauri::command]
pub async fn set_volume(state: State<'_, AppState>, volume: u8) -> Result<()> {
    if volume > 100 {
        return Err(AppError::InvalidArgument("Volume must be 0-100".to_string()));
    }
    state.player.send(PlayerCommand::SetVolume { volume });
    Ok(())
}

#[tauri::command]
pub async fn stop_playback(state: State<'_, AppState>) -> Result<()> {
    state.player.send(PlayerCommand::Stop);
    Ok(())
}

#[tauri::command]
pub async fn get_player_state(state: State<'_, AppState>) -> Result<PlayerState> {
    let player = &state.player;
    Ok(PlayerState {
        is_playing: player.is_playing.load(Ordering::Relaxed),
        volume: player.volume.load(Ordering::Relaxed) as u8,
        position_ms: player.position_ms.load(Ordering::Relaxed),
        duration_ms: player.duration_ms.load(Ordering::Relaxed),
        current_track_id: player.current_track_id.lock().unwrap().clone(),
    })
}
