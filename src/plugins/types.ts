import type React from "react";
import type { Track } from "@/types";

// ─── Manifest ─────────────────────────────────────────────────────────────────

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  api_version: string;
  description?: string;
  capabilities: PluginCapability[];
  frontend?: { entry: string; styles?: string };
  permissions: PluginPermissions;
  settings_schema?: object;
}

export type PluginCapability =
  | "audio_source"
  | "library_hooks"
  | "player_hooks"
  | "ui_components"
  | "ipc_commands";

export interface PluginPermissions {
  network: boolean;
  filesystem: boolean;
  exec_subprocess: boolean;
  read_library_db: boolean;
  write_library_db: boolean;
  player_control: boolean;
  player_observe: boolean;
}

// ─── Audio source types ───────────────────────────────────────────────────────

export interface PluginTrack {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration_secs: number;
  artwork_url?: string;
  needs_resolve: boolean;
  meta: unknown;
}

export interface PluginBrowseItem {
  id: string;
  label: string;
  kind: "collection" | "track";
  artwork_url?: string;
  track_count?: number;
}

export interface ResolvedStream {
  uri: string;
  content_type?: string;
  expires_at?: number;
  headers: Record<string, string>;
}

// ─── UI slot contribution types ───────────────────────────────────────────────

export interface PluginSidebarItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  /** Navigate to this route when clicked */
  route?: string;
  /** Called when clicked (used when no route is provided) */
  onClick?: () => void;
}

export interface PluginSettingsSection {
  id: string;
  label: string;
  component: React.ComponentType;
}

export interface PluginTrackContextMenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  onSelect: (track: Track) => void;
  enabled?: boolean;
}

export interface PluginNowPlayingAction {
  id: string;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  isActive?: boolean;
}

export interface PluginRoute {
  /** e.g. "plugins/com.example.foo/browse" — matched against the URL path */
  path: string;
  component: React.ComponentType;
}

export interface PluginUiContribution {
  sidebarItems?: PluginSidebarItem[];
  settingsSections?: PluginSettingsSection[];
  trackContextMenuItems?: PluginTrackContextMenuItem[];
  nowPlayingActions?: PluginNowPlayingAction[];
  routes?: PluginRoute[];
}

// ─── Plugin API surface ───────────────────────────────────────────────────────

export interface PluginApi {
  pluginId: string;
  /** Call a method on this plugin's subprocess via the plugin_dispatch IPC command. */
  invoke<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T>;
  /** Subscribe to a Tauri event emitted by this plugin's subprocess. Returns an unsubscribe fn. */
  onEvent(event: string, handler: (payload: unknown) => void): () => void;
  getSettings(): Promise<Record<string, unknown>>;
  saveSettings(settings: Record<string, unknown>): Promise<void>;
}

export interface PluginFrontendModule {
  register(api: PluginApi): PluginUiContribution;
}
