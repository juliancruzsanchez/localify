use std::path::Path;
use std::sync::Arc;
use crate::error::{AppError, Result};
use crate::plugins::registry::{
    BackendConfig, LoadedPlugin, PlatformExecutable, PluginManifest, PluginRegistry,
};
use crate::plugins::subprocess::SubprocessPlugin;

// ─── Public API ──────────────────────────────────────────────────────────────

/// Scan `plugins_dir` for `plugin.json` files, load each plugin, and register it.
/// Creates `plugins_dir` if it does not exist.
/// Individual load errors are logged but do not abort the loop.
pub fn load_plugins_from_dir(plugins_dir: &Path, registry: &PluginRegistry) -> Result<()> {
    if !plugins_dir.exists() {
        std::fs::create_dir_all(plugins_dir)?;
        return Ok(());
    }

    for entry in std::fs::read_dir(plugins_dir)?.flatten() {
        let manifest_path = entry.path().join("plugin.json");
        if !manifest_path.exists() { continue; }

        match load_one_plugin(&entry.path()) {
            Ok(loaded) => {
                log::info!("[plugins] Loaded: {} v{}", loaded.manifest.name, loaded.manifest.version);
                registry.register(loaded);
            }
            Err(e) => log::error!("[plugins] Failed to load {:?}: {e}", entry.path()),
        }
    }

    Ok(())
}

/// Load a single plugin from `plugin_dir` (must contain `plugin.json`).
pub fn load_one_plugin(plugin_dir: &Path) -> Result<LoadedPlugin> {
    let json_bytes = std::fs::read(plugin_dir.join("plugin.json"))?;
    let manifest: PluginManifest = serde_json::from_slice(&json_bytes)
        .map_err(|e| AppError::InvalidArgument(
            format!("Invalid plugin.json in {:?}: {e}", plugin_dir)
        ))?;

    validate_manifest(&manifest)?;

    match &manifest.backend {
        BackendConfig::None => Ok(LoadedPlugin {
            manifest,
            audio_source: None,
            library_hook: None,
            player_hook: None,
            ipc_command: None,
        }),

        BackendConfig::Subprocess { executable, .. } => {
            let exe_path = resolve_exe_path(plugin_dir, executable)?;
            let sp = Arc::new(SubprocessPlugin::spawn(manifest.clone(), &exe_path)?);

            let has = |cap: &str| manifest.capabilities.iter().any(|c| c == cap);

            Ok(LoadedPlugin {
                audio_source: if has("audio_source")  { Some(sp.clone()) } else { None },
                library_hook: if has("library_hooks") { Some(sp.clone()) } else { None },
                player_hook:  if has("player_hooks")  { Some(sp.clone()) } else { None },
                ipc_command:  if has("ipc_commands")  { Some(sp.clone()) } else { None },
                manifest,
            })
        }
    }
}

pub fn validate_manifest(manifest: &PluginManifest) -> Result<()> {
    if manifest.api_version != "1" {
        return Err(AppError::InvalidArgument(format!(
            "Plugin '{}' requires api_version=1, got '{}'",
            manifest.id, manifest.api_version
        )));
    }
    if !manifest.id.contains('.') {
        return Err(AppError::InvalidArgument(format!(
            "Plugin id '{}' must be a reverse-DNS identifier (e.g. com.example.myplugin)",
            manifest.id
        )));
    }
    Ok(())
}

pub fn copy_dir_all(src: &Path, dst: &Path) -> std::io::Result<()> {
    std::fs::create_dir_all(dst)?;
    for entry in std::fs::read_dir(src)? {
        let entry = entry?;
        let ty = entry.file_type()?;
        if ty.is_dir() {
            copy_dir_all(&entry.path(), &dst.join(entry.file_name()))?;
        } else {
            std::fs::copy(entry.path(), dst.join(entry.file_name()))?;
        }
    }
    Ok(())
}

