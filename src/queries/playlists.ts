import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import type { Playlist, PlaylistTrack } from "@/types";
import { queryKeys } from "./keys";

export function usePlaylistsQuery() {
  return useQuery({
    queryKey: queryKeys.playlists(),
    queryFn: () => invoke<Playlist[]>("get_playlists"),
  });
}

export function usePlaylistQuery(id: string) {
  return useQuery({
    queryKey: queryKeys.playlist(id),
    queryFn: () => invoke<Playlist>("get_playlist", { id }),
    enabled: !!id,
  });
}

export function usePlaylistTracksQuery(playlistId: string) {
  return useQuery({
    queryKey: queryKeys.playlistTracks(playlistId),
    queryFn: () => invoke<PlaylistTrack[]>("get_playlist_tracks_cmd", { playlistId }),
    enabled: !!playlistId,
  });
}

export function useCreatePlaylist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, description }: { name: string; description?: string }) =>
      invoke<Playlist>("create_playlist_cmd", { name, description: description ?? null }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.playlists() }),
  });
}

export function useUpdatePlaylist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name, description }: { id: string; name: string; description?: string | null }) =>
      invoke<Playlist>("update_playlist_cmd", { id, name, description: description ?? null }),
    onSuccess: (updated) => {
      qc.setQueryData(queryKeys.playlist(updated.id), updated);
      qc.invalidateQueries({ queryKey: queryKeys.playlists() });
    },
  });
}

export function useSetPlaylistCover() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, sourcePath }: { id: string; sourcePath: string | null }) =>
      invoke<Playlist>("set_playlist_cover_cmd", { id, sourcePath }),
    onSuccess: (updated) => {
      qc.setQueryData(queryKeys.playlist(updated.id), updated);
      qc.invalidateQueries({ queryKey: queryKeys.playlists() });
    },
  });
}

export function useDeletePlaylist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => invoke("delete_playlist_cmd", { id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.playlists() }),
  });
}

export function useAddTrackToPlaylist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ playlistId, trackId }: { playlistId: string; trackId: string }) =>
      invoke<PlaylistTrack>("add_track_to_playlist_cmd", { playlistId, trackId }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.playlistTracks(vars.playlistId) });
      qc.invalidateQueries({ queryKey: queryKeys.playlists() });
    },
  });
}

export function useRemoveTrackFromPlaylist(playlistId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (entryId: string) => invoke("remove_track_from_playlist_cmd", { entryId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.playlistTracks(playlistId) });
      qc.invalidateQueries({ queryKey: queryKeys.playlists() });
    },
  });
}

export function useReorderPlaylistTrack(playlistId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ entryId, newPosition }: { entryId: string; newPosition: number }) =>
      invoke("reorder_playlist_track_cmd", { entryId, newPosition }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.playlistTracks(playlistId) }),
  });
}
