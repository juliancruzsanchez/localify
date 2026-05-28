import { useNavigate } from "react-router";
import { Play, Music, Disc3, Mic2 } from "lucide-react";
import { useArtworkUrl } from "@/hooks/useArtworkUrl";
import { useRecentlyPlayedQuery, useGenreMixesQuery, type RecentItem, type GenreMix } from "@/queries/home";
import { useAlbumsQuery } from "@/queries/albums";
import { useArtistsQuery } from "@/queries/artists";
import { useTracksQuery } from "@/queries/tracks";
import { usePlayerStore } from "@/store/playerStore";
import { EmptyLibrary } from "@/components/library/EmptyLibrary";
import { toAssetUrl } from "@/lib/assetUrl";
import type { Album, Artist, Track } from "@/types";

// ─── Greeting ─────────────────────────────────────────────────────────────────

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ title, onShowAll }: { title: string; onShowAll?: () => void }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-xl font-bold text-white">{title}</h2>
      {onShowAll && (
        <button
          onClick={onShowAll}
          className="text-xs font-semibold text-[var(--color-text-muted)] hover:text-white uppercase tracking-widest transition-colors"
        >
          Show all
        </button>
      )}
    </div>
  );
}

// ─── Recent pill card (quick-access grid) ────────────────────────────────────

function RecentPillCard({ item }: { item: RecentItem }) {
  const navigate    = useNavigate();
  const artworkPath = useArtworkUrl(item.artwork_hash);
  const href = item.kind === "album" ? `/albums/${item.id}` : `/playlists/${item.id}`;

  return (
    <button
      onClick={() => navigate(href)}
      className="flex items-center gap-3 rounded-md overflow-hidden text-left group transition-all hover:brightness-110"
      style={{ background: "var(--color-surface-elevated)" }}
    >
      <div className="w-14 h-14 flex-shrink-0 overflow-hidden bg-[var(--color-surface)]">
        {artworkPath ? (
          <img
src={toAssetUrl(artworkPath)}
             alt={item.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-[var(--color-surface-elevated)]">
            <Music size={20} className="text-[var(--color-text-dim)]" />
          </div>
        )}
      </div>
      <span className="flex-1 min-w-0 pr-3 text-sm font-semibold text-white truncate">
        {item.title}
      </span>
    </button>
  );
}

// ─── Large browsable card (albums, artists, genre mixes) ─────────────────────

function AlbumCard({ album }: { album: Album }) {
  const navigate    = useNavigate();
  const artworkPath = useArtworkUrl(album.artwork_hash);
  const { playTrack } = usePlayerStore();

  return (
    <div
      className="group flex flex-col gap-3 p-3 rounded-lg cursor-pointer transition-colors"
      style={{ background: "transparent" }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.background = "var(--color-surface-elevated)")
      }
      onMouseLeave={(e) =>
        (e.currentTarget.style.background = "transparent")
      }
      onClick={() => navigate(`/albums/${album.id}`)}
    >
      <div className="relative w-full aspect-square rounded-md overflow-hidden bg-[var(--color-surface-elevated)] shadow-lg">
        {artworkPath ? (
          <img
src={toAssetUrl(artworkPath)}
             alt={album.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Disc3 size={48} className="text-[var(--color-text-dim)]" />
          </div>
        )}
        {/* Play button overlay */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            // We'd need the tracks query here – navigate instead for simplicity
            navigate(`/albums/${album.id}`);
          }}
          className="absolute bottom-2 right-2 w-10 h-10 rounded-full bg-[var(--color-accent)] flex items-center justify-center shadow-xl opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-200"
          aria-label={`Play ${album.title}`}
        >
          <Play size={18} fill="black" className="text-black ml-0.5" />
        </button>
      </div>
      <div className="min-w-0">
        <p className="text-white text-sm font-semibold truncate">{album.title}</p>
        <p className="text-[var(--color-text-muted)] text-xs truncate">{album.artist_name}</p>
      </div>
    </div>
  );
}

