import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import type { Track } from "@/types";

export interface LikedTrack extends Track {
  liked_at: number; // unix timestamp (seconds)
}

const LIKED_IDS_KEY  = ["likedTrackIds"] as const;
const LIKED_KEY      = (genre?: string) => ["likedTracks", genre ?? "all"] as const;
const LIKED_GENRES_KEY = ["likedGenres"] as const;

// ── All liked track IDs (used for O(1) heart status on every TrackRow) ────────
export function useLikedTrackIds() {
  return useQuery<string[]>({
    queryKey: LIKED_IDS_KEY,
    queryFn:  () => invoke<string[]>("get_liked_track_ids"),
    staleTime: 30_000,
  });
}

/** Returns true if the given track is liked; falls back to false while loading. */
export function useIsLiked(trackId: string) {
  const { data = [] } = useLikedTrackIds();
  return data.includes(trackId);
}

// ── Liked tracks list (with optional genre filter) ───────────────────────────
export function useLikedTracksQuery(genre?: string) {
  return useQuery<LikedTrack[]>({
    queryKey: LIKED_KEY(genre),
    queryFn:  () => invoke<LikedTrack[]>("get_liked_tracks", { genre: genre ?? null }),
    staleTime: 0,
  });
}

// ── Distinct genres present in liked tracks (for filter pills) ───────────────
export function useLikedGenresQuery() {
  return useQuery<string[]>({
    queryKey: LIKED_GENRES_KEY,
    queryFn:  () => invoke<string[]>("get_liked_genres"),
    staleTime: 0,
  });
}

// ── Mutations ────────────────────────────────────────────────────────────────
export function useLikeTrack() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (trackId: string) => invoke("like_track", { trackId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: LIKED_IDS_KEY });
      qc.invalidateQueries({ queryKey: ["likedTracks"] });
      qc.invalidateQueries({ queryKey: LIKED_GENRES_KEY });
    },
  });
}

export function useUnlikeTrack() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (trackId: string) => invoke("unlike_track", { trackId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: LIKED_IDS_KEY });
      qc.invalidateQueries({ queryKey: ["likedTracks"] });
      qc.invalidateQueries({ queryKey: LIKED_GENRES_KEY });
    },
  });
}
