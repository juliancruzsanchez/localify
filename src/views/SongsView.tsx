import { useState, useMemo } from "react";
import { useSearchParams } from "react-router";
import { Music, ArrowLeft, Download, Loader2, Search } from "lucide-react";
import { useTracksQuery, useAllGenresQuery } from "@/queries/tracks";
import { TrackList } from "@/components/tracks/TrackList";
import { useNavigate } from "react-router";
import { useArtworkUrl } from "@/hooks/useArtworkUrl";
import { toAssetUrl } from "@/lib/assetUrl";
import { formatTime } from "@/lib/formatTime";
import { cn } from "@/lib/utils";
import { SortMenu, type SortOption } from "@/components/library/SortMenu";
import { useSortPref, type SortPref } from "@/hooks/useSortPref";
import type { Track } from "@/types";

type SongSortKey = "title" | "artist" | "recent";

const SONG_SORT_OPTIONS: SortOption<SongSortKey>[] = [
  { key: "title",  label: "A–Z" },
  { key: "artist", label: "Creator" },
  { key: "recent", label: "Recently played" },
];

function sortTracks(list: Track[], pref: SortPref<SongSortKey>): Track[] {
  const cmpStr = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: "base" });
  const dirMul = pref.dir === "asc" ? 1 : -1;
  return [...list].sort((a, b) => {
    switch (pref.key) {
      case "title":  return cmpStr(a.title, b.title) * dirMul;
      case "artist": return (cmpStr(a.artist, b.artist) || cmpStr(a.title, b.title)) * dirMul;
      case "recent": {
        const at = a.last_played_at ?? 0;
        const bt = b.last_played_at ?? 0;
        return (bt - at) * (pref.dir === "desc" ? 1 : -1);
      }
    }
  });
}
import {
  useYtdlpStatus,
  useYtdlpInstall,
  useYtdlpSearch,
  useYtdlpDownload,
  type DownloadState,
} from "@/queries/ytdlp";
import { useDebounce } from "@/hooks/useDebounce";
import { YtdlpResultRow } from "@/components/search/YtdlpResultRow";

// ─── Genre pill ───────────────────────────────────────────────────────────────

interface GenrePillProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

function GenrePill({ label, active, onClick }: GenrePillProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0",
        active
          ? "bg-white text-black"
          : "bg-white/10 text-white hover:bg-white/20",
      )}
    >
      {label}
    </button>
  );
}

// ─── Empty search section ─────────────────────────────────────────────────────

