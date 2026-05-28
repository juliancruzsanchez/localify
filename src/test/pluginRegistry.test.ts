import { describe, it, expect, beforeEach, vi } from "vitest";
import { PluginRegistry } from "@/plugins/PluginRegistry";
import type { PluginManifest } from "@/plugins/types";
import { invoke } from "@tauri-apps/api/core";

// @tauri-apps/api/core and event are mocked in setup.ts

function makeManifest(id: string): PluginManifest {
  return {
    id,
    name: "Test Plugin",
    version: "1.0.0",
    api_version: "1",
    capabilities: ["ui_components"],
    permissions: {
      network: false,
      filesystem: false,
      exec_subprocess: false,
      read_library_db: false,
      write_library_db: false,
      player_control: false,
      player_observe: false,
    },
  };
}

describe("PluginRegistry", () => {
  beforeEach(() => {
    // Reset the singleton and clear mock call counts between tests
    (PluginRegistry as unknown as { instance: PluginRegistry | undefined }).instance = undefined;
    vi.clearAllMocks();
    vi.mocked(invoke).mockResolvedValue([]);
  });

  it("returns same instance on repeated getInstance calls", () => {
    const a = PluginRegistry.getInstance();
    const b = PluginRegistry.getInstance();
    expect(a).toBe(b);
  });

  it("initialize fetches plugin list and stores manifests", async () => {
    const manifest = makeManifest("com.test.hello");
    vi.mocked(invoke).mockResolvedValueOnce([manifest]);

    const registry = PluginRegistry.getInstance();
    await registry.initialize();

    expect(registry.getManifests()).toHaveLength(1);
    expect(registry.getManifest("com.test.hello")?.name).toBe("Test Plugin");
  });

  it("initialize only runs once even if called multiple times", async () => {
    const registry = PluginRegistry.getInstance();
    await registry.initialize();
    await registry.initialize();
    // invoke should have been called exactly once for plugin_list
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it("returns empty arrays when no contributions registered", () => {
    const registry = PluginRegistry.getInstance();
    expect(registry.getSidebarItems()).toHaveLength(0);
    expect(registry.getSettingsSections()).toHaveLength(0);
    expect(registry.getTrackContextMenuItems()).toHaveLength(0);
    expect(registry.getNowPlayingActions()).toHaveLength(0);
    expect(registry.getRoutes()).toHaveLength(0);
  });

  it("registerContribution aggregates sidebar items from multiple plugins", () => {
    const registry = PluginRegistry.getInstance();
    registry.registerContribution("com.test.a", {
      sidebarItems: [{ id: "a-item", label: "Plugin A", icon: null, route: "/plugin-a" }],
    });
    registry.registerContribution("com.test.b", {
      sidebarItems: [{ id: "b-item", label: "Plugin B", icon: null, route: "/plugin-b" }],
    });
    const items = registry.getSidebarItems();
    expect(items).toHaveLength(2);
    expect(items.map((i) => i.label)).toContain("Plugin A");
    expect(items.map((i) => i.label)).toContain("Plugin B");
  });

  it("registerContribution replaces previous contribution for same pluginId", () => {
    const registry = PluginRegistry.getInstance();
    registry.registerContribution("com.test.a", {
      sidebarItems: [{ id: "old", label: "Old", icon: null }],
    });
    registry.registerContribution("com.test.a", {
      sidebarItems: [{ id: "new", label: "New", icon: null }],
    });
    expect(registry.getSidebarItems()).toHaveLength(1);
    expect(registry.getSidebarItems()[0].label).toBe("New");
  });

  it("getTrackContextMenuItems returns items from contributions", () => {
    const registry = PluginRegistry.getInstance();
    const onSelect = vi.fn();
    registry.registerContribution("com.test.ctx", {
      trackContextMenuItems: [
        { id: "ctx-item", label: "Do Something", onSelect },
      ],
    });
    const items = registry.getTrackContextMenuItems();
    expect(items).toHaveLength(1);
    expect(items[0].label).toBe("Do Something");
  });

  it("onchange listener is notified when contribution is registered", () => {
    const registry = PluginRegistry.getInstance();
    const listener = vi.fn();
    registry.onchange(listener);
    registry.registerContribution("com.test.notify", {});
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("onchange unsubscribe stops notifications", () => {
    const registry = PluginRegistry.getInstance();
    const listener = vi.fn();
    const unsub = registry.onchange(listener);
    unsub();
    registry.registerContribution("com.test.unsub", {});
    expect(listener).not.toHaveBeenCalled();
  });

  it("buildApi creates a PluginApi with the correct pluginId", () => {
    const registry = PluginRegistry.getInstance();
    const api = registry.buildApi("com.test.api-test");
    expect(api.pluginId).toBe("com.test.api-test");
  });

  it("buildApi.invoke calls plugin_dispatch with correct args", async () => {
    const registry = PluginRegistry.getInstance();
    const api = registry.buildApi("com.test.dispatch");
    vi.mocked(invoke).mockResolvedValueOnce({ result: "ok" });

    await api.invoke("my_method", { foo: "bar" });

    expect(invoke).toHaveBeenCalledWith("plugin_dispatch", {
      pluginId: "com.test.dispatch",
      method: "my_method",
      params: { foo: "bar" },
    });
  });

  it("buildApi.getSettings calls plugin_get_settings", async () => {
    const registry = PluginRegistry.getInstance();
    const api = registry.buildApi("com.test.settings");
    vi.mocked(invoke).mockResolvedValueOnce({ key: "value" });

    const result = await api.getSettings();

    expect(invoke).toHaveBeenCalledWith("plugin_get_settings", {
      pluginId: "com.test.settings",
    });
    expect(result).toEqual({ key: "value" });
  });

  it("buildApi.saveSettings calls plugin_save_settings", async () => {
    const registry = PluginRegistry.getInstance();
    const api = registry.buildApi("com.test.save");
    vi.mocked(invoke).mockResolvedValueOnce(undefined);

    await api.saveSettings({ theme: "dark" });

    expect(invoke).toHaveBeenCalledWith("plugin_save_settings", {
      pluginId: "com.test.save",
      settings: { theme: "dark" },
    });
  });
});