function ArtistCard({ artist }: { artist: Artist }) {
  const navigate    = useNavigate();
  const artworkPath = useArtworkUrl(artist.artwork_hash);

  return (
    <div
      className="group flex flex-col items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors"
      style={{ background: "transparent" }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.background = "var(--color-surface-elevated)")
      }
      onMouseLeave={(e) =>
        (e.currentTarget.style.background = "transparent")
      }
      onClick={() => navigate(`/artists/${artist.id}`)}
    >
      <div className="relative w-full aspect-square rounded-full overflow-hidden bg-[var(--color-surface-elevated)] shadow-lg">
        {artworkPath ? (
          <img
src={toAssetUrl(artworkPath)}
             alt={artist.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Mic2 size={40} className="text-[var(--color-text-dim)]" />
          </div>
        )}
      </div>
      <div className="min-w-0 text-center">
        <p className="text-white text-sm font-semibold truncate">{artist.name}</p>
        <p className="text-[var(--color-text-muted)] text-xs">Artist</p>
      </div>
    </div>
  );
}

function GenreMixCard({ mix }: { mix: GenreMix }) {
  const navigate    = useNavigate();
  const artworkPath = useArtworkUrl(mix.artwork_hash);

  return (
    <div
      className="group flex flex-col gap-3 p-3 rounded-lg cursor-pointer transition-colors"
      style={{ background: "transparent" }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.background = "var(--color-surface-elevated)")
      }
      onMouseLeave={(e) =>
        (e.currentTarget.style.background = "transparent")
      }
      onClick={() => navigate(`/songs?genre=${encodeURIComponent(mix.genre)}`)}
    >
      <div className="relative w-full aspect-square rounded-md overflow-hidden bg-[var(--color-surface-elevated)] shadow-lg">
        {artworkPath ? (
          <img
src={toAssetUrl(artworkPath)}
             alt={mix.genre}
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{
              background: `hsl(${(mix.genre.charCodeAt(0) * 47) % 360}, 55%, 30%)`,
            }}
          >
            <Music size={40} className="text-white/60" />
          </div>
        )}
      </div>
      <div className="min-w-0">
        <p className="text-white text-sm font-semibold truncate">{mix.genre}</p>
        <p className="text-[var(--color-text-muted)] text-xs">{mix.track_count} songs</p>
      </div>
    </div>
  );
}

// ─── Most-played track card ───────────────────────────────────────────────────

function MostPlayedCard({ track, queue }: { track: Track; queue: Track[] }) {
  const { playTrack, currentTrack, isPlaying } = usePlayerStore();
  const artworkPath = useArtworkUrl(track.artwork_hash);
  const isActive = currentTrack?.id === track.id;

  return (
    <div
      className="group flex flex-col gap-3 p-3 rounded-lg cursor-pointer transition-colors"
      style={{ background: "transparent" }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.background = "var(--color-surface-elevated)")
      }
      onMouseLeave={(e) =>
        (e.currentTarget.style.background = "transparent")
      }
      onDoubleClick={() => {
        const idx = queue.findIndex((t) => t.id === track.id);
        playTrack(track, queue, idx >= 0 ? idx : 0);
      }}
    >
      <div className="relative w-full aspect-square rounded-md overflow-hidden bg-[var(--color-surface-elevated)] shadow-lg">
        {artworkPath ? (
          <img
src={toAssetUrl(artworkPath)}
             alt={track.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Music size={40} className="text-[var(--color-text-dim)]" />
          </div>
        )}
        {isActive && isPlaying && (
          <div className="absolute bottom-2 left-2 text-[var(--color-accent)] text-lg">♪</div>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            const idx = queue.findIndex((t) => t.id === track.id);
            playTrack(track, queue, idx >= 0 ? idx : 0);
          }}
          className="absolute bottom-2 right-2 w-10 h-10 rounded-full bg-[var(--color-accent)] flex items-center justify-center shadow-xl opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-200"
          aria-label={`Play ${track.title}`}
        >
          <Play size={18} fill="black" className="text-black ml-0.5" />
        </button>
      </div>
      <div className="min-w-0">
        <p className={`text-sm font-semibold truncate ${isActive ? "text-[var(--color-accent)]" : "text-white"}`}>
          {track.title}
        </p>
        <p className="text-[var(--color-text-muted)] text-xs truncate">{track.artist}</p>
      </div>
    </div>
  );
}

