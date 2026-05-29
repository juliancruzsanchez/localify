use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LyricLine {
    pub time_ms: u32,
    pub text: String,
}

/// Parse "mm:ss.xx" / "mm:ss.xxx" / "mm:ss" → milliseconds
fn parse_timestamp(s: &str) -> Option<u32> {
    let colon = s.find(':')?;
    let minutes: u32 = s[..colon].parse().ok()?;
    let rest = &s[colon + 1..];
    let (secs_str, frac_str) = match rest.find('.') {
        Some(d) => (&rest[..d], &rest[d + 1..]),
        None    => (rest, ""),
    };
    let seconds: u32 = secs_str.parse().ok()?;
    let millis: u32 = if frac_str.is_empty() {
        0
    } else {
        // Normalise to 3 digits (centiseconds → ms, ms stays)
        let trimmed = &frac_str[..frac_str.len().min(3)];
        let val: u32 = trimmed.parse().ok()?;
        val * 10u32.pow(3 - trimmed.len() as u32)
    };
    Some(minutes * 60_000 + seconds * 1_000 + millis)
}

/// Parse an LRC string into a time-sorted vec of lyric lines.
pub fn parse_lrc(content: &str) -> Vec<LyricLine> {
    let mut lines: Vec<LyricLine> = Vec::new();

    for raw in content.lines() {
        let raw = raw.trim();
        if raw.is_empty() { continue; }

        let mut timestamps: Vec<u32> = Vec::new();
        let mut pos = 0usize;
        let bytes = raw.as_bytes();

        while pos < raw.len() {
            if bytes[pos] != b'[' { break; }
            let close = match raw[pos..].find(']') {
                Some(i) => pos + i,
                None => break,
            };
            let tag = &raw[pos + 1..close];
            // Timestamp: starts with digit and contains ':'
            if tag.bytes().next().map_or(false, |b| b.is_ascii_digit()) && tag.contains(':') {
                if let Some(ms) = parse_timestamp(tag) {
                    timestamps.push(ms);
                }
                pos = close + 1;
            } else {
                // Metadata tag – skip the whole line if no timestamps collected yet
                if timestamps.is_empty() { pos = raw.len(); }
                break;
            }
        }

        if timestamps.is_empty() { continue; }
        let text = raw[pos..].trim().to_string();
        if text.is_empty() { continue; }

        for ts in timestamps {
            lines.push(LyricLine { time_ms: ts, text: text.clone() });
        }
    }

    lines.sort_by_key(|l| l.time_ms);
    lines
}

/// Try to read a sibling .lrc file next to the audio file.
pub fn read_lrc_file(audio_path: &str) -> Option<Vec<LyricLine>> {
    let lrc_path = Path::new(audio_path).with_extension("lrc");
    let content = std::fs::read_to_string(&lrc_path).ok()?;
    let lines = parse_lrc(&content);
    if lines.is_empty() { None } else { Some(lines) }
}

#[derive(Deserialize)]
struct LrclibResponse {
    #[serde(rename = "syncedLyrics")]
    synced_lyrics: Option<String>,
    #[serde(default)]
    instrumental: bool,
}

#[derive(Serialize)]
struct LrclibQuery<'a> {
    artist_name: &'a str,
    track_name: &'a str,
    album_name: &'a str,
    duration: u64,
}

/// Fetch synced lyrics from lrclib.net as a fallback.
pub async fn fetch_from_lrclib(
    artist: &str,
    title: &str,
    album: &str,
    duration_secs: f64,
) -> Option<Vec<LyricLine>> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(8))
        .user_agent("Localify/1.0")
        .build()
        .ok()?;

    let resp = client
        .get("https://lrclib.net/api/get")
        .query(&LrclibQuery {
            artist_name: artist,
            track_name: title,
            album_name: album,
            duration: duration_secs.round() as u64,
        })
        .send()
        .await
        .ok()?;

    if !resp.status().is_success() { return None; }

    let data: LrclibResponse = resp.json().await.ok()?;
    if data.instrumental { return None; }

    let synced = data.synced_lyrics.filter(|s| !s.trim().is_empty())?;
    let lines = parse_lrc(&synced);
    if lines.is_empty() { None } else { Some(lines) }
}

/// Resolve lyrics: local .lrc file first, then lrclib.net.
pub async fn get_lyrics_for_track(
    file_path: &str,
    title: &str,
    artist: &str,
    album: &str,
    duration_secs: f64,
) -> Option<Vec<LyricLine>> {
    if let Some(lines) = read_lrc_file(file_path) {
        return Some(lines);
    }
    fetch_from_lrclib(artist, title, album, duration_secs).await
}

/// Extract dominant color from an artwork JPEG.
/// Weights saturated pixels more heavily, then darkens the result for use as a
/// background. Returns a "#rrggbb" string, or `None` on failure.
pub fn artwork_dominant_color(path: &Path) -> Option<String> {
    let img = image::open(path).ok()?;
    let rgb = img.to_rgb8();

    let mut r_acc = 0.0f64;
    let mut g_acc = 0.0f64;
    let mut b_acc = 0.0f64;
    let mut w_acc = 0.0f64;

    // Sample every 5th pixel in each dimension (~1/25 of pixels, fast)
    for (x, y, pixel) in rgb.enumerate_pixels() {
        if x % 5 != 0 || y % 5 != 0 { continue; }
        let r = pixel[0] as f64;
        let g = pixel[1] as f64;
        let b = pixel[2] as f64;
        let max = r.max(g).max(b);
        let min = r.min(g).min(b);
        let sat = if max > 0.0 { (max - min) / max } else { 0.0 };
        let w = 1.0 + sat * 4.0;
        r_acc += r * w; g_acc += g * w; b_acc += b * w; w_acc += w;
    }

    if w_acc == 0.0 { return None; }

    // Darken by 55% for background use
    let r = ((r_acc / w_acc) * 0.55) as u8;
    let g = ((g_acc / w_acc) * 0.55) as u8;
    let b = ((b_acc / w_acc) * 0.55) as u8;

    Some(format!("#{:02x}{:02x}{:02x}", r, g, b))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_basic_lrc() {
        let lrc = "[ar:Artist]\n[00:04.32]First line\n[00:08.64]Second line\n";
        let lines = parse_lrc(lrc);
        assert_eq!(lines.len(), 2);
        assert_eq!(lines[0].time_ms, 4320);
        assert_eq!(lines[0].text, "First line");
        assert_eq!(lines[1].time_ms, 8640);
    }

    #[test]
    fn parse_multi_timestamp() {
        let lrc = "[00:10.00][01:20.00]Chorus line\n";
        let lines = parse_lrc(lrc);
        assert_eq!(lines.len(), 2);
        assert_eq!(lines[0].time_ms, 10_000);
        assert_eq!(lines[1].time_ms, 80_000);
    }

    #[test]
    fn parse_millisecond_timestamps() {
        let lrc = "[00:03.500]Hello\n";
        let lines = parse_lrc(lrc);
        assert_eq!(lines[0].time_ms, 3500);
    }
}
