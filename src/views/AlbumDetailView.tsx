import { useParams } from "react-router";
import { ChevronLeft, Music } from "lucide-react";
import { useNavigate } from "react-router";
import { useAlbumQuery, useAlbumTracksQuery } from "@/queries/albums";
import { TrackList } from "@/components/tracks/TrackList";
import { useArtworkUrl } from "@/hooks/useArtworkUrl";
import { toAssetUrl } from "@/lib/assetUrl";
import { formatTime } from "@/lib/formatTime";
import { usePlayerStore } from "@/store/playerStore";

export function AlbumDetailView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: album } = useAlbumQuery(id!);
  const { data: tracks = [] } = useAlbumTracksQuery(id!);
  const artworkPath = useArtworkUrl(album?.artwork_hash);
  const { playTrack } = usePlayerStore();

  if (!album) {
    return <div className="flex items-center justify-center h-full text-[var(--color-text-muted)]">Loading...</div>;
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-end gap-6 p-8 pb-6 flex-shrink-0" style={{ background: "linear-gradient(180deg, rgba(40,40,40,0.8) 0%, var(--color-base) 100%)" }}>
        <button onClick={() => navigate(-1)} className="absolute top-4 left-4 text-[var(--color-text-muted)] hover:text-white">
          <ChevronLeft size={24} />
        </button>
        <div className="w-40 h-40 flex-shrink-0 rounded-lg overflow-hidden bg-[var(--color-surface-elevated)] shadow-2xl">
          {artworkPath ? (
            <img src={toAssetUrl(artworkPath)} alt={album.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Music size={48} className="text-[var(--color-text-dim)]" />
            </div>
          )}
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)] mb-2">Album</p>
          <h1 className="text-4xl font-bold text-white mb-2">{album.title}</h1>
          <p className="text-[var(--color-text-muted)]">
            {album.artist_name} {album.year ? `· ${album.year}` : ""} · {album.track_count} tracks · {formatTime(album.duration_secs)}
          </p>
        </div>
      </div>

      {/* Play button */}
      <div className="px-8 mb-4 flex-shrink-0">
        <button
          onClick={() => tracks[0] && playTrack(tracks[0], tracks, 0)}
          className="w-14 h-14 rounded-full bg-[var(--color-accent)] flex items-center justify-center hover:scale-105 transition-transform shadow-lg"
        >
          <span className="text-black text-2xl ml-1">▶</span>
        </button>
      </div>

      <TrackList tracks={tracks} />
    </div>
  );
}
