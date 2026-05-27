import { Home, Music, Disc3, Mic2, ListMusic, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { useUiStore } from "@/store/uiStore";
import { usePlaylistsQuery } from "@/queries/playlists";
import { SidebarItem } from "./SidebarItem";
import { NavLink } from "react-router";
import { cn } from "@/lib/utils";
import { SIDEBAR_WIDTH, SIDEBAR_COLLAPSED_WIDTH } from "@/lib/constants";

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useUiStore();
  const { data: playlists = [] } = usePlaylistsQuery();

  const width = sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH;

  return (
    <aside
      className="flex flex-col h-full transition-all duration-200"
      style={{
        width,
        minWidth: width,
        maxWidth: width,
        background: "var(--color-sidebar-bg)",
        gridArea: "sidebar",
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
        <SidebarItem to="/search" icon={<Search size={20} />} label="Search" collapsed={sidebarCollapsed} />
        <SidebarItem to="/songs" icon={<Music size={20} />} label="Songs" collapsed={sidebarCollapsed} />
        <SidebarItem to="/albums" icon={<Disc3 size={20} />} label="Albums" collapsed={sidebarCollapsed} />
        <SidebarItem to="/artists" icon={<Mic2 size={20} />} label="Artists" collapsed={sidebarCollapsed} />
      </nav>

      {/* Divider */}
      <div className="mx-4 my-3 border-t border-[var(--color-border)]" />

      {/* Playlists section */}
      <div className="flex-1 overflow-y-auto px-2">
        {!sidebarCollapsed && (
          <div className="flex items-center justify-between px-1 mb-2">
            <span className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
              Playlists
            </span>
          </div>
        )}
        <nav className="space-y-1">
          {playlists.map((pl) => (
            <NavLink
              key={pl.id}
              to={`/playlists/${pl.id}`}
              title={sidebarCollapsed ? pl.name : undefined}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors truncate",
                  sidebarCollapsed ? "justify-center" : "",
                  isActive ? "text-white" : "text-[var(--color-text-muted)] hover:text-white",
                )
              }
            >
              <ListMusic size={16} className="flex-shrink-0" />
              {!sidebarCollapsed && <span className="truncate">{pl.name}</span>}
            </NavLink>
          ))}
        </nav>
      </div>
    </aside>
  );
}
