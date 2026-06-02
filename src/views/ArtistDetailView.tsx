import { useParams, useNavigate } from "react-router";
import { User, Music } from "lucide-react";
import { useArtistQuery, useArtistAlbumsQuery } from "@/queries/artists";
import { useLastFmArtistSimilar, type SimilarArtistInfo } from "@/queries/lastfm";
import { AlbumGrid } from "@/components/albums/AlbumGrid";
import { cn } from "@/lib/utils";

// ─── Horizontal similar-artist chip/card ─────────────────────────────────────

function SimilarArtistCard({ artist }: { artist: SimilarArtistInfo }) {
  const navigate = useNavigate();
  const inLibrary = !!artist.library_artist_id;

  return (
    <button
      onClick={() => {
        if (inLibrary) navigate(`/artists/${artist.library_artist_id}`);
      }}
      disabled={!inLibrary}
      className={cn(
        "flex flex-col items-center gap-2 flex-shrink-0 w-28 group",
        inLibrary ? "cursor-pointer" : "cursor-default opacity-60",
      )}
    >
      {/* Avatar circle */}
      <div
        className={cn(
          "w-20 h-20 rounded-full flex items-center justify-center",
          "bg-[var(--color-surface-elevated)] transition-all",
          inLibrary && "group-hover:ring-2 group-hover:ring-[var(--color-accent)]",
        )}
      >
        <User size={28} className="text-[var(--color-text-dim)]" />
      </div>

      {/* Name */}
      <span className="text-xs text-center text-white font-medium leading-tight line-clamp-2 w-full">
        {artist.name}
      </span>

      {/* In-library badge */}
      {inLibrary && (
        <span className="text-[10px] text-[var(--color-accent)] font-semibold uppercase tracking-wide">
          In library
        </span>
      )}
    </button>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

export function ArtistDetailView() {
  const { id } = useParams<{ id: string }>();
  const { data: artist } = useArtistQuery(id!);
  const { data: albums = [] } = useArtistAlbumsQuery(id!);
  const { data: similar = [] } = useLastFmArtistSimilar(artist?.name ?? "");

  if (!artist) {
    return <div className="flex items-center justify-center h-full text-[var(--color-text-muted)]">Loading...</div>;
  }

  return (
    <div className="h-full overflow-y-auto">
      {/* Hero header */}
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

      {/* Albums */}
      <div className="px-8 mb-2">
        <h2 className="text-xl font-bold text-white">Albums</h2>
      </div>
      <AlbumGrid albums={albums} />

      {/* Fans Also Like — only shown when Last.fm is connected */}
      {similar.length > 0 && (
        <section className="px-8 mt-8 mb-8">
          <h2 className="text-xl font-bold text-white mb-4">Fans Also Like</h2>
          <div className="flex gap-6 overflow-x-auto pb-3 scrollbar-hide">
            {similar.map((a) => (
              <SimilarArtistCard key={a.name} artist={a} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
