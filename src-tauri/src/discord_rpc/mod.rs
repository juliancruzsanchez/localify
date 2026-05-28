// Discord Rich Presence via the Discord IPC protocol (Unix socket).
// No external crates required — uses std Unix domain sockets.
//
// Set DISCORD_CLIENT_ID to your Discord Application's ID.
// Create an app at https://discord.com/developers/applications and enable
// Rich Presence, then upload a logo asset named "localify_logo".

use std::io::{Read, Write};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use crossbeam_channel::{bounded, Sender};
use serde_json::json;

/// Replace with your Discord Application ID.
const DISCORD_CLIENT_ID: &str = "1380000000000000000";

// ─── Command channel ──────────────────────────────────────────────────────────

enum Cmd {
    SetPlaying { title: String, artist: String, album: String, start_epoch: u64, end_epoch: u64 },
    SetPaused  { title: String, artist: String, album: String },
    Clear,
    Shutdown,
}

// ─── Public handle ────────────────────────────────────────────────────────────

pub struct DiscordRpcHandle {
    tx:      Sender<Cmd>,
    enabled: Arc<AtomicBool>,
}

impl DiscordRpcHandle {
    pub fn new() -> Arc<Self> {
        let (tx, rx) = bounded::<Cmd>(32);
        let enabled = Arc::new(AtomicBool::new(true));

        std::thread::Builder::new()
            .name("discord-rpc".into())
            .spawn(move || worker(rx))
            .expect("failed to spawn discord-rpc thread");

        Arc::new(Self { tx, enabled })
    }

    pub fn is_enabled(&self) -> bool { self.enabled.load(Ordering::Relaxed) }

    pub fn set_enabled(&self, val: bool) {
        self.enabled.store(val, Ordering::Relaxed);
        if !val { let _ = self.tx.try_send(Cmd::Clear); }
    }

    pub fn set_playing(&self, title: &str, artist: &str, album: &str, position_ms: i64, duration_ms: i64) {
        if !self.is_enabled() { return; }
        let now = epoch_secs();
        let start_epoch = now.saturating_sub((position_ms / 1000) as u64);
        let end_epoch   = start_epoch + (duration_ms / 1000) as u64;
        let _ = self.tx.try_send(Cmd::SetPlaying {
            title:       title.to_string(),
            artist:      artist.to_string(),
            album:       album.to_string(),
            start_epoch,
            end_epoch,
        });
    }

    pub fn set_paused(&self, title: &str, artist: &str, album: &str) {
        if !self.is_enabled() { return; }
        let _ = self.tx.try_send(Cmd::SetPaused {
            title:  title.to_string(),
            artist: artist.to_string(),
            album:  album.to_string(),
        });
    }

    pub fn clear(&self) {
        let _ = self.tx.try_send(Cmd::Clear);
    }
}

impl Drop for DiscordRpcHandle {
    fn drop(&mut self) {
        let _ = self.tx.try_send(Cmd::Shutdown);
    }
}

fn epoch_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

// ─── IPC helpers ─────────────────────────────────────────────────────────────

#[cfg(unix)]
use std::os::unix::net::UnixStream;

#[cfg(unix)]
fn ipc_connect() -> Option<UnixStream> {
    let tmpdir    = std::env::var("TMPDIR").unwrap_or_else(|_| "/tmp".into());
    let xdg       = std::env::var("XDG_RUNTIME_DIR").ok();
    let snap_xdg  = std::env::var("XDG_RUNTIME_DIR").ok()
        .map(|d| format!("{d}/app/com.discordapp.Discord"));

    for i in 0..10u8 {
        let mut paths = vec![
            format!("/tmp/discord-ipc-{i}"),
            format!("{tmpdir}/discord-ipc-{i}"),
        ];
        if let Some(ref xdg) = xdg       { paths.push(format!("{xdg}/discord-ipc-{i}")); }
        if let Some(ref snap) = snap_xdg  { paths.push(format!("{snap}/discord-ipc-{i}")); }

        for path in paths {
            if !std::path::Path::new(&path).exists() { continue; }
            if let Ok(mut s) = UnixStream::connect(&path) {
                let _ = s.set_read_timeout(Some(std::time::Duration::from_secs(3)));
                let handshake = json!({ "v": 1, "client_id": DISCORD_CLIENT_ID }).to_string();
                if ipc_write(&mut s, 0, &handshake).is_err() { continue; }
                if ipc_read(&mut s).is_ok() { return Some(s); }
            }
        }
    }
    None
}

