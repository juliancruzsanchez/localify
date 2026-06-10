import { useNavigate } from "react-router";
import { Radio, Download, Play, CheckCircle, AlertCircle, Loader2, ExternalLink, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLastFmSession, useLastFmRecommendations } from "@/queries/lastfm";
import { useYtdlpStatus, useYtdlpInstall, type YtdlpSearchResult } from "@/queries/ytdlp";
import { usePlayerStore } from "@/store/playerStore";
import { useTracksQuery } from "@/queries/tracks";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { cn } from "@/lib/utils";
import type { LastFmRecArtist, LastFmRecTrack, Track } from "@/types";

/** Round-robin flatten: one track from each artist before going back for
 *  seconds, so the resulting list stays diverse. */
function flattenRecommendations(artists: LastFmRecArtist[], limit: number): LastFmRecTrack[] {
  const out: LastFmRecTrack[] = [];
  const maxIdx = artists.reduce((m, a) => Math.max(m, a.top_tracks.length), 0);
  for (let i = 0; i < maxIdx; i++) {
    for (const a of artists) {
      if (out.length >= limit) return out;
      const t = a.top_tracks[i];
      if (t) out.push(t);
    }
  }
  return out;
}

// ─── Download button: search YouTube → download via yt-dlp ───────────────────

type DlPhase =
  | { kind: "idle" }
  | { kind: "searching" }
  | { kind: "downloading"; pct: number }
  | { kind: "processing"; pct: number }
  | { kind: "done" }
  | { kind: "error"; msg: string };

interface DownloadTrackBtnProps {
  track:     LastFmRecTrack;
  ytReady:   boolean;
  onInstall: () => void;
}

function DownloadTrackBtn({ track, ytReady, onInstall }: DownloadTrackBtnProps) {
  const [phase, setPhase] = useState<DlPhase>({ kind: "idle" });
  const [videoId, setVideoId] = useState<string | null>(null);

  // Listen to progress for our video once we have an ID
  useEffect(() => {
    if (!videoId) return;
    const unlisten = listen<{ video_id: string; status: string; pct: number }>(
      "ytdlp:progress",
      ({ payload }) => {
        if (payload.video_id !== videoId) return;
        if (payload.status === "done")  { setPhase({ kind: "done" }); return; }
        if (payload.status === "error") { setPhase({ kind: "error", msg: "Download failed" }); return; }
        if (payload.status === "processing") { setPhase({ kind: "processing", pct: payload.pct }); return; }
        setPhase({ kind: "downloading", pct: payload.pct });
      },
    );
    return () => { unlisten.then((fn) => fn()); };
  }, [videoId]);

  const handleClick = async () => {
    if (!ytReady)  { onInstall(); return; }
    if (phase.kind !== "idle" && phase.kind !== "error") return;

    setPhase({ kind: "searching" });
    try {
      const query = `${track.artist} ${track.title}`;
      const results = await invoke<YtdlpSearchResult[]>("ytdlp_search", { query, limit: 1 });
      if (results.length === 0) {
        setPhase({ kind: "error", msg: "No results found" });
        return;
      }
      const result = results[0];
      setVideoId(result.id);
      setPhase({ kind: "downloading", pct: 0 });
      await invoke("ytdlp_download", {
        videoId: result.id,
        title:   track.title,
        artist:  track.artist,
      });
    } catch (e) {
      setPhase({ kind: "error", msg: String(e) });
    }
  };

  if (phase.kind === "done") {
    return (
      <span className="flex items-center gap-1 text-xs text-green-400">
        <CheckCircle size={13} /> Added
      </span>
    );
  }
  if (phase.kind === "error") {
    return (
      <button onClick={handleClick} className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 transition-colors">
        <AlertCircle size={13} /> Retry
      </button>
    );
  }
  if (phase.kind === "searching") {
    return (
      <span className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
        <Loader2 size={13} className="animate-spin" /> Searching…
      </span>
    );
  }
  if (phase.kind === "downloading" || phase.kind === "processing") {
    return (
      <span className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
        <Loader2 size={13} className="animate-spin" />
        {phase.kind === "processing" ? "Processing…" : `${Math.round(phase.pct)}%`}
      </span>
    );
  }

  return (
    <button
      onClick={handleClick}
      title={ytReady ? "Download with yt-dlp" : "Install yt-dlp to download"}
      className={cn(
        "opacity-0 group-hover:opacity-100 flex items-center gap-1 px-2 py-0.5 rounded text-xs",
        "bg-white/10 hover:bg-white/20 text-white transition-all",
      )}
    >
      <Download size={12} />
      {ytReady ? "Download" : "Install yt-dlp"}
    </button>
  );
}

