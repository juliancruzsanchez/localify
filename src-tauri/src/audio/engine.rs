use std::sync::{Arc, Mutex};
use std::sync::atomic::{AtomicBool, AtomicI64, AtomicU32, Ordering};
use std::time::Duration;
use crossbeam_channel::{unbounded, Sender, Receiver};
use crate::audio::eq::EqConfig;

// ─── Commands ────────────────────────────────────────────────────────────────

#[derive(Debug)]
pub enum PlayerCommand {
    Play     { file_path: String, track_id: String, start_ms: u64 },
    Pause,
    Resume,
    Seek     { position_ms: u64 },
    SetVolume { volume: u8 },
    Stop,
    Shutdown,
}

// ─── PlayerHandle ────────────────────────────────────────────────────────────

pub struct PlayerHandle {
    pub cmd_tx:          Sender<PlayerCommand>,
    pub is_playing:      Arc<AtomicBool>,
    pub volume:          Arc<AtomicU32>,
    pub position_ms:     Arc<AtomicI64>,
    pub duration_ms:     Arc<AtomicI64>,
    pub current_track_id: Arc<Mutex<Option<String>>>,
    /// Shared with the audio loop and every EqSource — update in place.
    pub eq_config:       Arc<Mutex<EqConfig>>,
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

        let handle = Arc::new(PlayerHandle {
            cmd_tx,
            is_playing:       is_playing.clone(),
            volume:           volume.clone(),
            position_ms:      position_ms.clone(),
            duration_ms:      duration_ms.clone(),
            current_track_id: current_track_id.clone(),
            eq_config:        eq_config.clone(),
        });

        std::thread::spawn(move || {
            audio_loop(
                cmd_rx,
                is_playing, volume,
                position_ms, duration_ms,
                current_track_id, eq_config,
            );
        });

        handle
    }

    pub fn send(&self, cmd: PlayerCommand) {
        let _ = self.cmd_tx.send(cmd);
    }
}

// ─── Audio loop ───────────────────────────────────────────────────────────────