#[cfg(not(unix))]
fn ipc_connect() -> Option<()> { None }

fn ipc_write(w: &mut impl Write, opcode: u32, payload: &str) -> std::io::Result<()> {
    let bytes = payload.as_bytes();
    let mut hdr = [0u8; 8];
    hdr[0..4].copy_from_slice(&opcode.to_le_bytes());
    hdr[4..8].copy_from_slice(&(bytes.len() as u32).to_le_bytes());
    w.write_all(&hdr)?;
    w.write_all(bytes)
}

fn ipc_read(r: &mut impl Read) -> std::io::Result<()> {
    let mut hdr = [0u8; 8];
    r.read_exact(&mut hdr)?;
    let len = u32::from_le_bytes(hdr[4..8].try_into().unwrap()) as usize;
    if len > 65_536 {
        return Err(std::io::Error::new(std::io::ErrorKind::InvalidData, "frame too large"));
    }
    let mut buf = vec![0u8; len];
    r.read_exact(&mut buf)
}

// ─── Worker thread ────────────────────────────────────────────────────────────

#[cfg(unix)]
fn worker(rx: crossbeam_channel::Receiver<Cmd>) {
    let mut conn: Option<UnixStream> = None;
    let mut nonce: u64 = 0;

    fn nxt(n: &mut u64) -> String { *n += 1; n.to_string() }

    fn send_frame(s: &mut UnixStream, payload: String) -> bool {
        ipc_write(s, 1, &payload).is_ok() && ipc_read(s).is_ok()
    }

    for cmd in rx {
        match cmd {
            Cmd::Shutdown => break,

            Cmd::Clear => {
                if let Some(ref mut s) = conn {
                    let msg = json!({
                        "cmd": "SET_ACTIVITY",
                        "args": { "pid": std::process::id(), "activity": null },
                        "nonce": nxt(&mut nonce),
                    }).to_string();
                    if !send_frame(s, msg) { conn = None; }
                }
            }

            Cmd::SetPlaying { title, artist, album, start_epoch, end_epoch } => {
                if conn.is_none() { conn = ipc_connect(); }
                if let Some(ref mut s) = conn {
                    let large_text = if album.is_empty() { "Localify".to_string() } else { album };
                    let msg = json!({
                        "cmd": "SET_ACTIVITY",
                        "args": {
                            "pid": std::process::id(),
                            "activity": {
                                "details": title,
                                "state":   format!("by {artist}"),
                                "timestamps": { "start": start_epoch, "end": end_epoch },
                                "assets": {
                                    "large_image": "localify_logo",
                                    "large_text":  large_text,
                                    "small_image": "play_icon",
                                    "small_text":  "Playing",
                                },
                            },
                        },
                        "nonce": nxt(&mut nonce),
                    }).to_string();
                    if !send_frame(s, msg) { conn = None; }
                }
            }

            Cmd::SetPaused { title, artist, album } => {
                if conn.is_none() { conn = ipc_connect(); }
                if let Some(ref mut s) = conn {
                    let large_text = if album.is_empty() { "Localify".to_string() } else { album };
                    let msg = json!({
                        "cmd": "SET_ACTIVITY",
                        "args": {
                            "pid": std::process::id(),
                            "activity": {
                                "details": title,
                                "state":   format!("by {artist}"),
                                "assets": {
                                    "large_image": "localify_logo",
                                    "large_text":  large_text,
                                    "small_image": "pause_icon",
                                    "small_text":  "Paused",
                                },
                            },
                        },
                        "nonce": nxt(&mut nonce),
                    }).to_string();
                    if !send_frame(s, msg) { conn = None; }
                }
            }
        }
    }
}

#[cfg(not(unix))]
fn worker(rx: crossbeam_channel::Receiver<Cmd>) {
    // Windows named-pipe support not yet implemented.
    for _ in rx {}
}
