/// Google Cast (Chromecast) support.
///
/// Architecture
/// ────────────
/// 1. **Discovery** — mDNS browse for `_googlecast._tcp.local.` services.
///    Runs in a background task and populates a shared device list.
///
/// 2. **Local file server** — an axum HTTP server bound on a random port.
///    Chromecasts fetch audio from `http://{lan_ip}:{port}/track/{track_id}`.
///    The handler looks up the file path from the SQLite DB and streams it.
///
/// 3. **Cast session** — a blocking thread that uses `rust-cast` to connect
///    to the chosen device, launch Default Media Receiver, and load the URL.

use std::collections::HashMap;
use std::net::IpAddr;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use axum::body::Body;
use axum::extract::{Path, State as AxumState};
use axum::http::{StatusCode, header};
use axum::routing::get;
use axum::Router;
use mdns_sd::{ServiceDaemon, ServiceEvent};
use rusqlite::{Connection, params};
use serde::{Deserialize, Serialize};
use tokio::fs::File;
use tokio::sync::oneshot;
use tokio_util::io::ReaderStream;

// ─── Types ────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CastDevice {
    pub name:     String,
    pub host:     String,
    pub port:     u16,
    pub friendly: String, // display-friendly name from TXT record
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CastSession {
    pub device_name:    String,
    pub device_host:    String,
    pub local_port:     u16,
    pub current_track:  Option<String>,
}

// ─── Shared state ─────────────────────────────────────────────────────────────

pub struct CastState {
    /// Devices discovered via mDNS (refreshed by `discover_cast_devices` command)
    pub devices:         Arc<Mutex<Vec<CastDevice>>>,
    /// Active cast session info (if casting)
    pub session:         Arc<Mutex<Option<CastSession>>>,
    /// Shutdown sender for the local HTTP file server
    pub server_shutdown: Arc<Mutex<Option<oneshot::Sender<()>>>>,
    /// Port the local server is listening on (0 = not started)
    pub server_port:     Arc<Mutex<u16>>,
}

impl CastState {
    pub fn new() -> Arc<Self> {
        Arc::new(CastState {
            devices:         Arc::new(Mutex::new(Vec::new())),
            session:         Arc::new(Mutex::new(None)),
            server_shutdown: Arc::new(Mutex::new(None)),
            server_port:     Arc::new(Mutex::new(0)),
        })
    }
}

// ─── mDNS discovery ───────────────────────────────────────────────────────────

/// Browse the local network for `_googlecast._tcp.local.` services for up to
/// `timeout_ms` milliseconds and return all discovered devices.
pub fn discover(timeout_ms: u64) -> Vec<CastDevice> {
    let mdns = match ServiceDaemon::new() {
        Ok(d) => d,
        Err(e) => {
            log::error!("[cast] mDNS daemon error: {e}");
            return Vec::new();
        }
    };

    let receiver = match mdns.browse("_googlecast._tcp.local.") {
        Ok(r) => r,
        Err(e) => {
            log::error!("[cast] mDNS browse error: {e}");
            return Vec::new();
        }
    };

    let deadline = std::time::Instant::now() + Duration::from_millis(timeout_ms);
    let mut devices: HashMap<String, CastDevice> = HashMap::new();

    while std::time::Instant::now() < deadline {
        match receiver.recv_timeout(Duration::from_millis(200)) {
            Ok(ServiceEvent::ServiceResolved(info)) => {
                let host = info
                    .get_addresses()
                    .iter()
                    .next()
                    .map(|a| a.to_string())
                    .unwrap_or_default();

                if host.is_empty() { continue; }

                let friendly = info
                    .get_property_val_str("fn")
                    .unwrap_or_else(|| info.get_hostname())
                    .to_string();

                let entry = CastDevice {
                    name:     info.get_fullname().to_string(),
                    host:     host.clone(),
                    port:     info.get_port(),
                    friendly: friendly.clone(),
                };

                devices.insert(host, entry);
            }
            Err(_) => { /* timeout slot — keep polling */ }
            _ => {}
        }
    }

    let _ = mdns.shutdown();
    devices.into_values().collect()
}

// ─── Local HTTP file server ───────────────────────────────────────────────────

#[derive(Clone)]
struct ServerState {
    db: Arc<Mutex<Connection>>,
}

