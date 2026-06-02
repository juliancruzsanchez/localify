/// Last.fm scrobbling client.
///
/// Uses the Last.fm Mobile Session auth flow:
///   1. `auth.getMobileSession` with username + password → session key
///   2. All subsequent calls signed with `api_key` + `api_secret` + `session_key`
///
/// Users must register their own API key at <https://www.last.fm/api/account/create>.

use std::collections::BTreeMap;
use md5::{Md5, Digest};
use reqwest::Client;
use serde::{Deserialize, Serialize};

const LASTFM_API_URL: &str = "https://ws.audioscrobbler.com/2.0/";

// ─── Response types ───────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
struct SessionResponse {
    session: Option<SessionData>,
    error: Option<u32>,
    message: Option<String>,
}

#[derive(Debug, Deserialize)]
struct SessionData {
    key: String,
}

// ─── Client ──────────────────────────────────────────────────────────────────

#[derive(Debug, Clone)]
pub struct LastFmClient {
    http: Client,
    pub api_key: String,
    api_secret: String,
}

impl LastFmClient {
    pub fn new(api_key: String, api_secret: String) -> Self {
        Self {
            http: Client::builder()
                .timeout(std::time::Duration::from_secs(10))
                .build()
                .unwrap_or_default(),
            api_key,
            api_secret,
        }
    }

    // ── Signature helpers ─────────────────────────────────────────────────────

    /// Build an API signature per the Last.fm spec:
    ///   sort params (excl. `format`/`callback`) → concat key+value pairs → append secret → MD5
    fn sign(&self, params: &BTreeMap<&str, &str>) -> String {
        let mut sig = String::new();
        for (k, v) in params.iter() {
            if *k != "format" && *k != "callback" {
                sig.push_str(k);
                sig.push_str(v);
            }
        }
        sig.push_str(&self.api_secret);
        format!("{:x}", Md5::digest(sig.as_bytes()))
    }

    // ── Auth ──────────────────────────────────────────────────────────────────

    /// Authenticate with username + password and return a session key.
    pub async fn get_mobile_session(
        &self,
        username: &str,
        password: &str,
    ) -> Result<String, LastFmError> {
        let mut params = BTreeMap::new();
        params.insert("api_key", self.api_key.as_str());
        params.insert("method", "auth.getMobileSession");
        params.insert("password", password);
        params.insert("username", username);
        let sig = self.sign(&params);

        let resp: SessionResponse = self
            .http
            .post(LASTFM_API_URL)
            .form(&[
                ("api_key",  self.api_key.as_str()),
                ("method",   "auth.getMobileSession"),
                ("password", password),
                ("username", username),
                ("api_sig",  sig.as_str()),
                ("format",   "json"),
            ])
            .send()
            .await
            .map_err(LastFmError::Http)?
            .json()
            .await
            .map_err(LastFmError::Http)?;

        if let Some(code) = resp.error {
            return Err(LastFmError::Api(code, resp.message.unwrap_or_default()));
        }

        resp.session
            .map(|s| s.key)
            .ok_or(LastFmError::Api(0, "Empty session in response".into()))
    }

    // ── Now Playing ───────────────────────────────────────────────────────────

    pub async fn update_now_playing(
        &self,
        session_key: &str,
        artist: &str,
        track: &str,
        album: Option<&str>,
        duration_secs: u64,
    ) -> Result<(), LastFmError> {
        let dur = duration_secs.to_string();
        let mut params = BTreeMap::new();
        params.insert("api_key",  self.api_key.as_str());
        params.insert("artist",   artist);
        params.insert("duration", dur.as_str());
        params.insert("method",   "track.updateNowPlaying");
        params.insert("sk",       session_key);
        params.insert("track",    track);
        if let Some(a) = album { params.insert("album", a); }
        let sig = self.sign(&params);

        let mut form: Vec<(&str, &str)> = vec![
            ("api_key",  &self.api_key),
            ("artist",   artist),
            ("duration", dur.as_str()),
            ("method",   "track.updateNowPlaying"),
            ("sk",       session_key),
            ("track",    track),
            ("api_sig",  sig.as_str()),
            ("format",   "json"),
        ];
        if let Some(a) = album { form.push(("album", a)); }

        self.http
            .post(LASTFM_API_URL)
            .form(&form)
            .send()
            .await
            .map_err(LastFmError::Http)?;

        Ok(())
    }

    // ── Scrobble ──────────────────────────────────────────────────────────────

    pub async fn scrobble(
        &self,
        session_key: &str,
        artist: &str,
        track: &str,
        album: Option<&str>,
        timestamp_secs: u64,
        duration_secs: u64,
    ) -> Result<(), LastFmError> {
        let ts  = timestamp_secs.to_string();
        let dur = duration_secs.to_string();

        let mut params = BTreeMap::new();
        params.insert("api_key",       self.api_key.as_str());
        params.insert("artist[0]",     artist);
        params.insert("duration[0]",   dur.as_str());
        params.insert("method",        "track.scrobble");
        params.insert("sk",            session_key);
        params.insert("timestamp[0]",  ts.as_str());
        params.insert("track[0]",      track);
        if let Some(a) = album { params.insert("album[0]", a); }
        let sig = self.sign(&params);

        let mut form: Vec<(&str, &str)> = vec![
            ("api_key",      &self.api_key),
            ("artist[0]",    artist),
            ("duration[0]",  dur.as_str()),
            ("method",       "track.scrobble"),
            ("sk",           session_key),
            ("timestamp[0]", ts.as_str()),
            ("track[0]",     track),
            ("api_sig",      sig.as_str()),
            ("format",       "json"),
        ];
        if let Some(a) = album { form.push(("album[0]", a)); }

        self.http
            .post(LASTFM_API_URL)
            .form(&form)
            .send()
            .await
            .map_err(LastFmError::Http)?;

        Ok(())
    }

