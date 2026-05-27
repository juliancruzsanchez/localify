import type { Artist } from "@/types";
import { ArtistCard } from "./ArtistCard";

interface ArtistGridProps {
  artists: Artist[];
}

export function ArtistGrid({ artists }: ArtistGridProps) {
  return (
    <div
      className="grid gap-4 p-4"
      style={{
        gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
      }}
    >
      {artists.map((artist) => (
        <ArtistCard key={artist.id} artist={artist} />
      ))}
    </div>
  );
}