fn audio_loop(
    cmd_rx:          Receiver<PlayerCommand>,
    is_playing:      Arc<AtomicBool>,
    volume:          Arc<AtomicU32>,
    position_ms:     Arc<AtomicI64>,
    duration_ms:     Arc<AtomicI64>,
    current_track_id: Arc<Mutex<Option<String>>>,
    eq_config:       Arc<Mutex<EqConfig>>,
) {
    use rodio::{OutputStream, Sink};

    let (_stream, stream_handle) = match OutputStream::try_default() {
        Ok(v) => v,
        Err(e) => { log::error!("Failed to open audio output: {e}"); return; }
    };

    // Wrap Sink in Arc<Mutex<>> so crossfade threads can adjust volume.
    let make_sink = |vol: u32| -> Option<Arc<Mutex<Sink>>> {
        match Sink::try_new(&stream_handle) {
            Ok(s) => {
                s.set_volume(vol as f32 / 100.0);
                Some(Arc::new(Mutex::new(s)))
            }
            Err(e) => { log::error!("Failed to create rodio sink: {e}"); None }
        }
    };

    let vol = volume.load(Ordering::Relaxed);
    let mut sink: Arc<Mutex<Sink>> = match make_sink(vol) {
        Some(s) => s,
        None    => return,
    };

    loop {
        match cmd_rx.recv() {
            // ── Play ──────────────────────────────────────────────────────────
            Ok(PlayerCommand::Play { file_path, track_id, start_ms }) => {
                eprintln!("[audio] Play: track_id={track_id} file={file_path}");

                let vol          = volume.load(Ordering::Relaxed);
                let crossfade_ms = eq_config.lock().unwrap().crossfade_ms;
                eprintln!("[audio] vol={vol} crossfade_ms={crossfade_ms}");

                // New sink starts at vol=0 when crossfading, full vol otherwise.
                let start_vol = if crossfade_ms > 0 { 0 } else { vol };
                let new_sink  = match make_sink(start_vol) {
                    Some(s) => { eprintln!("[audio] new sink created OK"); s }
                    // Don't return — that would kill the audio loop permanently.
                    // Log the error and skip this play command instead.
                    None    => {
                        eprintln!("[audio] ERROR: failed to create sink for {file_path}");
                        continue;
                    }
                };

                if crossfade_ms > 0 {
                    // Move old sink into a thread that fades it out while
                    // simultaneously fading the new sink in.
                    let old_sink        = std::mem::replace(&mut sink, Arc::clone(&new_sink));
                    let new_for_thread  = Arc::clone(&new_sink);
                    let vol_f32         = vol as f32 / 100.0;

                    std::thread::spawn(move || {
                        let steps    = 30u32;
                        let step_ms  = Duration::from_millis((crossfade_ms / steps).max(1) as u64);
                        for i in 0..steps {
                            std::thread::sleep(step_ms);
                            let t = (i + 1) as f32 / steps as f32;
                            // fade out old track
                            if let Ok(o) = old_sink.try_lock() {
                                o.set_volume(vol_f32 * (1.0 - t));
                            }
                            // fade in new track
                            if let Ok(n) = new_for_thread.try_lock() {
                                n.set_volume(vol_f32 * t);
                            }
                        }
                        // old_sink Arc dropped here → playback stops
                    });
                } else {
                    // No crossfade — swap immediately, drop the old sink.
                    eprintln!("[audio] swapping sink (no crossfade)");
                    let _old = std::mem::replace(&mut sink, Arc::clone(&new_sink));
                    drop(_old);
                    eprintln!("[audio] old sink dropped");
                }

                // Reset counters BEFORE decode so the UI gets clean state
                // immediately. Don't touch is_playing yet — set it only after
                // we know decode succeeded to avoid the 250ms poll flashing
                // "paused" during the brief decode window.
                position_ms.store(0, Ordering::Relaxed);
                duration_ms.store(0, Ordering::Relaxed);
                { *current_track_id.lock().unwrap() = Some(track_id.clone()); }

                eprintln!("[audio] calling decode_and_play...");
                let sink_guard = new_sink.lock().unwrap();
                match super::player::decode_and_play(
                    &file_path, start_ms,
                    &sink_guard,
                    position_ms.clone(),
                    duration_ms.clone(),
                    eq_config.clone(),
                ) {
                    Ok(()) => {
                        eprintln!("[audio] decode_and_play OK — is_playing = true");
                        is_playing.store(true, Ordering::Relaxed);
                    }
                    Err(e) => {
                        eprintln!("[audio] ERROR in decode_and_play for {file_path}: {e}");
                        log::error!("Playback error for {file_path}: {e}");
                        is_playing.store(false, Ordering::Relaxed);
                    }
                }
            }

            // ── Simple controls ───────────────────────────────────────────────
            Ok(PlayerCommand::Pause) => {
                sink.lock().unwrap().pause();
                is_playing.store(false, Ordering::Relaxed);
            }
            Ok(PlayerCommand::Resume) => {
                sink.lock().unwrap().play();
                is_playing.store(true, Ordering::Relaxed);
            }
            Ok(PlayerCommand::Seek { position_ms: pos }) => {
                position_ms.store(pos as i64, Ordering::Relaxed);
            }
            Ok(PlayerCommand::SetVolume { volume: vol }) => {
                volume.store(vol as u32, Ordering::Relaxed);
                sink.lock().unwrap().set_volume(vol as f32 / 100.0);
            }
            Ok(PlayerCommand::Stop) => {
                sink.lock().unwrap().stop();
                is_playing.store(false, Ordering::Relaxed);
                position_ms.store(0, Ordering::Relaxed);
                *current_track_id.lock().unwrap() = None;
            }
            Ok(PlayerCommand::Shutdown) | Err(_) => {
                sink.lock().unwrap().stop();
                break;
            }
        }
    }
}
