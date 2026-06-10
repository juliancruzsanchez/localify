use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use crate::audio::engine::PlayerHandle;
use crate::cast::CastState;
use crate::discord_rpc::DiscordRpcHandle;
use crate::media_control::MediaControlHandle;
use crate::plugins::registry::PluginRegistry;

pub struct AppState {
    pub db:           Arc<Mutex<rusqlite::Connection>>,
    pub player:       Arc<PlayerHandle>,
    pub app_data_dir: PathBuf,
    pub cast:         Arc<CastState>,
    pub plugins:      Arc<PluginRegistry>,
    #[allow(dead_code)]
    pub media_control: Option<MediaControlHandle>,
    pub watcher:      Arc<Mutex<Option<crate::watcher::LibraryWatcher>>>,
    pub discord_rpc:  Arc<DiscordRpcHandle>,
}