// ─── Track row (library track: play button; not in library: download button) ─

interface RecTrackRowProps {
  track:      LastFmRecTrack;
  allTracks:  Track[];
  ytReady:    boolean;
  onInstall:  () => void;
}

function RecTrackRow({ track, allTracks, ytReady, onInstall }: RecTrackRowProps) {
  const playTrack = usePlayerStore((s) => s.playTrack);

  const libraryTrack = track.library_track_id
    ? allTracks.find((t) => t.id === track.library_track_id) ?? null
    : null;

  const handlePlay = () => {
    if (libraryTrack) {
      playTrack(libraryTrack, allTracks);
    }
  };

  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 group">
      {/* Play / placeholder icon */}
      <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center">
        {libraryTrack ? (
          <button
            onClick={handlePlay}
            className="opacity-0 group-hover:opacity-100 w-8 h-8 rounded-full bg-[var(--color-accent)] flex items-center justify-center transition-all"
          >
            <Play size={14} fill="white" className="text-white ml-0.5" />
          </button>
        ) : (
          <div className="w-6 h-6 rounded-full border border-white/10 flex items-center justify-center">
            <span className="text-[var(--color-text-dim)] text-[10px]">♪</span>
          </div>
        )}
      </div>

      {/* Track info */}
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm truncate", libraryTrack ? "text-white" : "text-[var(--color-text-muted)]")}>
          {track.title}
        </p>
        <p className="text-xs text-[var(--color-text-muted)] truncate">{track.artist}</p>
      </div>

      {/* In-library badge or download */}
      <div className="flex-shrink-0 flex items-center">
        {libraryTrack ? (
          <span className="text-xs text-[var(--color-accent)] opacity-70">In library</span>
        ) : (
          <DownloadTrackBtn track={track} ytReady={ytReady} onInstall={onInstall} />
        )}
      </div>
    </div>
  );
}

// ─── Artist card ─────────────────────────────────────────────────────────────

interface RecArtistCardProps {
  artist:    LastFmRecArtist;
  allTracks: Track[];
  ytReady:   boolean;
  onInstall: () => void;
}

