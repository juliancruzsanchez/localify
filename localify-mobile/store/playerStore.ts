import { Audio, AVPlaybackStatus } from 'expo-av';
import { create } from 'zustand';
import type { TrackSummary } from '../hooks/useLibrary';
import { useDownloadStore } from './downloadStore';

// ── Singleton sound object ────────────────────────────────────────────────────

let soundInstance: Audio.Sound | null = null;

async function getSoundInstance(): Promise<Audio.Sound> {
  if (!soundInstance) {
    soundInstance = new Audio.Sound();
  }
  return soundInstance;
}

// ── Store ─────────────────────────────────────────────────────────────────────

interface PlayerState {
  currentTrack: TrackSummary | null;
  queue: TrackSummary[];
  queueIndex: number;
  isPlaying: boolean;
  positionMs: number;
  durationMs: number;
  baseUrl: string | null;

  // Actions
  setBaseUrl: (url: string | null) => void;
  playTrack: (track: TrackSummary, queue?: TrackSummary[]) => Promise<void>;
  playNext: () => Promise<void>;
  playPrevious: () => Promise<void>;
  togglePlayPause: () => Promise<void>;
  seek: (ms: number) => Promise<void>;
  _onPlaybackStatus: (status: AVPlaybackStatus) => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentTrack: null,
  queue: [],
  queueIndex: -1,
  isPlaying: false,
  positionMs: 0,
  durationMs: 0,
  baseUrl: null,

  setBaseUrl: (url) => set({ baseUrl: url }),

  _onPlaybackStatus: (status: AVPlaybackStatus) => {
    if (!status.isLoaded) return;
    set({
      isPlaying: status.isPlaying,
      positionMs: status.positionMillis ?? 0,
      durationMs: status.durationMillis ?? 0,
    });
    if (status.didJustFinish) {
      get().playNext();
    }
  },

  playTrack: async (track: TrackSummary, queue?: TrackSummary[]) => {
    const { baseUrl } = get();
    if (!baseUrl) return;

    const newQueue = queue ?? [track];
    const newIndex = newQueue.findIndex((t) => t.id === track.id);

    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
    });

    const sound = await getSoundInstance();

    // Unload any existing track
    try {
      const status = await sound.getStatusAsync();
      if (status.isLoaded) {
        await sound.stopAsync();
        await sound.unloadAsync();
      }
    } catch {
      // Ignore unload errors
    }

    // Prefer locally downloaded file over network stream
    const localUri = useDownloadStore.getState().getLocalUri(track.id);
    const uri = localUri ?? `${baseUrl}/stream/${track.id}`;
    await sound.loadAsync({ uri }, { shouldPlay: true });
    sound.setOnPlaybackStatusUpdate(get()._onPlaybackStatus);

    set({
      currentTrack: track,
      queue: newQueue,
      queueIndex: newIndex >= 0 ? newIndex : 0,
      isPlaying: true,
      positionMs: 0,
    });
  },

  playNext: async () => {
    const { queue, queueIndex } = get();
    const nextIndex = queueIndex + 1;
    if (nextIndex < queue.length) {
      await get().playTrack(queue[nextIndex], queue);
      set({ queueIndex: nextIndex });
    }
  },

  playPrevious: async () => {
    const { queue, queueIndex, positionMs } = get();
    // If more than 3 seconds in, restart current track
    if (positionMs > 3000) {
      const sound = await getSoundInstance();
      try {
        await sound.setPositionAsync(0);
        set({ positionMs: 0 });
      } catch {
        // Ignore seek errors
      }
      return;
    }
    const prevIndex = queueIndex - 1;
    if (prevIndex >= 0) {
      await get().playTrack(queue[prevIndex], queue);
      set({ queueIndex: prevIndex });
    }
  },

  togglePlayPause: async () => {
    const sound = await getSoundInstance();
    const { isPlaying } = get();
    try {
      const status = await sound.getStatusAsync();
      if (!status.isLoaded) return;
      if (isPlaying) {
        await sound.pauseAsync();
      } else {
        await sound.playAsync();
      }
      set({ isPlaying: !isPlaying });
    } catch {
      // Ignore playback errors
    }
  },

  seek: async (ms: number) => {
    const sound = await getSoundInstance();
    try {
      await sound.setPositionAsync(ms);
      set({ positionMs: ms });
    } catch {
      // Ignore seek errors
    }
  },
}));
