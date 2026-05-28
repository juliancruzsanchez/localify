import { Music } from "lucide-react";
import { useNavigate } from "react-router";
import { useArtworkUrl } from "@/hooks/useArtworkUrl";
import { toAssetUrl } from "@/lib/assetUrl";
import type { Album } from "@/types";

interface AlbumCardProps {
  album: Album;
}

export function AlbumCard({ album }: AlbumCardProps) {
  const navigate = useNavigate();
  const artworkPath = useArtworkUrl(album.artwork_hash);

  return (
    <div
      onClick={() => navigate(`/albums/${album.id}`)}
      className="group cursor-pointer p-4 rounded-lg bg-[var(--color-surface)] hover:bg-[var(--color-surface-elevated)] transition-colors"
    >
      <div className="w-full aspect-square rounded-md overflow-hidden bg-[var(--color-surface-elevated)] mb-3">
        {artworkPath ? (
          <img
            src={toAssetUrl(artworkPath)}
            alt={album.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Music size={32} className="text-[var(--color-text-dim)]" />
          </div>
        )}
      </div>
      <p className="font-semibold text-white truncate text-sm">{album.title}</p>
      <p className="text-xs text-[var(--color-text-muted)] truncate mt-0.5">
        {album.artist_name} {album.year ? `· ${album.year}` : ""}
      </p>
    </div>
  );
}
