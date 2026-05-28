/// 6-band peaking biquad equalizer — push-based sample processor.
///
/// The filter chain is rebuilt from the shared `EqConfig` every ~4096 samples
/// (non-blocking `try_lock`) so that knob changes take effect in real-time
/// without restarting playback.
use std::sync::{Arc, Mutex};

// ─── Public types ─────────────────────────────────────────────────────────────

/// Center frequencies for the 6 EQ bands (Hz).
pub const EQ_BANDS_HZ: [f32; 6] = [60.0, 150.0, 400.0, 1_000.0, 2_400.0, 15_000.0];

/// Q factor used for every peaking band (1.41 ≈ 1/√2 gives a musical width).
const Q: f32 = 1.41;

/// How often (in samples) we poll the shared config for changes.
const UPDATE_EVERY: u64 = 4096;

#[derive(Clone, Debug)]
pub struct EqConfig {
    /// Whether the EQ processing is active.
    pub enabled: bool,
    /// Per-band gain in dB; clamped to [-12.0, +12.0].
    pub gains_db: [f32; 6],
    /// Cross-fade duration in milliseconds (0 = disabled).
    pub crossfade_ms: u32,
}

impl Default for EqConfig {
    fn default() -> Self {
        EqConfig { enabled: false, gains_db: [0.0; 6], crossfade_ms: 0 }
    }
}

// ─── Biquad maths ─────────────────────────────────────────────────────────────

/// Normalized biquad coefficients (a0 already divided out).
#[derive(Clone, Debug)]
struct Coeffs {
    b0: f64, b1: f64, b2: f64,
    a1: f64, a2: f64,
}

impl Coeffs {
    fn identity() -> Self {
        Coeffs { b0: 1.0, b1: 0.0, b2: 0.0, a1: 0.0, a2: 0.0 }
    }

    /// Peaking EQ biquad as described in the Audio EQ Cookbook (R. Bristow-Johnson).
    fn peaking(freq_hz: f32, gain_db: f32, q: f32, sample_rate: u32) -> Self {
        let a      = 10f64.powf(gain_db as f64 / 40.0);
        let w0     = 2.0 * std::f64::consts::PI * (freq_hz as f64 / sample_rate as f64);
        let alpha  = w0.sin() / (2.0 * q as f64);
        let cos_w0 = w0.cos();

        let b0 =  1.0 + alpha * a;
        let b1 = -2.0 * cos_w0;
        let b2 =  1.0 - alpha * a;
        let a0 =  1.0 + alpha / a;
        let a1 = -2.0 * cos_w0;
        let a2 =  1.0 - alpha / a;

        Coeffs { b0: b0/a0, b1: b1/a0, b2: b2/a0, a1: a1/a0, a2: a2/a0 }
    }
}

fn build_coeffs(config: &EqConfig, sample_rate: u32) -> [Coeffs; 6] {
    if !config.enabled {
        return std::array::from_fn(|_| Coeffs::identity());
    }
    std::array::from_fn(|i| {
        let g = config.gains_db[i];
        if g.abs() < 0.05 { Coeffs::identity() }
        else { Coeffs::peaking(EQ_BANDS_HZ[i], g, Q, sample_rate) }
    })
}

// ─── Per-channel delay lines ──────────────────────────────────────────────────

#[derive(Clone, Debug, Default)]
struct DelayLine {
    x1: f64, x2: f64,
    y1: f64, y2: f64,
}

impl DelayLine {
    #[inline]
    fn process(&mut self, x: f64, c: &Coeffs) -> f64 {
        let y = c.b0 * x + c.b1 * self.x1 + c.b2 * self.x2
              - c.a1 * self.y1 - c.a2 * self.y2;
        self.x2 = self.x1; self.x1 = x;
        self.y2 = self.y1; self.y1 = y;
        y
    }
}

// ─── EqProcessor ─────────────────────────────────────────────────────────────

/// Push-based 6-band EQ processor for interleaved f32 sample streams.
/// Feed one sample at a time via `process()`; channel index advances automatically.
pub struct EqProcessor {
    channels:      u16,
    sample_rate:   u32,
    shared:        Arc<Mutex<EqConfig>>,
    enabled:       bool,
    current_gains: [f32; 6],
    coeffs:        [Coeffs; 6],
    /// delay lines indexed [band][channel]; supports up to 2 channels (stereo).
    delays:        [[DelayLine; 2]; 6],
    current_ch:    u16,
    sample_count:  u64,
}

impl EqProcessor {
    pub fn new(channels: u16, sample_rate: u32, shared: Arc<Mutex<EqConfig>>) -> Self {
        let config = shared.lock().unwrap().clone();
        let coeffs = build_coeffs(&config, sample_rate);
        EqProcessor {
            channels,
            sample_rate,
            shared,
            enabled:       config.enabled,
            current_gains: config.gains_db,
            coeffs,
            delays:        Default::default(),
            current_ch:    0,
            sample_count:  0,
        }
    }

    /// Process one interleaved sample, advancing the internal channel counter.
    #[inline]
    pub fn process(&mut self, sample: f32) -> f32 {
        // Periodically check for config changes (non-blocking).
        if self.sample_count % UPDATE_EVERY == 0 {
            if let Ok(cfg) = self.shared.try_lock() {
                if cfg.enabled != self.enabled || cfg.gains_db != self.current_gains {
                    self.enabled       = cfg.enabled;
                    self.current_gains = cfg.gains_db;
                    self.coeffs        = build_coeffs(&cfg, self.sample_rate);
                    // Reset delay lines to avoid a transient click.
                    self.delays = Default::default();
                }
            }
        }
        self.sample_count += 1;

        if !self.enabled {
            self.current_ch = (self.current_ch + 1) % self.channels;
            return sample;
        }

        let ch = (self.current_ch as usize).min(1);
        let mut out = sample as f64;
        for band in 0..6 {
            out = self.delays[band][ch].process(out, &self.coeffs[band]);
        }
        self.current_ch = (self.current_ch + 1) % self.channels;
        out.clamp(-1.0, 1.0) as f32
    }
}