// ─── Horizontal scroll row ────────────────────────────────────────────────────

function HorizontalRow({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="grid gap-2"
      style={{ gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))" }}
    >
      {children}
    </div>
  );
}

// ─── Home view ────────────────────────────────────────────────────────────────

export function HomeView() {
  const navigate = useNavigate();
  const { data: tracks = [],  isLoading: tracksLoading  } = useTracksQuery();
  const { data: recent = [],  isLoading: recentLoading  } = useRecentlyPlayedQuery(6);
  const { data: allAlbums = [] }  = useAlbumsQuery();
  const { data: allArtists = [] } = useArtistsQuery();
  const { data: genreMixes = [] } = useGenreMixesQuery();

  if (tracksLoading) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--color-text-muted)]">
        Loading…
      </div>
    );
  }

  if (tracks.length === 0) {
    return <EmptyLibrary />;
  }

  // Top albums = highest track count, take up to 8
  const topAlbums  = [...allAlbums]
    .sort((a, b) => b.track_count - a.track_count)
    .slice(0, 8);

  // Top artists = highest track count, take up to 8
  const topArtists = [...allArtists]
    .sort((a, b) => b.track_count - a.track_count)
    .slice(0, 8);

  // Most played tracks (play_count > 0), take up to 8
  const mostPlayed = [...tracks]
    .filter((t) => t.play_count > 0)
    .sort((a, b) => b.play_count - a.play_count)
    .slice(0, 8);

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-8 pt-8 pb-4">
        <h1 className="text-3xl font-bold text-white">{greeting()}</h1>
      </div>

      {/* ── Quick-access recently played grid ─────────────────────────────── */}
      {!recentLoading && recent.length > 0 && (
        <section className="px-8 pb-6">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
            {recent.map((item) => (
              <RecentPillCard key={`${item.kind}-${item.id}`} item={item} />
            ))}
          </div>
        </section>
      )}

      {!recentLoading && recent.length === 0 && (
        <div className="px-8 pb-6">
          <p className="text-[var(--color-text-muted)] text-sm">
            Play some music to see your recent history here.
          </p>
        </div>
      )}

      {/* ── Most Played ───────────────────────────────────────────────────── */}
      {mostPlayed.length > 0 && (
        <section className="px-8 pb-8">
          <SectionHeader title="Most Played" />
          <HorizontalRow>
            {mostPlayed.map((track) => (
              <MostPlayedCard key={track.id} track={track} queue={mostPlayed} />
            ))}
          </HorizontalRow>
        </section>
      )}

      {/* ── Genre Mixes ───────────────────────────────────────────────────── */}
      {genreMixes.length > 0 && (
        <section className="px-8 pb-8">
          <SectionHeader title="Genre Mixes" />
          <HorizontalRow>
            {genreMixes.slice(0, 8).map((mix) => (
              <GenreMixCard key={mix.genre} mix={mix} />
            ))}
          </HorizontalRow>
        </section>
      )}

      {/* ── Top Albums ────────────────────────────────────────────────────── */}
      {topAlbums.length > 0 && (
        <section className="px-8 pb-8">
          <SectionHeader
            title="Top Albums"
            onShowAll={() => navigate("/albums")}
          />
          <HorizontalRow>
            {topAlbums.map((album) => (
              <AlbumCard key={album.id} album={album} />
            ))}
          </HorizontalRow>
        </section>
      )}

      {/* ── Top Artists ───────────────────────────────────────────────────── */}
      {topArtists.length > 0 && (
        <section className="px-8 pb-8">
          <SectionHeader
            title="Top Artists"
            onShowAll={() => navigate("/artists")}
          />
          <HorizontalRow>
            {topArtists.map((artist) => (
              <ArtistCard key={artist.id} artist={artist} />
            ))}
          </HorizontalRow>
        </section>
      )}
    </div>
  );
}
