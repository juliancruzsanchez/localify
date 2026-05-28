import { useState } from "react";
import { useParams } from "react-router";
import { Play, Shuffle, Pencil, Camera, X, Check, Loader2, Download } from "lucide-react";
import { open as openFileDialog, save as saveFileDialog } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { usePlaylistQuery, usePlaylistTracksQuery, useReorderPlaylistTrack, useUpdatePlaylist, useSetPlaylistCover } from "@/queries/playlists";
import { usePlayerStore } from "@/store/playerStore";
import { formatTime } from "@/lib/formatTime";
import { TrackRow } from "@/components/tracks/TrackRow";
import { PlaylistCover } from "@/components/playlists/PlaylistCover";
import { cn } from "@/lib/utils";

export function PlaylistDetailView() {
  const { id } = useParams<{ id: string }>();
  const { data: playlist } = usePlaylistQuery(id!);
  const { data: playlistTracks = [] } = usePlaylistTracksQuery(id!);
  const { playTrack, shuffleEnabled, toggleShuffle } = usePlayerStore();

  const updatePlaylist  = useUpdatePlaylist();
  const setCover        = useSetPlaylistCover();

  // ── inline editing ─────────────────────────────────────────────────────────
  const [editing, setEditing]           = useState(false);
  const [editName, setEditName]         = useState("");
  const [editDescription, setEditDescription] = useState("");

  const startEdit = () => {
    if (!playlist) return;
    setEditName(playlist.name);
    setEditDescription(playlist.description ?? "");
    setEditing(true);
  };

  const cancelEdit = () => setEditing(false);

  const saveEdit = () => {
    if (!playlist || !editName.trim()) return;
    updatePlaylist.mutate(
      { id: playlist.id, name: editName.trim(), description: editDescription.trim() || null },
      { onSuccess: () => setEditing(false) },
    );
  };

  // ── cover editing ───────────────────────────────────────────────────────────
  const [coverHover, setCoverHover] = useState(false);

  const pickCover = async () => {
    if (!playlist) return;
    const picked = await openFileDialog({
      multiple: false,
      filters: [{ name: "Images", extensions: ["jpg", "jpeg", "png", "webp", "gif"] }],
    });
    if (!picked) return;
    // plugin-dialog returns a string path (or FileResponse object in some versions)
    const sourcePath = typeof picked === "string" ? picked : (picked as { path: string }).path;
    setCover.mutate({ id: playlist.id, sourcePath });
  };

  const removeCover = () => {
    if (!playlist) return;
    setCover.mutate({ id: playlist.id, sourcePath: null });
  };

  const [exporting, setExporting] = useState(false);

  const exportM3u8 = async () => {
    if (!playlist) return;
    const destPath = await saveFileDialog({
      defaultPath: `${playlist.name}.m3u8`,
      filters: [{ name: "Playlist", extensions: ["m3u8"] }],
    });
    if (!destPath) return;
    setExporting(true);
    try {
      await invoke("export_playlist_m3u8", { playlistId: playlist.id, destPath });
      console.log("[Localify] Exported playlist to", destPath);
    } finally {
      setExporting(false);
    }
  };

  const tracks = playlistTracks.map((pt) => pt.track);

  if (!playlist) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--color-text-muted)]">
        Loading…
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto pb-4">
      {/* Header */}
      <div
        className="flex items-end gap-6 p-8 pb-6"
        style={{ background: "linear-gradient(180deg, rgba(30,60,114,0.6) 0%, var(--color-base) 100%)" }}
      >
        {/* Cover art — hover reveals change/remove buttons */}
        <div
          className="relative w-40 h-40 flex-shrink-0 rounded-lg shadow-2xl shadow-black/60 overflow-hidden cursor-pointer group"
          onMouseEnter={() => setCoverHover(true)}
          onMouseLeave={() => setCoverHover(false)}
        >
          <PlaylistCover playlist={playlist} tracks={tracks} />

          {/* Overlay on hover */}
          <div
            className={cn(
              "absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-2 transition-opacity",
              coverHover ? "opacity-100" : "opacity-0",
            )}
          >
            <button
              onClick={pickCover}
              disabled={setCover.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white/20 hover:bg-white/30 text-white text-xs font-semibold transition-colors"
              title="Change cover"
            >
              {setCover.isPending
                ? <Loader2 size={13} className="animate-spin" />
                : <Camera size={13} />}
              Change cover
            </button>

            {playlist.cover_path && (
              <button
                onClick={removeCover}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white/10 hover:bg-red-500/40 text-white text-xs transition-colors"
                title="Remove cover"
              >
                <X size={13} />
                Remove
              </button>
            )}
          </div>
        </div>

        {/* Name + description */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)] mb-2">
            Playlist
          </p>

          {editing ? (
            /* ── Edit mode ── */
            <div className="space-y-2">
              <input
                autoFocus
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveEdit();
                  if (e.key === "Escape") cancelEdit();
                }}
                className={cn(
                  "w-full bg-transparent border-b border-[var(--color-accent)] text-3xl font-bold text-white",
                  "outline-none pb-0.5 placeholder:text-white/30",
                )}
                placeholder="Playlist name"
              />
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={2}
                className={cn(
                  "w-full bg-transparent border border-[var(--color-border)] rounded-lg text-sm",
                  "text-[var(--color-text-muted)] outline-none px-2 py-1.5 resize-none",
                  "focus:border-[var(--color-accent)]/60 placeholder:text-white/20",
                )}
                placeholder="Add a description…"
              />
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={saveEdit}
                  disabled={!editName.trim() || updatePlaylist.isPending}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold",
                    "bg-[var(--color-accent)] text-white hover:opacity-90 disabled:opacity-40 transition",
                  )}
                >
                  {updatePlaylist.isPending
                    ? <Loader2 size={12} className="animate-spin" />
                    : <Check size={12} />}
                  Save
                </button>
                <button
                  onClick={cancelEdit}
                  className="px-3 py-1.5 rounded-lg text-xs text-[var(--color-text-muted)] hover:text-white hover:bg-white/5 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            /* ── Display mode ── */
            <div className="group/name flex items-start gap-2">
              <div className="min-w-0">
                <h1 className="text-4xl font-bold text-white mb-1 break-words">{playlist.name}</h1>
                {playlist.description && (
                  <p className="text-[var(--color-text-muted)] text-sm mb-2">{playlist.description}</p>
                )}
                <p className="text-[var(--color-text-muted)] text-sm">
                  {playlist.track_count} tracks · {formatTime(playlist.duration_secs)}
                </p>
              </div>
              <button
                onClick={startEdit}
                className="mt-1 flex-shrink-0 p-1.5 rounded-md text-[var(--color-text-dim)] hover:text-white hover:bg-white/10 opacity-0 group-hover/name:opacity-100 transition-all"
                title="Edit name & description"
              >
                <Pencil size={15} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Play button + Export button */}
      {tracks.length > 0 && (
        <div className="px-8 mb-4 flex items-center gap-3">
          <button
            onClick={() => playTrack(tracks[0], tracks, 0)}
            className="w-14 h-14 rounded-full bg-[var(--color-accent)] flex items-center justify-center hover:scale-105 transition-transform shadow-lg"
          >
            <Play size={24} fill="black" className="text-black ml-1" />
          </button>
          <button
            onClick={toggleShuffle}
            className={cn(
              "relative flex items-center justify-center w-10 h-10 rounded-full transition-colors",
              shuffleEnabled
                ? "text-[var(--color-accent)] bg-white/10"
                : "text-[var(--color-text-muted)] hover:text-white hover:bg-white/5",
            )}
            aria-label="Toggle shuffle"
          >
            <Shuffle size={22} />
            {shuffleEnabled && (
              <span className="absolute -bottom-0.5 w-1 h-1 rounded-full bg-[var(--color-accent)]" />
            )}
          </button>
          <button
            onClick={exportM3u8}
            disabled={exporting}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-[var(--color-text-muted)] hover:text-white hover:bg-white/10 disabled:opacity-40 transition-colors"
            title="Export as M3U8…"
          >
            {exporting
              ? <Loader2 size={16} className="animate-spin" />
              : <Download size={16} />}
            Export M3U8
          </button>
        </div>
      )}

      {/* Track list */}
      <div className="px-4">
        {tracks.length === 0 ? (
          <p className="text-center py-12 text-[var(--color-text-muted)] text-sm">
            This playlist is empty. Add songs from any track's context menu.
          </p>
        ) : (
          tracks.map((track, i) => (
            <TrackRow
              key={playlistTracks[i].id}
              track={track}
              index={i}
              queue={tracks}
            />
          ))
        )}
      </div>
    </div>
  );
}
