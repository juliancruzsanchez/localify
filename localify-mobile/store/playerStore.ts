import { Audio, AVPlaybackStatus } from 'expo-av';
import { create } from 'zustand';
import type { TrackSummary } from '../hooks/useLibrary';
import { useDownloadStore } from './downloadStore';
import { useStatsStore } from './statsStore';

// ── Singleton sound ───────────────────────────────────────────────────────────

let soundInstance: Audio.Sound | null = null;

async function getSoundInstance(): Promise<Audio.Sound> {
  if (!soundInstance) soundInstance = new Audio.Sound();
  return soundInstance;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type RepeatMode = 'none' | 'one' | 'all';

interface PlayerState {
  currentTrack: TrackSummary | null;
  queue: TrackSummary[];
  queueIndex: number;
  isPlaying: boolean;
  positionMs: number;
  durationMs: number;
  baseUrl: string | null;
  shuffleEnabled: boolean;
  repeatMode: RepeatMode;
  likedTrackIds: Record<string, boolean>;

  // Track when current track started playing (for stats finalization)
  _playStartMs: number;

  // Actions
  setBaseUrl: (url: string | null) => void;
  playTrack: (track: TrackSummary, queue?: TrackSummary[]) => Promise<void>;
  playNext: () => Promise<void>;
  playPrevious: () => Promise<void>;
  togglePlayPause: () => Promise<void>;
  seek: (ms: number) => Promise<void>;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  toggleLike: (trackId: string) => void;
  _onPlaybackStatus: (status: AVPlaybackStatus) => void;
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentTrack: null,
  queue: [],
  queueIndex: -1,
  isPlaying: false,
  positionMs: 0,
  durationMs: 0,
  baseUrl: null,
  shuffleEnabled: false,
  repeatMode: 'none',
  likedTrackIds: {},
  _playStartMs: 0,

  setBaseUrl: (url) => set({ baseUrl: url }),

  toggleShuffle: () => set((s) => ({ shuffleEnabled: !s.shuffleEnabled })),

  cycleRepeat: () => set((s) => {
    const modes: RepeatMode[] = ['none', 'all', 'one'];
    const next = modes[(modes.indexOf(s.repeatMode) + 1) % modes.length];
    return { repeatMode: next };
  }),

  toggleLike: (trackId) => set((s) => {
    const next = { ...s.likedTrackIds };
    if (next[trackId]) delete next[trackId];
    else next[trackId] = true;
    return { likedTrackIds: next };
  }),

  _onPlaybackStatus: (status: AVPlaybackStatus) => {
    if (!status.isLoaded) return;
    set({
      isPlaying: status.isPlaying,
      positionMs: status.positionMillis ?? 0,
      durationMs: status.durationMillis ?? 0,
    });
    if (status.didJustFinish) {
      // Finalize stats for the completed track
      const { currentTrack, _playStartMs } = get();
      if (currentTrack && _playStartMs > 0) {
        useStatsStore.getState().finalizePlay(currentTrack.id, Date.now() - _playStartMs);
      }
      get().playNext();
    }
  },

  playTrack: async (track: TrackSummary, queue?: TrackSummary[]) => {
    const { baseUrl, currentTrack, _playStartMs } = get();
    if (!baseUrl) return;

    // Finalize stats for previous track
    if (currentTrack && _playStartMs > 0) {
      useStatsStore.getState().finalizePlay(currentTrack.id, Date.now() - _playStartMs);
    }

    const newQueue = queue ?? [track];
    const newIndex = newQueue.findIndex((t) => t.id === track.id);

    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
    });

    const sound = await getSoundInstance();

    try {
      const status = await sound.getStatusAsync();
      if (status.isLoaded) {
        await sound.stopAsync();
        await sound.unloadAsync();
      }
    } catch {
      // ignore
    }

    const localUri = useDownloadStore.getState().getLocalUri(track.id);
    const uri = localUri ?? `${baseUrl}/stream/${track.id}`;
    await sound.loadAsync({ uri }, { shouldPlay: true });
    sound.setOnPlaybackStatusUpdate(get()._onPlaybackStatus);

    // Record play in stats
    useStatsStore.getState().recordPlay(track);

    set({
      currentTrack: track,
      queue: newQueue,
      queueIndex: newIndex >= 0 ? newIndex : 0,
      isPlaying: true,
      positionMs: 0,
      _playStartMs: Date.now(),
    });
  },

  playNext: async () => {
    const { queue, queueIndex, shuffleEnabled, repeatMode } = get();

    // Repeat-one: restart current track
    if (repeatMode === 'one') {
      const sound = await getSoundInstance();
      try {
        const status = await sound.getStatusAsync();
        if (status.isLoaded) {
          await sound.setPositionAsync(0);
          if (!status.isPlaying) await sound.playAsync();
          set({ positionMs: 0 });
        }
      } catch {}
      return;
    }

    let nextIndex: number;
    if (shuffleEnabled && queue.length > 1) {
      const pool = queue.map((_, i) => i).filter((i) => i !== queueIndex);
      nextIndex = pool[Math.floor(Math.random() * pool.length)];
    } else {
      nextIndex = queueIndex + 1;
      if (nextIndex >= queue.length) {
        if (repeatMode === 'all') nextIndex = 0;
        else return; // queue ended
      }
    }

    await get().playTrack(queue[nextIndex], queue);
  },

  playPrevious: async () => {
    const { queue, queueIndex, positionMs } = get();
    if (positionMs > 3000) {
      const sound = await getSoundInstance();
      try {
        await sound.setPositionAsync(0);
        set({ positionMs: 0 });
      } catch {}
      return;
    }
    const prevIndex = queueIndex - 1;
    if (prevIndex >= 0) {
      await get().playTrack(queue[prevIndex], queue);
    }
  },

  togglePlayPause: async () => {
    const sound = await getSoundInstance();
    const { isPlaying } = get();
    try {
      const status = await sound.getStatusAsync();
      if (!status.isLoaded) return;
      if (isPlaying) await sound.pauseAsync();
      else await sound.playAsync();
      set({ isPlaying: !isPlaying });
    } catch {}
  },

  seek: async (ms: number) => {
    const sound = await getSoundInstance();
    try {
      await sound.setPositionAsync(ms);
      set({ positionMs: ms });
    } catch {}
  },
}));
