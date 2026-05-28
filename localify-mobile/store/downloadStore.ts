import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { create } from 'zustand';
import type { TrackSummary } from '../hooks/useLibrary';

const DOWNLOADS_KEY = 'localify:downloads';
const DOWNLOADS_DIR = FileSystem.documentDirectory + 'downloads/';

export type DownloadStatus = 'idle' | 'downloading' | 'downloaded' | 'error';

interface DownloadedTrack {
  uri: string;
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
          if (info.exists) {
            verified[id] = entry;
            statusMap[id] = 'downloaded';
          }
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

      const entry: DownloadedTrack = {
        uri: result.uri,
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

  isDownloaded: (trackId) => get().status[trackId] === 'downloaded',

  getStatus: (trackId) => get().status[trackId] ?? 'idle',
}));
