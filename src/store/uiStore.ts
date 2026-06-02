import { create } from "zustand";
import type { DownloadState } from "@/queries/ytdlp";

interface UiStore {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  queueOpen: boolean;
  toggleQueue: () => void;
  albumArtExpanded: boolean;
  setAlbumArtExpanded: (v: boolean) => void;
  settingsOpen: boolean;
  setSettingsOpen: (v: boolean) => void;
  shortcutsModalOpen: boolean;
  setShortcutsModalOpen: (v: boolean) => void;
  createPlaylistOpen: boolean;
  setCreatePlaylistOpen: (v: boolean) => void;
  downloads: Record<string, DownloadState>;
  setDownload: (videoId: string, state: DownloadState) => void;
}

export const useUiStore = create<UiStore>((set) => ({
  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  queueOpen: false,
  toggleQueue: () => set((s) => ({ queueOpen: !s.queueOpen })),
  albumArtExpanded: false,
  setAlbumArtExpanded: (v) => set({ albumArtExpanded: v }),
  settingsOpen: false,
  setSettingsOpen: (v) => set({ settingsOpen: v }),
  shortcutsModalOpen: false,
  setShortcutsModalOpen: (v) => set({ shortcutsModalOpen: v }),
  createPlaylistOpen: false,
  setCreatePlaylistOpen: (v) => set({ createPlaylistOpen: v }),
  downloads: {},
  setDownload: (videoId, state) =>
    set((s) => ({ downloads: { ...s.downloads, [videoId]: state } })),
}));
