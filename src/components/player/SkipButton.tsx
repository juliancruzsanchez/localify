import { SkipBack, SkipForward } from "lucide-react";
import { usePlayerStore } from "@/store/playerStore";

export function SkipBackButton() {
  const { playPrev, currentTrack } = usePlayerStore();
  return (
    <button
      onClick={playPrev}
      disabled={!currentTrack}
      className="text-[var(--color-text-muted)] hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      aria-label="Previous"
    >
      <SkipBack size={20} />
    </button>
  );
}

export function SkipForwardButton() {
  const { playNext, currentTrack } = usePlayerStore();
  return (
    <button
      onClick={playNext}
      disabled={!currentTrack}
      className="text-[var(--color-text-muted)] hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      aria-label="Next"
    >
      <SkipForward size={20} />
    </button>
  );
}
