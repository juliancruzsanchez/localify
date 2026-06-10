import { useMemo } from "react";
import { useAlbumsQuery } from "@/queries/albums";
import { useTracksQuery } from "@/queries/tracks";
import { AlbumGrid } from "@/components/albums/AlbumGrid";
import { EmptyLibrary } from "@/components/library/EmptyLibrary";
import { SortMenu, type SortOption } from "@/components/library/SortMenu";
import { useSortPref, type SortPref } from "@/hooks/useSortPref";
import type { Album } from "@/types";

type AlbumSortKey = "title" | "artist" | "recent";

const OPTIONS: SortOption<AlbumSortKey>[] = [
  { key: "title",  label: "A–Z" },
  { key: "artist", label: "Creator" },
  { key: "recent", label: "Recently played" },
];

function sortAlbums(
  albums:        Album[],
  pref:          SortPref<AlbumSortKey>,
  lastPlayedFor: (albumId: string) => number,
): Album[] {
  const cmpStr  = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: "base" });
  const dirMul  = pref.dir === "asc" ? 1 : -1;
  return [...albums].sort((a, b) => {
    switch (pref.key) {
      case "title":  return cmpStr(a.title, b.title) * dirMul;
      case "artist": return (cmpStr(a.artist_name, b.artist_name) || cmpStr(a.title, b.title)) * dirMul;
      case "recent": return (lastPlayedFor(b.id) - lastPlayedFor(a.id)) * (pref.dir === "desc" ? 1 : -1);
    }
  });
}

export function AlbumsView() {
  const { data: albums = [], isLoading } = useAlbumsQuery();
  const { data: tracks = [] } = useTracksQuery();
  const { pref, toggle } = useSortPref<AlbumSortKey>(
    "albums",
    { key: "title", dir: "asc" },
    (k) => (k === "recent" ? "desc" : "asc"),
  );

  const lastPlayedByAlbum = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of tracks) {
      if (!t.album_id) continue;
      const ts = t.last_played_at ?? 0;
      const cur = m.get(t.album_id) ?? 0;
      if (ts > cur) m.set(t.album_id, ts);
    }
    return m;
  }, [tracks]);

  const sorted = useMemo(
    () => sortAlbums(albums, pref, (id) => lastPlayedByAlbum.get(id) ?? 0),
    [albums, pref, lastPlayedByAlbum],
  );

  if (isLoading) {
    return <div className="flex items-center justify-center h-full text-[var(--color-text-muted)]">Loading...</div>;
  }

  if (albums.length === 0) {
    return <EmptyLibrary />;
  }

  return (
    <div className="h-full overflow-y-auto pb-4">
      <div className="flex items-end justify-between px-8 py-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Albums</h1>
          <p className="text-[var(--color-text-muted)] text-sm mt-1">{albums.length} albums</p>
        </div>
        <SortMenu options={OPTIONS} pref={pref} onToggle={toggle} />
      </div>
      <AlbumGrid albums={sorted} />
    </div>
  );
}