function RecArtistCard({ artist, allTracks, ytReady, onInstall }: RecArtistCardProps) {
  const navigate = useNavigate();

  return (
    <div
      className="rounded-xl overflow-hidden border border-[var(--color-border)]"
      style={{ background: "var(--color-surface-elevated)" }}
    >
      {/* Artist header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-white truncate">{artist.name}</p>
            {artist.library_artist_id && (
              <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-accent)]/20 text-[var(--color-accent)]">
                In library
              </span>
            )}
          </div>
          <p className="text-xs text-[var(--color-text-muted)] truncate">
            Similar to {artist.similar_to}
          </p>
        </div>
        {artist.library_artist_id ? (
          <button
            onClick={() => navigate(`/artists/${artist.library_artist_id}`)}
            className="flex-shrink-0 flex items-center gap-1 text-xs text-[var(--color-accent)] hover:opacity-80 transition-opacity"
          >
            View <ExternalLink size={11} />
          </button>
        ) : null}
      </div>

      {/* Top tracks */}
      <div className="py-1">
        {artist.top_tracks.map((track) => (
          <RecTrackRow
            key={`${track.artist}-${track.title}`}
            track={track}
            allTracks={allTracks}
            ytReady={ytReady}
            onInstall={onInstall}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

export function LastFmRecommendationsView() {
  const { data: session } = useLastFmSession();
  const { data: recs, isLoading, isError, error, refetch, isFetching } = useLastFmRecommendations();
  const { data: allTracks = [] } = useTracksQuery();
  const { status: ytStatus, refresh: refreshYt } = useYtdlpStatus();
  const { state: installState, install } = useYtdlpInstall(refreshYt);
  const ytReady = ytStatus?.available === true;

  const handleInstall = () => install();

  const flatSongs = useMemo(
    () => (recs ? flattenRecommendations(recs.artists, 15) : []),
    [recs],
  );

  if (!session) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 px-6 text-center">
        <Radio size={48} className="text-[var(--color-text-dim)]" />
        <div>
          <h2 className="text-lg font-semibold text-white">Connect to Last.fm</h2>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            Link your Last.fm account in Settings to get personalised recommendations.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      {/* Header */}
      <div className="px-6 pt-5 pb-4 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Recommended for You</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            Based on your Last.fm history · {session.username}
            {recs && ` · Seeds: ${recs.based_on.slice(0, 3).join(", ")}${recs.based_on.length > 3 ? "…" : ""}`}
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] hover:text-white transition-colors disabled:opacity-40 mt-1"
        >
          <RefreshCw size={13} className={isFetching ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-[var(--color-text-muted)]">
          <Loader2 size={28} className="animate-spin" />
          <p className="text-sm">Fetching your personalised recommendations…</p>
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div className="mx-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-start gap-3">
          <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Failed to load recommendations</p>
            <p className="text-xs mt-0.5 opacity-80">{String(error)}</p>
            <button
              onClick={() => refetch()}
              className="mt-2 text-xs underline hover:no-underline"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && recs && recs.artists.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-4 py-20 px-6 text-center">
          <Radio size={40} className="text-[var(--color-text-dim)]" />
          <div>
            <p className="text-white font-medium">Not enough data yet</p>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">
              Scrobble more tracks on Last.fm to get personalised recommendations.
            </p>
          </div>
        </div>
      )}

      {/* yt-dlp install notice */}
      {!ytReady && recs && recs.artists.length > 0 && (
        <div className="mx-6 mb-4 flex items-center gap-4 px-4 py-3 rounded-xl bg-white/5 border border-white/10">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white">Download recommended tracks</p>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              Install yt-dlp to download tracks not yet in your library.
            </p>
            {installState.status === "error" && (
              <p className="text-xs text-red-400 mt-1">{installState.message}</p>
            )}
          </div>
          {installState.status === "idle" && (
            <button
              onClick={handleInstall}
              className="flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded bg-[var(--color-accent)] hover:opacity-90 text-white text-xs font-medium transition-opacity"
            >
              <Download size={13} /> Install yt-dlp
            </button>
          )}
          {installState.status === "installing" && (
            <span className="flex-shrink-0 flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
              <Loader2 size={13} className="animate-spin" />
              {Math.round(installState.pct)}%
            </span>
          )}
          {installState.status === "done" && (
            <span className="flex-shrink-0 text-xs text-green-400">Installed ✓</span>
          )}
        </div>
      )}

      {/* Recommended songs (flat list) */}
      {flatSongs.length > 0 && (
        <section className="px-6 pb-8">
          <h2 className="text-lg font-semibold text-white mb-3">Recommended Songs</h2>
          <div
            className="rounded-xl overflow-hidden border border-[var(--color-border)] py-1"
            style={{ background: "var(--color-surface-elevated)" }}
          >
            {flatSongs.map((track) => (
              <RecTrackRow
                key={`flat-${track.artist}-${track.title}`}
                track={track}
                allTracks={allTracks}
                ytReady={ytReady}
                onInstall={handleInstall}
              />
            ))}
          </div>
        </section>
      )}

      {/* Artist recommendation grid */}
      {recs && recs.artists.length > 0 && (
        <div className="px-6 pb-8">
          {/* New artists section */}
          {recs.artists.filter((a) => !a.library_artist_id).length > 0 && (
            <section className="mb-8">
              <h2 className="text-lg font-semibold text-white mb-3">Discover New Artists</h2>
              <div className="grid gap-4"
                style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
                {recs.artists
                  .filter((a) => !a.library_artist_id)
                  .map((artist) => (
                    <RecArtistCard
                      key={artist.name}
                      artist={artist}
                      allTracks={allTracks}
                      ytReady={ytReady}
                      onInstall={handleInstall}
                    />
                  ))}
              </div>
            </section>
          )}

          {/* Library artists section */}
          {recs.artists.filter((a) => !!a.library_artist_id).length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-white mb-3">More From Your Library</h2>
              <div className="grid gap-4"
                style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
                {recs.artists
                  .filter((a) => !!a.library_artist_id)
                  .map((artist) => (
                    <RecArtistCard
                      key={artist.name}
                      artist={artist}
                      allTracks={allTracks}
                      ytReady={ytReady}
                      onInstall={handleInstall}
                    />
                  ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
