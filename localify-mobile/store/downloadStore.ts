import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { create } from 'zustand';
import type { TrackSummary } from '../hooks/useLibrary';

const DOWNLOADS_KEY = 'localify:downloads';
const DOWNLOADS_DIR = FileSystem.documentDirectory + 'downloads/';

export type DownloadStatus = 'idle' | 'downloading' | 'downloaded' | 'error';

interface DownloadedTrack {
  uri: string;
  artworkUri?: string;
  metadata: TrackSummary;
  downloadedAt: number;
}

interface DownloadStore {
  downloads: Record<string, DownloadedTrack>;
  progress: Record<string, number>;
  status: Record<string, DownloadStatus>;

  // Actions
  loadDownloads: () => Promise<void>;
  downloadTrack: (track: TrackSummary, streamBaseUrl: string) => Promise<void>;
  deleteDownload: (trackId: string) => Promise<void>;
  getLocalUri: (trackId: string) => string | undefined;
  // Resolve cached artwork for a track id, or an album id (via any downloaded
  // track belonging to that album).
  getArtworkUri: (id: string) => string | undefined;
  isDownloaded: (trackId: string) => boolean;
  getStatus: (trackId: string) => DownloadStatus;
}

async function ensureDir() {
  const info = await FileSystem.getInfoAsync(DOWNLOADS_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(DOWNLOADS_DIR, { intermediates: true });
  }
}

async function persistDownloads(downloads: Record<string, DownloadedTrack>) {
  await AsyncStorage.setItem(DOWNLOADS_KEY, JSON.stringify(downloads));
}

export const useDownloadStore = create<DownloadStore>((set, get) => ({
  downloads: {},
  progress: {},
  status: {},

  loadDownloads: async () => {
    try {
      const raw = await AsyncStorage.getItem(DOWNLOADS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, DownloadedTrack>;

      // Verify files still exist on disk
      const verified: Record<string, DownloadedTrack> = {};
      const statusMap: Record<string, DownloadStatus> = {};
      await Promise.all(
        Object.entries(parsed).map(async ([id, entry]) => {
          const info = await FileSystem.getInfoAsync(entry.uri);
          if (!info.exists) return;
          let artworkUri = entry.artworkUri;
          if (artworkUri) {
            const artInfo = await FileSystem.getInfoAsync(artworkUri);
            if (!artInfo.exists) artworkUri = undefined;
          }
          verified[id] = { ...entry, artworkUri };
          statusMap[id] = 'downloaded';
        }),
      );

      set({ downloads: verified, status: statusMap });
    } catch {
      // Ignore load errors
    }
  },

  downloadTrack: async (track: TrackSummary, streamBaseUrl: string) => {
    const { status } = get();
    if (status[track.id] === 'downloading' || status[track.id] === 'downloaded') return;

    set((s) => ({
      status: { ...s.status, [track.id]: 'downloading' },
      progress: { ...s.progress, [track.id]: 0 },
    }));

    try {
      await ensureDir();
      const dest = `${DOWNLOADS_DIR}${track.id}.audio`;
      const url  = `${streamBaseUrl}/stream/${track.id}`;

      const task = FileSystem.createDownloadResumable(
        url,
        dest,
        {},
        (evt) => {
          if (evt.totalBytesExpectedToWrite > 0) {
            const pct = evt.totalBytesWritten / evt.totalBytesExpectedToWrite;
            set((s) => ({ progress: { ...s.progress, [track.id]: pct } }));
          }
        },
      );

      const result = await task.downloadAsync();
      if (!result) throw new Error('Download returned null');

      // Best-effort artwork caching so covers render offline. A missing cover
      // shouldn't fail the track download.
      let artworkUri: string | undefined;
      try {
        const artDest = `${DOWNLOADS_DIR}${track.id}.art`;
        const artRes = await FileSystem.downloadAsync(
          `${streamBaseUrl}/api/artwork/${track.id}`,
          artDest,
        );
        if (artRes.status === 200) {
          artworkUri = artRes.uri;
        } else {
          try { await FileSystem.deleteAsync(artRes.uri, { idempotent: true }); } catch {}
        }
      } catch {}

      const entry: DownloadedTrack = {
        uri: result.uri,
        artworkUri,
        metadata: track,
        downloadedAt: Date.now(),
      };

      set((s) => {
        const downloads = { ...s.downloads, [track.id]: entry };
        const stStatus  = { ...s.status,    [track.id]: 'downloaded' as DownloadStatus };
        const progress  = { ...s.progress };
        delete progress[track.id];
        persistDownloads(downloads);
        return { downloads, status: stStatus, progress };
      });
    } catch {
      set((s) => ({
        status:   { ...s.status,   [track.id]: 'error' },
        progress: { ...s.progress, [track.id]: 0 },
      }));
    }
  },

  deleteDownload: async (trackId: string) => {
    const { downloads } = get();
    const entry = downloads[trackId];
    if (entry) {
      try { await FileSystem.deleteAsync(entry.uri, { idempotent: true }); } catch {}
      if (entry.artworkUri) {
        try { await FileSystem.deleteAsync(entry.artworkUri, { idempotent: true }); } catch {}
      }
    }
    set((s) => {
      const downloads = { ...s.downloads };
      const stStatus  = { ...s.status };
      delete downloads[trackId];
      delete stStatus[trackId];
      persistDownloads(downloads);
      return { downloads, status: stStatus };
    });
  },

  getLocalUri: (trackId) => get().downloads[trackId]?.uri,

  getArtworkUri: (id) => {
    const downloads = get().downloads;
    const direct = downloads[id]?.artworkUri;
    if (direct) return direct;
    // `id` may be an album id — reuse art from any downloaded track in it.
    for (const entry of Object.values(downloads)) {
      if (entry.metadata.album_id === id && entry.artworkUri) return entry.artworkUri;
    }
    return undefined;
  },

  isDownloaded: (trackId) => get().status[trackId] === 'downloaded',

  getStatus: (trackId) => get().status[trackId] ?? 'idle',
}));
