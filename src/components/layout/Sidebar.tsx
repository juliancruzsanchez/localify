import { Home, Music, Disc3, Mic2, ListMusic, Heart, ChevronLeft, ChevronRight, Plus, ChevronDown } from "lucide-react";
import { useDroppable } from "@dnd-kit/core";
import { useUiStore } from "@/store/uiStore";
import { usePlaylistsQuery } from "@/queries/playlists";
import { useLikedTrackIds } from "@/queries/liked";
import { SidebarItem } from "./SidebarItem";
import { NavLink } from "react-router";
import { cn } from "@/lib/utils";
import { SIDEBAR_WIDTH, SIDEBAR_COLLAPSED_WIDTH } from "@/lib/constants";
import { CreatePlaylistDialog } from "@/components/playlists/CreatePlaylistDialog";
import { PlaylistContextMenu } from "@/components/playlists/PlaylistContextMenu";
import { usePlayerStore } from "@/store/playerStore";
import { useArtworkUrl } from "@/hooks/useArtworkUrl";
import { usePluginRegistrySnapshot } from "@/plugins/PluginRegistryContext";
import { toAssetUrl } from "@/lib/assetUrl";
import { useCoverImage } from "@/hooks/useCoverImage";
import type { Playlist } from "@/types";

function PlaylistNavLink({ playlist, collapsed }: { playlist: Playlist; collapsed: boolean }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `playlist-${playlist.id}`,
    data: { type: "playlist", playlistId: playlist.id },
  });
  const coverDataUrl = useCoverImage(playlist.cover_path);

  return (
    <PlaylistContextMenu playlist={playlist}>
      <NavLink
        ref={setNodeRef}
        to={`/playlists/${playlist.id}`}
        title={collapsed ? playlist.name : undefined}
        className={({ isActive }) =>
          cn(
            "flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors",
            collapsed ? "justify-center" : "",
            isActive
              ? "bg-white/10 text-white"
              : "text-[var(--color-text-muted)] hover:text-white hover:bg-white/5",
            isOver && "ring-2 ring-[var(--color-accent)] bg-white/10",
          )
        }
      >
        <div className="w-8 h-8 flex-shrink-0 rounded overflow-hidden bg-[var(--color-surface-elevated)] flex items-center justify-center">
          {coverDataUrl ? (
            <img
              src={coverDataUrl}
              className="w-full h-full object-cover"
              alt=""
              draggable={false}
            />
          ) : (
            <ListMusic size={14} className="text-[var(--color-text-dim)]" />
          )}
        </div>
        {!collapsed && <span className="truncate leading-tight">{playlist.name}</span>}
      </NavLink>
    </PlaylistContextMenu>
  );
}

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar, albumArtExpanded, setAlbumArtExpanded } = useUiStore();
  const { data: playlists = [] } = usePlaylistsQuery();
  const { data: likedIds = [] } = useLikedTrackIds();
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const artworkPath = useArtworkUrl(currentTrack?.artwork_hash);
  const pluginRegistry = usePluginRegistrySnapshot();
  const pluginSidebarItems = pluginRegistry.getSidebarItems();

  const width = sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH;

  return (
    <aside
      className="flex flex-col overflow-hidden transition-all duration-200"
      style={{
        width,
        minWidth: width,
        maxWidth: width,
        background: "var(--color-sidebar-bg)",
        gridArea: "sidebar",
        borderRadius: "12px",
      }}
    >
      {/* Logo / toggle */}
      <div className={cn("flex items-center p-4", sidebarCollapsed ? "justify-center" : "justify-between")}>
        {!sidebarCollapsed && (
          <span className="text-white font-bold text-lg tracking-tight">Localify</span>
        )}
        <button
          onClick={toggleSidebar}
          className="text-[var(--color-text-muted)] hover:text-white transition-colors p-1 rounded"
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      {/* Main nav */}
      <nav className="px-2 space-y-1">
        <SidebarItem to="/" icon={<Home size={20} />} label="Home" collapsed={sidebarCollapsed} />
        <SidebarItem to="/songs" icon={<Music size={20} />} label="Songs" collapsed={sidebarCollapsed} />
        <SidebarItem to="/albums" icon={<Disc3 size={20} />} label="Albums" collapsed={sidebarCollapsed} />
        <SidebarItem to="/artists" icon={<Mic2 size={20} />} label="Artists" collapsed={sidebarCollapsed} />
      </nav>

      {/* Plugin sidebar items */}
      {pluginSidebarItems.length > 0 && (
        <>
          <div className="mx-4 my-2 border-t border-[var(--color-border)]" />
          <nav className="px-2 space-y-1">
            {pluginSidebarItems.map((item) =>
              item.route ? (
                <SidebarItem
                  key={item.id}
                  to={item.route}
                  icon={item.icon}
                  label={item.label}
                  collapsed={sidebarCollapsed}
                />
              ) : (
                <button
                  key={item.id}
                  onClick={item.onClick}
                  title={sidebarCollapsed ? item.label : undefined}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors hover:text-white text-[var(--color-text-muted)]",
                    sidebarCollapsed ? "justify-center" : "",
                  )}
                >
                  <span className="flex-shrink-0 w-5 h-5">{item.icon}</span>
                  {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                </button>
              )
            )}
          </nav>
        </>
      )}

      {/* Divider */}
      <div className="mx-4 my-3 border-t border-[var(--color-border)]" />

      {/* Playlists section */}
      <div className="flex-1 overflow-y-auto px-2">
        {!sidebarCollapsed && (
          <div className="flex items-center justify-between px-1 mb-2">
            <span className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
              Playlists
            </span>
            <CreatePlaylistDialog>
              <button
                className="text-[var(--color-text-muted)] hover:text-white transition-colors p-0.5 rounded"
                aria-label="Create playlist"
                title="Create playlist"
              >
                <Plus size={16} />
              </button>
            </CreatePlaylistDialog>
          </div>
        )}
        {sidebarCollapsed && (
          <CreatePlaylistDialog>
            <button
              className="w-full flex justify-center text-[var(--color-text-muted)] hover:text-white transition-colors py-2"
              aria-label="Create playlist"
              title="Create playlist"
            >
              <Plus size={16} />
            </button>
          </CreatePlaylistDialog>
        )}
        <nav className="space-y-1">
          {playlists.map((pl) => (
            <PlaylistNavLink key={pl.id} playlist={pl} collapsed={sidebarCollapsed} />
          ))}
        </nav>
      </div>

      {/* Liked Songs – album-style card, pinned below playlists */}
      <div className="px-2 py-2 flex-shrink-0">
        <NavLink
          to="/liked"
          title={sidebarCollapsed ? "Liked Songs" : undefined}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 px-2 py-2 rounded-md text-sm transition-colors",
              sidebarCollapsed ? "justify-center" : "",
              isActive ? "bg-white/10 text-white" : "hover:bg-white/5 text-[var(--color-text-muted)] hover:text-white",
            )
          }
        >
          {/* Purple heart thumbnail */}
          <div
            className="w-10 h-10 flex-shrink-0 rounded flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #7c3aed 0%, #4c1d95 100%)" }}
          >
            <Heart size={16} className="text-white" fill="white" />
          </div>
          {!sidebarCollapsed && (
            <div className="min-w-0">
              <p className="text-white text-sm font-medium truncate leading-tight">Liked Songs</p>
              <p className="text-[var(--color-text-muted)] text-xs truncate">
                Playlist · {likedIds.length} songs
              </p>
            </div>
          )}
        </NavLink>
      </div>

      {/* Expanded album art panel */}
      {albumArtExpanded && !sidebarCollapsed && currentTrack && (
        <div className="flex-shrink-0 relative" style={{ width: "100%" }}>
          {/* Collapse button */}
          <button
            onClick={() => setAlbumArtExpanded(false)}
            className="absolute top-2 right-2 z-10 w-7 h-7 flex items-center justify-center rounded-full bg-black/50 text-white/70 hover:text-white hover:bg-black/70 transition-colors"
            aria-label="Collapse album art"
          >
            <ChevronDown size={16} />
          </button>
          {/* Square album art filling sidebar width */}
          <div className="w-full aspect-square overflow-hidden bg-[var(--color-surface-elevated)]">
            {artworkPath ? (
              <img
                src={toAssetUrl(artworkPath)}
                alt={currentTrack.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Music size={48} className="text-[var(--color-text-dim)]" />
              </div>
            )}
          </div>
          {/* Track info below art */}
          <div className="px-4 py-3">
            <p className="text-white text-sm font-semibold truncate">{currentTrack.title}</p>
            <p className="text-[var(--color-text-muted)] text-xs truncate">{currentTrack.artist}</p>
          </div>
        </div>
      )}
    </aside>
  );
}
