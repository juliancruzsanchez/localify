use std::path::{Path, PathBuf};
use tauri::{State, Emitter};
use serde::{Deserialize, Serialize};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use crate::error::{AppError, Result};
use crate::state::AppState;
use crate::scanner::scan::{ScanContext, process_file};

// ─── Types ────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct YtdlpSearchResult {
    pub id: String,
    pub title: String,
    pub uploader: String,
    pub duration_secs: f64,
    pub thumbnail_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct YtdlpProgress {
    pub video_id: String,
    pub status: String,
    pub pct: f32,
    pub track_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct YtdlpStatus {
    pub available: bool,
    pub version: Option<String>,
    pub managed: bool, // true if we installed it ourselves into app_data_dir/bin
}

// ─── Binary resolution ────────────────────────────────────────────────────────

fn managed_bin_path(app_data_dir: &Path) -> PathBuf {
    let name = if cfg!(target_os = "windows") { "yt-dlp.exe" } else { "yt-dlp" };
    app_data_dir.join("bin").join(name)
}

/// Returns the path to use when invoking yt-dlp.  Prefers the managed copy in
/// app_data_dir/bin over whatever is on PATH so the bundled version is always used.
fn resolve_bin(app_data_dir: &Path) -> String {
    let managed = managed_bin_path(app_data_dir);
    if managed.exists() {
        return managed.to_string_lossy().into_owned();
    }
    // Fall back to the system-wide yt-dlp
    "yt-dlp".to_string()
}

fn yt_dlp_version(bin: &str) -> Option<String> {
    std::process::Command::new(bin)
        .arg("--version")
        .output()
        .ok()
        .filter(|o| o.status.success())
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .map(|s| s.trim().to_string())
}

// ─── Commands ─────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn ytdlp_check(state: State<'_, AppState>) -> Result<YtdlpStatus> {
    let bin = resolve_bin(&state.app_data_dir);
    let managed = Path::new(&bin) != Path::new("yt-dlp");
    match yt_dlp_version(&bin) {
        Some(v) => Ok(YtdlpStatus { available: true, version: Some(v), managed }),
        None     => Ok(YtdlpStatus { available: false, version: None, managed: false }),
    }
}

/// Download the official yt-dlp release binary into {app_data_dir}/bin/yt-dlp.
/// Emits `ytdlp:install_progress` events with `{ pct: f32, done: bool, error: Option<String> }`.
#[tauri::command]
pub async fn ytdlp_install(
    state: State<'_, AppState>,
    app_handle: tauri::AppHandle,
) -> Result<YtdlpStatus> {
    let bin_dir = state.app_data_dir.join("bin");
    tokio::fs::create_dir_all(&bin_dir)
        .await
        .map_err(|e| AppError::Io(e.to_string()))?;

    let bin_path = managed_bin_path(&state.app_data_dir);

    #[cfg(target_os = "macos")]
    let url = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos";
    #[cfg(target_os = "windows")]
    let url = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe";
    #[cfg(target_os = "linux")]
    let url = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux";

    let _ = app_handle.emit("ytdlp:install_progress", serde_json::json!({ "pct": 0.0, "done": false }));

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

    let mut file = tokio::fs::File::create(&bin_path)
        .await
        .map_err(|e| AppError::Io(e.to_string()))?;

    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|e| AppError::Io(e.to_string()))?
    {
        file.write_all(&chunk)
            .await
            .map_err(|e| AppError::Io(e.to_string()))?;
        downloaded += chunk.len() as u64;
        let pct = total
            .filter(|&t| t > 0)
            .map(|t| downloaded as f32 / t as f32 * 100.0)
            .unwrap_or(0.0);
        let _ = app_handle.emit("ytdlp:install_progress", serde_json::json!({ "pct": pct, "done": false }));
    }

    file.flush().await.map_err(|e| AppError::Io(e.to_string()))?;
    drop(file);

    // Make executable on Unix
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&bin_path, std::fs::Permissions::from_mode(0o755))
            .map_err(|e| AppError::Io(e.to_string()))?;
    }

    let _ = app_handle.emit("ytdlp:install_progress", serde_json::json!({ "pct": 100.0, "done": true }));

    let version = yt_dlp_version(&bin_path.to_string_lossy());
    Ok(YtdlpStatus { available: true, version, managed: true })
}

