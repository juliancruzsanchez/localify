import { useConnectionStore } from '../store/connectionStore';

// Re-exported so existing imports (connect/settings screens) keep working.
export { fetchWithTimeout, normalizeUrl } from '../lib/net';

// ── Legacy helpers ─────────────────────────────────────────────────────────────
// Older callers (statsStore, connect, settings) used these free functions.
// They now delegate to the connection store, which manages the local/public
// URL pair and the active (reachable) address.

export async function loadServerUrl(): Promise<string | null> {
  const store = useConnectionStore.getState();
  if (!store.loaded) await store.load();
  const { activeUrl, localUrl, publicUrl } = useConnectionStore.getState();
  return activeUrl ?? localUrl ?? publicUrl ?? null;
}

export async function saveServerUrl(rawInput: string): Promise<string> {
  await useConnectionStore.getState().setLocalUrl(rawInput);
  await useConnectionStore.getState().check();
  const { activeUrl, localUrl } = useConnectionStore.getState();
  return activeUrl ?? localUrl ?? '';
}

export async function clearServerUrl(): Promise<void> {
  await useConnectionStore.getState().clear();
}

// ── Hook ────────────────────────────────────────────────────────────────────────

export interface ServerInfo {
  baseUrl: string | null;
  isLoading: boolean;
  isOffline: boolean;
  isChecking: boolean;
  localUrl: string | null;
  publicUrl: string | null;
  reconnect: () => Promise<boolean>;
  refresh: () => Promise<void>;
}

export function useServer(): ServerInfo {
  const activeUrl = useConnectionStore((s) => s.activeUrl);
  const isOffline = useConnectionStore((s) => s.isOffline);
  const isChecking = useConnectionStore((s) => s.isChecking);
  const loaded = useConnectionStore((s) => s.loaded);
  const localUrl = useConnectionStore((s) => s.localUrl);
  const publicUrl = useConnectionStore((s) => s.publicUrl);
  const reconnect = useConnectionStore((s) => s.reconnect);
  const load = useConnectionStore((s) => s.load);

  return {
    baseUrl: activeUrl,
    isLoading: !loaded,
    isOffline,
    isChecking,
    localUrl,
    publicUrl,
    reconnect,
    refresh: load,
  };
}
