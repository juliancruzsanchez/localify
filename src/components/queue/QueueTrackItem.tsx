import { Music } from "lucide-react";
import { cn } from "@/lib/utils";
import { toAssetUrl } from "@/lib/assetUrl";
import { useArtworkUrl } from "@/hooks/useArtworkUrl";
import type { Track } from "@/types";

interface QueueTrackItemProps {
  track: Track;
  position: number; // absolute queue index
  isCurrent?: boolean;
  onClick?: () => void;
}

export function QueueTrackItem({ track, isCurrent, onClick }: QueueTrackItemProps) {
  const artworkPath = useArtworkUrl(track.artwork_hash);

  return (
    <div
      onDoubleClick={onClick}
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-md cursor-default group",
        "hover:bg-white/5 transition-colors",
        isCurrent && "bg-white/10",
      )}
    >
      {/* Artwork */}
      <div className="w-9 h-9 flex-shrink-0 rounded overflow-hidden bg-[var(--color-surface-elevated)]">
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

      {/* Title + artist */}
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-sm font-medium truncate leading-tight",
            isCurrent ? "text-[var(--color-accent)]" : "text-white",
          )}
        >
          {track.title}
        </p>
        <p className="text-xs text-[var(--color-text-muted)] truncate leading-tight mt-0.5">
          {track.artist}
        </p>
      </div>
    </div>
  );
}
