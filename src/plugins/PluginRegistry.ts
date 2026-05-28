import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { PluginManifest, PluginUiContribution, PluginApi } from "./types";

// ─── PluginRegistry ───────────────────────────────────────────────────────────
//
// Singleton that:
//  1. Fetches all installed plugin manifests from the backend on startup.
//  2. Accepts UI contributions registered by bundled/built-in plugins.
//  3. Exposes aggregated slot accessors for layout components.
//  4. Notifies subscribers when the plugin list changes.

export class PluginRegistry {
  private static instance: PluginRegistry;

  private manifests = new Map<string, PluginManifest>();
  private contributions = new Map<string, PluginUiContribution>();
  private changeListeners = new Set<() => void>();
  private _initialized = false;

  static getInstance(): PluginRegistry {
    if (!PluginRegistry.instance) {
      PluginRegistry.instance = new PluginRegistry();
    }
    return PluginRegistry.instance;
  }

  get initialized(): boolean { return this._initialized; }

  async initialize(): Promise<void> {
    if (this._initialized) return;
    this._initialized = true;

    try {
      const manifests = await invoke<PluginManifest[]>("plugin_list");
      for (const m of manifests) {
        this.manifests.set(m.id, m);
      }
    } catch (e) {
      console.error("[PluginRegistry] Failed to fetch plugin list:", e);
    }

    // Keep the list in sync if plugins are installed/uninstalled at runtime.
    listen<{ id: string; name: string; version: string }>("plugin:loaded", () => {
      void invoke<PluginManifest[]>("plugin_list").then((all) => {
        for (const m of all) this.manifests.set(m.id, m);
        this.notifyChange();
      });
    }).catch(console.error);

    listen<{ id: string }>("plugin:unloaded", ({ payload }) => {
      this.manifests.delete(payload.id);
      this.contributions.delete(payload.id);
      this.notifyChange();
    }).catch(console.error);

    this.notifyChange();
  }

  // ── Contribution registration ─────────────────────────────────────────────

  /** Register UI contributions from a bundled/built-in plugin. */
  registerContribution(pluginId: string, contribution: PluginUiContribution): void {
    this.contributions.set(pluginId, contribution);
    this.notifyChange();
  }

  /** Build a PluginApi for a given pluginId (used by bundled plugins to call their backend). */
  buildApi(pluginId: string): PluginApi {
    return {
      pluginId,

      invoke<T>(method: string, params?: Record<string, unknown>): Promise<T> {
        return invoke<T>("plugin_dispatch", { pluginId, method, params: params ?? {} });
      },

      onEvent(event: string, handler: (payload: unknown) => void): () => void {
        let unlisten: (() => void) | undefined;
        listen(`plugin:${pluginId}:${event}`, (e) => handler(e.payload))
          .then((fn) => { unlisten = fn; })
          .catch(console.error);
        return () => unlisten?.();
      },

      getSettings(): Promise<Record<string, unknown>> {
        return invoke("plugin_get_settings", { pluginId });
      },

      saveSettings(settings: Record<string, unknown>): Promise<void> {
        return invoke("plugin_save_settings", { pluginId, settings });
      },
    };
  }

  // ── Slot accessors ────────────────────────────────────────────────────────

  getSidebarItems() {
    return [...this.contributions.values()].flatMap((c) => c.sidebarItems ?? []);
  }

  getSettingsSections() {
    return [...this.contributions.values()].flatMap((c) => c.settingsSections ?? []);
  }

  getTrackContextMenuItems() {
    return [...this.contributions.values()].flatMap((c) => c.trackContextMenuItems ?? []);
  }

  getNowPlayingActions() {
    return [...this.contributions.values()].flatMap((c) => c.nowPlayingActions ?? []);
  }

  getRoutes() {
    return [...this.contributions.values()].flatMap((c) => c.routes ?? []);
  }

  // ── Manifest accessors ────────────────────────────────────────────────────

  getManifests(): PluginManifest[] {
    return [...this.manifests.values()];
  }

  getManifest(id: string): PluginManifest | undefined {
    return this.manifests.get(id);
  }

  // ── Change notification ───────────────────────────────────────────────────

  onchange(listener: () => void): () => void {
    this.changeListeners.add(listener);
    return () => this.changeListeners.delete(listener);
  }

  private notifyChange() {
    for (const l of this.changeListeners) l();
  }
}
