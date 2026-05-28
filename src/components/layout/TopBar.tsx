import { Home, Search, Settings, X, Music, Disc3, Mic2 } from "lucide-react";
import { useNavigate } from "react-router";
import { useState, useRef, useEffect, useCallback } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { useSearchQuery } from "@/queries/search";
import { useArtworkUrl } from "@/hooks/useArtworkUrl";
import { toAssetUrl } from "@/lib/assetUrl";
import { usePlayerStore } from "@/store/playerStore";
import type { Track, Album, Artist } from "@/types";

// ─── Artwork thumbnail used inside the dropdown ───────────────────────────────

function ArtworkThumb({
  hash,
  fallback,
  round = false,
}: {
  hash: string | null | undefined;
  fallback: React.ReactNode;
  round?: boolean;
}) {
  const path = useArtworkUrl(hash);
  return (
    <div
      className={`w-10 h-10 flex-shrink-0 flex items-center justify-center overflow-hidden bg-[var(--color-surface-elevated)] ${round ? "rounded-full" : "rounded"}`}
    >
      {path ? (
        <img
          src={toAssetUrl(path)}
          alt=""
          className="w-full h-full object-cover"
        />
      ) : (
        <span className="text-[var(--color-text-dim)]">{fallback}</span>
      )}
    </div>
  );
}

// ─── Individual result rows ───────────────────────────────────────────────────

function TrackResult({
  track,
  focused,
  onSelect,
}: {
  track: Track;
  focused: boolean;
  onSelect: (track: Track) => void;
}) {
  return (
    <button
      onMouseDown={(e) => { e.preventDefault(); onSelect(track); }}
      className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${
        focused ? "bg-white/10" : "hover:bg-white/5"
      }`}
    >
      <ArtworkThumb hash={track.artwork_hash} fallback={<Music size={16} />} />
      <div className="min-w-0">
        <p className="text-white text-sm font-medium truncate">{track.title}</p>
        <p className="text-[var(--color-text-muted)] text-xs truncate">
          Song · {track.artist}
        </p>
      </div>
    </button>
  );
}

function AlbumResult({
  album,
  focused,
  onSelect,
}: {
  album: Album;
  focused: boolean;
  onSelect: (album: Album) => void;
}) {
  return (
    <button
      onMouseDown={(e) => { e.preventDefault(); onSelect(album); }}
      className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${
        focused ? "bg-white/10" : "hover:bg-white/5"
      }`}
    >
      <ArtworkThumb hash={album.artwork_hash} fallback={<Disc3 size={16} />} />
      <div className="min-w-0">
        <p className="text-white text-sm font-medium truncate">{album.title}</p>
        <p className="text-[var(--color-text-muted)] text-xs truncate">
          Album · {album.artist_name}
        </p>
      </div>
    </button>
  );
}

