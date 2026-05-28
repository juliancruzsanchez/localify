use std::sync::{Arc, Mutex};
use std::sync::atomic::{AtomicBool, AtomicI64, AtomicU32, Ordering};
use crossbeam_channel::{bounded, unbounded, Receiver, Sender};
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use crate::audio::eq::EqConfig;

// ─── Commands ────────────────────────────────────────────────────────────────

#[derive(Debug)]
pub enum PlayerCommand {
    Play         { file_path: String, track_id: String, start_ms: u64 },
    Pause,
    Resume,
    Seek         { position_ms: u64 },
    SetVolume    { volume: u8 },
    Stop,
    /// Switch the audio output to the named device (None = system default).
    SwitchDevice { device_name: Option<String> },
    Shutdown,
}

// ─── PlayerHandle ─────────────────────────────────────────────────────────────

pub struct PlayerHandle {
    pub cmd_tx:           Sender<PlayerCommand>,
    pub is_playing:       Arc<AtomicBool>,
    pub volume:           Arc<AtomicU32>,
    pub position_ms:      Arc<AtomicI64>,
    pub duration_ms:      Arc<AtomicI64>,
    pub current_track_id: Arc<Mutex<Option<String>>>,
    /// Shared with the decode thread — update in place.
    pub eq_config:        Arc<Mutex<EqConfig>>,
    /// Name of the currently selected output device (None = default).
    pub selected_device:  Arc<Mutex<Option<String>>>,
}

impl PlayerHandle {
    pub fn new() -> Arc<Self> {
        let (cmd_tx, cmd_rx) = unbounded::<PlayerCommand>();

        let is_playing       = Arc::new(AtomicBool::new(false));
        let volume           = Arc::new(AtomicU32::new(80));
        let position_ms      = Arc::new(AtomicI64::new(0));
        let duration_ms      = Arc::new(AtomicI64::new(0));
        let current_track_id = Arc::new(Mutex::new(None::<String>));
        let eq_config        = Arc::new(Mutex::new(EqConfig::default()));
        let selected_device  = Arc::new(Mutex::new(None::<String>));

        let handle = Arc::new(PlayerHandle {
            cmd_tx,
            is_playing:       is_playing.clone(),
            volume:           volume.clone(),
            position_ms:      position_ms.clone(),
            duration_ms:      duration_ms.clone(),
            current_track_id: current_track_id.clone(),
            eq_config:        eq_config.clone(),
            selected_device:  selected_device.clone(),
        });

        std::thread::spawn(move || {
            audio_loop(
                cmd_rx,
                is_playing, volume,
                position_ms, duration_ms,
                current_track_id, eq_config,
                selected_device,
            );
        });

        handle
    }

    pub fn send(&self, cmd: PlayerCommand) {
        let _ = self.cmd_tx.send(cmd);
    }
}

// ─── Active playback ──────────────────────────────────────────────────────────

struct ActivePlayback {
    stream:    cpal::Stream,
    stop:      Arc<AtomicBool>,
    is_paused: Arc<AtomicBool>,
    seek_tx:   Sender<u64>,
}

impl ActivePlayback {
    /// Silence and stop this playback immediately.
    fn halt(self) {
        self.stop.store(true, std::sync::atomic::Ordering::Relaxed);
        // Pause the CoreAudio unit before dropping so there is no overlap
        // with the next stream on macOS.
        let _ = self.stream.pause();
    }
}

// ─── Device helpers ───────────────────────────────────────────────────────────

fn open_device(name: Option<&str>) -> Option<cpal::Device> {
    let host = cpal::default_host();
    if let Some(n) = name {
        host.output_devices().ok()?.find(|d| d.name().ok().as_deref() == Some(n))
    } else {
        host.default_output_device()
    }
}

/// Build a cpal f32 output stream that drains from the chunk channel.
/// When the sender side drops (decode thread done) the callback sets
/// `is_playing = false` after it has played the last buffered sample.
fn build_stream(
    device:     &cpal::Device,
    sample_rate: u32,
    channels:   u16,
    rx:         Receiver<Vec<f32>>,
    volume:     Arc<AtomicU32>,
    is_paused:  Arc<AtomicBool>,
    is_playing: Arc<AtomicBool>,
) -> Option<cpal::Stream> {
    let config = cpal::StreamConfig {
        channels,
        sample_rate: cpal::SampleRate(sample_rate),
        buffer_size: cpal::BufferSize::Default,
    };

    // State carried across callback invocations
    let mut current: Option<(Vec<f32>, usize)> = None;

    let stream = device
        .build_output_stream::<f32, _, _>(
            &config,
            move |data: &mut [f32], _| {
                if is_paused.load(Ordering::Relaxed) {
                    data.fill(0.0);
                    return;
                }

                let vol = volume.load(Ordering::Relaxed) as f32 / 100.0;
                let mut pos = 0;

                while pos < data.len() {
                    // Refill from the next chunk when the current one is exhausted
                    if current.is_none() {
                        match rx.try_recv() {
                            Ok(chunk) => current = Some((chunk, 0)),
                            Err(crossbeam_channel::TryRecvError::Empty) => {
                                data[pos..].fill(0.0);
                                return;
                            }
                            Err(crossbeam_channel::TryRecvError::Disconnected) => {
                                // Decode thread finished and channel drained — end of track
                                data[pos..].fill(0.0);
                                is_playing.store(false, Ordering::Relaxed);
                                return;
                            }
                        }
                    }

                    if let Some((ref chunk, ref mut offset)) = current {
                        let available = chunk.len() - *offset;
                        let to_copy   = available.min(data.len() - pos);
                        for i in 0..to_copy {
                            data[pos + i] = chunk[*offset + i] * vol;
                        }
                        pos     += to_copy;
                        *offset += to_copy;
                        if *offset >= chunk.len() {
                            current = None;
                        }
                    }
                }
            },
            |e| eprintln!("[audio] cpal stream error: {e}"),
            None,
        )
        .ok()?;

    stream.play().ok()?;
    Some(stream)
}

