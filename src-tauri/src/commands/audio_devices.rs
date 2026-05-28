/// Audio output device commands (AirPlay / casting support).
///
/// On macOS, AirPlay receivers appear as CoreAudio output devices once the
/// system has discovered them.  By letting the user pick any cpal output
/// device we get AirPlay for free — no proprietary protocol needed.

use tauri::State;
use serde::{Deserialize, Serialize};
use cpal::traits::{DeviceTrait, HostTrait};

use crate::audio::engine::PlayerCommand;
use crate::error::{AppError, Result};
use crate::state::AppState;

const SETTING_KEY: &str = "selected_audio_device";

// ─── Types ────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioDevice {
    pub name:       String,
    pub is_default: bool,
}

// ─── DB helpers ───────────────────────────────────────────────────────────────

pub fn db_save_device(conn: &rusqlite::Connection, device_name: Option<&str>) -> Result<()> {
    match device_name {
        Some(name) => {
            conn.execute(
                "INSERT INTO app_settings (key, value, updated_at)
                 VALUES (?1, ?2, unixepoch())
                 ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
                rusqlite::params![SETTING_KEY, name],
            )?;
        }
        None => {
            conn.execute("DELETE FROM app_settings WHERE key = ?1", rusqlite::params![SETTING_KEY])?;
        }
    }
    Ok(())
}

pub fn db_load_device(conn: &rusqlite::Connection) -> Result<Option<String>> {
    let mut stmt = conn.prepare("SELECT value FROM app_settings WHERE key = ?1")?;
    let result = stmt.query_row(rusqlite::params![SETTING_KEY], |row| row.get::<_, String>(0));
    match result {
        Ok(v) => Ok(Some(v)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.into()),
    }
}

// ─── Commands ─────────────────────────────────────────────────────────────────

/// List all available output devices on the default host.
/// On macOS this includes built-in speakers, Bluetooth headphones, AirPlay
/// receivers, and any other CoreAudio output device.
#[tauri::command]
pub async fn get_audio_output_devices() -> Result<Vec<AudioDevice>> {
    let host = cpal::default_host();

    let default_name = host
        .default_output_device()
        .and_then(|d| d.name().ok())
        .unwrap_or_default();

    let devices = host
        .output_devices()
        .map_err(|e| AppError::Audio(e.to_string()))?
        .filter_map(|d| {
            d.name().ok().map(|name| AudioDevice {
                is_default: name == default_name,
                name,
            })
        })
        .collect();

    Ok(devices)
}

/// Switch playback to the named output device.
/// Pass `None` to revert to the system default.
#[tauri::command]
pub async fn set_audio_output_device(
    state:       State<'_, AppState>,
    device_name: Option<String>,
) -> Result<()> {
    {
        let conn = state.db.lock().unwrap();
        db_save_device(&conn, device_name.as_deref())?;
    }
    state.player.send(PlayerCommand::SwitchDevice { device_name });
    Ok(())
}

/// Return the name of the currently selected output device (or `None` if
/// using the system default).
/// Falls back to the DB-persisted value when in-memory state is not yet set.
#[tauri::command]
pub async fn get_selected_audio_device(
    state: State<'_, AppState>,
) -> Result<Option<String>> {
    let in_memory = state.player.selected_device.lock().unwrap().clone();
    if in_memory.is_some() {
        return Ok(in_memory);
    }
    let conn = state.db.lock().unwrap();
    db_load_device(&conn)
}
