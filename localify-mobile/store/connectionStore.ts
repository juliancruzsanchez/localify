import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { normalizeUrl, probeServer } from '../lib/net';
import { usePlayerStore } from './playerStore';

// Two server addresses can be configured: a `local` one used when on the
// home Wi-Fi, and a `public` one for reaching the desktop from anywhere.
// On connect we probe whichever are set and use the first that responds.
const LOCAL_KEY = 'localify:serverUrl:local';
const PUBLIC_KEY = 'localify:serverUrl:public';
const ACTIVE_KEY = 'localify:serverUrl:active';
const LEGACY_KEY = 'localify_server_url'; // single-URL key from older builds

interface ConnectionState {
  localUrl: string | null;
  publicUrl: string | null;
  // The address that last responded — drives baseUrl across the app.
  activeUrl: string | null;
  // True when at least one URL is configured but none are reachable.
  isOffline: boolean;
  isChecking: boolean;
  loaded: boolean;

  load: () => Promise<void>;
  setLocalUrl: (raw: string) => Promise<void>;
  setPublicUrl: (raw: string) => Promise<void>;
  saveUrls: (local: string, pub: string) => Promise<boolean>;
  check: () => Promise<boolean>;
  reconnect: () => Promise<boolean>;
  clear: () => Promise<void>;
}

function pushActive(url: string | null) {
  usePlayerStore.getState().setBaseUrl(url);
}

export const useConnectionStore = create<ConnectionState>((set, get) => ({
  localUrl: null,
  publicUrl: null,
  activeUrl: null,
  isOffline: false,
  isChecking: false,
  loaded: false,

  load: async () => {
    const [local, pub, legacy] = await Promise.all([
      AsyncStorage.getItem(LOCAL_KEY),
      AsyncStorage.getItem(PUBLIC_KEY),
      AsyncStorage.getItem(LEGACY_KEY),
    ]);

    let localUrl = local;
    // Migrate the old single-URL key into the local slot.
    if (!localUrl && legacy) {
      localUrl = legacy;
      await AsyncStorage.setItem(LOCAL_KEY, legacy);
      await AsyncStorage.removeItem(LEGACY_KEY);
    }

    set({ localUrl: localUrl ?? null, publicUrl: pub ?? null, loaded: true });
    await get().check();
  },

  setLocalUrl: async (raw: string) => {
    const url = normalizeUrl(raw);
    if (url) await AsyncStorage.setItem(LOCAL_KEY, url);
    else await AsyncStorage.removeItem(LOCAL_KEY);
    set({ localUrl: url || null });
  },

  setPublicUrl: async (raw: string) => {
    const url = normalizeUrl(raw);
    if (url) await AsyncStorage.setItem(PUBLIC_KEY, url);
    else await AsyncStorage.removeItem(PUBLIC_KEY);
    set({ publicUrl: url || null });
  },

  saveUrls: async (local: string, pub: string) => {
    await get().setLocalUrl(local);
    await get().setPublicUrl(pub);
    return get().check();
  },

  check: async () => {
    const { localUrl, publicUrl, activeUrl } = get();

    // Probe the previously-active URL first to avoid flapping, then local,
    // then public.
    const candidates: string[] = [];
    if (activeUrl) candidates.push(activeUrl);
    if (localUrl && !candidates.includes(localUrl)) candidates.push(localUrl);
    if (publicUrl && !candidates.includes(publicUrl)) candidates.push(publicUrl);

    if (candidates.length === 0) {
      set({ activeUrl: null, isOffline: false, isChecking: false });
      pushActive(null);
      return false;
    }

    set({ isChecking: true });
    for (const url of candidates) {
      if (await probeServer(url)) {
        set({ activeUrl: url, isOffline: false, isChecking: false });
        pushActive(url);
        AsyncStorage.setItem(ACTIVE_KEY, url).catch(() => {});
        return true;
      }
    }

    set({ activeUrl: null, isOffline: true, isChecking: false });
    pushActive(null);
    return false;
  },

  reconnect: async () => get().check(),

  clear: async () => {
    await Promise.all([
      AsyncStorage.removeItem(LOCAL_KEY),
      AsyncStorage.removeItem(PUBLIC_KEY),
      AsyncStorage.removeItem(ACTIVE_KEY),
      AsyncStorage.removeItem(LEGACY_KEY),
    ]);
    set({ localUrl: null, publicUrl: null, activeUrl: null, isOffline: false });
    pushActive(null);
  },
}));
