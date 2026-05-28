use std::sync::{Arc, Mutex};
use std::sync::atomic::{AtomicBool, AtomicI64, Ordering};
use std::time::Duration;
use crossbeam_channel::{Receiver, Sender, TrySendError};
use symphonia::core::{
    audio::SampleBuffer,
    codecs::{DecoderOptions, CODEC_TYPE_NULL},
    errors::Error as SymphError,
    formats::{FormatOptions, SeekMode, SeekTo},
    io::MediaSourceStream,
    meta::MetadataOptions,
    probe::Hint,
    units::Time,
};
use crate::audio::eq::{EqConfig, EqProcessor};
use crate::error::{AppError, Result};

// ─── Probe ────────────────────────────────────────────────────────────────────

/// Probe a file for sample rate, channel count, and duration.
/// Returns `(sample_rate, channels, duration_ms)`.
pub fn probe_file(file_path: &str) -> Result<(u32, u16, Option<u64>)> {
    let file = std::fs::File::open(file_path)
        .map_err(|e| AppError::Io(format!("Cannot open {file_path}: {e}")))?;
    let mss = MediaSourceStream::new(Box::new(file), Default::default());

    let mut hint = Hint::new();
    if let Some(ext) = std::path::Path::new(file_path)
        .extension()
        .and_then(|e| e.to_str())
    {
        hint.with_extension(ext);
    }

    let probed = symphonia::default::get_probe()
        .format(&hint, mss, &FormatOptions::default(), &MetadataOptions::default())
        .map_err(|e| AppError::Audio(format!("Cannot probe {file_path}: {e}")))?;

    let track = probed
        .format
        .tracks()
        .iter()
        .find(|t| t.codec_params.codec != CODEC_TYPE_NULL)
        .ok_or_else(|| AppError::Audio("No audio track found".to_string()))?;

    let sample_rate = track.codec_params.sample_rate.unwrap_or(44100);
    let channels    = track.codec_params.channels
        .map(|c| c.count() as u16)
        .unwrap_or(2);
    let duration_ms = track.codec_params.time_base
        .zip(track.codec_params.n_frames)
        .map(|(tb, frames)| {
            let t = tb.calc_time(frames);
            t.seconds * 1000 + (t.frac * 1000.0) as u64
        });

    Ok((sample_rate, channels, duration_ms))
}

// ─── Decode thread ────────────────────────────────────────────────────────────

/// Spawned by the audio loop for each Play command.
/// Decodes the file, applies EQ, and sends interleaved f32 chunks to `tx`.
/// Sets `is_playing = false` only after the cpal consumer has drained everything
/// (the sender drop triggers a `Disconnected` signal to the cpal callback which
/// then clears the flag).
pub fn decode_thread(
    file_path:   String,
    start_ms:    u64,
    tx:          Sender<Vec<f32>>,
    eq_config:   Arc<Mutex<EqConfig>>,
    position_ms: Arc<AtomicI64>,
    duration_ms: Arc<AtomicI64>,
    stop:        Arc<AtomicBool>,
    is_paused:   Arc<AtomicBool>,
    seek_rx:     Receiver<u64>,
) {
    if let Err(e) = decode_inner(
        &file_path, start_ms, &tx, eq_config,
        &position_ms, &duration_ms, &stop, &is_paused, &seek_rx,
    ) {
        eprintln!("[audio] decode error for {file_path}: {e}");
    }
    // Dropping `tx` here signals the cpal callback that the stream is finished.
    eprintln!("[audio] decode thread done: {file_path}");
}

