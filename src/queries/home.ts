import { useQuery } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";

export interface RecentItem {
  id:             string;
  kind:           "album" | "playlist";
  title:          string;
  subtitle:       string;
  artwork_hash:   string | null;
  last_played_at: number;
}

export interface GenreMix {
  genre:        string;
  track_count:  number;
  artwork_hash: string | null;
}

export function useRecentlyPlayedQuery(limit = 8) {
  return useQuery<RecentItem[]>({
    queryKey: ["recentlyPlayed", limit],
    queryFn:  () => invoke<RecentItem[]>("get_recently_played", { limit }),
    // Refresh whenever the user navigates back to Home.
    staleTime: 0,
  });
}

export function useGenreMixesQuery() {
  return useQuery<GenreMix[]>({
    queryKey: ["genreMixes"],
    queryFn:  () => invoke<GenreMix[]>("get_genre_mixes"),
    staleTime: 60_000,
  });
}
