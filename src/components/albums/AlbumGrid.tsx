import type { Album } from "@/types";
import { AlbumCard } from "./AlbumCard";

interface AlbumGridProps {
  albums: Album[];
}

export function AlbumGrid({ albums }: AlbumGridProps) {
  return (
    <div
      className="grid gap-4 p-4"
      style={{
        gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
      }}
    >
      {albums.map((album) => (
        <AlbumCard key={album.id} album={album} />
      ))}
    </div>
  );
}
