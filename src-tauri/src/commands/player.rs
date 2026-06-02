use rusqlite::params;
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
    let (file_path, title, artist, album, artwork_file, duration_ms) = {
        let conn = state.db.lock().unwrap();
        let track = get_track_by_id(&conn, &track_id)?;
        // Increment play count and record to play_history
        let _ = crate::db::tracks::increment_play_count(&conn, &track_id);
        let _ = conn.execute(
            "INSERT INTO play_history (track_id, played_at, source) VALUES (?1, strftime('%s','now')*1000, 'desktop')",
            params![track_id],
        );

        let artwork_file = track.artwork_hash.as_ref().map(|hash| {
            state
                .app_data_dir
                .join("artwork")
                .join(format!("{hash}.jpg"))
                .to_string_lossy()
                .to_string()
        });
        let dur_ms = (track.duration_secs * 1000.0) as i64;

        (
            track.file_path,
            track.title,
            track.artist,
            track.album_title.unwrap_or_default(),
            artwork_file,
            dur_ms,
        )
    };

    state.player.send(PlayerCommand::Play {
        file_path,
        track_id: track_id.clone(),
        start_ms: start_ms.unwrap_or(0),
        title:    title.clone(),
        artist:   artist.clone(),
        album:    album.clone(),
        artwork_file,
    });

    let start = start_ms.unwrap_or(0);
    state.discord_rpc.set_playing(&title, &artist, &album, start as i64, duration_ms);
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
    // Look up track metadata for Discord RPC
    {
        let conn = state.db.lock().unwrap();
        if let Ok(track) = get_track_by_id(&conn, &track_id) {
            state.discord_rpc.set_paused(&track.title, &track.artist, &track.album_title.unwrap_or_default());
        }
    }
    for hook in state.plugins.player_hooks() {
        let _ = hook.on_pause(&track_id, pos).await;
    }
    Ok(())
}

#[tauri::command]
pub async fn resume(state: State<'_, AppState>) -> Result<()> {
    state.player.send(PlayerCommand::Resume);
    let track_id = state.player.current_track_id.lock().unwrap().clone().unwrap_or_default();
    let pos_ms = state.player.position_ms.load(std::sync::atomic::Ordering::Relaxed);
    let dur_ms = state.player.duration_ms.load(std::sync::atomic::Ordering::Relaxed);
    {
        let conn = state.db.lock().unwrap();
        if let Ok(track) = get_track_by_id(&conn, &track_id) {
            state.discord_rpc.set_playing(&track.title, &track.artist, &track.album_title.unwrap_or_default(), pos_ms, dur_ms);
        }
    }
    for hook in state.plugins.player_hooks() {
        let _ = hook.on_resume(&track_id, pos_ms as u64).await;
    }
    Ok(())
}

#[tauri::command]
pub async fn seek(state: State<'_, AppState>, position_ms: u64) -> Result<()> {
    state.player.send(PlayerCommand::Seek { position_ms });
    // Update wall-clock tracking immediately so get_player_state reflects the
    // seek position right away, before the decode thread processes the message.
    let pos_i64 = position_ms as i64;
    state.player.position_ms.store(pos_i64, Ordering::Relaxed);
    state.player.wall_start_pos_ms.store(pos_i64, Ordering::Relaxed);
    if state.player.is_playing.load(Ordering::Relaxed) {
        *state.player.wall_start_time.lock().unwrap() = Some(std::time::Instant::now());
    }
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
    state.discord_rpc.clear();
    for hook in state.plugins.player_hooks() {
        let _ = hook.on_stop().await;
    }
    Ok(())
}

#[tauri::command]
pub async fn get_player_state(state: State<'_, AppState>) -> Result<PlayerState> {
    let player = &state.player;
    // Compute position from the wall clock rather than the decode-ahead atomic,
    // so the display reflects actual playback position regardless of buffer depth.
    let position_ms = {
        let wt = player.wall_start_time.lock().unwrap();
        match *wt {
            Some(t) => {
                let elapsed = t.elapsed().as_millis() as i64;
                let start   = player.wall_start_pos_ms.load(Ordering::Relaxed);
                let dur     = player.duration_ms.load(Ordering::Relaxed);
                (start + elapsed).min(dur).max(0)
            }
            None => player.wall_start_pos_ms.load(Ordering::Relaxed).max(0),
        }
    };
    Ok(PlayerState {
        is_playing: player.is_playing.load(Ordering::Relaxed),
        volume: player.volume.load(Ordering::Relaxed) as u8,
        position_ms,
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
