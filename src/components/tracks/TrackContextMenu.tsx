import * as ContextMenu from "@radix-ui/react-context-menu";
import { Play, ListEnd, ListStart, ListPlus, ChevronRight, Disc3, User, Heart, HeartOff } from "lucide-react";
import { useNavigate } from "react-router";
import { cn } from "@/lib/utils";
import { usePlayerStore } from "@/store/playerStore";
import { usePlaylistsQuery, useAddTrackToPlaylist } from "@/queries/playlists";
import { useIsLiked, useLikeTrack, useUnlikeTrack } from "@/queries/liked";
import type { Track } from "@/types";

interface TrackContextMenuProps {
  track: Track;
  queue: Track[];
  queueIndex: number;
  children: React.ReactNode;
}

export function TrackContextMenu({ track, queue, queueIndex, children }: TrackContextMenuProps) {
  const navigate = useNavigate();
  const { playTrack, playAfterCurrent, addToQueue } = usePlayerStore();
  const { data: playlists = [] } = usePlaylistsQuery();
  const { mutate: addToPlaylist } = useAddTrackToPlaylist();
  const isLiked = useIsLiked(track.id);
  const { mutate: likeTrack } = useLikeTrack();
  const { mutate: unlikeTrack } = useUnlikeTrack();

  const handlePlay = () => {
    playTrack(track, queue, queueIndex);
  };

  const handlePlayNext = () => {
    playAfterCurrent(track);
  };

  const handleAddToQueue = () => {
    addToQueue(track);
  };

  const handleAddToPlaylist = (playlistId: string) => {
    addToPlaylist({ playlistId, trackId: track.id });
  };

  const handleGoToAlbum = () => {
    if (track.album_id) navigate(`/albums/${track.album_id}`);
  };

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>{children}</ContextMenu.Trigger>

      <ContextMenu.Portal>
        <ContextMenu.Content
          className={cn(
            "z-50 min-w-[220px] overflow-hidden rounded-md py-1",
            "bg-[#282828] shadow-xl shadow-black/50 border border-white/10",
            "text-sm text-white",
          )}
        >
          {/* Play */}
          <MenuItem icon={<Play size={15} fill="currentColor" />} onSelect={handlePlay}>
            Play
          </MenuItem>

          {/* Play Next */}
          <MenuItem icon={<ListStart size={15} />} onSelect={handlePlayNext}>
            Play next
          </MenuItem>

          {/* Add to Queue */}
          <MenuItem icon={<ListEnd size={15} />} onSelect={handleAddToQueue}>
            Add to queue
          </MenuItem>

          <Separator />

          {/* Add to Playlist submenu */}
          <ContextMenu.Sub>
            <ContextMenu.SubTrigger
              className={cn(
                "flex items-center gap-3 px-3 py-2 cursor-default select-none outline-none",
                "hover:bg-white/10 focus:bg-white/10",
                "data-[state=open]:bg-white/10",
              )}
            >
              <span className="flex-shrink-0 text-[var(--color-text-muted)]">
                <ListPlus size={15} />
              </span>
              <span className="flex-1">Add to playlist</span>
              <span className="text-[var(--color-text-muted)]">
                <ChevronRight size={14} />
              </span>
            </ContextMenu.SubTrigger>

            <ContextMenu.Portal>
              <ContextMenu.SubContent
                className={cn(
                  "z-50 min-w-[180px] overflow-hidden rounded-md py-1",
                  "bg-[#282828] shadow-xl shadow-black/50 border border-white/10",
                  "text-sm text-white",
                  "animate-in fade-in-0 zoom-in-95",
                )}
                sideOffset={2}
                alignOffset={-4}
              >
                {playlists.length === 0 ? (
                  <div className="px-3 py-2 text-[var(--color-text-muted)] text-xs italic">
                    No playlists yet
                  </div>
                ) : (
                  playlists.map((pl) => (
                    <MenuItem
                      key={pl.id}
                      onSelect={() => handleAddToPlaylist(pl.id)}
                    >
                      {pl.name}
                    </MenuItem>
                  ))
                )}
              </ContextMenu.SubContent>
            </ContextMenu.Portal>
          </ContextMenu.Sub>

          <Separator />

          {/* Like / Unlike */}
          {isLiked ? (
            <MenuItem
              icon={<HeartOff size={15} />}
              onSelect={() => unlikeTrack(track.id)}
            >
              Remove from Liked Songs
            </MenuItem>
          ) : (
            <MenuItem
              icon={<Heart size={15} />}
              onSelect={() => likeTrack(track.id)}
            >
              Add to Liked Songs
            </MenuItem>
          )}

          <Separator />

          {/* Go to Album */}
          {track.album_id && (
            <MenuItem icon={<Disc3 size={15} />} onSelect={handleGoToAlbum}>
              Go to album
            </MenuItem>
          )}

          {/* Go to Artist — label only; navigates via artist search by name */}
          {track.artist && (
            <MenuItem
              icon={<User size={15} />}
              onSelect={() => navigate(`/artists`)}
            >
              Go to artist
            </MenuItem>
          )}
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface MenuItemProps {
  children: React.ReactNode;
  icon?: React.ReactNode;
  onSelect?: () => void;
  disabled?: boolean;
}

function MenuItem({ children, icon, onSelect, disabled }: MenuItemProps) {
  return (
    <ContextMenu.Item
      onSelect={onSelect}
      disabled={disabled}
      className={cn(
        "flex items-center gap-3 px-3 py-2 cursor-default select-none outline-none",
        "hover:bg-white/10 focus:bg-white/10",
        "disabled:opacity-40 disabled:pointer-events-none",
      )}
    >
      {icon && (
        <span className="flex-shrink-0 text-[var(--color-text-muted)]">{icon}</span>
      )}
      <span className="flex-1">{children}</span>
    </ContextMenu.Item>
  );
}

function Separator() {
  return <ContextMenu.Separator className="my-1 h-px bg-white/10 mx-1" />;
}
