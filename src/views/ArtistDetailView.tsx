import { useParams, useNavigate } from "react-router";
import { User } from "lucide-react";
import { useArtistQuery, useArtistAlbumsQuery } from "@/queries/artists";
import { AlbumGrid } from "@/components/albums/AlbumGrid";

export function ArtistDetailView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: artist } = useArtistQuery(id!);
  const { data: albums = [] } = useArtistAlbumsQuery(id!);

  if (!artist) {
    return <div className="flex items-center justify-center h-full text-[var(--color-text-muted)]">Loading...</div>;
  }

  return (
    <div className="h-full overflow-y-auto">
      {/* Header */}
      <div
        className="flex items-end gap-6 p-8 pb-6 min-h-52"
        style={{ background: "linear-gradient(180deg, #1a1a2e 0%, var(--color-base) 100%)" }}
      >
        <div className="w-32 h-32 flex-shrink-0 rounded-full bg-[var(--color-surface-elevated)] shadow-2xl flex items-center justify-center">
          <User size={48} className="text-[var(--color-text-dim)]" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)] mb-2">Artist</p>
          <h1 className="text-4xl font-bold text-white mb-1">{artist.name}</h1>
          <p className="text-[var(--color-text-muted)]">
            {artist.album_count} albums · {artist.track_count} tracks
          </p>
        </div>
      </div>

      <div className="px-8 mb-2">
        <h2 className="text-xl font-bold text-white">Albums</h2>
      </div>
      <AlbumGrid albums={albums} />
    </div>
  );
}
