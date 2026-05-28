import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type { Track, RepeatMode } from "@/types";

interface PlayerStore {
  currentTrack: Track | null;
  queue: Track[];
  queueIndex: number;
  isPlaying: boolean;
  positionMs: number;
  durationMs: number;
  volumePct: number;
  shuffleEnabled: boolean;
  repeatMode: RepeatMode;
  /** Timestamp (Date.now()) of last playTrack call — used to suppress poll flicker. */
  _lastPlayStartedAt: number;

  playTrack: (track: Track, queue?: Track[], index?: number) => Promise<void>;
  togglePlayPause: () => Promise<void>;
  playNext: () => Promise<void>;
  playPrev: () => Promise<void>;
  seek: (positionMs: number) => Promise<void>;
  setVolume: (volumePct: number) => Promise<void>;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  setPosition: (ms: number) => void;
  setDuration: (ms: number) => void;
  setIsPlaying: (playing: boolean) => void;
  /** Inserts track immediately after the current queue position. */
  playAfterCurrent: (track: Track) => void;
  /** Appends track to the end of the current queue. */
  addToQueue: (track: Track) => void;
}

export const usePlayerStore = create<PlayerStore>((set, get) => ({
  currentTrack: null,
  queue: [],
  queueIndex: -1,
  isPlaying: false,
  positionMs: 0,
  durationMs: 0,
  volumePct: 80,
  shuffleEnabled: false,
  repeatMode: "none",
  _lastPlayStartedAt: 0,

  playTrack: async (track, queue = [], index = 0) => {
    try {
      await invoke("play_track", { trackId: track.id, startMs: null });
      set({
        currentTrack: track,
        queue: queue.length > 0 ? queue : [track],
        queueIndex: index,
        isPlaying: true,
        positionMs: 0,
        durationMs: Math.round(track.duration_secs * 1000),
        // Record when this play started so the polling loop can suppress
        // position/duration/is_playing sync for 600 ms while the Rust audio
        // loop bootstraps the new track (the atomic may still hold the
        // previous track's position until the Play command is processed).
        _lastPlayStartedAt: Date.now(),
      });
    } catch (e) {
      console.error("play_track failed:", e);
    }
  },

  togglePlayPause: async () => {
    const { isPlaying } = get();
    try {
      if (isPlaying) {
        await invoke("pause");
        set({ isPlaying: false });
      } else {
        await invoke("resume");
        set({ isPlaying: true });
      }
    } catch (e) {
      console.error("togglePlayPause failed:", e);
    }
  },

  playNext: async () => {
    const { queue, queueIndex, repeatMode, shuffleEnabled } = get();
    if (queue.length === 0) return;

    let nextIndex: number;
    if (repeatMode === "one") {
      nextIndex = queueIndex;
    } else if (shuffleEnabled) {
      nextIndex = Math.floor(Math.random() * queue.length);
    } else {
      nextIndex = queueIndex + 1;
      if (nextIndex >= queue.length) {
        if (repeatMode === "all") nextIndex = 0;
        else return;
      }
    }

    const nextTrack = queue[nextIndex];
    if (nextTrack) {
      await get().playTrack(nextTrack, queue, nextIndex);
    }
  },

  playPrev: async () => {
    const { queue, queueIndex, positionMs } = get();
    // If more than 3s into track, restart it
    if (positionMs > 3000) {
      await get().seek(0);
      return;
    }
    const prevIndex = Math.max(0, queueIndex - 1);
    const prevTrack = queue[prevIndex];
    if (prevTrack) {
      await get().playTrack(prevTrack, queue, prevIndex);
    }
  },

  seek: async (positionMs) => {
    try {
      await invoke("seek", { positionMs });
      set({ positionMs });
    } catch (e) {
      console.error("seek failed:", e);
    }
  },

  setVolume: async (volumePct) => {
    try {
      const vol = Math.round(Math.max(0, Math.min(100, volumePct)));
      await invoke("set_volume", { volume: vol });
      set({ volumePct: vol });
    } catch (e) {
      console.error("set_volume failed:", e);
    }
  },

  toggleShuffle: () => {
    set((s) => ({ shuffleEnabled: !s.shuffleEnabled }));
  },

  cycleRepeat: () => {
    set((s) => {
      const modes: RepeatMode[] = ["none", "all", "one"];
      const idx = modes.indexOf(s.repeatMode);
      return { repeatMode: modes[(idx + 1) % modes.length] };
    });
  },

  setPosition: (ms) => set({ positionMs: ms }),
  setDuration: (ms) => set({ durationMs: ms }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),

  playAfterCurrent: (track) => {
    set((s) => {
      const newQueue = [...s.queue];
      const insertAt = s.queueIndex + 1;
      newQueue.splice(insertAt, 0, track);
      return { queue: newQueue };
    });
  },

  addToQueue: (track) => {
    set((s) => ({ queue: [...s.queue, track] }));
  },
}));
