import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { PluginRegistry } from "./PluginRegistry";

const Ctx = createContext<PluginRegistry | null>(null);

export function PluginRegistryProvider({ children }: { children: ReactNode }) {
  const [registry] = useState(() => PluginRegistry.getInstance());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    registry.initialize().then(() => setReady(true));
  }, [registry]);

  // Render children immediately so the rest of the app loads while plugins initialise.
  // Components that need plugin data use usePluginRegistrySnapshot which re-renders once ready.
  return (
    <Ctx.Provider value={registry}>
      {ready ? children : children}
    </Ctx.Provider>
  );
}

export function usePluginRegistry(): PluginRegistry {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePluginRegistry must be used inside <PluginRegistryProvider>");
  return ctx;
}

/** Like usePluginRegistry but re-renders when the registry changes (install/uninstall). */
export function usePluginRegistrySnapshot(): PluginRegistry {
  const registry = usePluginRegistry();
  // useSyncExternalStore subscribes to changes and triggers re-renders.
  useSyncExternalStore(
    (cb) => registry.onchange(cb),
    () => registry.getManifests().length + registry.getSidebarItems().length,
    () => 0,
  );
  return registry;
}
