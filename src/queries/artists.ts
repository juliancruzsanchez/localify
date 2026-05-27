import { useQuery } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import type { Artist, Album } from "@/types";
import { queryKeys } from "./keys";

export function useArtistsQuery() {
  return useQuery({
    queryKey: queryKeys.artists(),
    queryFn: () => invoke<Artist[]>("get_artists"),
  });
}

export function useArtistQuery(id: string) {
  return useQuery({
    queryKey: queryKeys.artist(id),
    queryFn: () => invoke<Artist>("get_artist", { id }),
    enabled: !!id,
  });
}

export function useArtistAlbumsQuery(artistId: string) {
  return useQuery({
    queryKey: queryKeys.artistAlbums(artistId),
    queryFn: () => invoke<Album[]>("get_artist_albums", { artistId }),
    enabled: !!artistId,
  });
}