fn decode_inner(
    file_path:   &str,
    start_ms:    u64,
    tx:          &Sender<Vec<f32>>,
    eq_config:   Arc<Mutex<EqConfig>>,
    position_ms: &AtomicI64,
    duration_ms: &AtomicI64,
    stop:        &AtomicBool,
    is_paused:   &AtomicBool,
    seek_rx:     &Receiver<u64>,
) -> Result<()> {
    let file = std::fs::File::open(file_path)
        .map_err(|e| AppError::Io(format!("Cannot open {file_path}: {e}")))?;
    let mss = MediaSourceStream::new(Box::new(file), Default::default());

    let mut hint = Hint::new();
    if let Some(ext) = std::path::Path::new(file_path)
        .extension()
        .and_then(|e| e.to_str())
    {
        hint.with_extension(ext);
    }

    let probed = symphonia::default::get_probe()
        .format(&hint, mss, &FormatOptions::default(), &MetadataOptions::default())
        .map_err(|e| AppError::Audio(format!("Cannot probe {file_path}: {e}")))?;

    let mut format = probed.format;

    let track = format
        .tracks()
        .iter()
        .find(|t| t.codec_params.codec != CODEC_TYPE_NULL)
        .ok_or_else(|| AppError::Audio("No audio track".to_string()))?;

    let track_id    = track.id;
    let time_base   = track.codec_params.time_base;
    let channels    = track.codec_params.channels
        .map(|c| c.count() as u16)
        .unwrap_or(2);
    let sample_rate = track.codec_params.sample_rate.unwrap_or(44100);

    // Store duration
    if let Some((tb, frames)) = time_base.zip(track.codec_params.n_frames) {
        let t = tb.calc_time(frames);
        duration_ms.store(
            (t.seconds * 1000 + (t.frac * 1000.0) as u64) as i64,
            Ordering::Relaxed,
        );
    }

    let mut decoder = symphonia::default::get_codecs()
        .make(&track.codec_params, &DecoderOptions::default())
        .map_err(|e| AppError::Audio(format!("Cannot create decoder: {e}")))?;

    // Seek to requested start position
    if start_ms > 0 {
        let t = Time { seconds: start_ms / 1000, frac: (start_ms % 1000) as f64 / 1000.0 };
        let _ = format.seek(SeekMode::Coarse, SeekTo::Time { time: t, track_id: None });
        position_ms.store(start_ms as i64, Ordering::Relaxed);
    }

    let mut eq = EqProcessor::new(channels, sample_rate, eq_config);

    loop {
        // Drain pending seek requests (keep the last one)
        let mut seek_target: Option<u64> = None;
        while let Ok(ms) = seek_rx.try_recv() {
            seek_target = Some(ms);
        }
        if let Some(ms) = seek_target {
            let t = Time { seconds: ms / 1000, frac: (ms % 1000) as f64 / 1000.0 };
            if let Err(e) = format.seek(SeekMode::Coarse, SeekTo::Time { time: t, track_id: None }) {
                log::warn!("[audio] seek error: {e}");
            }
            decoder.reset();
            position_ms.store(ms as i64, Ordering::Relaxed);
        }

        if stop.load(Ordering::Relaxed) { break; }

        // Pause: idle until resumed, still draining seek requests
        while is_paused.load(Ordering::Relaxed) {
            if stop.load(Ordering::Relaxed) { return Ok(()); }
            while let Ok(ms) = seek_rx.try_recv() {
                let t = Time { seconds: ms / 1000, frac: (ms % 1000) as f64 / 1000.0 };
                let _ = format.seek(SeekMode::Coarse, SeekTo::Time { time: t, track_id: None });
                decoder.reset();
                position_ms.store(ms as i64, Ordering::Relaxed);
            }
            std::thread::sleep(Duration::from_millis(10));
        }

        let packet = match format.next_packet() {
            Ok(p) => p,
            Err(SymphError::IoError(_)) => break,  // EOF
            Err(e) => {
                log::warn!("[audio] packet error: {e}");
                break;
            }
        };

        if packet.track_id() != track_id { continue; }

        // Update position from packet timestamp
        if let Some(tb) = time_base {
            let t  = tb.calc_time(packet.ts());
            let ms = t.seconds * 1000 + (t.frac * 1000.0) as u64;
            position_ms.store(ms as i64, Ordering::Relaxed);
        }

        let decoded = match decoder.decode(&packet) {
            Ok(d) => d,
            Err(SymphError::DecodeError(e)) => {
                log::warn!("[audio] decode error (skipping packet): {e}");
                continue;
            }
            Err(e) => {
                log::error!("[audio] fatal decode error: {e}");
                break;
            }
        };

        // Convert to interleaved f32
        let spec = *decoded.spec();
        let mut sample_buf = SampleBuffer::<f32>::new(decoded.capacity() as u64, spec);
        sample_buf.copy_interleaved_ref(decoded);

        // Apply EQ
        let chunk: Vec<f32> = sample_buf.samples().iter().map(|&s| eq.process(s)).collect();

        // Send to cpal callback; retry on full, bail on stop or disconnect
        let mut pending = chunk;
        loop {
            match tx.try_send(pending) {
                Ok(()) => break,
                Err(TrySendError::Full(v)) => {
                    if stop.load(Ordering::Relaxed) { return Ok(()); }
                    std::thread::sleep(Duration::from_millis(5));
                    pending = v;
                }
                Err(TrySendError::Disconnected(_)) => return Ok(()),
            }
        }
    }

    Ok(())
}
