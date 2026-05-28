import { Music, ChevronUp, ChevronDown, Heart } from "lucide-react";
import { useNavigate } from "react-router";
import { usePlayerStore } from "@/store/playerStore";
import { useUiStore } from "@/store/uiStore";
import { useArtworkUrl } from "@/hooks/useArtworkUrl";
import { toAssetUrl } from "@/lib/assetUrl";
import { cn } from "@/lib/utils";
import { useIsLiked, useLikeTrack, useUnlikeTrack } from "@/queries/liked";

function formatSampleRate(hz: number | null | undefined): string {
  if (!hz) return "";
  return hz >= 1000 ? `${(hz / 1000).toFixed(1)}kHz` : `${hz}Hz`;
}

export function TrackInfo() {
  const navigate = useNavigate();
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const artworkPath = useArtworkUrl(currentTrack?.artwork_hash);
  const { albumArtExpanded, setAlbumArtExpanded } = useUiStore();
  const isLiked = useIsLiked(currentTrack?.id ?? "");
  const { mutate: likeTrack } = useLikeTrack();
  const { mutate: unlikeTrack } = useUnlikeTrack();

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
    <div className="flex items-center gap-3 min-w-0 w-56">
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

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <p className="text-sm font-medium text-white truncate">{currentTrack.title}</p>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (!currentTrack) return;
              isLiked ? unlikeTrack(currentTrack.id) : likeTrack(currentTrack.id);
            }}
            className={cn(
              "flex-shrink-0 transition-colors",
              isLiked
                ? "text-[var(--color-accent)]"
                : "text-[var(--color-text-muted)] hover:text-white",
            )}
            aria-label={isLiked ? "Remove from Liked Songs" : "Add to Liked Songs"}
          >
            <Heart size={12} fill={isLiked ? "currentColor" : "none"} />
          </button>
        </div>
        <p className="text-xs text-[var(--color-text-muted)] whitespace-nowrap">
          <button
            onClick={(e) => { e.stopPropagation(); if (currentTrack.artist_id) navigate(`/artists/${currentTrack.artist_id}`); }}
            className="hover:underline hover:text-white cursor-pointer inline"
          >
            {currentTrack.artist}
          </button>
          {currentTrack.format && (
            <>
              <span className="mx-1.5 w-1 h-1 rounded-full bg-[var(--color-text-dim)] inline-block align-middle" />
              <span className="uppercase align-middle">{currentTrack.format}</span>
              {currentTrack.sample_rate && (
                <>
                  <span className="mx-1.5 w-1 h-1 rounded-full bg-[var(--color-text-dim)] inline-block align-middle" />
                  <span className="align-middle">{formatSampleRate(currentTrack.sample_rate)}</span>
                </>
              )}
            </>
          )}
        </p>
      </div>
    </div>
  );
}
