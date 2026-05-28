import { useTracksQuery } from "@/queries/tracks";
import { TrackList } from "@/components/tracks/TrackList";
import { EmptyLibrary } from "@/components/library/EmptyLibrary";

export function SongsView() {
  const { data: tracks = [], isLoading } = useTracksQuery();

  if (isLoading) {
    return <div className="flex items-center justify-center h-full text-[var(--color-text-muted)]">Loading...</div>;
  }

  if (tracks.length === 0) {
    return <EmptyLibrary />;
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-8 py-6 flex-shrink-0">
        <h1 className="text-3xl font-bold text-white">Songs</h1>
        <span className="text-[var(--color-text-muted)] text-sm">{tracks.length} tracks</span>
      </div>
      <TrackList tracks={tracks} />
    </div>
  );
}
