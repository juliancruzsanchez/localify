import { useQuery } from '@tanstack/react-query';
import { useServer } from './useServer';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TrackSummary {
  id: string;
  title: string;
  artist: string;
  album: string;
  album_id: string;
  artist_id: string;
  duration_ms: number;
  track_number?: number;
  year?: number;
}

export interface AlbumSummary {
  id: string;
  title: string;
  artist: string;
  artist_id: string;
  year?: number;
  track_count: number;
}

export interface AlbumDetail extends AlbumSummary {
  tracks: TrackSummary[];
}

export interface ArtistSummary {
  id: string;
  name: string;
  album_count: number;
  track_count: number;
}

export interface ArtistDetail extends ArtistSummary {
  albums: AlbumSummary[];
}

export interface PlaylistSummary {
  id: string;
  name: string;
  track_count: number;
}

export interface PlaylistDetail extends PlaylistSummary {
  tracks: TrackSummary[];
}

export interface SearchResults {
  tracks: TrackSummary[];
  albums: AlbumSummary[];
  artists: ArtistSummary[];
}

// ── Fetcher ───────────────────────────────────────────────────────────────────

async function apiFetch<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function useTracks() {
  const { baseUrl } = useServer();
  return useQuery<TrackSummary[]>({
    queryKey: ['tracks', baseUrl],
    queryFn: () => apiFetch<TrackSummary[]>(`${baseUrl}/api/tracks`),
    enabled: !!baseUrl,
  });
}

export function useLiked() {
  const { baseUrl } = useServer();
  return useQuery<TrackSummary[]>({
    queryKey: ['liked', baseUrl],
    queryFn: () => apiFetch<TrackSummary[]>(`${baseUrl}/api/liked`),
    enabled: !!baseUrl,
  });
}

export function useRecent(limit = 8) {
  const { baseUrl } = useServer();
  return useQuery<TrackSummary[]>({
    queryKey: ['recent', baseUrl, limit],
    queryFn: () => apiFetch<TrackSummary[]>(`${baseUrl}/api/recent?limit=${limit}`),
    enabled: !!baseUrl,
  });
}

export function useAlbums() {
  const { baseUrl } = useServer();
  return useQuery<AlbumSummary[]>({
    queryKey: ['albums', baseUrl],
    queryFn: () => apiFetch<AlbumSummary[]>(`${baseUrl}/api/albums`),
    enabled: !!baseUrl,
  });
}

export function useAlbum(id: string) {
  const { baseUrl } = useServer();
  return useQuery<AlbumDetail>({
    queryKey: ['album', baseUrl, id],
    queryFn: () => apiFetch<AlbumDetail>(`${baseUrl}/api/album/${id}`),
    enabled: !!baseUrl && !!id,
  });
}

export function useArtists() {
  const { baseUrl } = useServer();
  return useQuery<ArtistSummary[]>({
    queryKey: ['artists', baseUrl],
    queryFn: () => apiFetch<ArtistSummary[]>(`${baseUrl}/api/artists`),
    enabled: !!baseUrl,
  });
}

export function useArtist(id: string) {
  const { baseUrl } = useServer();
  return useQuery<ArtistDetail>({
    queryKey: ['artist', baseUrl, id],
    queryFn: () => apiFetch<ArtistDetail>(`${baseUrl}/api/artist/${id}`),
    enabled: !!baseUrl && !!id,
  });
}

export function usePlaylists() {
  const { baseUrl } = useServer();
  return useQuery<PlaylistSummary[]>({
    queryKey: ['playlists', baseUrl],
    queryFn: () => apiFetch<PlaylistSummary[]>(`${baseUrl}/api/playlists`),
    enabled: !!baseUrl,
  });
}

export function usePlaylist(id: string) {
  const { baseUrl } = useServer();
  return useQuery<PlaylistDetail>({
    queryKey: ['playlist', baseUrl, id],
    queryFn: () => apiFetch<PlaylistDetail>(`${baseUrl}/api/playlist/${id}`),
    enabled: !!baseUrl && !!id,
  });
}

export function useSearch(q: string) {
  const { baseUrl } = useServer();
  return useQuery<SearchResults>({
    queryKey: ['search', baseUrl, q],
    queryFn: () =>
      apiFetch<SearchResults>(`${baseUrl}/api/search?q=${encodeURIComponent(q)}`),
    enabled: !!baseUrl && q.length > 1,
  });
}

// ── Library snapshot ─────────────────────────────────────────────────────────

export interface LibrarySnapshot {
  tracks: TrackSummary[];
  albums: AlbumSummary[];
  artists: ArtistSummary[];
  playlists: PlaylistSummary[];
}

export function useLibrarySnapshot() {
  const { baseUrl } = useServer();
  return useQuery<LibrarySnapshot>({
    queryKey: ['library-snapshot', baseUrl],
    queryFn: () => apiFetch<LibrarySnapshot>(`${baseUrl}/api/library.json`),
    enabled: !!baseUrl,
    staleTime: 1000 * 60 * 5,
  });
}

// ── Last.fm similar artists ───────────────────────────────────────────────────

export interface SimilarArtistInfo {
  name:              string;
  library_artist_id: string | null;
}

export function useLastFmArtistSimilar(artistName: string) {
  const { baseUrl } = useServer();
  return useQuery<SimilarArtistInfo[]>({
    queryKey: ['lastfm-similar', baseUrl, artistName],
    queryFn:  () =>
      apiFetch<SimilarArtistInfo[]>(
        `${baseUrl}/api/lastfm/similar/${encodeURIComponent(artistName)}`,
      ),
    enabled:   !!baseUrl && !!artistName,
    staleTime: 30 * 60 * 1000,
  });
}

// ── Artwork URL helper ────────────────────────────────────────────────────────

export function artworkUrl(baseUrl: string | null, id: string): string | null {
  if (!baseUrl) return null;
  return `${baseUrl}/api/artwork/${id}`;
}

export function streamUrl(baseUrl: string | null, trackId: string): string | null {
  if (!baseUrl) return null;
  return `${baseUrl}/stream/${trackId}`;
}

// ── Server stats ──────────────────────────────────────────────────────────────

export interface ServerStatsSummary {
  total_plays: number;
  total_listen_ms: number;
  unique_tracks: number;
  unique_artists: number;
  top_tracks: Array<{ id: string; name: string; count: number; ms: number }>;
  top_artists: Array<{ id: string; name: string; count: number; ms: number }>;
}

export function useServerStats() {
  const { baseUrl } = useServer();
  return useQuery<ServerStatsSummary>({
    queryKey: ['server-stats', baseUrl],
    queryFn: () => apiFetch<ServerStatsSummary>(`${baseUrl}/api/stats`),
    enabled: !!baseUrl,
    staleTime: 1000 * 60 * 2,
  });
}
