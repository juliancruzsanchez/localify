use std::path::{Path, PathBuf};
use tauri::{State, Emitter};
use serde::{Deserialize, Serialize};
use crate::error::{AppError, Result};
use crate::state::AppState;

// ─── Types ────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FfmpegStatus {
    pub available: bool,
    pub managed: bool, // true if we installed it ourselves into app_data_dir/bin
}

// ─── Binary resolution ────────────────────────────────────────────────────────

fn bin_name() -> &'static str {
    if cfg!(target_os = "windows") { "ffmpeg.exe" } else { "ffmpeg" }
}

fn managed_bin_path(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join("bin").join(bin_name())
}

/// Returns the command to use when invoking ffmpeg. Prefers the managed copy in
/// `app_data_dir/bin` over whatever is on PATH so the bundled version is always
/// used. Shared with the cast/transcode code path.
pub fn resolve_ffmpeg(app_data_dir: &Path) -> String {
    let managed = managed_bin_path(app_data_dir);
    if managed.exists() {
        return managed.to_string_lossy().into_owned();
    }
    "ffmpeg".to_string()
}

/// True if the resolved ffmpeg binary is runnable.
pub async fn ffmpeg_available(app_data_dir: &Path) -> bool {
    let bin = resolve_ffmpeg(app_data_dir);
    tokio::process::Command::new(&bin)
        .arg("-version")
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .await
        .map(|s| s.success())
        .unwrap_or(false)
}

// ─── Commands ─────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn ffmpeg_check(state: State<'_, AppState>) -> Result<FfmpegStatus> {
    let managed_exists = managed_bin_path(&state.app_data_dir).exists();
    let available = ffmpeg_available(&state.app_data_dir).await;
    Ok(FfmpegStatus { available, managed: available && managed_exists })
}

/// Download a static ffmpeg build and install just the `ffmpeg` binary into
/// `{app_data_dir}/bin`. Archives are extracted with the system `tar` (libarchive
/// on macOS, bsdtar on Windows 10+, GNU tar on Linux — each handles the format we
/// fetch for its platform). Emits `ffmpeg:install_progress` events with
/// `{ pct: f32, done: bool }`.
#[tauri::command]
pub async fn ffmpeg_install(
    state: State<'_, AppState>,
    app_handle: tauri::AppHandle,
) -> Result<FfmpegStatus> {
    use tokio::io::AsyncWriteExt;

    let bin_dir = state.app_data_dir.join("bin");
    tokio::fs::create_dir_all(&bin_dir)
        .await
        .map_err(|e| AppError::Io(e.to_string()))?;

    // Each platform's archive format matches what its bundled `tar` can extract.
    #[cfg(target_os = "macos")]
    let (url, archive_name) = (
        "https://evermeet.cx/ffmpeg/getrelease/ffmpeg/zip",
        "ffmpeg_download.zip",
    );
    #[cfg(target_os = "windows")]
    let (url, archive_name) = (
        "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip",
        "ffmpeg_download.zip",
    );
    #[cfg(target_os = "linux")]
    let (url, archive_name) = (
        "https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz",
        "ffmpeg_download.tar.xz",
    );

    let _ = app_handle.emit("ffmpeg:install_progress", serde_json::json!({ "pct": 0.0, "done": false }));

    // ── Download the archive to disk ────────────────────────────────────────
    let archive_path = bin_dir.join(archive_name);
    let client = reqwest::Client::builder()
        .user_agent("Localify/1.0")
        .build()
        .map_err(|e| AppError::Io(e.to_string()))?;

    let mut response = client
        .get(url)
        .send()
        .await
        .map_err(|e| AppError::Io(format!("Download failed: {e}")))?;

    if !response.status().is_success() {
        return Err(AppError::Io(format!("HTTP {}", response.status())));
    }

    let total = response.content_length();
    let mut downloaded: u64 = 0;
    {
        let mut file = tokio::fs::File::create(&archive_path)
            .await
            .map_err(|e| AppError::Io(e.to_string()))?;
        while let Some(chunk) = response
            .chunk()
            .await
            .map_err(|e| AppError::Io(e.to_string()))?
        {
            file.write_all(&chunk).await.map_err(|e| AppError::Io(e.to_string()))?;
            downloaded += chunk.len() as u64;
            // Reserve the last 10% for extraction.
            let pct = total
                .filter(|&t| t > 0)
                .map(|t| (downloaded as f32 / t as f32) * 90.0)
                .unwrap_or(0.0);
            let _ = app_handle.emit("ffmpeg:install_progress", serde_json::json!({ "pct": pct, "done": false }));
        }
        file.flush().await.map_err(|e| AppError::Io(e.to_string()))?;
    }

    let _ = app_handle.emit("ffmpeg:install_progress", serde_json::json!({ "pct": 92.0, "done": false }));

    // ── Extract and install the binary ──────────────────────────────────────
    let result = extract_and_install(&archive_path, &bin_dir).await;
    let _ = tokio::fs::remove_file(&archive_path).await;
    result?;

    let _ = app_handle.emit("ffmpeg:install_progress", serde_json::json!({ "pct": 100.0, "done": true }));

    let available = ffmpeg_available(&state.app_data_dir).await;
    Ok(FfmpegStatus { available, managed: true })
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/// Extract `archive` into a temp dir, locate the ffmpeg binary inside it, and
/// move that binary into `bin_dir`.
async fn extract_and_install(archive: &Path, bin_dir: &Path) -> Result<()> {
    let extract_dir = bin_dir.join("ffmpeg_extract_tmp");
    let _ = tokio::fs::remove_dir_all(&extract_dir).await;
    tokio::fs::create_dir_all(&extract_dir)
        .await
        .map_err(|e| AppError::Io(e.to_string()))?;

    let status = tokio::process::Command::new("tar")
        .arg("-xf")
        .arg(archive)
        .arg("-C")
        .arg(&extract_dir)
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .await
        .map_err(|e| AppError::Io(format!("Failed to extract archive: {e}")))?;

    if !status.success() {
        let _ = tokio::fs::remove_dir_all(&extract_dir).await;
        return Err(AppError::Io("Failed to extract ffmpeg archive".into()));
    }

    // The binary lives at an unknown depth (evermeet ships it at the root, gyan
    // under `bin/`, johnvansickle under a versioned dir) — walk to find it.
    let wanted = bin_name();
    let found = walkdir::WalkDir::new(&extract_dir)
        .into_iter()
        .filter_map(|e| e.ok())
        .find(|e| e.file_type().is_file() && e.file_name().to_string_lossy() == wanted)
        .map(|e| e.path().to_path_buf());

    let src = match found {
        Some(p) => p,
        None => {
            let _ = tokio::fs::remove_dir_all(&extract_dir).await;
            return Err(AppError::Io("ffmpeg binary not found in archive".into()));
        }
    };

    let dest = bin_dir.join(wanted);
    // `rename` can fail across filesystems; copy then drop the temp tree.
    tokio::fs::copy(&src, &dest)
        .await
        .map_err(|e| AppError::Io(e.to_string()))?;
    let _ = tokio::fs::remove_dir_all(&extract_dir).await;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&dest, std::fs::Permissions::from_mode(0o755))
            .map_err(|e| AppError::Io(e.to_string()))?;
    }

    Ok(())
}
