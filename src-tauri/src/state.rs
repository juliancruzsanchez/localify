use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use crate::audio::engine::PlayerHandle;

pub struct AppState {
    pub db: Arc<Mutex<rusqlite::Connection>>,
    pub player: Arc<PlayerHandle>,
    pub app_data_dir: PathBuf,
}
