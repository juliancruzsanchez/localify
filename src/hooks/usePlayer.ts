import { usePlayerStore } from "@/store/playerStore";
import type { Track } from "@/types";

export function usePlayer() {
  return usePlayerStore();
}

export function useCurrentTrack(): Track | null {
  return usePlayerStore((s) => s.currentTrack);
}

export function useIsPlaying(): boolean {
  return usePlayerStore((s) => s.isPlaying);
}
