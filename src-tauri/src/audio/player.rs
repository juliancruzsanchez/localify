use std::io::BufReader;
use std::sync::Arc;
use std::sync::atomic::{AtomicI64, Ordering};
use rodio::{Decoder, Sink, Source};
use crate::error::{AppError, Result};

pub fn decode_and_play(
    file_path: &str,
    _start_ms: u64,
    sink: &Sink,
    position_ms: Arc<AtomicI64>,
    duration_ms: Arc<AtomicI64>,
) -> Result<()> {
    let file = std::fs::File::open(file_path)
        .map_err(|e| AppError::Io(format!("Cannot open {file_path}: {e}")))?;

    let reader = BufReader::new(file);

    let source = Decoder::new(reader)
        .map_err(|e| AppError::Audio(format!("Cannot decode {file_path}: {e}")))?;

    // Try to get duration from source
    if let Some(dur) = source.total_duration() {
        duration_ms.store(dur.as_millis() as i64, Ordering::Relaxed);
    }

    // Wrap with periodic position update
    let position_ms_clone = position_ms.clone();
    let tracked = source.periodic_access(
        std::time::Duration::from_millis(250),
        move |src| {
            // Calculate position from what's been decoded
            // rodio doesn't expose position directly, so we track elapsed time
            let current = position_ms_clone.load(Ordering::Relaxed);
            position_ms_clone.store(current + 250, Ordering::Relaxed);
            let _ = src;
        },
    );

    sink.append(tracked);
    sink.play();

    Ok(())
}
