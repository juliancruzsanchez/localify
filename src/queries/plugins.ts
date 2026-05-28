import { invoke } from "@tauri-apps/api/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { open } from "@tauri-apps/plugin-dialog";
import type { PluginManifest } from "@/plugins/types";

export const pluginKeys = {
  all: ["plugins"] as const,
  list: () => [...pluginKeys.all, "list"] as const,
  settings: (id: string) => [...pluginKeys.all, "settings", id] as const,
};

export function usePlugins() {
  return useQuery({
    queryKey: pluginKeys.list(),
    queryFn: () => invoke<PluginManifest[]>("plugin_list"),
  });
}

export function usePluginSettings(pluginId: string) {
  return useQuery({
    queryKey: pluginKeys.settings(pluginId),
    queryFn: () => invoke<Record<string, unknown>>("plugin_get_settings", { pluginId }),
    enabled: !!pluginId,
  });
}

export function useInstallPlugin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const dir = await open({ directory: true, multiple: false, title: "Select Plugin Directory" });
      if (!dir || typeof dir !== "string") return null;
      return invoke<PluginManifest>("plugin_install", { sourceDir: dir });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: pluginKeys.all }),
  });
}

export function useUninstallPlugin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (pluginId: string) => invoke<void>("plugin_uninstall", { pluginId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: pluginKeys.all }),
  });
}

export function useSavePluginSettings(pluginId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (settings: Record<string, unknown>) =>
      invoke<void>("plugin_save_settings", { pluginId, settings }),
    onSuccess: () => qc.invalidateQueries({ queryKey: pluginKeys.settings(pluginId) }),
  });
}
