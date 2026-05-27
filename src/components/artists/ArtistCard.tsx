import { User } from "lucide-react";
import { useNavigate } from "react-router";
import type { Artist } from "@/types";

interface ArtistCardProps {
  artist: Artist;
}

export function ArtistCard({ artist }: ArtistCardProps) {
  const navigate = useNavigate();

  return (
    <div
      onClick={() => navigate(`/artists/${artist.id}`)}
      className="group cursor-pointer p-4 rounded-lg bg-[var(--color-surface)] hover:bg-[var(--color-surface-elevated)] transition-colors"
    >
      <div className="w-full aspect-square rounded-full overflow-hidden bg-[var(--color-surface-elevated)] mb-3 flex items-center justify-center">
        <User size={40} className="text-[var(--color-text-dim)]" />
      </div>
      <p className="font-semibold text-white truncate text-sm">{artist.name}</p>
      <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
        {artist.album_count} album{artist.album_count !== 1 ? "s" : ""} · {artist.track_count} track{artist.track_count !== 1 ? "s" : ""}
      </p>
    </div>
  );
}
