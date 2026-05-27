import { Shuffle, Repeat, Repeat1 } from "lucide-react";
import { usePlayerStore } from "@/store/playerStore";
import { TrackInfo } from "@/components/player/TrackInfo";
import { PlayPauseButton } from "@/components/player/PlayPauseButton";
import { SkipBackButton, SkipForwardButton } from "@/components/player/SkipButton";
import { SeekBar } from "@/components/player/SeekBar";
import { VolumeSlider } from "@/components/player/VolumeSlider";
import { cn } from "@/lib/utils";

export function NowPlayingBar() {
  const { shuffleEnabled, repeatMode, toggleShuffle, cycleRepeat } = usePlayerStore();

  return (
    <footer
      className="flex items-center justify-between px-4 border-t border-[var(--color-border)]"
      style={{
        gridArea: "player",
        height: "var(--player-height)",
        background: "var(--color-surface)",
      }}
    >
      {/* Left: Track Info */}
      <TrackInfo />

      {/* Center: Controls */}
      <div className="flex flex-col items-center gap-1 flex-1 max-w-sm mx-4">
        <div className="flex items-center gap-4">
          <button
            onClick={toggleShuffle}
            className={cn(
              "transition-colors",
              shuffleEnabled ? "text-[var(--color-accent)]" : "text-[var(--color-text-muted)] hover:text-white",
            )}
            aria-label="Toggle shuffle"
          >
            <Shuffle size={18} />
          </button>
          <SkipBackButton />
          <PlayPauseButton />
          <SkipForwardButton />
          <button
            onClick={cycleRepeat}
            className={cn(
              "transition-colors",
              repeatMode !== "none" ? "text-[var(--color-accent)]" : "text-[var(--color-text-muted)] hover:text-white",
            )}
            aria-label="Repeat mode"
          >
            {repeatMode === "one" ? <Repeat1 size={18} /> : <Repeat size={18} />}
          </button>
        </div>
        <SeekBar />
      </div>

      {/* Right: Volume */}
      <div className="flex items-center justify-end w-48">
        <VolumeSlider />
      </div>
    </footer>
  );
}
