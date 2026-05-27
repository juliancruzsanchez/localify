import { useArtistsQuery } from "@/queries/artists";
import { ArtistGrid } from "@/components/artists/ArtistGrid";
import { EmptyLibrary } from "@/components/library/EmptyLibrary";

export function ArtistsView() {
  const { data: artists = [], isLoading } = useArtistsQuery();

  if (isLoading) {
    return <div className="flex items-center justify-center h-full text-[var(--color-text-muted)]">Loading...</div>;
  }

  if (artists.length === 0) {
    return <EmptyLibrary />;
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-8 py-6">
        <h1 className="text-3xl font-bold text-white">Artists</h1>
        <p className="text-[var(--color-text-muted)] text-sm mt-1">{artists.length} artists</p>
      </div>
      <ArtistGrid artists={artists} />
    </div>
  );
}
