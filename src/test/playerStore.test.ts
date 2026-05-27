import { describe, it, expect, beforeEach, vi } from "vitest";
import { usePlayerStore } from "@/store/playerStore";
import type { Track } from "@/types";

const mockTrack: Track = {
  id: "track-1",
  file_path: "/music/song.flac",
  title: "Test Song",
  artist: "Test Artist",
  album_artist: null,
  album_id: "album-1",
  album_title: "Test Album",
  track_number: 1,
  disc_number: 1,
  year: 2024,
  genre: "Electronic",
  duration_secs: 240,
  sample_rate: 44100,
  bit_depth: 16,
  channels: 2,
  bitrate_kbps: null,
  format: "flac",
  artwork_hash: null,
  play_count: 0,
  last_played_at: null,
};

describe("playerStore", () => {
  beforeEach(() => {
    // Reset store state
    usePlayerStore.setState({
      currentTrack: null,
      queue: [],
      queueIndex: -1,
      isPlaying: false,
      positionMs: 0,
      durationMs: 0,
      volumePct: 80,
      shuffleEnabled: false,
      repeatMode: "none",
    });
  });

  it("initializes with correct defaults", () => {
    const state = usePlayerStore.getState();
    expect(state.currentTrack).toBeNull();
    expect(state.isPlaying).toBe(false);
    expect(state.volumePct).toBe(80);
    expect(state.shuffleEnabled).toBe(false);
    expect(state.repeatMode).toBe("none");
  });

  it("toggleShuffle toggles shuffle state", () => {
    const store = usePlayerStore.getState();
    expect(store.shuffleEnabled).toBe(false);
    store.toggleShuffle();
    expect(usePlayerStore.getState().shuffleEnabled).toBe(true);
    usePlayerStore.getState().toggleShuffle();
    expect(usePlayerStore.getState().shuffleEnabled).toBe(false);
  });

  it("cycleRepeat cycles through none -> all -> one -> none", () => {
    const store = usePlayerStore.getState();
    expect(store.repeatMode).toBe("none");
    store.cycleRepeat();
    expect(usePlayerStore.getState().repeatMode).toBe("all");
    usePlayerStore.getState().cycleRepeat();
    expect(usePlayerStore.getState().repeatMode).toBe("one");
    usePlayerStore.getState().cycleRepeat();
    expect(usePlayerStore.getState().repeatMode).toBe("none");
  });

  it("setPosition updates position", () => {
    usePlayerStore.getState().setPosition(5000);
    expect(usePlayerStore.getState().positionMs).toBe(5000);
  });

  it("setDuration updates duration", () => {
    usePlayerStore.getState().setDuration(240000);
    expect(usePlayerStore.getState().durationMs).toBe(240000);
  });

  it("setIsPlaying updates playing state", () => {
    usePlayerStore.getState().setIsPlaying(true);
    expect(usePlayerStore.getState().isPlaying).toBe(true);
    usePlayerStore.getState().setIsPlaying(false);
    expect(usePlayerStore.getState().isPlaying).toBe(false);
  });

  it("playTrack sets current track and queue", async () => {
    const store = usePlayerStore.getState();
    const queue = [mockTrack];
    await store.playTrack(mockTrack, queue, 0);
    const newState = usePlayerStore.getState();
    expect(newState.currentTrack).toEqual(mockTrack);
    expect(newState.queue).toEqual(queue);
    expect(newState.queueIndex).toBe(0);
    expect(newState.isPlaying).toBe(true);
  });
});