fn resolve_exe_path(plugin_dir: &Path, exe: &PlatformExecutable) -> Result<std::path::PathBuf> {
    let rel = if cfg!(target_os = "macos") {
        exe.macos.as_deref()
    } else if cfg!(target_os = "windows") {
        exe.windows.as_deref()
    } else {
        exe.linux.as_deref()
    };

    let rel = rel.ok_or_else(|| AppError::InvalidArgument(
        "No executable path for the current platform in plugin.json".to_string()
    ))?;

    let path = plugin_dir.join(rel);
    if !path.exists() {
        return Err(AppError::InvalidArgument(
            format!("Plugin executable not found: {:?}", path)
        ));
    }
    Ok(path)
}

// ─── Tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    fn write_manifest(dir: &Path, json: &str) {
        fs::create_dir_all(dir).unwrap();
        fs::write(dir.join("plugin.json"), json).unwrap();
    }

    #[test]
    fn load_from_empty_dir_is_ok() {
        let tmp = TempDir::new().unwrap();
        let registry = PluginRegistry::new();
        load_plugins_from_dir(tmp.path(), &registry).unwrap();
        assert_eq!(registry.all_manifests().len(), 0);
    }

    #[test]
    fn missing_manifest_is_skipped() {
        let tmp = TempDir::new().unwrap();
        fs::create_dir_all(tmp.path().join("com.test.no-manifest")).unwrap();
        let registry = PluginRegistry::new();
        load_plugins_from_dir(tmp.path(), &registry).unwrap();
        assert_eq!(registry.all_manifests().len(), 0);
    }

    #[test]
    fn frontend_only_plugin_loads() {
        let tmp = TempDir::new().unwrap();
        let plugin_dir = tmp.path().join("com.test.ui");
        write_manifest(&plugin_dir, r#"{
            "id": "com.test.ui",
            "name": "UI Plugin",
            "version": "1.0.0",
            "api_version": "1",
            "capabilities": ["ui_components"],
            "backend": {"kind": "none"},
            "permissions": {}
        }"#);
        let registry = PluginRegistry::new();
        load_plugins_from_dir(tmp.path(), &registry).unwrap();
        assert_eq!(registry.all_manifests().len(), 1);
        assert_eq!(registry.all_manifests()[0].id, "com.test.ui");
    }

    #[test]
    fn validate_rejects_bad_api_version() {
        let manifest = minimal_manifest("com.test.foo", "99");
        assert!(validate_manifest(&manifest).is_err());
        let err = validate_manifest(&manifest).unwrap_err().to_string();
        assert!(err.contains("api_version"));
    }

    #[test]
    fn validate_rejects_non_reverse_dns_id() {
        let manifest = minimal_manifest("myplugin", "1");
        assert!(validate_manifest(&manifest).is_err());
    }

    #[test]
    fn validate_accepts_valid_manifest() {
        let manifest = minimal_manifest("com.example.plugin", "1");
        assert!(validate_manifest(&manifest).is_ok());
    }

    #[test]
    fn copy_dir_all_copies_nested_files() {
        let tmp = TempDir::new().unwrap();
        let src = tmp.path().join("src");
        let dst = tmp.path().join("dst");
        fs::create_dir_all(src.join("sub")).unwrap();
        fs::write(src.join("plugin.json"), "{}").unwrap();
        fs::write(src.join("sub").join("file.js"), "console.log('hi')").unwrap();
        copy_dir_all(&src, &dst).unwrap();
        assert!(dst.join("plugin.json").exists());
        assert!(dst.join("sub").join("file.js").exists());
    }

    fn minimal_manifest(id: &str, api_version: &str) -> PluginManifest {
        use crate::plugins::registry::{BackendConfig, PluginPermissions};
        PluginManifest {
            id: id.to_string(),
            name: "Test".to_string(),
            version: "1.0.0".to_string(),
            api_version: api_version.to_string(),
            description: None,
            capabilities: vec![],
            backend: BackendConfig::None,
            frontend: None,
            permissions: PluginPermissions::default(),
            settings_schema: None,
        }
    }
}
