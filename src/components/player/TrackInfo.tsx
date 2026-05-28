import { Music, ChevronUp, ChevronDown } from "lucide-react";
import { usePlayerStore } from "@/store/playerStore";
import { useUiStore } from "@/store/uiStore";
import { useArtworkUrl } from "@/hooks/useArtworkUrl";
import { toAssetUrl } from "@/lib/assetUrl";

export function TrackInfo() {
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const artworkPath = useArtworkUrl(currentTrack?.artwork_hash);
  const { albumArtExpanded, setAlbumArtExpanded } = useUiStore();

  if (!currentTrack) {
    return (
      <div className="flex items-center gap-3 min-w-0 w-48">
        <div className="w-10 h-10 bg-[var(--color-surface-elevated)] rounded flex items-center justify-center flex-shrink-0">
          <Music size={16} className="text-[var(--color-text-muted)]" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 min-w-0 w-48">
      {/* Album art with expand toggle */}
      <button
        onClick={() => setAlbumArtExpanded(!albumArtExpanded)}
        className="relative w-10 h-10 flex-shrink-0 rounded overflow-hidden bg-[var(--color-surface-elevated)] group"
        aria-label={albumArtExpanded ? "Collapse album art" : "Expand album art"}
        title={albumArtExpanded ? "Collapse album art" : "Expand album art"}
      >
        {artworkPath ? (
          <img
            src={toAssetUrl(artworkPath)}
            alt="Album art"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Music size={16} className="text-[var(--color-text-muted)]" />
          </div>
        )}
        {/* Hover overlay with arrow */}
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          {albumArtExpanded
            ? <ChevronDown size={16} className="text-white" />
            : <ChevronUp size={16} className="text-white" />
          }
        </div>
      </button>

      <div className="min-w-0">
        <p className="text-sm font-medium text-white truncate">{currentTrack.title}</p>
        <p className="text-xs text-[var(--color-text-muted)] truncate">{currentTrack.artist}</p>
      </div>
    </div>
  );
}
