import { useAlbumsQuery } from "@/queries/albums";
import { AlbumGrid } from "@/components/albums/AlbumGrid";
import { EmptyLibrary } from "@/components/library/EmptyLibrary";

export function AlbumsView() {
  const { data: albums = [], isLoading } = useAlbumsQuery();

  if (isLoading) {
    return <div className="flex items-center justify-center h-full text-[var(--color-text-muted)]">Loading...</div>;
  }

  if (albums.length === 0) {
    return <EmptyLibrary />;
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-8 py-6">
        <h1 className="text-3xl font-bold text-white">Albums</h1>
        <p className="text-[var(--color-text-muted)] text-sm mt-1">{albums.length} albums</p>
      </div>
      <AlbumGrid albums={albums} />
    </div>
  );
}
