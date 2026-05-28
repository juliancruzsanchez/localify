import { create } from "zustand";

interface UiStore {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  queueOpen: boolean;
  toggleQueue: () => void;
  albumArtExpanded: boolean;
  setAlbumArtExpanded: (v: boolean) => void;
}

export const useUiStore = create<UiStore>((set) => ({
  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  queueOpen: false,
  toggleQueue: () => set((s) => ({ queueOpen: !s.queueOpen })),
  albumArtExpanded: false,
  setAlbumArtExpanded: (v) => set({ albumArtExpanded: v }),
}));
