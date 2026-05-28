import * as ContextMenu from "@radix-ui/react-context-menu";
import { ListEnd, ListPlus, Trash2, FolderInput } from "lucide-react";
import { useNavigate } from "react-router";
import { cn } from "@/lib/utils";
import { usePlayerStore } from "@/store/playerStore";
import { useDeletePlaylist } from "@/queries/playlists";
import { usePlaylistTracksQuery } from "@/queries/playlists";
import type { Playlist } from "@/types";

interface PlaylistContextMenuProps {
  playlist: Playlist;
  children: React.ReactNode;
}

function MenuItem({ children, icon, onSelect, disabled, danger }: {
  children: React.ReactNode;
  icon?: React.ReactNode;
  onSelect?: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <ContextMenu.Item
      onSelect={onSelect}
      disabled={disabled}
      className={cn(
        "flex items-center gap-3 px-3 py-2 cursor-default select-none outline-none",
        "hover:bg-white/10 focus:bg-white/10",
        "disabled:opacity-40 disabled:pointer-events-none",
        danger && "hover:bg-red-500/20 focus:bg-red-500/20",
      )}
    >
      {icon && (
        <span className={cn("flex-shrink-0", danger ? "text-red-400" : "text-[var(--color-text-muted)]")}>
          {icon}
        </span>
      )}
      <span className={cn("flex-1", danger && "text-red-400")}>{children}</span>
    </ContextMenu.Item>
  );
}

function Separator() {
  return <ContextMenu.Separator className="my-1 h-px bg-white/10 mx-1" />;
}

export function PlaylistContextMenu({ playlist, children }: PlaylistContextMenuProps) {
  const navigate = useNavigate();
  const { addToQueue } = usePlayerStore();
  const { data: playlistTracks = [] } = usePlaylistTracksQuery(playlist.id);
  const { mutate: deletePlaylist } = useDeletePlaylist();

  const tracks = playlistTracks.map((pt) => pt.track);

  const handleAddToQueue = () => {
    tracks.forEach((t) => addToQueue(t));
  };

  const handleDelete = () => {
    deletePlaylist(playlist.id);
    navigate("/");
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
          {tracks.length > 0 && (
            <MenuItem icon={<ListEnd size={15} />} onSelect={handleAddToQueue}>
              Add to queue
            </MenuItem>
          )}

          <MenuItem
            icon={<FolderInput size={15} />}
            onSelect={() => navigate(`/playlists/${playlist.id}`)}
          >
            Open playlist
          </MenuItem>

          <Separator />

          <MenuItem
            icon={<Trash2 size={15} />}
            onSelect={handleDelete}
            danger
          >
            Delete
          </MenuItem>
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
