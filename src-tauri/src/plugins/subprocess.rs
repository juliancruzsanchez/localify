use std::io::{BufRead, BufReader, Write};
use std::process::{Child, ChildStdin, Stdio};
use std::sync::{Arc, Mutex};
use std::sync::atomic::{AtomicU64, Ordering};
use async_trait::async_trait;
use serde_json::{json, Value};
use crate::error::{AppError, Result};
use crate::plugins::registry::PluginManifest;
use crate::plugins::traits::{
    AudioSourcePlugin, BrowseItemKind, IpcCommandPlugin, LibraryHookPlugin,
    PlayerHookPlugin, Plugin, PluginBrowseItem, PluginTrack, ResolvedStream,
};

// ─── SubprocessPlugin ────────────────────────────────────────────────────────
//
// Communicates with an external plugin executable over stdin/stdout using
// newline-delimited JSON-RPC 2.0.
//
// All trait impls:
//   • Plugin           — init / shutdown
//   • AudioSourcePlugin — search / browse / resolve (blocking call)
//   • LibraryHookPlugin — on_scan_started / on_track_added / … (notify, fire-and-forget)
//   • PlayerHookPlugin  — on_play / on_pause / … (notify, fire-and-forget)
//   • IpcCommandPlugin  — generic dispatch (blocking call)

pub struct SubprocessPlugin {
    manifest: PluginManifest,
    child:    Arc<Mutex<Child>>,
    stdin:    Arc<Mutex<ChildStdin>>,
    reader:   Arc<Mutex<BufReader<std::process::ChildStdout>>>,
    next_id:  Arc<AtomicU64>,
}

impl std::fmt::Debug for SubprocessPlugin {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("SubprocessPlugin")
            .field("id", &self.manifest.id)
            .field("version", &self.manifest.version)
            .finish()
    }
}

impl SubprocessPlugin {
    pub fn spawn(manifest: PluginManifest, exe_path: &std::path::Path) -> Result<Self> {
        let mut child = std::process::Command::new(exe_path)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::inherit())
            .spawn()
            .map_err(|e| AppError::Io(
                format!("Failed to spawn plugin '{}': {e}", manifest.id)
            ))?;

        let stdin  = child.stdin.take().expect("stdin was piped");
        let stdout = child.stdout.take().expect("stdout was piped");

        Ok(Self {
            manifest,
            child:   Arc::new(Mutex::new(child)),
            stdin:   Arc::new(Mutex::new(stdin)),
            reader:  Arc::new(Mutex::new(BufReader::new(stdout))),
            next_id: Arc::new(AtomicU64::new(1)),
        })
    }

    // ── Internal helpers ──────────────────────────────────────────────────

    fn call_blocking(&self, method: &str, params: Value) -> Result<Value> {
        let id = self.next_id.fetch_add(1, Ordering::SeqCst);
        let request = json!({ "jsonrpc": "2.0", "id": id, "method": method, "params": params });
        let mut line = serde_json::to_string(&request).unwrap();
        line.push('\n');

        { self.stdin.lock().unwrap().write_all(line.as_bytes())?; }

        let mut resp_line = String::new();
        { self.reader.lock().unwrap().read_line(&mut resp_line)?; }

        let resp: Value = serde_json::from_str(resp_line.trim())
            .map_err(|e| AppError::InvalidArgument(
                format!("Plugin '{}': bad JSON response: {e}", self.manifest.id)
            ))?;

        if let Some(err) = resp.get("error") {
            return Err(AppError::InvalidArgument(
                format!("Plugin '{}' returned error: {err}", self.manifest.id)
            ));
        }
        Ok(resp["result"].clone())
    }

    /// Fire-and-forget — does not wait for a response.
    fn notify(&self, method: &str, params: Value) {
        let notif = json!({ "jsonrpc": "2.0", "method": method, "params": params });
        let mut line = serde_json::to_string(&notif).unwrap();
        line.push('\n');
        if let Ok(mut stdin) = self.stdin.lock() {
            let _ = stdin.write_all(line.as_bytes());
        }
    }

    /// Async wrapper that moves the blocking call onto a Tokio blocking thread.
    async fn call_async(&self, method: &str, params: Value) -> Result<Value> {
        let stdin   = self.stdin.clone();
        let reader  = self.reader.clone();
        let next_id = self.next_id.clone();
        let plugin_id = self.manifest.id.clone();
        let method = method.to_string();

        tokio::task::spawn_blocking(move || {
            let id = next_id.fetch_add(1, Ordering::SeqCst);
            let request = json!({ "jsonrpc": "2.0", "id": id, "method": method, "params": params });
            let mut line = serde_json::to_string(&request).unwrap();
            line.push('\n');

            { stdin.lock().unwrap().write_all(line.as_bytes())?; }

            let mut resp_line = String::new();
            { reader.lock().unwrap().read_line(&mut resp_line)?; }

            let resp: Value = serde_json::from_str(resp_line.trim())
                .map_err(|e| AppError::InvalidArgument(
                    format!("Plugin '{plugin_id}': bad JSON response: {e}")
                ))?;

            if let Some(err) = resp.get("error") {
                return Err(AppError::InvalidArgument(
                    format!("Plugin '{plugin_id}' returned error: {err}")
                ));
            }
            Ok(resp["result"].clone())
        })
        .await
        .map_err(|e| AppError::Io(e.to_string()))?
    }
}

