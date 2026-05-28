import * as ContextMenu from "@radix-ui/react-context-menu";
import { Play, ListEnd, ListPlus, ChevronRight, Heart, Library, Disc3 } from "lucide-react";
import { useNavigate } from "react-router";
import { cn } from "@/lib/utils";
import { usePlayerStore } from "@/store/playerStore";
import { usePlaylistsQuery, useAddTrackToPlaylist } from "@/queries/playlists";
import { useLikedTrackIds, useLikeTrack, useUnlikeTrack } from "@/queries/liked";
import { useAlbumTracksQuery } from "@/queries/albums";
import type { Album } from "@/types";

interface AlbumContextMenuProps {
  album: Album;
  children: React.ReactNode;
}

function MenuItem({ children, icon, onSelect, disabled }: {
  children: React.ReactNode;
  icon?: React.ReactNode;
  onSelect?: () => void;
  disabled?: boolean;
}) {
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
      {icon && <span className="flex-shrink-0 text-[var(--color-text-muted)]">{icon}</span>}
      <span className="flex-1">{children}</span>
    </ContextMenu.Item>
  );
}

function Separator() {
  return <ContextMenu.Separator className="my-1 h-px bg-white/10 mx-1" />;
}

export function AlbumContextMenu({ album, children }: AlbumContextMenuProps) {
  const navigate = useNavigate();
  const { playTrack, addToQueue } = usePlayerStore();
  const { data: tracks = [] } = useAlbumTracksQuery(album.id);
  const { data: playlists = [] } = usePlaylistsQuery();
  const { mutate: addToPlaylist } = useAddTrackToPlaylist();
  const likedIds = useLikedTrackIds();
  const { mutate: likeTrack } = useLikeTrack();
  const { mutate: unlikeTrack } = useUnlikeTrack();

  const allTrackIds = tracks.map((t) => t.id);
  const allLiked = allTrackIds.length > 0 && allTrackIds.every((id) => likedIds.includes(id));

  const handlePlay = () => {
    if (tracks.length > 0) playTrack(tracks[0], tracks, 0);
  };

  const handleAddToQueue = () => {
    tracks.forEach((t) => addToQueue(t));
  };

  const handleToggleLiked = () => {
    if (allLiked) {
      allTrackIds.forEach((id) => unlikeTrack(id));
    } else {
      allTrackIds.forEach((id) => likeTrack(id));
    }
  };

  const handleAddToPlaylist = (playlistId: string) => {
    tracks.forEach((t) => addToPlaylist({ playlistId, trackId: t.id }));
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
          <MenuItem icon={<Play size={15} fill="currentColor" />} onSelect={handlePlay}>
            Play
          </MenuItem>

          <MenuItem icon={<ListEnd size={15} />} onSelect={handleAddToQueue}>
            Add to queue
          </MenuItem>

          <Separator />

          <MenuItem
            icon={<Library size={15} />}
            onSelect={handleToggleLiked}
          >
            {allLiked ? "Remove from Liked Songs" : "Add to Liked Songs"}
          </MenuItem>

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

          <MenuItem
            icon={<Disc3 size={15} />}
            onSelect={() => navigate(`/albums/${album.id}`)}
          >
            Go to album
          </MenuItem>
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