    // ── Recommendations ───────────────────────────────────────────────────────

    /// Fetch the user's top artists over `period` ("overall", "7day", "1month",
    /// "3month", "6month", "12month").  Returns a list of artist names.
    pub async fn get_user_top_artists(
        &self,
        username: &str,
        limit: u32,
    ) -> Result<Vec<String>, LastFmError> {
        let limit_s = limit.to_string();
        let resp: serde_json::Value = self
            .http
            .get(LASTFM_API_URL)
            .query(&[
                ("method",  "user.gettopartists"),
                ("user",    username),
                ("period",  "overall"),
                ("limit",   limit_s.as_str()),
                ("api_key", self.api_key.as_str()),
                ("format",  "json"),
            ])
            .send()
            .await
            .map_err(LastFmError::Http)?
            .json()
            .await
            .map_err(LastFmError::Http)?;

        if let Some(code) = resp["error"].as_u64() {
            let msg = resp["message"].as_str().unwrap_or("").to_string();
            return Err(LastFmError::Api(code as u32, msg));
        }

        let artists = resp["topartists"]["artist"]
            .as_array()
            .map(|arr| {
                arr.iter()
                    .filter_map(|a| a["name"].as_str().map(String::from))
                    .collect()
            })
            .unwrap_or_default();

        Ok(artists)
    }

    /// Fetch artists similar to `artist`.  Returns (name, match_score 0–1) pairs,
    /// sorted by match descending.
    pub async fn get_similar_artists(
        &self,
        artist: &str,
        limit: u32,
    ) -> Result<Vec<(String, f32)>, LastFmError> {
        let limit_s = limit.to_string();
        let resp: serde_json::Value = self
            .http
            .get(LASTFM_API_URL)
            .query(&[
                ("method",  "artist.getsimilar"),
                ("artist",  artist),
                ("limit",   limit_s.as_str()),
                ("api_key", self.api_key.as_str()),
                ("format",  "json"),
            ])
            .send()
            .await
            .map_err(LastFmError::Http)?
            .json()
            .await
            .map_err(LastFmError::Http)?;

        if let Some(code) = resp["error"].as_u64() {
            let msg = resp["message"].as_str().unwrap_or("").to_string();
            return Err(LastFmError::Api(code as u32, msg));
        }

        let similar = resp["similarartists"]["artist"]
            .as_array()
            .map(|arr| {
                arr.iter()
                    .filter_map(|a| {
                        let name  = a["name"].as_str()?.to_string();
                        let score = a["match"]
                            .as_str()
                            .and_then(|s| s.parse::<f32>().ok())
                            .unwrap_or(0.0);
                        Some((name, score))
                    })
                    .collect()
            })
            .unwrap_or_default();

        Ok(similar)
    }

    /// Fetch the global top tracks for `artist`.  Returns (track_title, artist_name) pairs.
    pub async fn get_artist_top_tracks(
        &self,
        artist: &str,
        limit: u32,
    ) -> Result<Vec<(String, String)>, LastFmError> {
        let limit_s = limit.to_string();
        let resp: serde_json::Value = self
            .http
            .get(LASTFM_API_URL)
            .query(&[
                ("method",  "artist.gettoptracks"),
                ("artist",  artist),
                ("limit",   limit_s.as_str()),
                ("api_key", self.api_key.as_str()),
                ("format",  "json"),
            ])
            .send()
            .await
            .map_err(LastFmError::Http)?
            .json()
            .await
            .map_err(LastFmError::Http)?;

        if let Some(code) = resp["error"].as_u64() {
            let msg = resp["message"].as_str().unwrap_or("").to_string();
            return Err(LastFmError::Api(code as u32, msg));
        }

        let tracks = resp["toptracks"]["track"]
            .as_array()
            .map(|arr| {
                arr.iter()
                    .filter_map(|t| {
                        let title       = t["name"].as_str()?.to_string();
                        let artist_name = t["artist"]["name"].as_str()
                            .unwrap_or(artist)
                            .to_string();
                        Some((title, artist_name))
                    })
                    .collect()
            })
            .unwrap_or_default();

        Ok(tracks)
    }
}

// ─── Error type ───────────────────────────────────────────────────────────────

#[derive(Debug, thiserror::Error, Serialize)]
pub enum LastFmError {
    #[error("HTTP error: {0}")]
    Http(#[serde(skip)] #[from] reqwest::Error),
    #[error("Last.fm API error {0}: {1}")]
    Api(u32, String),
}
