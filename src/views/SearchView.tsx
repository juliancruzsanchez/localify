import { useState } from "react";
import { SearchInput } from "@/components/search/SearchInput";
import { useSearchQuery } from "@/queries/search";
import { useDebounce } from "@/hooks/useDebounce";
import { TrackRow } from "@/components/tracks/TrackRow";
import { AlbumCard } from "@/components/albums/AlbumCard";
import { ArtistCard } from "@/components/artists/ArtistCard";

export function SearchView() {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 300);
  const { data: results, isLoading } = useSearchQuery(debouncedQuery);

  const hasResults = results && (
    results.tracks.length > 0 || results.albums.length > 0 || results.artists.length > 0
  );

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-8 py-6">
        <h1 className="text-3xl font-bold text-white mb-4">Search</h1>
        <SearchInput value={query} onChange={setQuery} />
      </div>

      {isLoading && debouncedQuery && (
        <div className="px-8 text-[var(--color-text-muted)]">Searching...</div>
      )}

      {!isLoading && debouncedQuery && !hasResults && (
        <div className="px-8 text-[var(--color-text-muted)]">No results found for "{debouncedQuery}"</div>
      )}

      {results && (
        <div className="px-8 space-y-8">
          {results.tracks.length > 0 && (
            <section>
              <h2 className="text-xl font-bold text-white mb-3">Songs</h2>
              <div>
                {results.tracks.map((track, i) => (
                  <TrackRow key={track.id} track={track} index={i} queue={results.tracks} />
                ))}
              </div>
            </section>
          )}

          {results.albums.length > 0 && (
            <section>
              <h2 className="text-xl font-bold text-white mb-3">Albums</h2>
              <div
                className="grid gap-4"
                style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}
              >
                {results.albums.map((album) => (
                  <AlbumCard key={album.id} album={album} />
                ))}
              </div>
            </section>
          )}

          {results.artists.length > 0 && (
            <section>
              <h2 className="text-xl font-bold text-white mb-3">Artists</h2>
              <div
                className="grid gap-4"
                style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}
              >
                {results.artists.map((artist) => (
                  <ArtistCard key={artist.id} artist={artist} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
