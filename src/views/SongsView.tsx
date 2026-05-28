import { useMemo } from "react";
import { useSearchParams } from "react-router";
import { Music, ArrowLeft } from "lucide-react";
import { useTracksQuery } from "@/queries/tracks";
import { TrackList } from "@/components/tracks/TrackList";
import { EmptyLibrary } from "@/components/library/EmptyLibrary";
import { useNavigate } from "react-router";
import { useArtworkUrl } from "@/hooks/useArtworkUrl";
import { toAssetUrl } from "@/lib/assetUrl";
import { formatTime } from "@/lib/formatTime";

export function SongsView() {
  const [searchParams] = useSearchParams();
  const genre = searchParams.get("genre");
  const navigate = useNavigate();
  const { data: allTracks = [], isLoading } = useTracksQuery();

  const tracks = useMemo(() => {
    if (!genre) return allTracks;
    return allTracks.filter(
      (t) => t.genre?.toLowerCase() === genre.toLowerCase(),
    );
  }, [allTracks, genre]);

  const firstWithArtwork = useMemo(
    () => tracks.find((t) => t.artwork_hash),
    [tracks],
  );
  const artworkPath = useArtworkUrl(firstWithArtwork?.artwork_hash);

  if (isLoading) {
    return <div className="flex items-center justify-center h-full text-[var(--color-text-muted)]">Loading...</div>;
  }

  if (allTracks.length === 0) {
    return <EmptyLibrary />;
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {genre ? (
        <>
          {/* Genre mix header (like playlist/album) */}
          <div
            className="flex items-end gap-6 p-8 pb-6 flex-shrink-0"
            style={{
              background:
                "linear-gradient(180deg, rgba(30,60,114,0.6) 0%, var(--color-base) 100%)",
            }}
          >
            <button
              onClick={() => navigate(-1)}
              className="absolute top-4 left-4 text-[var(--color-text-muted)] hover:text-white"
            >
              <ArrowLeft size={24} />
            </button>
            <div className="w-40 h-40 flex-shrink-0 rounded-lg overflow-hidden bg-[var(--color-surface-elevated)] shadow-2xl flex items-center justify-center"
              style={{
                background: artworkPath
                  ? undefined
                  : `hsl(${(genre.charCodeAt(0) * 47) % 360}, 55%, 30%)`,
              }}
            >
              {artworkPath ? (
                <img
                  src={toAssetUrl(artworkPath)}
                  alt={genre}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Music size={48} className="text-white/60" />
              )}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)] mb-2">
                Genre Mix
              </p>
              <h1 className="text-4xl font-bold text-white mb-2">{genre}</h1>
              <p className="text-[var(--color-text-muted)]">
                {tracks.length} tracks{" "}
                {tracks.length > 0 &&
                  `· ${formatTime(
                    tracks.reduce((s, t) => s + t.duration_secs, 0),
                  )}`}
              </p>
            </div>
          </div>
          <TrackList tracks={tracks} />
        </>
      ) : (
        <>
          <div className="flex items-center justify-between px-8 py-6 flex-shrink-0">
            <h1 className="text-3xl font-bold text-white">Songs</h1>
            <span className="text-[var(--color-text-muted)] text-sm">
              {tracks.length} tracks
            </span>
          </div>
          <TrackList tracks={tracks} />
        </>
      )}
    </div>
  );
}
