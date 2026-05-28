import { Shuffle, Repeat, Repeat1, ListMusic } from "lucide-react";
import { usePlayerStore } from "@/store/playerStore";
import { useUiStore } from "@/store/uiStore";
import { TrackInfo } from "@/components/player/TrackInfo";
import { PlayPauseButton } from "@/components/player/PlayPauseButton";
import { SkipBackButton, SkipForwardButton } from "@/components/player/SkipButton";
import { SeekBar } from "@/components/player/SeekBar";
import { VolumeSlider } from "@/components/player/VolumeSlider";
import { CastButton } from "@/components/player/CastButton";
import { cn } from "@/lib/utils";
import { usePluginRegistrySnapshot } from "@/plugins/PluginRegistryContext";

export function NowPlayingBar() {
  const { shuffleEnabled, repeatMode, toggleShuffle, cycleRepeat } = usePlayerStore();
  const { queueOpen, toggleQueue } = useUiStore();
  const pluginRegistry = usePluginRegistrySnapshot();
  const pluginActions = pluginRegistry.getNowPlayingActions();

  return (
    <footer
      className="flex items-center justify-between px-4"
      style={{
        gridArea: "player",
        height: "var(--player-height)",
        background: "var(--color-surface)",
        borderRadius: "12px",
      }}
    >
      {/* Left: Track Info */}
      <TrackInfo />

      {/* Center: Controls */}
      <div className="flex flex-col items-center justify-center gap-1 flex-1 max-w-sm mx-4 h-full">
        <div className="flex items-center gap-4 playbar">
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

      {/* Right: Volume + Cast + Plugin actions + Queue toggle */}
      <div className="flex items-center justify-end gap-3 w-48">
        <VolumeSlider />
        <CastButton />
        {pluginActions.map((action) => (
          <button
            key={action.id}
            onClick={action.onClick}
            className={cn(
              "transition-colors flex-shrink-0",
              action.isActive
                ? "text-[var(--color-accent)]"
                : "text-[var(--color-text-muted)] hover:text-white",
            )}
            aria-label={action.label}
            title={action.label}
          >
            {action.icon}
          </button>
        ))}
        <button
          onClick={toggleQueue}
          className={cn(
            "transition-colors flex-shrink-0",
            queueOpen ? "text-[var(--color-accent)]" : "text-[var(--color-text-muted)] hover:text-white",
          )}
          aria-label="Toggle queue"
          title="Queue"
        >
          <ListMusic size={18} />
        </button>
      </div>
    </footer>
  );
}
