import { useState, useMemo } from "react";
import { Heart, Play, Shuffle, Download, Music } from "lucide-react";
import { useNavigate } from "react-router";
import { save as saveFileDialog } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { useLikedTracksQuery, useLikedGenresQuery, type LikedTrack } from "@/queries/liked";
import { usePlayerStore } from "@/store/playerStore";
import { useArtworkUrl } from "@/hooks/useArtworkUrl";
import { TrackContextMenu } from "@/components/tracks/TrackContextMenu";
import { formatTime } from "@/lib/formatTime";
import { cn } from "@/lib/utils";
import { toAssetUrl } from "@/lib/assetUrl";
import type { Track } from "@/types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatLikedDate(unixSecs: number): string {
  const now = Date.now() / 1000;
  const diff = now - unixSecs;
  if (diff < 60 * 60 * 24) return "Today";
  if (diff < 60 * 60 * 24 * 7) {
    const days = Math.floor(diff / (60 * 60 * 24));
    return `${days} day${days !== 1 ? "s" : ""} ago`;
  }
  if (diff < 60 * 60 * 24 * 30) {
    const weeks = Math.floor(diff / (60 * 60 * 24 * 7));
    return `${weeks} week${weeks !== 1 ? "s" : ""} ago`;
  }
  return new Date(unixSecs * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ─── Liked track row ─────────────────────────────────────────────────────────

interface LikedRowProps {
  track: LikedTrack;
  index: number;
  queue: Track[];
  isActive: boolean;
}

function LikedTrackRow({ track, index, queue, isActive }: LikedRowProps) {
  const navigate = useNavigate();
  const { playTrack, isPlaying } = usePlayerStore();
  const artworkPath = useArtworkUrl(track.artwork_hash);

  return (
    <TrackContextMenu track={track} queue={queue} queueIndex={index}>
      <div
        onDoubleClick={() => playTrack(track, queue, index)}
        className={cn(
          "group grid items-center gap-3 px-2 py-2 rounded-md text-sm",
          "hover:bg-white/5 cursor-default transition-colors",
          isActive && "bg-white/10",
        )}
        style={{ gridTemplateColumns: "28px 40px 1fr 1fr 100px 48px" }}
      >
        {/* Number / play button */}
        <div className="text-right text-[var(--color-text-muted)] flex-shrink-0">
          <span className="group-hover:hidden text-xs">
            {isActive && isPlaying ? (
              <span className="text-[var(--color-accent)]">♪</span>
            ) : (
              index + 1
            )}
          </span>
          <button
            onClick={() => playTrack(track, queue, index)}
            className="hidden group-hover:flex items-center justify-center text-white"
            aria-label={`Play ${track.title}`}
          >
            <Play size={13} fill="white" />
          </button>
        </div>

        {/* Artwork thumbnail */}
        <div className="w-10 h-10 flex-shrink-0 rounded overflow-hidden bg-[var(--color-surface-elevated)]">
          {artworkPath ? (
            <img
              src={toAssetUrl(artworkPath)}
              alt={track.album_title ?? track.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Music size={16} className="text-[var(--color-text-dim)]" />
            </div>
          )}
        </div>

        {/* Title & artist */}
        <div className="min-w-0">
          <p className={cn("truncate font-medium", isActive ? "text-[var(--color-accent)]" : "text-white")}>
            {track.title}
          </p>
          <button
            onClick={(e) => { e.stopPropagation(); if (track.artist_id) navigate(`/artists/${track.artist_id}`); }}
            className="truncate text-xs text-[var(--color-text-muted)] hover:underline hover:text-white text-left cursor-pointer"
          >
            {track.artist}
          </button>
        </div>

        {/* Album */}
        <div className="min-w-0 hidden md:block">
          <button
            onClick={(e) => { e.stopPropagation(); if (track.album_id) navigate(`/albums/${track.album_id}`); }}
            className="truncate text-[var(--color-text-muted)] hover:underline hover:text-white text-left cursor-pointer"
          >
            {track.album_title ?? "—"}
          </button>
        </div>

        {/* Date added */}
        <div className="hidden lg:block text-xs text-[var(--color-text-muted)] truncate">
          {formatLikedDate(track.liked_at)}
        </div>

        {/* Duration */}
        <div className="text-right text-[var(--color-text-muted)] text-xs">
          {formatTime(track.duration_secs)}
        </div>
      </div>
    </TrackContextMenu>
  );
}

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

// ─── Main view ────────────────────────────────────────────────────────────────

type LikedSortKey = "track_number" | "title" | "album_title" | "liked_at" | "duration_secs";

function sortLiked(list: LikedTrack[], key: LikedSortKey, dir: "asc" | "desc"): LikedTrack[] {
  return [...list].sort((a, b) => {
    let cmp = 0;
    switch (key) {
      case "track_number":
        cmp = (a.track_number ?? 0) - (b.track_number ?? 0);
        break;
      case "title":
        cmp = a.title.localeCompare(b.title);
        break;
      case "album_title":
        cmp = (a.album_title ?? "").localeCompare(b.album_title ?? "");
        break;
      case "liked_at":
        cmp = a.liked_at - b.liked_at;
        break;
      case "duration_secs":
        cmp = a.duration_secs - b.duration_secs;
        break;
    }
    return dir === "asc" ? cmp : -cmp;
  });
}

export function LikedSongsView() {
  const [activeGenre, setActiveGenre] = useState<string | undefined>();
  const [sortBy, setSortBy] = useState<LikedSortKey>("liked_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const toggleSort = (key: LikedSortKey) => {
    if (sortBy === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setSortDir("desc");
    }
  };

  const SORT_COLUMNS: { key: LikedSortKey; label: string; className: string; align?: string }[] = [
    { key: "track_number", label: "#",         className: "text-center" },
    { key: "title",        label: "Title",     className: "" },
    { key: "album_title",  label: "Album",     className: "hidden md:block" },
    { key: "liked_at",     label: "Date added", className: "hidden lg:block" },
    { key: "duration_secs",label: "Time",      className: "text-right" },
  ];

  const { data: likedTracks = [], isLoading } = useLikedTracksQuery(activeGenre);
  const { data: genres = [] } = useLikedGenresQuery();
  const { playTrack, currentTrack } = usePlayerStore();

  const sortedTracks = useMemo(() => sortLiked(likedTracks, sortBy, sortDir), [likedTracks, sortBy, sortDir]);
  // Cast to plain Track[] for the queue (LikedTrack is a structural superset)
  const queue = sortedTracks as unknown as Track[];

  const totalDuration = useMemo(
    () => sortedTracks.reduce((s, t) => s + t.duration_secs, 0),
    [sortedTracks],
  );

  const handlePlayAll = () => {
    if (queue.length > 0) playTrack(queue[0], queue, 0);
  };

  const handleShuffle = () => {
    if (queue.length === 0) return;
    const shuffled = [...queue].sort(() => Math.random() - 0.5);
    playTrack(shuffled[0], shuffled, 0);
  };

  const exportM3u8 = async () => {
    const destPath = await saveFileDialog({
      defaultPath: "Liked Songs.m3u8",
      filters: [{ name: "Playlist", extensions: ["m3u8"] }],
    });
    if (!destPath) return;
    await invoke("export_liked_m3u8", { destPath });
  };

  const toggleGenre = (genre: string) =>
    setActiveGenre((cur) => (cur === genre ? undefined : genre));

  return (
    <div className="h-full overflow-y-auto">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div
        className="flex items-end gap-6 p-8 pb-6"
        style={{
          background:
            "linear-gradient(180deg, #4a1fa8 0%, #2d1260 55%, var(--color-base) 100%)",
        }}
      >
        {/* Purple art square with heart */}
        <div
          className="w-48 h-48 flex-shrink-0 rounded-lg shadow-2xl flex items-center justify-center"
          style={{ background: "linear-gradient(135deg, #7c3aed 0%, #4c1d95 100%)" }}
        >
          <Heart size={72} className="text-white drop-shadow-lg" fill="white" />
        </div>

        <div className="pb-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-white/70 mb-2">
            Playlist
          </p>
          <h1 className="text-5xl font-bold text-white mb-3">Liked Songs</h1>
          <p className="text-white/70 text-sm">
            {likedTracks.length} {likedTracks.length === 1 ? "song" : "songs"}
            {likedTracks.length > 0 && ` · ${formatTime(totalDuration)}`}
          </p>
        </div>
      </div>

      {/* ── Action bar ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-5 px-8 py-5">
        <button
          onClick={handlePlayAll}
          disabled={queue.length === 0}
          className="w-14 h-14 rounded-full bg-[var(--color-accent)] flex items-center justify-center hover:scale-105 transition-transform shadow-lg disabled:opacity-40 disabled:pointer-events-none"
          aria-label="Play all liked songs"
        >
          <Play size={22} fill="black" className="text-black ml-1" />
        </button>
        <button
          onClick={handleShuffle}
          disabled={queue.length === 0}
          className="text-[var(--color-text-muted)] hover:text-white transition-colors disabled:opacity-40 disabled:pointer-events-none"
          aria-label="Shuffle liked songs"
        >
          <Shuffle size={28} />
        </button>
        <button
          onClick={exportM3u8}
          disabled={queue.length === 0}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-[var(--color-text-muted)] hover:text-white hover:bg-white/10 disabled:opacity-40 transition-colors"
          title="Export as M3U8…"
        >
          <Download size={16} />
          Export
        </button>
      </div>

      {/* ── Genre filter pills ─────────────────────────────────────────────── */}
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

      {/* ── Column headers ─────────────────────────────────────────────────── */}
      {likedTracks.length > 0 && (
        <div
          className="grid items-center gap-3 px-2 py-2 text-xs text-[var(--color-text-muted)] uppercase tracking-wider border-b border-white/5 mx-4 mb-1"
          style={{ gridTemplateColumns: "28px 40px 1fr 1fr 100px 48px" }}
        >
          {SORT_COLUMNS.map(({ key, label, className }) => (
            <button
              key={key}
              onClick={() => toggleSort(key)}
              className={cn(
                "flex items-center gap-1 transition-colors hover:text-white",
                sortBy === key ? "text-white" : "",
                className,
              )}
            >
              {label}
              {sortBy === key && (
                <span className="text-[10px]">{sortDir === "asc" ? "▲" : "▼"}</span>
              )}
            </button>
          ))}
          <div />
        </div>
      )}

      {/* ── Track list ─────────────────────────────────────────────────────── */}
      <div className="px-4 pb-24">
        {isLoading ? (
          <div className="text-center text-[var(--color-text-muted)] py-16">
            Loading…
          </div>
        ) : likedTracks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div
              className="w-24 h-24 rounded-full flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #7c3aed 0%, #4c1d95 100%)" }}
            >
              <Heart size={40} className="text-white" fill="white" />
            </div>
            <p className="text-white font-semibold text-lg">
              Songs you like will appear here
            </p>
            <p className="text-[var(--color-text-muted)] text-sm text-center max-w-sm">
              {activeGenre
                ? `No liked songs in genre "${activeGenre}". Try a different filter.`
                : "Click the ♥ on any track to add it to your Liked Songs."}
            </p>
          </div>
        ) : (
          sortedTracks.map((track, i) => (
            <LikedTrackRow
              key={track.id}
              track={track}
              index={i}
              queue={queue}
              isActive={currentTrack?.id === track.id}
            />
          ))
        )}
      </div>
    </div>
  );
}
