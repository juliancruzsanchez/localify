import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState, useCallback } from 'react';

const SERVER_URL_KEY = 'localify_server_url';

let cachedUrl: string | null = null;
const listeners = new Set<(url: string | null) => void>();

function notifyListeners(url: string | null) {
  cachedUrl = url;
  listeners.forEach((fn) => fn(url));
}

export async function loadServerUrl(): Promise<string | null> {
  if (cachedUrl !== null) return cachedUrl;
  const stored = await AsyncStorage.getItem(SERVER_URL_KEY);
  cachedUrl = stored;
  return stored;
}

export async function saveServerUrl(rawInput: string): Promise<string> {
  const trimmed = rawInput.trim();
  const url = trimmed.startsWith('http') ? trimmed : `http://${trimmed}`;
  await AsyncStorage.setItem(SERVER_URL_KEY, url);
  notifyListeners(url);
  return url;
}

export async function clearServerUrl(): Promise<void> {
  await AsyncStorage.removeItem(SERVER_URL_KEY);
  notifyListeners(null);
}

export function useServer(): {
  baseUrl: string | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
} {
  const [baseUrl, setBaseUrl] = useState<string | null>(cachedUrl);
  const [isLoading, setIsLoading] = useState(cachedUrl === null);

  useEffect(() => {
    const listener = (url: string | null) => setBaseUrl(url);
    listeners.add(listener);

    if (cachedUrl === null) {
      loadServerUrl().then((url) => {
        setBaseUrl(url);
        setIsLoading(false);
      });
    } else {
      setIsLoading(false);
    }

    return () => {
      listeners.delete(listener);
    };
  }, []);

  const refresh = useCallback(async () => {
    const url = await loadServerUrl();
    setBaseUrl(url);
  }, []);

  return { baseUrl, isLoading, refresh };
}