// ─── Audio loop ───────────────────────────────────────────────────────────────

fn audio_loop(
    cmd_rx:           Receiver<PlayerCommand>,
    is_playing:       Arc<AtomicBool>,
    volume:           Arc<AtomicU32>,
    position_ms:      Arc<AtomicI64>,
    duration_ms:      Arc<AtomicI64>,
    current_track_id: Arc<Mutex<Option<String>>>,
    eq_config:        Arc<Mutex<EqConfig>>,
    selected_device:  Arc<Mutex<Option<String>>>,
) {
    let mut active: Option<ActivePlayback> = None;

    loop {
        match cmd_rx.recv() {

            // ── Play ─────────────────────────────────────────────────────────
            Ok(PlayerCommand::Play { file_path, track_id, start_ms }) => {
                eprintln!("[audio] Play: track_id={track_id} file={file_path}");

                if let Some(old) = active.take() { old.halt(); }
                is_playing.store(false, Ordering::Relaxed);
                position_ms.store(0, Ordering::Relaxed);
                duration_ms.store(0, Ordering::Relaxed);
                *current_track_id.lock().unwrap() = Some(track_id.clone());

                // Probe file for stream config
                let (sample_rate, channels, dur_ms) =
                    match super::player::probe_file(&file_path) {
                        Ok(info) => {
                            eprintln!("[audio] probe OK: {}Hz {}ch", info.0, info.1);
                            info
                        }
                        Err(e) => {
                            eprintln!("[audio] probe failed: {e}");
                            continue;
                        }
                    };

                if let Some(dur) = dur_ms {
                    duration_ms.store(dur as i64, Ordering::Relaxed);
                }

                // Open output device
                let dev_name = selected_device.lock().unwrap().clone();
                let device = match open_device(dev_name.as_deref()) {
                    Some(d) => d,
                    None => {
                        eprintln!("[audio] no output device available");
                        continue;
                    }
                };

                // Channel connecting decode thread → cpal callback
                // 256 chunks provides ~3 s of buffer at 44.1 kHz stereo / ~1 k samples per chunk
                let (samples_tx, samples_rx) = bounded::<Vec<f32>>(256);
                let is_paused = Arc::new(AtomicBool::new(false));

                let stream = match build_stream(
                    &device, sample_rate, channels,
                    samples_rx,
                    volume.clone(),
                    is_paused.clone(),
                    is_playing.clone(),
                ) {
                    Some(s) => s,
                    None => {
                        eprintln!("[audio] failed to open cpal stream");
                        continue;
                    }
                };

                // Spawn decode thread
                let stop = Arc::new(AtomicBool::new(false));
                let (seek_tx, seek_rx) = unbounded::<u64>();

                {
                    let file_path    = file_path.clone();
                    let stop         = stop.clone();
                    let is_paused_c  = is_paused.clone();
                    let position_ms  = position_ms.clone();
                    let duration_ms  = duration_ms.clone();
                    let eq_config    = eq_config.clone();

                    std::thread::spawn(move || {
                        super::player::decode_thread(
                            file_path, start_ms,
                            samples_tx,
                            eq_config,
                            position_ms, duration_ms,
                            stop, is_paused_c,
                            seek_rx,
                        );
                    });
                }

                is_playing.store(true, Ordering::Relaxed);
                active = Some(ActivePlayback { stream, stop, is_paused, seek_tx });
            }

            // ── Simple controls ───────────────────────────────────────────────
            Ok(PlayerCommand::Pause) => {
                if let Some(ref act) = active {
                    act.is_paused.store(true, Ordering::Relaxed);
                }
                is_playing.store(false, Ordering::Relaxed);
            }

            Ok(PlayerCommand::Resume) => {
                if let Some(ref act) = active {
                    act.is_paused.store(false, Ordering::Relaxed);
                }
                is_playing.store(true, Ordering::Relaxed);
            }

            Ok(PlayerCommand::Seek { position_ms: pos }) => {
                if let Some(ref act) = active {
                    let _ = act.seek_tx.send(pos);
                }
            }

            Ok(PlayerCommand::SetVolume { volume: vol }) => {
                volume.store(vol as u32, Ordering::Relaxed);
            }

            Ok(PlayerCommand::Stop) => {
                if let Some(old) = active.take() { old.halt(); }
                is_playing.store(false, Ordering::Relaxed);
                position_ms.store(0, Ordering::Relaxed);
                *current_track_id.lock().unwrap() = None;
            }

            // ── Device switch ─────────────────────────────────────────────────
            Ok(PlayerCommand::SwitchDevice { device_name }) => {
                eprintln!("[audio] SwitchDevice → {:?}", device_name);
                if let Some(old) = active.take() { old.halt(); }
                is_playing.store(false, Ordering::Relaxed);
                *selected_device.lock().unwrap() = device_name;
            }

            Ok(PlayerCommand::Shutdown) | Err(_) => {
                if let Some(old) = active.take() { old.halt(); }
                break;
            }
        }
    }
}
