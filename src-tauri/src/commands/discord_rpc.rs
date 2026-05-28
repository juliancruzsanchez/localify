use tauri::State;
use serde::{Deserialize, Serialize};
use crate::error::Result;
use crate::state::AppState;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscordRpcStatus {
    pub enabled: bool,
}

#[tauri::command]
pub async fn discord_rpc_enable(state: State<'_, AppState>) -> Result<()> {
    state.discord_rpc.set_enabled(true);
    Ok(())
}

#[tauri::command]
pub async fn discord_rpc_disable(state: State<'_, AppState>) -> Result<()> {
    state.discord_rpc.set_enabled(false);
    Ok(())
}

#[tauri::command]
pub async fn discord_rpc_get_status(state: State<'_, AppState>) -> Result<DiscordRpcStatus> {
    Ok(DiscordRpcStatus {
        enabled: state.discord_rpc.is_enabled(),
    })
}