// ─── Trait implementations ───────────────────────────────────────────────────

#[async_trait]
impl Plugin for SubprocessPlugin {
    fn id(&self) -> &str { &self.manifest.id }
    fn name(&self) -> &str { &self.manifest.name }

    async fn init(&self, config: Value) -> Result<()> {
        self.call_async("init", json!({ "config": config })).await?;
        Ok(())
    }

    async fn shutdown(&self) -> Result<()> {
        self.notify("shutdown", json!({}));
        let _ = self.child.lock().unwrap().kill();
        Ok(())
    }
}

#[async_trait]
impl AudioSourcePlugin for SubprocessPlugin {
    fn source_label(&self) -> &str { self.manifest.name.as_str() }

    async fn search(&self, query: &str, limit: u32) -> Result<Vec<PluginTrack>> {
        let result = self.call_async(
            "audio_source.search",
            json!({ "query": query, "limit": limit }),
        ).await?;
        serde_json::from_value(result["tracks"].clone())
            .map_err(|e| AppError::InvalidArgument(e.to_string()))
    }

    async fn browse_root(&self) -> Result<Vec<PluginBrowseItem>> {
        let result = self.call_async("audio_source.browse_root", json!({})).await?;
        serde_json::from_value(result["items"].clone())
            .map_err(|e| AppError::InvalidArgument(e.to_string()))
    }

    async fn browse_collection(&self, collection_id: &str) -> Result<Vec<PluginTrack>> {
        let result = self.call_async(
            "audio_source.browse_collection",
            json!({ "collection_id": collection_id }),
        ).await?;
        serde_json::from_value(result["tracks"].clone())
            .map_err(|e| AppError::InvalidArgument(e.to_string()))
    }

    async fn resolve_stream(&self, track_id: &str) -> Result<ResolvedStream> {
        let result = self.call_async(
            "audio_source.resolve_stream",
            json!({ "track_id": track_id }),
        ).await?;
        serde_json::from_value(result)
            .map_err(|e| AppError::InvalidArgument(e.to_string()))
    }
}

#[async_trait]
impl LibraryHookPlugin for SubprocessPlugin {
    async fn on_scan_started(&self, paths: &[String]) -> Result<()> {
        self.notify("library.on_scan_started", json!({ "paths": paths }));
        Ok(())
    }

    async fn on_scan_progress(&self, scanned: u32, total: u32) -> Result<()> {
        self.notify("library.on_scan_progress", json!({ "scanned": scanned, "total": total }));
        Ok(())
    }

    async fn on_scan_finished(&self) -> Result<()> {
        self.notify("library.on_scan_finished", json!({}));
        Ok(())
    }

    async fn on_track_added(&self, track_id: &str, file_path: &str) -> Result<()> {
        self.notify("library.on_track_added", json!({ "track_id": track_id, "file_path": file_path }));
        Ok(())
    }