#[tauri::command]
pub async fn ytdlp_search(
    state: State<'_, AppState>,
    query: String,
    limit: Option<u32>,
) -> Result<Vec<YtdlpSearchResult>> {
    let bin = resolve_bin(&state.app_data_dir);
    let limit = limit.unwrap_or(8).min(25);
    let search_query = format!("ytsearch{}:{}", limit, query);

    let output = tokio::process::Command::new(&bin)
        .args([
            &search_query,
            "--flat-playlist",
            "--no-playlist",
            "--print", "%(id)s\t%(title)s\t%(uploader)s\t%(duration)s",
            "--no-warnings",
        ])
        .output()
        .await
        .map_err(|e| AppError::Io(format!("Failed to run yt-dlp: {e}")))?;

    if !output.status.success() {
        return Err(AppError::Audio(
            String::from_utf8_lossy(&output.stderr).into_owned(),
        ));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let results = stdout
        .lines()
        .filter_map(|line| {
            let parts: Vec<&str> = line.splitn(4, '\t').collect();
            if parts.len() < 4 { return None; }
            let id = parts[0].to_string();
            let title = parts[1].to_string();
            let uploader = parts[2].to_string();
            let duration_secs: f64 = parts[3].parse().unwrap_or(0.0);
            let thumbnail_url = format!("https://img.youtube.com/vi/{id}/mqdefault.jpg");
            Some(YtdlpSearchResult { id, title, uploader, duration_secs, thumbnail_url })
        })
        .collect();

    Ok(results)
}

#[tauri::command]
pub async fn ytdlp_download(
    state: State<'_, AppState>,
    app_handle: tauri::AppHandle,
    video_id: String,
    title: String,
    artist: String,
) -> Result<String> {
    let bin = resolve_bin(&state.app_data_dir);

    let lib_path = {
        let conn = state.db.lock().unwrap();
        let mut stmt = conn
            .prepare("SELECT path FROM library_paths LIMIT 1")
            .map_err(|e| AppError::Database(e.to_string()))?;
        stmt.query_row([], |row| row.get::<_, String>(0))
            .map_err(|_| AppError::InvalidArgument(
                "No library path configured. Add a music folder first.".into(),
            ))?
    };

    let output_template = format!("{}/{}.%(ext)s", lib_path, video_id);
    let url = format!("https://www.youtube.com/watch?v={}", video_id);
    let vid = video_id.clone();

    let emit = move |pct: f32, status: &str, track_id: Option<String>| {
        let _ = app_handle.emit("ytdlp:progress", YtdlpProgress {
            video_id: vid.clone(),
            status: status.to_string(),
            pct,
            track_id,
        });
    };

    emit(0.0, "downloading", None);

    let mut child = tokio::process::Command::new(&bin)
        .args([
            url.as_str(),
            "--output", &output_template,
            "--extract-audio",
            "--audio-format", "mp3",
            "--audio-quality", "0",
            "--embed-thumbnail",
            "--add-metadata",
            "--no-playlist",
            "--no-warnings",
            "--newline",
        ])
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::null())
        .spawn()
        .map_err(|e| AppError::Io(format!("Failed to start yt-dlp: {e}")))?;

    if let Some(stdout) = child.stdout.take() {
        let mut lines = BufReader::new(stdout).lines();
        while let Ok(Some(line)) = lines.next_line().await {
            if line.contains("[download]") && line.contains('%') {
                let pct = parse_pct(&line) * 0.9;
                emit(pct, "downloading", None);
            }
        }
    }

    let exit = child.wait().await.map_err(|e| AppError::Io(e.to_string()))?;
    if !exit.success() {
        emit(0.0, "error", None);
        return Err(AppError::Audio("yt-dlp download failed".into()));
    }

    emit(90.0, "processing", None);

    let file_path = find_file(&lib_path, &video_id)?;

    write_tags(&file_path, &title, &artist)?;

    let path_obj = Path::new(&file_path);
    let mtime = std::fs::metadata(path_obj)
        .and_then(|m| m.modified())
        .map(|t| {
            t.duration_since(std::time::SystemTime::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs() as i64
        })
        .unwrap_or(0);

    let ctx = ScanContext {
        db: state.db.clone(),
        app_data_dir: state.app_data_dir.clone(),
        force_rescan: true,
    };
    process_file(path_obj, &file_path, mtime, &ctx)
        .map_err(|e| AppError::Scan(format!("Failed to index downloaded track: {e}")))?;

    let track_id = {
        let conn = state.db.lock().unwrap();
        conn.query_row(
            "SELECT id FROM tracks WHERE file_path = ?1",
            rusqlite::params![file_path],
            |row| row.get::<_, String>(0),
        )
        .ok()
    };

    emit(100.0, "done", track_id);

    Ok(file_path)
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

fn parse_pct(line: &str) -> f32 {
    for part in line.split_whitespace() {
        if let Some(stripped) = part.strip_suffix('%') {
            if let Ok(v) = stripped.parse::<f32>() {
                return v;
            }
        }
    }
    0.0
}

fn find_file(dir: &str, video_id: &str) -> Result<String> {
    for ext in &["mp3", "m4a", "ogg", "opus", "webm"] {
        let candidate = format!("{}/{}.{}", dir, video_id, ext);
        if Path::new(&candidate).exists() {
            return Ok(candidate);
        }
    }
    Err(AppError::Io(format!("Downloaded file not found for {video_id}")))
}

fn write_tags(file_path: &str, title: &str, artist: &str) -> Result<()> {
    use lofty::prelude::*;
    use lofty::probe::Probe;
    use lofty::tag::Accessor;

    let path = Path::new(file_path);
    let mut tagged = Probe::open(path)
        .map_err(|e| AppError::Scan(e.to_string()))?
        .guess_file_type()
        .map_err(|e| AppError::Scan(e.to_string()))?
        .read()
        .map_err(|e| AppError::Scan(e.to_string()))?;

    let has_primary = tagged.primary_tag().is_some();
    let tag = if has_primary {
        tagged.primary_tag_mut().unwrap()
    } else {
        tagged
            .first_tag_mut()
            .ok_or_else(|| AppError::Scan("No tag found in downloaded file".into()))?
    };

    tag.set_title(title.to_string());
    tag.set_artist(artist.to_string());

    tagged
        .save_to_path(path, lofty::config::WriteOptions::default())
        .map_err(|e| AppError::Scan(e.to_string()))?;

    Ok(())
}
