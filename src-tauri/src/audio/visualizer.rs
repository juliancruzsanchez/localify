use std::f32::consts::PI;
use crossbeam_channel::Receiver;
use rustfft::{FftPlanner, num_complex::Complex};
use tauri::Emitter;

const FFT_SIZE: usize = 2048;
const NUM_BANDS: usize = 32;
const FREQ_MIN: f32 = 20.0;
const FREQ_MAX: f32 = 20_000.0;

pub fn run_visualizer_thread(
    rx: Receiver<Vec<f32>>,
    sample_rate: u32,
    app_handle: tauri::AppHandle,
) {
    let mut ring: Vec<f32> = vec![0.0; FFT_SIZE];
    let mut ring_head: usize = 0;
    let mut ring_fill: usize = 0;

    let hop = (sample_rate / 60).max(1) as usize;
    let mut samples_since_hop: usize = 0;

    let mut planner = FftPlanner::<f32>::new();
    let fft = planner.plan_fft_forward(FFT_SIZE);

    let hann: Vec<f32> = (0..FFT_SIZE)
        .map(|i| 0.5 * (1.0 - (2.0 * PI * i as f32 / (FFT_SIZE - 1) as f32).cos()))
        .collect();

    // Precompute band edges as FFT bin indices
    let log_min = FREQ_MIN.log10();
    let log_max = FREQ_MAX.log10();
    let bins_per_hz = FFT_SIZE as f32 / sample_rate as f32;
    let band_ranges: Vec<(usize, usize)> = (0..NUM_BANDS)
        .map(|b| {
            let lo_freq = 10f32.powf(log_min + (b as f32 / NUM_BANDS as f32) * (log_max - log_min));
            let hi_freq = 10f32.powf(log_min + ((b + 1) as f32 / NUM_BANDS as f32) * (log_max - log_min));
            let lo_bin = ((lo_freq * bins_per_hz) as usize).max(1).min(FFT_SIZE / 2 - 1);
            let hi_bin = ((hi_freq * bins_per_hz) as usize).max(lo_bin + 1).min(FFT_SIZE / 2);
            (lo_bin, hi_bin)
        })
        .collect();

    let norm = (FFT_SIZE / 2) as f32 * 0.5;
    let mut smoothed = vec![0.0f32; NUM_BANDS];

    loop {
        let chunk = match rx.recv() {
            Ok(c) => c,
            Err(_) => return,
        };

        for &sample in &chunk {
            ring[ring_head] = sample;
            ring_head = (ring_head + 1) % FFT_SIZE;
            if ring_fill < FFT_SIZE {
                ring_fill += 1;
            }
            samples_since_hop += 1;

            if samples_since_hop >= hop && ring_fill >= FFT_SIZE {
                samples_since_hop = 0;

                // Copy ring buffer into windowed FFT input in chronological order
                let mut buf: Vec<Complex<f32>> = (0..FFT_SIZE)
                    .map(|i| {
                        let idx = (ring_head + FFT_SIZE - FFT_SIZE + i) % FFT_SIZE;
                        Complex { re: ring[idx] * hann[i], im: 0.0 }
                    })
                    .collect();

                fft.process(&mut buf);

                let mags: Vec<f32> = buf[..FFT_SIZE / 2]
                    .iter()
                    .map(|c| (c.re * c.re + c.im * c.im).sqrt())
                    .collect();

                for (b, &(lo, hi)) in band_ranges.iter().enumerate() {
                    let avg = mags[lo..hi].iter().sum::<f32>() / (hi - lo) as f32;
                    let normalized = (avg / norm).min(1.0);
                    smoothed[b] = if normalized < smoothed[b] {
                        smoothed[b] * 0.85 + normalized * 0.15
                    } else {
                        smoothed[b] * 0.7 + normalized * 0.3
                    };
                }

                let _ = app_handle.emit("visualizer-update", &smoothed);
            }
        }
    }
}
