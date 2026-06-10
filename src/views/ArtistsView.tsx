import { useMemo } from "react";
import { useArtistsQuery } from "@/queries/artists";
import { useTracksQuery } from "@/queries/tracks";
import { ArtistGrid } from "@/components/artists/ArtistGrid";
import { EmptyLibrary } from "@/components/library/EmptyLibrary";
import { SortMenu, type SortOption } from "@/components/library/SortMenu";
import { useSortPref, type SortPref } from "@/hooks/useSortPref";
import type { Artist } from "@/types";

type ArtistSortKey = "name" | "recent";

const OPTIONS: SortOption<ArtistSortKey>[] = [
  { key: "name",   label: "A–Z" },
  { key: "recent", label: "Recently played" },
];

function sortArtists(
  artists:       Artist[],
  pref:          SortPref<ArtistSortKey>,
  lastPlayedFor: (artistId: string) => number,
): Artist[] {
  const cmpStr  = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: "base" });
  const dirMul  = pref.dir === "asc" ? 1 : -1;
  return [...artists].sort((a, b) => {
    switch (pref.key) {
      case "name":   return cmpStr(a.name, b.name) * dirMul;
      case "recent": return (lastPlayedFor(b.id) - lastPlayedFor(a.id)) * (pref.dir === "desc" ? 1 : -1);
    }
  });
}

export function ArtistsView() {
  const { data: artists = [], isLoading } = useArtistsQuery();
  const { data: tracks = [] } = useTracksQuery();
  const { pref, toggle } = useSortPref<ArtistSortKey>(
    "artists",
    { key: "name", dir: "asc" },
    (k) => (k === "recent" ? "desc" : "asc"),
  );

  const lastPlayedByArtist = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of tracks) {
      if (!t.artist_id) continue;
      const ts = t.last_played_at ?? 0;
      const cur = m.get(t.artist_id) ?? 0;
      if (ts > cur) m.set(t.artist_id, ts);
    }
    return m;
  }, [tracks]);

  const sorted = useMemo(
    () => sortArtists(artists, pref, (id) => lastPlayedByArtist.get(id) ?? 0),
    [artists, pref, lastPlayedByArtist],
  );

  if (isLoading) {
    return <div className="flex items-center justify-center h-full text-[var(--color-text-muted)]">Loading...</div>;
  }

  if (artists.length === 0) {
    return <EmptyLibrary />;
  }

  return (
    <div className="h-full overflow-y-auto pb-4">
      <div className="flex items-end justify-between px-8 py-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Artists</h1>
          <p className="text-[var(--color-text-muted)] text-sm mt-1">{artists.length} artists</p>
        </div>
        <SortMenu options={OPTIONS} pref={pref} onToggle={toggle} />
      </div>
      <ArtistGrid artists={sorted} />
    </div>
  );
}
