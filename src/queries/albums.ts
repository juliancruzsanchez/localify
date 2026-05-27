import { useQuery } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import type { Album, Track } from "@/types";
import { queryKeys } from "./keys";

export function useAlbumsQuery() {
  return useQuery({
    queryKey: queryKeys.albums(),
    queryFn: () => invoke<Album[]>("get_albums"),
  });
}

export function useAlbumQuery(id: string) {
  return useQuery({
    queryKey: queryKeys.album(id),
    queryFn: () => invoke<Album>("get_album", { id }),
    enabled: !!id,
  });
}

export function useAlbumTracksQuery(albumId: string) {
  return useQuery({
    queryKey: queryKeys.albumTracks(albumId),
    queryFn: () => invoke<Track[]>("get_album_tracks", { albumId }),
    enabled: !!albumId,
  });
}
