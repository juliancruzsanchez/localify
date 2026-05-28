use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use serde::{Deserialize, Serialize};
use crate::plugins::traits::{AudioSourcePlugin, LibraryHookPlugin, PlayerHookPlugin, IpcCommandPlugin};

// ─── Manifest types ───────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginManifest {
    pub id: String,
    pub name: String,
    pub version: String,
    pub api_version: String,
    pub description: Option<String>,
    #[serde(default)]
    pub capabilities: Vec<String>,
    pub backend: BackendConfig,
    pub frontend: Option<FrontendConfig>,
    #[serde(default)]
    pub permissions: PluginPermissions,
    pub settings_schema: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum BackendConfig {
    Subprocess {
        executable: PlatformExecutable,
        #[serde(default)]
        args: Vec<String>,
        #[serde(default)]
        env: HashMap<String, String>,
        startup_timeout_ms: Option<u64>,
    },
    None,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlatformExecutable {
    pub macos:   Option<String>,
    pub windows: Option<String>,
    pub linux:   Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FrontendConfig {
    pub entry:  String,
    pub styles: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct PluginPermissions {
    #[serde(default)] pub network:          bool,
    #[serde(default)] pub filesystem:       bool,
    #[serde(default)] pub exec_subprocess:  bool,
    #[serde(default)] pub read_library_db:  bool,
    #[serde(default)] pub write_library_db: bool,
    #[serde(default)] pub player_control:   bool,
    #[serde(default)] pub player_observe:   bool,
}

// ─── Loaded plugin ────────────────────────────────────────────────────────────

/// A fully loaded and initialised plugin, with optional trait-object handles for each capability.
/// `Arc<dyn Trait>` is used so callers can clone the Arc and call async methods
/// without holding any registry lock across an await point.
pub struct LoadedPlugin {
    pub manifest:     PluginManifest,
    pub audio_source: Option<Arc<dyn AudioSourcePlugin>>,
    pub library_hook: Option<Arc<dyn LibraryHookPlugin>>,
    pub player_hook:  Option<Arc<dyn PlayerHookPlugin>>,
    pub ipc_command:  Option<Arc<dyn IpcCommandPlugin>>,
}

// ─── Registry ────────────────────────────────────────────────────────────────

pub struct PluginRegistry {
    plugins: RwLock<HashMap<String, LoadedPlugin>>,
}

impl PluginRegistry {
    pub fn new() -> Arc<Self> {
        Arc::new(Self { plugins: RwLock::new(HashMap::new()) })
    }

    pub fn register(&self, plugin: LoadedPlugin) {
        let id = plugin.manifest.id.clone();
        self.plugins.write().unwrap().insert(id, plugin);
    }

    pub fn remove(&self, id: &str) -> bool {
        self.plugins.write().unwrap().remove(id).is_some()
    }

    pub fn has(&self, id: &str) -> bool {
        self.plugins.read().unwrap().contains_key(id)
    }

    pub fn all_manifests(&self) -> Vec<PluginManifest> {
        self.plugins.read().unwrap()
            .values()
            .map(|p| p.manifest.clone())
            .collect()
    }

    // ── Capability accessors — clone Arcs before returning so callers
    //    never hold the registry lock across an async boundary.

    pub fn audio_sources(&self) -> Vec<Arc<dyn AudioSourcePlugin>> {
        self.plugins.read().unwrap()
            .values()
            .filter_map(|p| p.audio_source.clone())
            .collect()
    }

    pub fn library_hooks(&self) -> Vec<Arc<dyn LibraryHookPlugin>> {
        self.plugins.read().unwrap()
            .values()
            .filter_map(|p| p.library_hook.clone())
            .collect()
    }

    pub fn player_hooks(&self) -> Vec<Arc<dyn PlayerHookPlugin>> {
        self.plugins.read().unwrap()
            .values()
            .filter_map(|p| p.player_hook.clone())
            .collect()
    }

    pub fn ipc_command(&self, id: &str) -> Option<Arc<dyn IpcCommandPlugin>> {
        self.plugins.read().unwrap()
            .get(id)
            .and_then(|p| p.ipc_command.clone())
    }

    pub fn audio_source(&self, id: &str) -> Option<Arc<dyn AudioSourcePlugin>> {
        self.plugins.read().unwrap()
            .get(id)
            .and_then(|p| p.audio_source.clone())
    }

    pub fn manifest(&self, id: &str) -> Option<PluginManifest> {
        self.plugins.read().unwrap()
            .get(id)
            .map(|p| p.manifest.clone())
    }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn make_manifest(id: &str) -> PluginManifest {
        PluginManifest {
            id: id.to_string(),
            name: "Test Plugin".to_string(),
            version: "1.0.0".to_string(),
            api_version: "1".to_string(),
            description: None,
            capabilities: vec!["ui_components".to_string()],
            backend: BackendConfig::None,
            frontend: None,
            permissions: PluginPermissions::default(),
            settings_schema: None,
        }
    }

    fn make_ui_only_plugin(id: &str) -> LoadedPlugin {
        LoadedPlugin {
            manifest: make_manifest(id),
            audio_source: None,
            library_hook: None,
            player_hook: None,
            ipc_command: None,
        }
    }

    #[test]
    fn register_and_has() {
        let registry = PluginRegistry::new();
        registry.register(make_ui_only_plugin("com.test.hello"));
        assert!(registry.has("com.test.hello"));
        assert!(!registry.has("com.test.missing"));
    }

    #[test]
    fn remove_plugin() {
        let registry = PluginRegistry::new();
        registry.register(make_ui_only_plugin("com.test.remove-me"));
        assert!(registry.has("com.test.remove-me"));
        assert!(registry.remove("com.test.remove-me"));
        assert!(!registry.has("com.test.remove-me"));
        assert!(!registry.remove("com.test.remove-me")); // idempotent
    }

    #[test]
    fn audio_sources_filter() {
        let registry = PluginRegistry::new();
        registry.register(make_ui_only_plugin("com.test.ui-only"));
        assert_eq!(registry.audio_sources().len(), 0);
        assert_eq!(registry.all_manifests().len(), 1);
    }

    #[test]
    fn all_manifests_aggregates() {
        let registry = PluginRegistry::new();
        for i in 0..3 {
            registry.register(make_ui_only_plugin(&format!("com.test.plugin{i}")));
        }
        assert_eq!(registry.all_manifests().len(), 3);
    }

    #[test]
    fn manifest_lookup() {
        let registry = PluginRegistry::new();
        registry.register(make_ui_only_plugin("com.test.lookup"));
        let m = registry.manifest("com.test.lookup");
        assert!(m.is_some());
        assert_eq!(m.unwrap().name, "Test Plugin");
        assert!(registry.manifest("com.test.nope").is_none());
    }
}
