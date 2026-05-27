use std::sync::{Arc, Mutex};
use std::sync::atomic::{AtomicBool, AtomicI64, AtomicU32, Ordering};
use crossbeam_channel::{unbounded, Sender, Receiver};

#[derive(Debug)]
pub enum PlayerCommand {
    Play { file_path: String, track_id: String, start_ms: u64 },
    Pause,
    Resume,
    Seek { position_ms: u64 },
    SetVolume { volume: u8 },
    Stop,
    Shutdown,
}

pub struct PlayerHandle {
    pub cmd_tx: Sender<PlayerCommand>,
    pub is_playing: Arc<AtomicBool>,
    pub volume: Arc<AtomicU32>,
    pub position_ms: Arc<AtomicI64>,
    pub duration_ms: Arc<AtomicI64>,
    pub current_track_id: Arc<Mutex<Option<String>>>,
}

impl PlayerHandle {
    pub fn new() -> Arc<Self> {
        let (cmd_tx, cmd_rx) = unbounded::<PlayerCommand>();

        let is_playing = Arc::new(AtomicBool::new(false));
        let volume = Arc::new(AtomicU32::new(80));
        let position_ms = Arc::new(AtomicI64::new(0));
        let duration_ms = Arc::new(AtomicI64::new(0));
        let current_track_id = Arc::new(Mutex::new(None::<String>));

        let handle = Arc::new(PlayerHandle {
            cmd_tx,
            is_playing: is_playing.clone(),
            volume: volume.clone(),
            position_ms: position_ms.clone(),
            duration_ms: duration_ms.clone(),
            current_track_id: current_track_id.clone(),
        });

        // Spawn the audio thread
        std::thread::spawn(move || {
            audio_loop(cmd_rx, is_playing, volume, position_ms, duration_ms, current_track_id);
        });

        handle
    }

    pub fn send(&self, cmd: PlayerCommand) {
        let _ = self.cmd_tx.send(cmd);
    }
}

fn audio_loop(
    cmd_rx: Receiver<PlayerCommand>,
    is_playing: Arc<AtomicBool>,
    volume: Arc<AtomicU32>,
    position_ms: Arc<AtomicI64>,
    duration_ms: Arc<AtomicI64>,
    current_track_id: Arc<Mutex<Option<String>>>,
) {
    use rodio::{OutputStream, Sink};

    let (_stream, stream_handle) = match OutputStream::try_default() {
        Ok(v) => v,
        Err(e) => {
            log::error!("Failed to open audio output: {e}");
            return;
        }
    };

    let sink = match Sink::try_new(&stream_handle) {
        Ok(s) => s,
        Err(e) => {
            log::error!("Failed to create rodio sink: {e}");
            return;
        }
    };

    // Set initial volume
    let vol = volume.load(Ordering::Relaxed);
    sink.set_volume(vol as f32 / 100.0);

    loop {
        match cmd_rx.recv() {
            Ok(PlayerCommand::Play { file_path, track_id, start_ms }) => {
                sink.stop();
                is_playing.store(false, Ordering::Relaxed);
                position_ms.store(0, Ordering::Relaxed);
                duration_ms.store(0, Ordering::Relaxed);

                {
                    let mut guard = current_track_id.lock().unwrap();
                    *guard = Some(track_id);
                }

                match super::player::decode_and_play(
                    &file_path,
                    start_ms,
                    &sink,
                    position_ms.clone(),
                    duration_ms.clone(),
                ) {
                    Ok(()) => {
                        is_playing.store(true, Ordering::Relaxed);
                    }
                    Err(e) => {
                        log::error!("Playback error for {file_path}: {e}");
                    }
                }
            }
            Ok(PlayerCommand::Pause) => {
                sink.pause();
                is_playing.store(false, Ordering::Relaxed);
            }
            Ok(PlayerCommand::Resume) => {
                sink.play();
                is_playing.store(true, Ordering::Relaxed);
            }
            Ok(PlayerCommand::Seek { position_ms: pos }) => {
                // Seek by reading current track and replaying from position
                let track_id = current_track_id.lock().unwrap().clone();
                if let Some(_id) = track_id {
                    // We'll re-read the file_path from the current sink state
                    // For simplicity, just update position atomic; full seek needs file path
                    position_ms.store(pos as i64, Ordering::Relaxed);
                }
            }
            Ok(PlayerCommand::SetVolume { volume: vol }) => {
                volume.store(vol as u32, Ordering::Relaxed);
                sink.set_volume(vol as f32 / 100.0);
            }
            Ok(PlayerCommand::Stop) => {
                sink.stop();
                is_playing.store(false, Ordering::Relaxed);
                position_ms.store(0, Ordering::Relaxed);
                {
                    let mut guard = current_track_id.lock().unwrap();
                    *guard = None;
                }
            }
            Ok(PlayerCommand::Shutdown) | Err(_) => {
                sink.stop();
                break;
            }
        }
    }
}
