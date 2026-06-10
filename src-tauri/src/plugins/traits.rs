use async_trait::async_trait;
use serde_json::Value;
use crate::error::Result;

// ─── Base Plugin ─────────────────────────────────────────────────────────────

/// Base trait every backend plugin must implement.
/// All methods take `&self` — implementations use internal mutability (Mutex) for state.
#[async_trait]
#[allow(dead_code)]
pub trait Plugin: Send + Sync {
    fn id(&self) -> &str;
    fn name(&self) -> &str;
    /// Called once after loading, before any other method. `config` is persisted settings.
    async fn init(&self, config: Value) -> Result<()>;
    /// Called when Localify shuts down or the plugin is unloaded.
    async fn shutdown(&self) -> Result<()>;
}

// ─── Audio Source ────────────────────────────────────────────────────────────

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct PluginTrack {
    pub id: String,
    pub title: String,
    pub artist: String,
    pub album: Option<String>,
    pub duration_secs: f64,
    pub artwork_url: Option<String>,
    /// If true, `resolve_stream` must be called before playback.
    pub needs_resolve: bool,
    pub meta: serde_json::Value,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct PluginBrowseItem {
    pub id: String,
    pub label: String,
    pub kind: BrowseItemKind,
    pub artwork_url: Option<String>,
    pub track_count: Option<u32>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BrowseItemKind {
    Collection,
    Track,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ResolvedStream {
    /// A file:// path or http(s):// URL the audio engine can play directly.
    pub uri: String,
    pub content_type: Option<String>,
    /// Unix timestamp after which the URL expires (None = never).
    pub expires_at: Option<i64>,
    pub headers: std::collections::HashMap<String, String>,
}

/// A browsable/searchable external audio source (e.g., YouTube via yt-dlp, DLNA).
#[async_trait]
#[allow(dead_code)]
pub trait AudioSourcePlugin: Plugin {
    fn source_label(&self) -> &str;
    fn source_icon_svg(&self) -> Option<&str> { None }
    async fn search(&self, query: &str, limit: u32) -> Result<Vec<PluginTrack>>;
    async fn browse_root(&self) -> Result<Vec<PluginBrowseItem>>;
    async fn browse_collection(&self, collection_id: &str) -> Result<Vec<PluginTrack>>;
    /// Resolve a track to a playable URI. Called right before playback.
    async fn resolve_stream(&self, track_id: &str) -> Result<ResolvedStream>;
}

// ─── Library Hooks ───────────────────────────────────────────────────────────

/// Hooks into the library scanner lifecycle. All methods have default no-op impls.
#[async_trait]
#[allow(dead_code)]
pub trait LibraryHookPlugin: Plugin {
    async fn on_scan_started(&self, _paths: &[String]) -> Result<()> { Ok(()) }
    async fn on_scan_progress(&self, _scanned: u32, _total: u32) -> Result<()> { Ok(()) }
    async fn on_scan_finished(&self) -> Result<()> { Ok(()) }
    async fn on_track_added(&self, _track_id: &str, _file_path: &str) -> Result<()> { Ok(()) }
    async fn on_track_removed(&self, _track_id: &str, _file_path: &str) -> Result<()> { Ok(()) }
}

// ─── Player Hooks ────────────────────────────────────────────────────────────

/// Hooks into player state transitions. All methods have default no-op impls.
#[async_trait]
#[allow(dead_code)]
pub trait PlayerHookPlugin: Plugin {
    async fn on_play(&self, _track_id: &str, _position_ms: u64) -> Result<()> { Ok(()) }
    async fn on_pause(&self, _track_id: &str, _position_ms: u64) -> Result<()> { Ok(()) }
    async fn on_resume(&self, _track_id: &str, _position_ms: u64) -> Result<()> { Ok(()) }
    async fn on_seek(&self, _track_id: &str, _position_ms: u64) -> Result<()> { Ok(()) }
    async fn on_track_ended(&self, _track_id: &str) -> Result<()> { Ok(()) }
    async fn on_stop(&self) -> Result<()> { Ok(()) }
}

// ─── IPC Commands ────────────────────────────────────────────────────────────

/// Lets a plugin expose custom IPC commands to the frontend.
/// The host proxies `plugin_dispatch(plugin_id, method, params)` calls here.
#[async_trait]
#[allow(dead_code)]
pub trait IpcCommandPlugin: Plugin {
    fn command_names(&self) -> Vec<String>;
    async fn dispatch(&self, method: &str, params: serde_json::Value) -> Result<serde_json::Value>;
}
