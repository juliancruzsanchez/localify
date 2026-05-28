/**
 * Handles Last.fm "now playing" + scrobble events.
 *
 * Rules (per the Last.fm API spec):
 *   • Send "now playing" immediately when a track starts.
 *   • Scrobble when the user has listened to ≥50 % of the track OR
 *     4 minutes — whichever threshold is reached first.
 *   • Never scrobble the same play session twice.
 */

import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { usePlayerStore } from "@/store/playerStore";
import { loadSession } from "@/queries/lastfm";

export function useLastFmScrobbling() {
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying    = usePlayerStore((s) => s.isPlaying);
  const positionMs   = usePlayerStore((s) => s.positionMs);
  const durationMs   = usePlayerStore((s) => s.durationMs);

  // Refs so the interval callback always sees latest values without re-subscribing
  const positionRef  = useRef(positionMs);
  const durationRef  = useRef(durationMs);
  const isPlayingRef = useRef(isPlaying);

  // Dedup guards
  const scrobbledRef = useRef<string | null>(null); // track id already scrobbled this play
  const npSentRef    = useRef<string | null>(null);  // track id for which NP was sent
  const trackStartTs = useRef<number>(0);            // unix secs when this play started

  useEffect(() => { positionRef.current  = positionMs;  }, [positionMs]);
  useEffect(() => { durationRef.current  = durationMs;  }, [durationMs]);
  useEffect(() => { isPlayingRef.current = isPlaying;   }, [isPlaying]);

  // ── Now Playing — fires whenever track changes ──────────────────────────
  useEffect(() => {
    if (!currentTrack || !isPlaying) return;
    if (npSentRef.current === currentTrack.id) return;

    const session = loadSession();
    if (!session) return;

    npSentRef.current    = currentTrack.id;
    scrobbledRef.current = null; // reset scrobble guard for fresh play
    trackStartTs.current = Math.floor(Date.now() / 1000);

    invoke("lastfm_now_playing", {
      trackId:    currentTrack.id,
      apiKey:     session.api_key,
      apiSecret:  session.api_secret,
      sessionKey: session.session_key,
    }).catch((e) => console.warn("[last.fm] now_playing failed:", e));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrack?.id, isPlaying]);

  // ── Scrobble — poll every second for threshold ──────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      const track    = currentTrack;
      const position = positionRef.current;
      const duration = durationRef.current;

      if (!track || !isPlayingRef.current) return;
      if (scrobbledRef.current === track.id) return;
      if (duration <= 0) return;

      const session = loadSession();
      if (!session) return;

      const threshold = Math.min(duration / 2, 4 * 60 * 1000);
      if (position >= threshold) {
        scrobbledRef.current = track.id;
        invoke("lastfm_scrobble", {
          trackId:       track.id,
          apiKey:        session.api_key,
          apiSecret:     session.api_secret,
          sessionKey:    session.session_key,
          timestampSecs: trackStartTs.current,
        }).catch((e) => console.warn("[last.fm] scrobble failed:", e));
      }
    }, 1000);

    return () => clearInterval(interval);
  // currentTrack is intentionally in closure so the interval always checks latest track
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrack]);
}
