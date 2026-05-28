import { useMutation, useQueryClient } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { usePlayerStore } from "@/store/playerStore";
import type { Track, TrackTags } from "@/types";
import { queryKeys } from "./keys";

export function useGetTrackTags() {
  return useMutation({
    mutationFn: (filePath: string) =>
      invoke<TrackTags>("get_track_tags", { filePath }),
  });
}

export function useUpdateTrackTags() {
  const qc = useQueryClient();
  const playerCurrentTrack = usePlayerStore((s) => s.currentTrack);
  const setCurrentTrackInStore = usePlayerStore.getState;

  return useMutation({
    mutationFn: ({ trackId, tags }: { trackId: string; tags: TrackTags }) =>
      invoke<Track>("update_track_tags", { trackId, tags }),

    onSuccess: (updatedTrack) => {
      // ── Patch player store if this is the currently playing track ──────
      const state = usePlayerStore.getState();
      if (state.currentTrack?.id === updatedTrack.id) {
        usePlayerStore.setState({ currentTrack: updatedTrack });
      }

      // ── Poke the individual track cache so any open detail card refreshes
      qc.setQueryData(queryKeys.track(updatedTrack.id), updatedTrack);

      // ── Invalidate list queries so all views reload from the DB ─────────
      // Use broad invalidation so album/artist detail pages, FTS search,
      // and any other consumers all pick up the change.
      qc.invalidateQueries({ queryKey: queryKeys.tracks() });
      qc.invalidateQueries({ queryKey: queryKeys.albums() });
      qc.invalidateQueries({ queryKey: queryKeys.artists() });

      // Also invalidate the specific album-tracks list if we know the album
      if (updatedTrack.album_id) {
        qc.invalidateQueries({ queryKey: queryKeys.albumTracks(updatedTrack.album_id) });
        qc.invalidateQueries({ queryKey: queryKeys.album(updatedTrack.album_id) });
      }

      // Invalidate search (FTS index was updated server-side via triggers)
      qc.invalidateQueries({ queryKey: ["search"] });
    },
  });
}
