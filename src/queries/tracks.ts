import { useQuery } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import type { Track } from "@/types";
import { queryKeys } from "./keys";

export function useTracksQuery() {
  return useQuery({
    queryKey: queryKeys.tracks(),
    queryFn: () => invoke<Track[]>("get_tracks"),
  });
}

export function useTrackQuery(id: string) {
  return useQuery({
    queryKey: queryKeys.track(id),
    queryFn: () => invoke<Track>("get_track", { id }),
    enabled: !!id,
  });
}