function ArtistResult({
  artist,
  focused,
  onSelect,
}: {
  artist: Artist;
  focused: boolean;
  onSelect: (artist: Artist) => void;
}) {
  return (
    <button
      onMouseDown={(e) => { e.preventDefault(); onSelect(artist); }}
      className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${
        focused ? "bg-white/10" : "hover:bg-white/5"
      }`}
    >
      <ArtworkThumb
        hash={artist.artwork_hash}
        fallback={<Mic2 size={16} />}
        round
      />
      <div className="min-w-0">
        <p className="text-white text-sm font-medium truncate">{artist.name}</p>
        <p className="text-[var(--color-text-muted)] text-xs truncate">
          Artist · {artist.track_count} songs
        </p>
      </div>
    </button>
  );
}

// ─── Main TopBar ──────────────────────────────────────────────────────────────

const MAX_TRACKS  = 4;
const MAX_ALBUMS  = 3;
const MAX_ARTISTS = 3;

export function TopBar() {
  const navigate = useNavigate();
  const { playTrack } = usePlayerStore();

  const [query, setQuery]       = useState("");
  const [open, setOpen]         = useState(false);
  const [focusedIdx, setFocusedIdx] = useState(-1);

  const debouncedQuery = useDebounce(query, 200);
  const { data: results } = useSearchQuery(debouncedQuery);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef     = useRef<HTMLInputElement>(null);

  // Sliced result lists
  const tracks  = results?.tracks.slice(0, MAX_TRACKS)   ?? [];
  const albums  = results?.albums.slice(0, MAX_ALBUMS)   ?? [];
  const artists = results?.artists.slice(0, MAX_ARTISTS) ?? [];

  // Flat list of focusable items for arrow-key navigation
  // Each item: { kind, data }  — used to determine which section index maps to
  type FlatItem =
    | { kind: "track";  data: Track  }
    | { kind: "album";  data: Album  }
    | { kind: "artist"; data: Artist }
    | { kind: "see-all" };

  const flatItems: FlatItem[] = [
    ...tracks.map((t)  => ({ kind: "track"  as const, data: t })),
    ...albums.map((a)  => ({ kind: "album"  as const, data: a })),
    ...artists.map((a) => ({ kind: "artist" as const, data: a })),
    ...(query.trim() ? [{ kind: "see-all" as const }] : []),
  ];

  const hasResults = tracks.length > 0 || albums.length > 0 || artists.length > 0;
  const dropdownVisible = open && query.trim().length > 0 && hasResults;

  // Close on outside click
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  // Reset focused index when results change
  useEffect(() => { setFocusedIdx(-1); }, [debouncedQuery]);

  const goToFullSearch = useCallback(() => {
    if (!query.trim()) return;
    navigate(`/search?q=${encodeURIComponent(query.trim())}`);
    setOpen(false);
  }, [query, navigate]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!dropdownVisible) {
      if (e.key === "Enter" && query.trim()) goToFullSearch();
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIdx((i) => Math.min(i + 1, flatItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIdx((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (focusedIdx >= 0 && focusedIdx < flatItems.length) {
        const item = flatItems[focusedIdx];
        activateItem(item);
      } else {
        goToFullSearch();
      }
    } else if (e.key === "Escape") {
      setQuery("");
      setOpen(false);
      inputRef.current?.blur();
    }
  }

  function activateItem(item: FlatItem) {
    if (item.kind === "track") {
      // Play the track immediately (queue = all track results so skip/prev works)
      const allTracks = results?.tracks ?? [];
      const idx = allTracks.findIndex((t) => t.id === item.data.id);
      playTrack(item.data, allTracks, idx >= 0 ? idx : 0);
      setOpen(false);
      setQuery("");
    } else if (item.kind === "album") {
      navigate(`/albums/${item.data.id}`);
      setOpen(false);
      setQuery("");
    } else if (item.kind === "artist") {
      navigate(`/artists/${item.data.id}`);
      setOpen(false);
      setQuery("");
    } else {
      goToFullSearch();
    }
  }

  function handleClear() {
    setQuery("");
    setOpen(false);
    inputRef.current?.focus();
  }

  // Compute absolute index offset for each section (for focused highlighting)
  const trackOffset  = 0;
  const albumOffset  = tracks.length;
  const artistOffset = tracks.length + albums.length;
  const seeAllIdx    = tracks.length + albums.length + artists.length;

  return (
    <header
      style={{
        gridArea: "topbar",
        height: "var(--topbar-height)",
        background: "var(--color-surface)",
        borderBottom: "1px solid var(--color-border)",
        display: "flex",
        alignItems: "center",
        padding: "0 24px",
        gap: "12px",
        borderRadius: "12px 12px 0 0",
        overflow: "hidden",
      }}
    >
      {/* Home button */}
      <button
        onClick={() => navigate("/")}
        title="Home"
        className="flex items-center justify-center w-9 h-9 rounded-full bg-black/40 text-[var(--color-text-muted)] hover:text-white hover:bg-black/60 transition-colors flex-shrink-0"
      >
        <Home size={20} />
      </button>

      {/* Search bar + dropdown wrapper */}
      <div ref={containerRef} className="flex-1 flex justify-center relative">
        <div className="relative w-full max-w-[480px]">
          {/* Input */}
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none z-10"
          />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder="What do you want to play?"
            className="w-full h-10 bg-[var(--color-surface-elevated)] text-white placeholder-[var(--color-text-muted)] rounded-full pl-10 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
          />
          {query && (
            <button
              onMouseDown={(e) => { e.preventDefault(); handleClear(); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-white transition-colors z-10"
              aria-label="Clear search"
            >
              <X size={15} />
            </button>
          )}

          {/* Dropdown */}
          {dropdownVisible && (
            <div
              className="absolute top-[calc(100%+8px)] left-0 right-0 rounded-lg overflow-hidden shadow-2xl z-50 py-2"
              style={{
                background: "var(--color-surface-elevated)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              {/* Tracks section */}
              {tracks.length > 0 && (
                <section>
                  <p className="px-4 pt-1 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">
                    Songs
                  </p>
                  {tracks.map((t, i) => (
                    <TrackResult
                      key={t.id}
                      track={t}
                      focused={focusedIdx === trackOffset + i}
                      onSelect={(track) => activateItem({ kind: "track", data: track })}
                    />
                  ))}
                </section>
              )}

              {/* Albums section */}
              {albums.length > 0 && (
                <section className={tracks.length > 0 ? "mt-1" : ""}>
                  <p className="px-4 pt-1 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">
                    Albums
                  </p>
                  {albums.map((a, i) => (
                    <AlbumResult
                      key={a.id}
                      album={a}
                      focused={focusedIdx === albumOffset + i}
                      onSelect={(album) => activateItem({ kind: "album", data: album })}
                    />
                  ))}
                </section>
              )}

              {/* Artists section */}
              {artists.length > 0 && (
                <section className={tracks.length > 0 || albums.length > 0 ? "mt-1" : ""}>
                  <p className="px-4 pt-1 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">
                    Artists
                  </p>
                  {artists.map((a, i) => (
                    <ArtistResult
                      key={a.id}
                      artist={a}
                      focused={focusedIdx === artistOffset + i}
                      onSelect={(artist) => activateItem({ kind: "artist", data: artist })}
                    />
                  ))}
                </section>
              )}

              {/* See all results footer */}
              <button
                onMouseDown={(e) => { e.preventDefault(); goToFullSearch(); }}
                className={`w-full flex items-center gap-2 px-4 py-3 mt-1 border-t border-white/5 text-sm transition-colors ${
                  focusedIdx === seeAllIdx
                    ? "bg-white/10 text-white"
                    : "text-[var(--color-text-muted)] hover:text-white hover:bg-white/5"
                }`}
              >
                <Search size={14} className="flex-shrink-0" />
                <span>
                  See all results for{" "}
                  <strong className="text-white">"{query.trim()}"</strong>
                </span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Settings button */}
      <button
        onClick={() => navigate("/settings")}
        title="Settings"
        className="flex items-center justify-center w-9 h-9 rounded-full bg-black/40 text-[var(--color-text-muted)] hover:text-white hover:bg-black/60 transition-colors flex-shrink-0"
      >
        <Settings size={20} />
      </button>
    </header>
  );
}
