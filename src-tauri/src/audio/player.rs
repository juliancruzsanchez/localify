use std::io::BufReader;
use std::sync::Arc;
use std::sync::atomic::{AtomicI64, Ordering};
use rodio::{Decoder, Sink, Source};
use crate::audio::eq::{EqConfig, EqSource};
use crate::error::{AppError, Result};

pub fn decode_and_play(
    file_path:   &str,
    _start_ms:   u64,
    sink:        &Sink,
    position_ms: Arc<AtomicI64>,
    duration_ms: Arc<AtomicI64>,
    eq_config:   Arc<std::sync::Mutex<EqConfig>>,
) -> Result<()> {
    let file   = std::fs::File::open(file_path)
        .map_err(|e| AppError::Io(format!("Cannot open {file_path}: {e}")))?;
    let reader = BufReader::new(file);
    let source = Decoder::new(reader)
        .map_err(|e| AppError::Audio(format!("Cannot decode {file_path}: {e}")))?;

    // Capture duration before we move the source.
    if let Some(dur) = source.total_duration() {
        duration_ms.store(dur.as_millis() as i64, Ordering::Relaxed);
    }

    // Convert to f32 (no-op if the decoder already outputs f32).
    let source_f32 = source.convert_samples::<f32>();

    // Apply the 6-band EQ (polls shared config every ~4096 samples).
    let eq_source = EqSource::new(source_f32, eq_config);

    // Wrap with periodic position tracking (every 250 ms).
    let position_ms_clone = position_ms.clone();
    let tracked = eq_source.periodic_access(
        std::time::Duration::from_millis(250),
        move |_src| {
            let cur = position_ms_clone.load(Ordering::Relaxed);
            position_ms_clone.store(cur + 250, Ordering::Relaxed);
        },
    );

    sink.append(tracked);
    sink.play();
    Ok(())
}
