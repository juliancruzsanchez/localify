import { Music } from "lucide-react";
import { usePlayerStore } from "@/store/playerStore";
import { useArtworkUrl } from "@/hooks/useArtworkUrl";

export function TrackInfo() {
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const artworkPath = useArtworkUrl(currentTrack?.artwork_hash);

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
      <div className="w-10 h-10 flex-shrink-0 rounded overflow-hidden bg-[var(--color-surface-elevated)]">
        {artworkPath ? (
          <img
            src={`asset://localhost/${encodeURIComponent(artworkPath)}`}
            alt="Album art"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Music size={16} className="text-[var(--color-text-muted)]" />
          </div>
        )}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-white truncate">{currentTrack.title}</p>
        <p className="text-xs text-[var(--color-text-muted)] truncate">{currentTrack.artist}</p>
      </div>
    </div>
  );
}
