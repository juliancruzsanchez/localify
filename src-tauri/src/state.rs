use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use crate::audio::engine::PlayerHandle;
use crate::cast::CastState;
use crate::plugins::registry::PluginRegistry;

pub struct AppState {
    pub db:           Arc<Mutex<rusqlite::Connection>>,
    pub player:       Arc<PlayerHandle>,
    pub app_data_dir: PathBuf,
    pub cast:         Arc<CastState>,
    pub plugins:      Arc<PluginRegistry>,
}
