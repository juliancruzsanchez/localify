import { useCallback } from "react";
import { useSearchParams } from "react-router";
import { Download, Loader2 } from "lucide-react";
import { useSearchQuery } from "@/queries/search";
import {
  useYtdlpStatus,
  useYtdlpInstall,
  useYtdlpSearch,
  useYtdlpDownload,
} from "@/queries/ytdlp";
import { useDebounce } from "@/hooks/useDebounce";
import { TrackRow } from "@/components/tracks/TrackRow";
import { AlbumCard } from "@/components/albums/AlbumCard";
import { ArtistCard } from "@/components/artists/ArtistCard";
import { YtdlpResultRow } from "@/components/search/YtdlpResultRow";

export function SearchView() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get("q") ?? "";
  const debouncedQuery = useDebounce(query, 300);

  const { data: results, isLoading } = useSearchQuery(debouncedQuery);
  const { status: ytStatus, refresh: refreshYtStatus } = useYtdlpStatus();
  const { state: installState, install } = useYtdlpInstall(refreshYtStatus);

  const libraryTrackCount = results?.tracks.length ?? 0;
  const showYoutube =
    !!debouncedQuery && ytStatus?.available === true && libraryTrackCount < 5;
  // Still waiting for ytdlp_check to return — show a placeholder so the section
  // doesn't silently vanish while the binary probe runs.
  const ytStatusLoading = !!debouncedQuery && ytStatus === null && libraryTrackCount < 5;
  const ytInitializing = !!debouncedQuery && ytStatus?.available === false && (installState.status === "installing" || installState.status === "done");

  const { results: ytResults, loading: ytLoading } = useYtdlpSearch(
    debouncedQuery,
    showYoutube,
  );
  const { downloads, download } = useYtdlpDownload();

  const hasResults =
    results &&
    (results.tracks.length > 0 ||
      results.albums.length > 0 ||
      results.artists.length > 0);

  const showInstallBanner =
    !!debouncedQuery && ytStatus?.available === false && libraryTrackCount < 5;

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-6 pt-4 pb-3">
        <h1 className="text-xl font-bold text-white">Search</h1>
        {!query && (
          <p className="text-[var(--color-text-muted)] text-sm">
            Use the search bar above to find songs, albums, and artists.
          </p>
        )}
      </div>

      {isLoading && debouncedQuery && (
        <div className="px-6 text-[var(--color-text-muted)]">Searching...</div>
      )}

      {!isLoading && debouncedQuery && !hasResults && !showYoutube && !showInstallBanner && !ytInitializing && (
        <div className="px-6 text-[var(--color-text-muted)]">
          No local results found for "{debouncedQuery}".{ytStatus?.available ? " Try installing yt-dlp to search YouTube." : ""}
        </div>
      )}

      {ytStatusLoading && (
        <div className="px-6">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-xl font-bold text-white">From YouTube</h2>
          </div>
          <p className="text-[var(--color-text-muted)] text-sm flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Checking for yt-dlp…
          </p>
        </div>
      )}

      {ytInitializing && (
        <div className="px-6 text-[var(--color-text-muted)] flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Waiting for yt-dlp to initialize…</span>
        </div>
      )}

      <div className="px-6 space-y-6 pb-6">
        {results && (
          <>
            {results.tracks.length > 0 && (
              <section>
                <h2 className="text-xl font-bold text-white mb-3">Songs</h2>
                <div>
                  {results.tracks.map((track, i) => (
                    <TrackRow key={track.id} track={track} index={i} queue={results.tracks} />
                  ))}
                </div>
              </section>
            )}

            {results.albums.length > 0 && (
              <section>
                <h2 className="text-xl font-bold text-white mb-3">Albums</h2>
                <div
                  className="grid gap-4"
                  style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}
                >
                  {results.albums.map((album) => (
                    <AlbumCard key={album.id} album={album} />
                  ))}
                </div>
              </section>
            )}

            {results.artists.length > 0 && (
              <section>
                <h2 className="text-xl font-bold text-white mb-3">Artists</h2>
                <div
                  className="grid gap-4"
                  style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}
                >
                  {results.artists.map((artist) => (
                    <ArtistCard key={artist.id} artist={artist} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {/* YouTube results (yt-dlp available) */}
        {showYoutube && (ytLoading || ytResults.length > 0) && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-xl font-bold text-white">From YouTube</h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-red-600/20 text-red-400 border border-red-600/30">
                yt-dlp
              </span>
            </div>
            {ytLoading && (
              <p className="text-[var(--color-text-muted)] text-sm">Searching YouTube...</p>
            )}
            {!ytLoading && ytResults.length > 0 && (
              <div>
                {ytResults.map((result) => (
                  <YtdlpResultRow
                    key={result.id}
                    result={result}
                    state={downloads[result.id] ?? { status: "idle" }}
                    onDownload={download}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {/* yt-dlp not installed — offer to install */}
        {showInstallBanner && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-xl font-bold text-white">From YouTube</h2>
            </div>
            <div className="flex items-center gap-4 px-4 py-3 rounded-lg bg-white/5 border border-white/10">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white font-medium">Search YouTube and add tracks to your library</p>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                  Requires yt-dlp — a free, open-source downloader.
                  {ytStatus?.managed === false && installState.status === "idle" && " It will be downloaded automatically."}
                </p>
                {installState.status === "error" && (
                  <p className="text-xs text-red-400 mt-1">{installState.message}</p>
                )}
              </div>

              {installState.status === "idle" && (
                <button
                  onClick={install}
                  className="flex items-center gap-2 px-3 py-1.5 rounded bg-[var(--color-accent)] hover:opacity-90 text-white text-sm font-medium flex-shrink-0 transition-opacity"
                >
                  <Download className="w-3.5 h-3.5" />
                  Install yt-dlp
                </button>
              )}

              {installState.status === "installing" && (
                <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)] flex-shrink-0">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{Math.round(installState.pct)}%</span>
                </div>
              )}

              {installState.status === "done" && (
                <span className="text-sm text-green-400 flex-shrink-0">Installed</span>
              )}

              {installState.status === "error" && (
                <button
                  onClick={install}
                  className="flex items-center gap-2 px-3 py-1.5 rounded bg-white/10 hover:bg-white/20 text-white text-sm flex-shrink-0 transition-colors"
                >
                  Retry
                </button>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
