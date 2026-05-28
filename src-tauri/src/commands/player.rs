use tauri::State;
use serde::{Deserialize, Serialize};
use std::sync::atomic::Ordering;
use crate::audio::engine::PlayerCommand;
use crate::audio::eq::EQ_BANDS_HZ;
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
        track_id: track_id.clone(),
        start_ms: start_ms.unwrap_or(0),
    });

    let start = start_ms.unwrap_or(0);
    for hook in state.plugins.player_hooks() {
        let _ = hook.on_play(&track_id, start).await;
    }

    Ok(())
}

#[tauri::command]
pub async fn pause(state: State<'_, AppState>) -> Result<()> {
    state.player.send(PlayerCommand::Pause);
    let track_id = state.player.current_track_id.lock().unwrap().clone().unwrap_or_default();
    let pos = state.player.position_ms.load(std::sync::atomic::Ordering::Relaxed) as u64;
    for hook in state.plugins.player_hooks() {
        let _ = hook.on_pause(&track_id, pos).await;
    }
    Ok(())
}

#[tauri::command]
pub async fn resume(state: State<'_, AppState>) -> Result<()> {
    state.player.send(PlayerCommand::Resume);
    let track_id = state.player.current_track_id.lock().unwrap().clone().unwrap_or_default();
    let pos = state.player.position_ms.load(std::sync::atomic::Ordering::Relaxed) as u64;
    for hook in state.plugins.player_hooks() {
        let _ = hook.on_resume(&track_id, pos).await;
    }
    Ok(())
}

#[tauri::command]
pub async fn seek(state: State<'_, AppState>, position_ms: u64) -> Result<()> {
    state.player.send(PlayerCommand::Seek { position_ms });
    // Update the atomic immediately so the polling loop picks up the new
    // position without having to wait for the decode thread to process the
    // seek (otherwise the frontend slider snaps back to the old value).
    state.player.position_ms.store(position_ms as i64, Ordering::Relaxed);
    let track_id = state.player.current_track_id.lock().unwrap().clone().unwrap_or_default();
    for hook in state.plugins.player_hooks() {
        let _ = hook.on_seek(&track_id, position_ms).await;
    }
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
    for hook in state.plugins.player_hooks() {
        let _ = hook.on_stop().await;
    }
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

// ─── Audio settings ───────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioSettings {
    pub eq_enabled:    bool,
    pub eq_gains:      Vec<f32>,   // 6 values, dB
    pub eq_bands_hz:   Vec<f32>,   // centre frequencies (read-only, for the UI)
    pub crossfade_ms:  u32,
}

#[tauri::command]
pub async fn get_audio_settings(state: State<'_, AppState>) -> Result<AudioSettings> {
    let cfg = state.player.eq_config.lock().unwrap();
    Ok(AudioSettings {
        eq_enabled:   cfg.enabled,
        eq_gains:     cfg.gains_db.to_vec(),
        eq_bands_hz:  EQ_BANDS_HZ.to_vec(),
        crossfade_ms: cfg.crossfade_ms,
    })
}

#[tauri::command]
pub async fn set_eq_bands(
    state:   State<'_, AppState>,
    enabled: bool,
    gains:   Vec<f32>,
) -> Result<()> {
    if gains.len() != 6 {
        return Err(AppError::InvalidArgument("EQ requires exactly 6 gain values".into()));
    }
    let mut cfg = state.player.eq_config.lock().unwrap();
    cfg.enabled = enabled;
    for (i, &g) in gains.iter().enumerate() {
        cfg.gains_db[i] = g.clamp(-12.0, 12.0);
    }
    Ok(())
}

#[tauri::command]
pub async fn set_crossfade(
    state:       State<'_, AppState>,
    duration_ms: u32,
) -> Result<()> {
    state.player.eq_config.lock().unwrap().crossfade_ms = duration_ms.min(12_000);
    Ok(())
}