async fn serve_track(
    AxumState(state): AxumState<ServerState>,
    Path(track_id): Path<String>,
) -> Result<axum::response::Response<Body>, StatusCode> {
    // Resolve file path from DB
    let file_path = {
        let conn = state.db.lock().unwrap();
        conn.query_row(
            "SELECT file_path FROM tracks WHERE id = ?1 AND removed_at IS NULL",
            params![track_id],
            |row| row.get::<_, String>(0),
        )
        .map_err(|_| StatusCode::NOT_FOUND)?
    };

    // Detect content type from extension
    let content_type = match std::path::Path::new(&file_path)
        .extension()
        .and_then(|e| e.to_str())
        .map(str::to_lowercase)
        .as_deref()
    {
        Some("mp3")                   => "audio/mpeg",
        Some("flac")                  => "audio/flac",
        Some("ogg") | Some("opus")   => "audio/ogg",
        Some("m4a") | Some("aac")    => "audio/mp4",
        Some("wav")                   => "audio/wav",
        Some("aiff") | Some("aif")   => "audio/aiff",
        _                             => "application/octet-stream",
    };

    let file = File::open(&file_path).await.map_err(|_| StatusCode::NOT_FOUND)?;
    let metadata = file.metadata().await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let stream = ReaderStream::new(file);
    let body = Body::from_stream(stream);

    let response = axum::response::Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, content_type)
        .header(header::CONTENT_LENGTH, metadata.len())
        .header(header::ACCEPT_RANGES, "bytes")
        .body(body)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(response)
}

/// Start the local HTTP file server on a random port and return the port.
/// Sends on `shutdown_tx` when the server should stop.
pub async fn start_file_server(
    db: Arc<Mutex<Connection>>,
) -> (u16, oneshot::Sender<()>) {
    let server_state = ServerState { db };

    let app = Router::new()
        .route("/track/:track_id", get(serve_track))
        .with_state(server_state);

    // Bind to port 0 to let the OS pick an available port
    let listener = tokio::net::TcpListener::bind("0.0.0.0:0")
        .await
        .expect("Failed to bind file server");
    let port = listener.local_addr().unwrap().port();

    let (shutdown_tx, shutdown_rx) = oneshot::channel::<()>();

    tokio::spawn(async move {
        axum::serve(listener, app)
            .with_graceful_shutdown(async { let _ = shutdown_rx.await; })
            .await
            .ok();
    });

    (port, shutdown_tx)
}

// ─── Cast session (blocking, runs in std::thread) ─────────────────────────────

/// Connect to a Chromecast, launch Default Media Receiver, and load a URL.
pub fn start_cast_session(device_host: &str, device_port: u16, media_url: &str) -> Result<(), String> {
    use rust_cast::CastDevice;
    use rust_cast::channels::receiver::CastDeviceApp;
    use rust_cast::channels::media::{Media, StreamType};

    let cast = CastDevice::connect(device_host, device_port)
        .map_err(|e| format!("Connect failed: {e}"))?;

    // Protocol handshake
    cast.connection
        .connect("receiver-0")
        .map_err(|e| format!("Connection channel failed: {e}"))?;

    cast.heartbeat
        .ping()
        .map_err(|e| format!("Heartbeat ping failed: {e}"))?;

    // Launch the default media receiver
    let app = cast.receiver
        .launch_app(&CastDeviceApp::DefaultMediaReceiver)
        .map_err(|e| format!("Launch app failed: {e}"))?;

    cast.connection
        .connect(&app.transport_id)
        .map_err(|e| format!("Media connection failed: {e}"))?;

    // Infer content type from URL
    let content_type = if media_url.contains(".flac") { "audio/flac" }
        else if media_url.contains(".ogg") || media_url.contains(".opus") { "audio/ogg" }
        else if media_url.contains(".m4a") || media_url.contains(".aac") { "audio/mp4" }
        else if media_url.contains(".wav") { "audio/wav" }
        else { "audio/mpeg" };

    // Load the media
    cast.media
        .load(
            &app.transport_id,
            &app.session_id,
            &Media {
                content_id:   media_url.to_string(),
                stream_type:  StreamType::Buffered,
                content_type: content_type.to_string(),
                metadata:     None,
                duration:     None,
            },
        )
        .map_err(|e| format!("Media load failed: {e}"))?;

    Ok(())
}

/// Send a Stop command to the Chromecast.
pub fn stop_cast_session(device_host: &str, device_port: u16) -> Result<(), String> {
    use rust_cast::CastDevice;

    let cast = CastDevice::connect(device_host, device_port)
        .map_err(|e| format!("Connect failed: {e}"))?;

    cast.connection
        .connect("receiver-0")
        .map_err(|e| format!("Connection channel failed: {e}"))?;

    let session_id = cast.receiver
        .get_status()
        .map_err(|e| format!("Get status failed: {e}"))?
        .applications
        .into_iter()
        .next()
        .map(|a| a.session_id)
        .unwrap_or_default();

    if !session_id.is_empty() {
        cast.receiver
            .stop_app(&session_id)
            .map_err(|e| format!("Stop app failed: {e}"))?;
    }

    Ok(())
}

/// Return the first non-loopback LAN IPv4 address of this machine.
pub fn local_ip() -> Option<IpAddr> {
    local_ip_address::local_ip().ok()
}
