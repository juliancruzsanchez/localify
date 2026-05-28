import { Play, Heart, Music } from "lucide-react";
import { usePlayerStore } from "@/store/playerStore";
import { useIsLiked, useLikeTrack, useUnlikeTrack } from "@/queries/liked";
import { useArtworkUrl } from "@/hooks/useArtworkUrl";
import { formatTime } from "@/lib/formatTime";
import { cn } from "@/lib/utils";
import { toAssetUrl } from "@/lib/assetUrl";
import type { Track } from "@/types";
import { TrackContextMenu } from "./TrackContextMenu";

interface TrackRowProps {
  track: Track;
  index: number;
  queue: Track[];
  isActive?: boolean;
  style?: React.CSSProperties;
}

export function TrackRow({ track, index, queue, isActive, style }: TrackRowProps) {
  const { playTrack, togglePlayPause, isPlaying, currentTrack } = usePlayerStore();
  const isLiked = useIsLiked(track.id);
  const { mutate: likeTrack } = useLikeTrack();
  const { mutate: unlikeTrack } = useUnlikeTrack();
  const artworkPath = useArtworkUrl(track.artwork_hash);

  const handlePlay = () => {
    if (isActive && isPlaying) {
      togglePlayPause();
      return;
    }
    playTrack(track, queue, index);
  };

  return (
    <TrackContextMenu track={track} queue={queue} queueIndex={index}>
    <div
      style={style}
      onDoubleClick={() => !(isActive && isPlaying) && playTrack(track, queue, index)}
      className={cn(
        "group flex items-center gap-3 px-4 py-2 rounded-md text-sm hover:bg-white/5 cursor-default transition-colors",
        isActive && "bg-white/10",
      )}
    >
      {/* Track number / play indicator */}
      <div className="w-6 text-right text-[var(--color-text-muted)] flex-shrink-0">
        <span className="group-hover:hidden">
          {isActive && isPlaying ? (
            <span className="text-[var(--color-accent)]">♪</span>
          ) : (
            index + 1
          )}
        </span>
        <button
          onClick={handlePlay}
          className="hidden group-hover:block text-white"
          aria-label={`Play ${track.title}`}
        >
          <Play size={14} fill="white" />
        </button>
      </div>

      {/* Album art thumbnail */}
      <div className="w-10 h-10 flex-shrink-0 rounded overflow-hidden bg-[var(--color-surface-elevated)]">
        {artworkPath ? (
          <img
            src={toAssetUrl(artworkPath)}
            alt={track.album_title ?? track.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Music size={14} className="text-[var(--color-text-dim)]" />
          </div>
        )}
      </div>

      {/* Title & artist */}
      <div className="flex-1 min-w-0">
        <p className={cn("truncate font-medium", isActive ? "text-[var(--color-accent)]" : "text-white")}>
          {track.title}
        </p>
        <p className="truncate text-xs text-[var(--color-text-muted)]">{track.artist}</p>
      </div>

      {/* Album */}
      <div className="hidden md:block flex-1 min-w-0">
        <p className="truncate text-[var(--color-text-muted)]">{track.album_title ?? "—"}</p>
      </div>

      {/* Format badge */}
      <div className="hidden lg:block w-12 text-center">
        <span className="text-xs text-[var(--color-text-dim)] uppercase">
          {track.format}
        </span>
      </div>

      {/* Heart / like button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          isLiked ? unlikeTrack(track.id) : likeTrack(track.id);
        }}
        aria-label={isLiked ? "Remove from Liked Songs" : "Add to Liked Songs"}
        className={cn(
          "w-8 flex items-center justify-center transition-all",
          isLiked
            ? "text-[var(--color-accent)] opacity-100"
            : "text-[var(--color-text-muted)] opacity-0 group-hover:opacity-100 hover:text-white",
        )}
      >
        <Heart size={15} fill={isLiked ? "currentColor" : "none"} />
      </button>

      {/* Duration */}
      <div className="w-12 text-right text-[var(--color-text-muted)]">
        {formatTime(track.duration_secs)}
      </div>
    </div>
    </TrackContextMenu>
  );
}
