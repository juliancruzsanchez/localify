/**
 * PlaylistCover
 *
 * Priority:
 *  1. User-set custom cover  (playlist.cover_path is not null)
 *  2. 2×2 grid               (playlist has ≥ 4 tracks)
 *  3. Single album cover     (playlist has 1-3 tracks)
 *  4. Generic music-note icon (empty playlist)
 */

import { useMemo } from "react";
import { ListMusic } from "lucide-react";
import { cn } from "@/lib/utils";
import { toAssetUrl } from "@/lib/assetUrl";
import { useArtworkUrl } from "@/hooks/useArtworkUrl";
import type { Playlist, Track } from "@/types";

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Renders one artwork cell; handles missing hash or missing artwork gracefully. */
function ArtworkCell({ hash }: { hash: string | null | undefined }) {
  const path = useArtworkUrl(hash ?? null);
  if (!path) {
    return <div className="w-full h-full bg-[var(--color-surface-elevated)]" />;
  }
  return (
    <img
      src={toAssetUrl(path)}
      className="w-full h-full object-cover"
      alt=""
      draggable={false}
    />
  );
}

// ─── public component ─────────────────────────────────────────────────────────

interface PlaylistCoverProps {
  playlist: Playlist;
  /** Tracks in playlist order — used to build the auto cover. */
  tracks: Track[];
  className?: string;
}

export function PlaylistCover({ playlist, tracks, className }: PlaylistCoverProps) {
  // Collect first 4 artwork hashes (allow duplicates — matches "first 4 items")
  const firstFour = useMemo(
    () => tracks.slice(0, 4).map((t) => t.artwork_hash),
    [tracks],
  );

  const base = cn(
    "w-full h-full overflow-hidden rounded-lg",
    className,
  );

  // 1 ── Custom cover set by user
  if (playlist.cover_path) {
    return (
      <div className={base}>
        <img
          src={toAssetUrl(playlist.cover_path)}
          className="w-full h-full object-cover"
          alt={playlist.name}
          draggable={false}
        />
      </div>
    );
  }

  // 2 ── 4+ tracks → 2×2 grid
  if (tracks.length >= 4) {
    return (
      <div className={cn(base, "grid grid-cols-2 grid-rows-2")}>
        <ArtworkCell hash={firstFour[0]} />
        <ArtworkCell hash={firstFour[1]} />
        <ArtworkCell hash={firstFour[2]} />
        <ArtworkCell hash={firstFour[3]} />
      </div>
    );
  }

  // 3 ── 1-3 tracks → first track's album art
  if (tracks.length > 0) {
    return (
      <div className={base}>
        <ArtworkCell hash={tracks[0].artwork_hash} />
      </div>
    );
  }

  // 4 ── Empty playlist
  return (
    <div
      className={cn(
        base,
        "flex items-center justify-center bg-[var(--color-surface-elevated)]",
      )}
    >
      <ListMusic size={40} className="text-[var(--color-text-dim)]" />
    </div>
  );
}
