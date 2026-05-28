import { useParams } from "react-router";
import { usePluginRegistrySnapshot } from "@/plugins/PluginRegistryContext";

export function PluginRouteView() {
  const { "*": splat } = useParams();
  const registry = usePluginRegistrySnapshot();
  const path = splat ?? "";

  const route = registry.getRoutes().find((r) => r.path === path);

  if (!route) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--color-text-muted)] text-sm">
        Plugin view not found: <code className="ml-2 opacity-60">{path}</code>
      </div>
    );
  }

  return <route.component />;
}
