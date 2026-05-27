import { Play, Pause } from "lucide-react";
import { usePlayerStore } from "@/store/playerStore";

export function PlayPauseButton() {
  const { isPlaying, togglePlayPause, currentTrack } = usePlayerStore();

  return (
    <button
      onClick={togglePlayPause}
      disabled={!currentTrack}
      className="w-9 h-9 rounded-full bg-white flex items-center justify-center hover:scale-105 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
      aria-label={isPlaying ? "Pause" : "Play"}
    >
      {isPlaying ? (
        <Pause size={18} fill="black" className="text-black" />
      ) : (
        <Play size={18} fill="black" className="text-black ml-0.5" />
      )}
    </button>
  );
}