    async fn on_track_removed(&self, track_id: &str, file_path: &str) -> Result<()> {
        self.notify("library.on_track_removed", json!({ "track_id": track_id, "file_path": file_path }));
        Ok(())
    }
}

#[async_trait]
impl PlayerHookPlugin for SubprocessPlugin {
    async fn on_play(&self, track_id: &str, position_ms: u64) -> Result<()> {
        self.notify("player.on_play", json!({ "track_id": track_id, "position_ms": position_ms }));
        Ok(())
    }

    async fn on_pause(&self, track_id: &str, position_ms: u64) -> Result<()> {
        self.notify("player.on_pause", json!({ "track_id": track_id, "position_ms": position_ms }));
        Ok(())
    }

    async fn on_resume(&self, track_id: &str, position_ms: u64) -> Result<()> {
        self.notify("player.on_resume", json!({ "track_id": track_id, "position_ms": position_ms }));
        Ok(())
    }

    async fn on_seek(&self, track_id: &str, position_ms: u64) -> Result<()> {
        self.notify("player.on_seek", json!({ "track_id": track_id, "position_ms": position_ms }));
        Ok(())
    }

    async fn on_track_ended(&self, track_id: &str) -> Result<()> {
        self.notify("player.on_track_ended", json!({ "track_id": track_id }));
        Ok(())
    }

    async fn on_stop(&self) -> Result<()> {
        self.notify("player.on_stop", json!({}));
        Ok(())
    }
}

#[async_trait]
impl IpcCommandPlugin for SubprocessPlugin {
    fn command_names(&self) -> Vec<String> { vec![] }

    async fn dispatch(&self, method: &str, params: Value) -> Result<Value> {
        self.call_async(method, params).await
    }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::plugins::registry::{BackendConfig, PluginPermissions};

    fn fake_manifest() -> PluginManifest {
        PluginManifest {
            id: "com.test.fake".to_string(),
            name: "Fake".to_string(),
            version: "1.0.0".to_string(),
            api_version: "1".to_string(),
            description: None,
            capabilities: vec![],
            backend: BackendConfig::None,
            frontend: None,
            permissions: PluginPermissions::default(),
            settings_schema: None,
        }
    }

    #[test]
    fn spawn_nonexistent_exe_returns_error() {
        let result = SubprocessPlugin::spawn(
            fake_manifest(),
            std::path::Path::new("/nonexistent/plugin_binary"),
        );
        assert!(result.is_err());
        let msg = result.unwrap_err().to_string();
        assert!(msg.contains("Failed to spawn"));
    }

    /// Verify JSON-RPC framing using `cat` as a trivial echo process (Unix only).
    /// `cat` echoes stdin to stdout, so we use a Python one-liner that actually
    /// parses and responds, making the test meaningful but dependency-light.
    #[test]
    #[cfg(unix)]
    fn call_blocking_roundtrip_via_python() {
        // Skip if python3 not available
        if std::process::Command::new("python3").arg("--version").output().is_err() {
            return;
        }

        let script = r#"
import sys, json
for line in sys.stdin:
    line = line.strip()
    if not line: continue
    req = json.loads(line)
    resp = {"jsonrpc": "2.0", "id": req.get("id"), "result": {"pong": True}}
    print(json.dumps(resp), flush=True)
"#;
        let tmp = tempfile::NamedTempFile::new().unwrap();
        std::fs::write(tmp.path(), script).unwrap();

        // Spawn python3 running our script
        let mut child = std::process::Command::new("python3")
            .arg(tmp.path())
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::inherit())
            .spawn()
            .expect("python3 should be available");

        let stdin  = child.stdin.take().unwrap();
        let stdout = child.stdout.take().unwrap();

        let plugin = SubprocessPlugin {
            manifest: fake_manifest(),
            child:   Arc::new(Mutex::new(child)),
            stdin:   Arc::new(Mutex::new(stdin)),
            reader:  Arc::new(Mutex::new(BufReader::new(stdout))),
            next_id: Arc::new(AtomicU64::new(1)),
        };

        let result = plugin.call_blocking("ping", json!({}));
        assert!(result.is_ok(), "Expected Ok, got: {:?}", result);
        assert_eq!(result.unwrap()["pong"], true);
    }
}
