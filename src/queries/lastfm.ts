/**
 * Last.fm queries + mutations.
 *
 * The session (api_key, session_key, username) is stored in localStorage
 * under the key "lastfm_session" so it survives app restarts without needing
 * an extra Tauri store round-trip on every play.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import type { LastFmSession, LastFmRecommendations } from "@/types";

const SESSION_KEY = "lastfm_session";

// ─── Session helpers ──────────────────────────────────────────────────────────

export function loadSession(): LastFmSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as LastFmSession) : null;
  } catch {
    return null;
  }
}

function saveSession(session: LastFmSession) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/** Returns the persisted session, or null if not connected. */
export function useLastFmSession() {
  return useQuery<LastFmSession | null>({
    queryKey: ["lastfm", "session"],
    queryFn:  () => loadSession(),
    staleTime: Infinity,
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export interface ConnectArgs {
  api_key:    string;
  api_secret: string;
  username:   string;
  password:   string;
}

/** Authenticate with Last.fm.  On success the session is saved to localStorage.
 *  We merge api_secret back in (the Rust command only returns api_key +
 *  session_key + username) so the scrobbling hook can sign subsequent calls. */
export function useLastFmConnect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: ConnectArgs) => {
      const session = await invoke<LastFmSession>("lastfm_authenticate", { credentials: args });
      return { ...session, api_secret: args.api_secret };
    },
    onSuccess: (session) => {
      saveSession(session);
      qc.setQueryData(["lastfm", "session"], session);
    },
  });
}

/** Clear the stored session — no API call needed. */
export function useLastFmDisconnect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => { clearSession(); },
    onSuccess: () => {
      qc.setQueryData(["lastfm", "session"], null);
    },
  });
}

/** Fire a "now playing" notification (fire-and-forget — errors are ignored). */
export function useLastFmNowPlaying() {
  return useMutation({
    mutationFn: ({
      trackId,
      apiKey,
      apiSecret,
      sessionKey,
    }: {
      trackId:    string;
      apiKey:     string;
      apiSecret:  string;
      sessionKey: string;
    }) =>
      invoke("lastfm_now_playing", {
        trackId,
        apiKey,
        apiSecret,
        sessionKey,
      }),
  });
}

/** Fetch personalised recommendations.  Requires a connected session. */
export function useLastFmRecommendations() {
  const session = loadSession();
  return useQuery<LastFmRecommendations>({
    queryKey: ["lastfm", "recommendations"],
    queryFn:  () =>
      invoke<LastFmRecommendations>("lastfm_get_recommendations", {
        username: session!.username,
        apiKey:   session!.api_key,
      }),
    enabled:   !!session,
    staleTime: 10 * 60 * 1000, // 10 min
    retry:     1,
  });
}

/** Scrobble a track (fire-and-forget — errors are shown in console only). */
export function useLastFmScrobble() {
  return useMutation({
    mutationFn: ({
      trackId,
      apiKey,
      apiSecret,
      sessionKey,
      timestampSecs,
    }: {
      trackId:       string;
      apiKey:        string;
      apiSecret:     string;
      sessionKey:    string;
      timestampSecs: number;
    }) =>
      invoke("lastfm_scrobble", {
        trackId,
        apiKey,
        apiSecret,
        sessionKey,
        timestampSecs,
      }),
    onError: (e) => console.error("[last.fm] scrobble failed:", e),
  });
}
