import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useDownloadStore } from '../store/downloadStore';
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
  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`API error ${res.status} at ${url}`);
    }
    return (await res.json()) as T;
  } catch (e) {
    // Surface the URL in network failures so it's obvious when the saved
    // server URL has gone stale (e.g. desktop restarted, port changed).
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Could not reach ${url}: ${msg}`);
  }
}

// ── Offline library (derived from downloaded tracks) ───────────────────────────
// When the server is unreachable we synthesize the library from the metadata
// stored alongside each downloaded track, so only downloaded content shows.

function buildOfflineAlbums(tracks: TrackSummary[]): AlbumSummary[] {
  const byId = new Map<string, AlbumSummary>();
  for (const t of tracks) {
    const existing = byId.get(t.album_id);
    if (existing) existing.track_count += 1;
    else
      byId.set(t.album_id, {
        id: t.album_id,
        title: t.album,
        artist: t.artist,
        artist_id: t.artist_id,
        year: t.year,
        track_count: 1,
      });
  }
  return [...byId.values()].sort((a, b) => a.title.localeCompare(b.title));
}

function buildOfflineArtists(tracks: TrackSummary[]): ArtistSummary[] {
  const byId = new Map<string, ArtistSummary & { _albums: Set<string> }>();
  for (const t of tracks) {
    const existing = byId.get(t.artist_id);
    if (existing) {
      existing.track_count += 1;
      existing._albums.add(t.album_id);
    } else {
      byId.set(t.artist_id, {
        id: t.artist_id,
        name: t.artist,
        album_count: 0,
        track_count: 1,
        _albums: new Set([t.album_id]),
      });
    }
  }
  return [...byId.values()]
    .map(({ _albums, ...a }) => ({ ...a, album_count: _albums.size }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function useOfflineTracks(): TrackSummary[] {
  const downloads = useDownloadStore((s) => s.downloads);
  return useMemo(() => Object.values(downloads).map((d) => d.metadata), [downloads]);
}

// Replace a query result with offline-derived data when the server is offline.
function withOffline<T>(
  q: UseQueryResult<T>,
  isOffline: boolean,
  data: T | undefined,
): UseQueryResult<T> {
  if (!isOffline) return q;
  return {
    ...q,
    data,
    isLoading: false,
    isPending: false,
    isError: false,
    isSuccess: true,
    error: null,
    status: 'success',
    fetchStatus: 'idle',
  } as UseQueryResult<T>;
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function useTracks() {
  const { baseUrl, isOffline } = useServer();
  const offlineTracks = useOfflineTracks();
  const q = useQuery<TrackSummary[]>({
    queryKey: ['tracks', baseUrl],
    queryFn: () => apiFetch<TrackSummary[]>(`${baseUrl}/api/tracks`),
    enabled: !!baseUrl && !isOffline,
  });
  return withOffline(q, isOffline, offlineTracks);
}

export function useLiked() {
  const { baseUrl, isOffline } = useServer();
  const q = useQuery<TrackSummary[]>({
    queryKey: ['liked', baseUrl],
    queryFn: () => apiFetch<TrackSummary[]>(`${baseUrl}/api/liked`),
    enabled: !!baseUrl && !isOffline,
  });
  return withOffline(q, isOffline, [] as TrackSummary[]);
}

export function useRecent(limit = 8) {
  const { baseUrl, isOffline } = useServer();
  const offlineTracks = useOfflineTracks();
  const q = useQuery<TrackSummary[]>({
    queryKey: ['recent', baseUrl, limit],
    queryFn: () => apiFetch<TrackSummary[]>(`${baseUrl}/api/recent?limit=${limit}`),
    enabled: !!baseUrl && !isOffline,
  });
  const offlineRecent = useMemo(() => offlineTracks.slice(0, limit), [offlineTracks, limit]);
  return withOffline(q, isOffline, offlineRecent);
}

export function useAlbums() {
  const { baseUrl, isOffline } = useServer();
  const offlineTracks = useOfflineTracks();
  const q = useQuery<AlbumSummary[]>({
    queryKey: ['albums', baseUrl],
    queryFn: () => apiFetch<AlbumSummary[]>(`${baseUrl}/api/albums`),
    enabled: !!baseUrl && !isOffline,
  });
  const offlineAlbums = useMemo(() => buildOfflineAlbums(offlineTracks), [offlineTracks]);
  return withOffline(q, isOffline, offlineAlbums);
}

export function useAlbum(id: string) {
  const { baseUrl, isOffline } = useServer();
  const offlineTracks = useOfflineTracks();
  const q = useQuery<AlbumDetail>({
    queryKey: ['album', baseUrl, id],
    queryFn: () => apiFetch<AlbumDetail>(`${baseUrl}/api/album/${id}`),
    enabled: !!baseUrl && !!id && !isOffline,
  });
  const offlineAlbum = useMemo<AlbumDetail | undefined>(() => {
    const tracks = offlineTracks
      .filter((t) => t.album_id === id)
      .sort((a, b) => (a.track_number ?? 0) - (b.track_number ?? 0));
    if (tracks.length === 0) return undefined;
    const first = tracks[0];
    return {
      id,
      title: first.album,
      artist: first.artist,
      artist_id: first.artist_id,
      year: first.year,
      track_count: tracks.length,
      tracks,
    };
  }, [offlineTracks, id]);
  return withOffline(q, isOffline, offlineAlbum);
}

export function useArtists() {
  const { baseUrl, isOffline } = useServer();
  const offlineTracks = useOfflineTracks();
  const q = useQuery<ArtistSummary[]>({
    queryKey: ['artists', baseUrl],
    queryFn: () => apiFetch<ArtistSummary[]>(`${baseUrl}/api/artists`),
    enabled: !!baseUrl && !isOffline,
  });
  const offlineArtists = useMemo(() => buildOfflineArtists(offlineTracks), [offlineTracks]);
  return withOffline(q, isOffline, offlineArtists);
}

export function useArtist(id: string) {
  const { baseUrl, isOffline } = useServer();
  const offlineTracks = useOfflineTracks();
  const q = useQuery<ArtistDetail>({
    queryKey: ['artist', baseUrl, id],
    queryFn: () => apiFetch<ArtistDetail>(`${baseUrl}/api/artist/${id}`),
    enabled: !!baseUrl && !!id && !isOffline,
  });
  const offlineArtist = useMemo<ArtistDetail | undefined>(() => {
    const tracks = offlineTracks.filter((t) => t.artist_id === id);
    if (tracks.length === 0) return undefined;
    const albums = buildOfflineAlbums(tracks);
    return {
      id,
      name: tracks[0].artist,
      album_count: albums.length,
      track_count: tracks.length,
      albums,
    };
  }, [offlineTracks, id]);
  return withOffline(q, isOffline, offlineArtist);
}

export function usePlaylists() {
  const { baseUrl, isOffline } = useServer();
  const q = useQuery<PlaylistSummary[]>({
    queryKey: ['playlists', baseUrl],
    queryFn: () => apiFetch<PlaylistSummary[]>(`${baseUrl}/api/playlists`),
    enabled: !!baseUrl && !isOffline,
  });
  // Server-defined playlists have no offline equivalent.
  return withOffline(q, isOffline, [] as PlaylistSummary[]);
}

export function usePlaylist(id: string) {
  const { baseUrl, isOffline } = useServer();
  return useQuery<PlaylistDetail>({
    queryKey: ['playlist', baseUrl, id],
    queryFn: () => apiFetch<PlaylistDetail>(`${baseUrl}/api/playlist/${id}`),
    enabled: !!baseUrl && !!id && !isOffline,
  });
}

export function useSearch(q: string) {
  const { baseUrl, isOffline } = useServer();
  const offlineTracks = useOfflineTracks();
  const query = useQuery<SearchResults>({
    queryKey: ['search', baseUrl, q],
    queryFn: () =>
      apiFetch<SearchResults>(`${baseUrl}/api/search?q=${encodeURIComponent(q)}`),
    enabled: !!baseUrl && !isOffline && q.length > 1,
  });
  const offlineResults = useMemo<SearchResults>(() => {
    const needle = q.trim().toLowerCase();
    if (needle.length <= 1) return { tracks: [], albums: [], artists: [] };
    const tracks = offlineTracks.filter(
      (t) =>
        t.title.toLowerCase().includes(needle) ||
        t.artist.toLowerCase().includes(needle) ||
        t.album.toLowerCase().includes(needle),
    );
    return {
      tracks,
      albums: buildOfflineAlbums(tracks).filter((a) => a.title.toLowerCase().includes(needle) || a.artist.toLowerCase().includes(needle)),
      artists: buildOfflineArtists(tracks).filter((a) => a.name.toLowerCase().includes(needle)),
    };
  }, [offlineTracks, q]);
  return withOffline(query, isOffline, offlineResults);
}

// ── Library snapshot ─────────────────────────────────────────────────────────

export interface LibrarySnapshot {
  tracks: TrackSummary[];
  albums: AlbumSummary[];
  artists: ArtistSummary[];
  playlists: PlaylistSummary[];
}

export function useLibrarySnapshot() {
  const { baseUrl, isOffline } = useServer();
  const offlineTracks = useOfflineTracks();
  const q = useQuery<LibrarySnapshot>({
    queryKey: ['library-snapshot', baseUrl],
    queryFn: () => apiFetch<LibrarySnapshot>(`${baseUrl}/api/library.json`),
    enabled: !!baseUrl && !isOffline,
    staleTime: 1000 * 60 * 5,
  });
  const offlineSnapshot = useMemo<LibrarySnapshot>(
    () => ({
      tracks: offlineTracks,
      albums: buildOfflineAlbums(offlineTracks),
      artists: buildOfflineArtists(offlineTracks),
      playlists: [],
    }),
    [offlineTracks],
  );
  return withOffline(q, isOffline, offlineSnapshot);
}

// ── Artwork URL helper ────────────────────────────────────────────────────────

export function artworkUrl(baseUrl: string | null, id: string): string | null {
  // Prefer a locally cached cover so artwork renders instantly and works
  // offline. Falls back to the server endpoint when not cached.
  const cached = useDownloadStore.getState().getArtworkUri(id);
  if (cached) return cached;
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