function EmptyYtdlpSection({
  ytQuery,
  setYtQuery,
  showYoutube,
  ytStatus,
  installState,
  install,
  ytResults,
  ytLoading,
  downloads,
  download,
}: {
  ytQuery: string;
  setYtQuery: (q: string) => void;
  showYoutube: boolean;
  ytStatus: { available: boolean; managed: boolean } | null;
  installState: { status: string; message?: string; pct?: number };
  install: () => void;
  ytResults: { id: string; title: string; uploader: string; duration_secs: number; thumbnail_url: string }[];
  ytLoading: boolean;
  downloads: Record<string, DownloadState>;
  download: (result: { id: string; title: string; uploader: string; duration_secs: number; thumbnail_url: string }) => void;
}) {
  const showInstallBanner = ytStatus?.available === false && installState.status === "idle";

  return (
    <div className="h-full overflow-y-auto">
      <div className="flex flex-col items-center justify-center pt-24 pb-12 gap-6 text-center px-8">
        <div className="w-24 h-24 rounded-full bg-[var(--color-surface-elevated)] flex items-center justify-center">
          <Music size={40} className="text-[var(--color-text-muted)]" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">Your library is empty</h2>
          <p className="text-[var(--color-text-muted)] max-w-sm">
            Add a music folder in Settings, or search YouTube below to download tracks.
          </p>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-6 pb-8 space-y-4">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-full bg-white/10 border border-white/10 focus-within:border-white/30 transition-colors">
          <Search size={18} className="text-[var(--color-text-muted)] flex-shrink-0" />
          <input
            type="text"
            placeholder="Search YouTube..."
            value={ytQuery}
            onChange={(e) => setYtQuery(e.target.value)}
            className="flex-1 bg-transparent text-white text-sm outline-none placeholder:text-[var(--color-text-dim)]"
            autoFocus
          />
        </div>

        {/* YouTube results */}
        {showYoutube && ytLoading && (
          <div className="text-sm text-[var(--color-text-muted)] flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Searching YouTube...
          </div>
        )}

        {showYoutube && !ytLoading && ytResults.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-sm font-semibold text-white">From YouTube</h3>
              <span className="text-xs px-2 py-0.5 rounded-full bg-red-600/20 text-red-400 border border-red-600/30">
                yt-dlp
              </span>
            </div>
            <div className="space-y-1">
              {ytResults.map((result) => (
                <YtdlpResultRow
                  key={result.id}
                  result={result}
                  state={downloads[result.id] ?? ({ status: "idle" } as DownloadState)}
                  onDownload={download}
                />
              ))}
            </div>
          </div>
        )}

        {ytQuery && !ytLoading && ytResults.length === 0 && ytStatus?.available && (
          <p className="text-sm text-[var(--color-text-muted)]">No YouTube results found.</p>
        )}

        {/* yt-dlp not installed */}
        {showInstallBanner && (
          <div className="flex items-center gap-4 px-4 py-3 rounded-lg bg-white/5 border border-white/10">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white font-medium">Search YouTube and add tracks to your library</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                Requires yt-dlp — a free, open-source downloader.
              </p>
            </div>
            <button
              onClick={install}
              className="flex items-center gap-2 px-3 py-1.5 rounded bg-[var(--color-accent)] hover:opacity-90 text-white text-sm font-medium flex-shrink-0 transition-opacity"
            >
              <Download className="w-3.5 h-3.5" />
              Install yt-dlp
            </button>
          </div>
        )}

        {installState.status === "installing" && (
          <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>{Math.round((installState as { pct: number }).pct)}%</span>
          </div>
        )}

        {installState.status === "error" && (
          <div className="flex items-center gap-2 text-sm text-red-400">
            <span>Install failed: {(installState as { message: string }).message}</span>
            <button onClick={install} className="underline hover:text-white">Retry</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

export function SongsView() {
  const [searchParams] = useSearchParams();
  const urlGenre = searchParams.get("genre");
  const navigate = useNavigate();
  const { data: allTracks = [], isLoading } = useTracksQuery();
  const { data: genres = [] } = useAllGenresQuery();
  const [ytQuery, setYtQuery] = useState("");

  const [activeGenre, setActiveGenre] = useState<string | undefined>(urlGenre ?? undefined);

  const { pref: sortPref, toggle: toggleSort } = useSortPref<SongSortKey>(
    "songs",
    { key: "title", dir: "asc" },
    (k) => (k === "recent" ? "desc" : "asc"),
  );

  const filteredTracks = useMemo(() => {
    if (!activeGenre) return allTracks;
    return allTracks.filter(
      (t) => t.genre?.toLowerCase() === activeGenre.toLowerCase(),
    );
  }, [allTracks, activeGenre]);

  const tracks = useMemo(
    () => sortTracks(filteredTracks, sortPref),
    [filteredTracks, sortPref],
  );

  const firstWithArtwork = useMemo(
    () => tracks.find((t) => t.artwork_hash),
    [tracks],
  );
  const artworkPath = useArtworkUrl(firstWithArtwork?.artwork_hash);

  const toggleGenre = (genre: string) =>
    setActiveGenre((cur) => (cur === genre ? undefined : genre));

  // ─── yt-dlp hooks (always called, unconditionally) ──────────────────────────
  const debouncedYtQuery = useDebounce(ytQuery, 300);
  const { status: ytStatus, refresh: refreshYtStatus } = useYtdlpStatus();
  const { state: installState, install } = useYtdlpInstall(refreshYtStatus);
  const showYoutube = !!debouncedYtQuery && ytStatus?.available === true;
  const { results: ytResults, loading: ytLoading } = useYtdlpSearch(debouncedYtQuery, showYoutube);
  const { downloads, download } = useYtdlpDownload();

  if (isLoading) {
    return <div className="flex items-center justify-center h-full text-[var(--color-text-muted)]">Loading...</div>;
  }

  // Empty library — show ytdlp search fallback
  if (allTracks.length === 0) {
    return (
      <EmptyYtdlpSection
        ytQuery={ytQuery}
        setYtQuery={setYtQuery}
        showYoutube={showYoutube}
        ytStatus={ytStatus}
        installState={installState}
        install={install}
        ytResults={ytResults}
        ytLoading={ytLoading}
        downloads={downloads}
        download={download}
      />
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {activeGenre ? (
        <>
          {/* Genre mix header */}
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
                  : `hsl(${(activeGenre.charCodeAt(0) * 47) % 360}, 55%, 30%)`,
              }}
            >
              {artworkPath ? (
                <img
                  src={toAssetUrl(artworkPath)}
                  alt={activeGenre}
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
              <h1 className="text-4xl font-bold text-white mb-2">{activeGenre}</h1>
              <p className="text-[var(--color-text-muted)]">
                {tracks.length} tracks{" "}
                {tracks.length > 0 &&
                  `· ${formatTime(
                    tracks.reduce((s, t) => s + t.duration_secs, 0),
                  )}`}
              </p>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between px-8 py-6 flex-shrink-0">
            <h1 className="text-3xl font-bold text-white">Songs</h1>
            <div className="flex items-center gap-4">
              <span className="text-[var(--color-text-muted)] text-sm">
                {tracks.length} tracks
              </span>
              <SortMenu options={SONG_SORT_OPTIONS} pref={sortPref} onToggle={toggleSort} />
            </div>
          </div>
        </>
      )}

      {/* Genre filter pills */}
      {genres.length > 0 && (
        <div className="flex items-center gap-2 px-8 pb-4 overflow-x-auto"
             style={{ scrollbarWidth: "none" }}>
          <GenrePill
            label="All"
            active={activeGenre === undefined}
            onClick={() => setActiveGenre(undefined)}
          />
          {genres.map((g) => (
            <GenrePill
              key={g}
              label={g}
              active={activeGenre === g}
              onClick={() => toggleGenre(g)}
            />
          ))}
        </div>
      )}

      <TrackList tracks={tracks} />
    </div>
  );
}
