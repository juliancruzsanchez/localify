import { useMemo } from "react";
import { useNavigate } from "react-router";
import { Music, ListMusic } from "lucide-react";
import { useArtworkUrl } from "@/hooks/useArtworkUrl";
import { useRecentlyPlayedQuery, type RecentItem } from "@/queries/home";
import { useTracksQuery } from "@/queries/tracks";
import { EmptyLibrary } from "@/components/library/EmptyLibrary";

// ─── Greeting ─────────────────────────────────────────────────────────────────

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

// ─── Home view ────────────────────────────────────────────────────────────────

export function HomeView() {
  const { data: tracks = [], isLoading: tracksLoading } = useTracksQuery();
  const { data: recent = [], isLoading: recentLoading } = useRecentlyPlayedQuery(8);

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

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-8 pt-8 pb-4">
        <h1 className="text-3xl font-bold text-white">{greeting()}</h1>
      </div>

      {/* Recently played */}
      {!recentLoading && recent.length > 0 && (
        <section className="px-8 pb-8">
          {/* 4-column pill-card grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {recent.map((item) => (
              <RecentCard key={`${item.kind}-${item.id}`} item={item} />
            ))}
          </div>
        </section>
      )}

      {/* Empty recently-played (library exists but nothing played yet) */}
      {!recentLoading && recent.length === 0 && (
        <div className="px-8 pb-8">
          <p className="text-[var(--color-text-muted)] text-sm">
            Play some music to see your recent history here.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Pill card ────────────────────────────────────────────────────────────────

function RecentCard({ item }: { item: RecentItem }) {
  const navigate    = useNavigate();
  const artworkPath = useArtworkUrl(item.artwork_hash);

  const href = item.kind === "album"
    ? `/albums/${item.id}`
    : `/playlists/${item.id}`;

  return (
    <button
      onClick={() => navigate(href)}
      className="flex items-center gap-3 rounded-md overflow-hidden text-left group transition-colors"
      style={{ background: "var(--color-surface-elevated)" }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.background = "rgba(255,255,255,0.1)")
      }
      onMouseLeave={(e) =>
        (e.currentTarget.style.background = "var(--color-surface-elevated)")
      }
    >
      {/* Artwork thumbnail */}
      <div className="w-14 h-14 flex-shrink-0 overflow-hidden rounded-l-md bg-[var(--color-surface)]">
        {artworkPath ? (
          <img
            src={`asset://localhost/${encodeURIComponent(artworkPath)}`}
            alt={item.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            {item.kind === "playlist"
              ? <ListMusic size={20} className="text-[var(--color-text-dim)]" />
              : <Music     size={20} className="text-[var(--color-text-dim)]" />
            }
          </div>
        )}
      </div>

      {/* Title */}
      <span className="flex-1 min-w-0 pr-3 py-2">
        <span className="block text-sm font-semibold text-white truncate leading-tight">
          {item.title}
        </span>
        <span className="block text-xs text-[var(--color-text-muted)] truncate mt-0.5">
          {item.subtitle}
        </span>
      </span>
    </button>
  );
}
