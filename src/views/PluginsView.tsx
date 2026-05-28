import { usePlugins, useInstallPlugin, useUninstallPlugin } from "@/queries/plugins";
import type { PluginManifest } from "@/plugins/types";
import { cn } from "@/lib/utils";

export function PluginsView() {
  const { data: plugins = [], isLoading } = usePlugins();
  const install = useInstallPlugin();
  const uninstall = useUninstallPlugin();

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Plugins</h1>
        <button
          onClick={() => install.mutate()}
          disabled={install.isPending}
          className={cn(
            "px-4 py-2 rounded-lg text-sm font-semibold transition-opacity",
            "bg-[var(--color-accent)] text-black hover:opacity-90 disabled:opacity-50",
          )}
        >
          {install.isPending ? "Installing…" : "Install Plugin"}
        </button>
      </div>

      {isLoading && (
        <p className="text-[var(--color-text-muted)]">Loading plugins…</p>
      )}

      {!isLoading && plugins.length === 0 && (
        <div className="text-center py-16">
          <p className="text-[var(--color-text-muted)] mb-1">No plugins installed</p>
          <p className="text-sm text-[var(--color-text-muted)]">
            Click "Install Plugin" to add a plugin directory.
          </p>
        </div>
      )}

      <div className="space-y-3 max-w-2xl">
        {plugins.map((plugin) => (
          <PluginCard
            key={plugin.id}
            plugin={plugin}
            onUninstall={() => uninstall.mutate(plugin.id)}
            isUninstalling={uninstall.isPending && uninstall.variables === plugin.id}
          />
        ))}
      </div>
    </div>
  );
}

function PluginCard({
  plugin,
  onUninstall,
  isUninstalling,
}: {
  plugin: PluginManifest;
  onUninstall: () => void;
  isUninstalling: boolean;
}) {
  return (
    <div className="flex items-start justify-between p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)]">
      <div className="flex-1 min-w-0 mr-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-semibold text-white">{plugin.name}</span>
          <span className="text-xs text-[var(--color-text-muted)] bg-[var(--color-border)] px-2 py-0.5 rounded-full">
            v{plugin.version}
          </span>
        </div>
        {plugin.description && (
          <p className="text-sm text-[var(--color-text-muted)] mb-2">{plugin.description}</p>
        )}
        <div className="flex gap-1 flex-wrap">
          {plugin.capabilities.map((cap) => (
            <span
              key={cap}
              className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
            >
              {cap.replace(/_/g, " ")}
            </span>
          ))}
        </div>
        <p className="text-xs text-[var(--color-text-dim)] mt-2 font-mono">{plugin.id}</p>
      </div>
      <button
        onClick={onUninstall}
        disabled={isUninstalling}
        className="px-3 py-1.5 text-xs rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 disabled:opacity-50 flex-shrink-0"
      >
        {isUninstalling ? "Removing…" : "Uninstall"}
      </button>
    </div>
  );
}
