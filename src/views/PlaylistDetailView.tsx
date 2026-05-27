import { useParams } from "react-router";
import { ListMusic, Play } from "lucide-react";
import { usePlaylistQuery, usePlaylistTracksQuery, useReorderPlaylistTrack } from "@/queries/playlists";
import { usePlayerStore } from "@/store/playerStore";
import { formatTime } from "@/lib/formatTime";
import { TrackRow } from "@/components/tracks/TrackRow";

export function PlaylistDetailView() {
  const { id } = useParams<{ id: string }>();
  const { data: playlist } = usePlaylistQuery(id!);
  const { data: playlistTracks = [] } = usePlaylistTracksQuery(id!);
  const { playTrack } = usePlayerStore();

  const tracks = playlistTracks.map((pt) => pt.track);

  if (!playlist) {
    return <div className="flex items-center justify-center h-full text-[var(--color-text-muted)]">Loading...</div>;
  }

  return (
    <div className="h-full overflow-y-auto">
      {/* Header */}
      <div
        className="flex items-end gap-6 p-8 pb-6"
        style={{ background: "linear-gradient(180deg, rgba(30,60,114,0.6) 0%, var(--color-base) 100%)" }}
      >
        <div className="w-40 h-40 flex-shrink-0 rounded-lg bg-[var(--color-surface-elevated)] shadow-2xl flex items-center justify-center">
          <ListMusic size={48} className="text-[var(--color-text-dim)]" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)] mb-2">Playlist</p>
          <h1 className="text-4xl font-bold text-white mb-2">{playlist.name}</h1>
          {playlist.description && (
            <p className="text-[var(--color-text-muted)] text-sm mb-2">{playlist.description}</p>
          )}
          <p className="text-[var(--color-text-muted)] text-sm">
            {playlist.track_count} tracks · {formatTime(playlist.duration_secs)}
          </p>
        </div>
      </div>

      {/* Play button */}
      {tracks.length > 0 && (
        <div className="px-8 mb-4">
          <button
            onClick={() => playTrack(tracks[0], tracks, 0)}
            className="w-14 h-14 rounded-full bg-[var(--color-accent)] flex items-center justify-center hover:scale-105 transition-transform shadow-lg"
          >
            <Play size={24} fill="black" className="text-black ml-1" />
          </button>
        </div>
      )}

      {/* Track list */}
      <div className="px-4">
        {tracks.map((track, i) => (
          <TrackRow
            key={playlistTracks[i].id}
            track={track}
            index={i}
            queue={tracks}
          />
        ))}
      </div>
    </div>
  );
}
