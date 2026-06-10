/**
 * Recommended songs — a flat list of tracks to suggest to the user.
 *
 * Source priority:
 *   1. Last.fm — when a session is connected, flatten the artist-grouped
 *      recommendations into a single round-robin list (one track from each
 *      artist before going back for seconds, so the list stays diverse).
 *   2. Local fallback — when there's no session (or Last.fm returned nothing),
 *      surface underplayed tracks from the user's most-listened artists so
 *      they can rediscover their own library.
 */

import { useMemo } from "react";
import { useLastFmRecommendations, loadSession } from "./lastfm";
import { useTracksQuery } from "./tracks";

export interface RecommendedSong {
  title:            string;
  artist:           string;
  /** Set when the track exists in the local library; null for Last.fm tracks
   *  the user hasn't downloaded yet. */
  library_track_id: string | null;
  /** Human-readable "why" — shown as the row subtitle. */
  reason:           string;
  source:           "lastfm" | "local";
}

export interface RecommendedSongsResult {
  songs:     RecommendedSong[];
  isLoading: boolean;
  source:    "lastfm" | "local" | null;
}

export function useRecommendedSongs(limit = 20): RecommendedSongsResult {
  const session       = loadSession();
  const lastfmEnabled = !!session;
  const { data: lastfmRecs, isLoading: lastfmLoading } = useLastFmRecommendations();
  const { data: allTracks = [], isLoading: tracksLoading } = useTracksQuery();

  return useMemo<RecommendedSongsResult>(() => {
    // ── Last.fm: round-robin one track per artist for diversity ──────────
    if (lastfmEnabled && lastfmRecs && lastfmRecs.artists.length > 0) {
      const flat: RecommendedSong[] = [];
      const artists = lastfmRecs.artists;
      const maxTopTrackIdx = artists.reduce((m, a) => Math.max(m, a.top_tracks.length), 0);

      outer: for (let i = 0; i < maxTopTrackIdx; i++) {
        for (const a of artists) {
          if (flat.length >= limit) break outer;
          const t = a.top_tracks[i];
          if (!t) continue;
          flat.push({
            title:            t.title,
            artist:           t.artist,
            library_track_id: t.library_track_id,
            reason:           `Because you like ${a.similar_to}`,
            source:           "lastfm",
          });
        }
      }
      return { songs: flat, isLoading: false, source: "lastfm" };
    }

    // ── Local fallback: rediscover underplayed tracks ────────────────────
    if (allTracks.length === 0) {
      return {
        songs:     [],
        isLoading: tracksLoading || (lastfmEnabled && lastfmLoading),
        source:    null,
      };
    }

    const playsByArtist = new Map<string, number>();
    for (const t of allTracks) {
      if (t.play_count > 0 && t.artist) {
        playsByArtist.set(t.artist, (playsByArtist.get(t.artist) ?? 0) + t.play_count);
      }
    }
    const topArtists = new Set(
      [...playsByArtist.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([name]) => name),
    );

    const shuffled = [...allTracks].sort(() => Math.random() - 0.5);
    const used = new Set<string>();
    const pool: typeof allTracks = [];

    for (const t of shuffled) {
      if (pool.length >= limit) break;
      if (used.has(t.id)) continue;
      if (topArtists.has(t.artist) && t.play_count === 0) {
        pool.push(t);
        used.add(t.id);
      }
    }
    if (pool.length < limit) {
      for (const t of shuffled) {
        if (pool.length >= limit) break;
        if (used.has(t.id)) continue;
        if (t.play_count <= 1) {
          pool.push(t);
          used.add(t.id);
        }
      }
    }

    const songs: RecommendedSong[] = pool.map((t) => ({
      title:            t.title,
      artist:           t.artist,
      library_track_id: t.id,
      reason:           topArtists.has(t.artist) ? `More from ${t.artist}` : "From your library",
      source:           "local",
    }));

    return {
      songs,
      isLoading: tracksLoading,
      source:    songs.length > 0 ? "local" : null,
    };
  }, [lastfmEnabled, lastfmRecs, allTracks, tracksLoading, lastfmLoading, limit]);
}
