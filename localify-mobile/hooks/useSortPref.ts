import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

export interface SortPref<K extends string> {
  key: K;
  dir: 'asc' | 'desc';
}

/**
 * Persist a sort preference in AsyncStorage under `localify.sort.{scope}`.
 *
 * `toggle(key)` is the Spotify-style interaction: tapping the same key flips
 * direction; tapping a new key swaps with the default direction for that key.
 */
export function useSortPref<K extends string>(
  scope:          string,
  defaultPref:    SortPref<K>,
  defaultDirFor?: (key: K) => 'asc' | 'desc',
): {
  pref:   SortPref<K>;
  set:    (pref: SortPref<K>) => void;
  toggle: (key: K) => void;
  ready:  boolean;
} {
  const storageKey = `localify.sort.${scope}`;
  const [pref, setPref] = useState<SortPref<K>>(defaultPref);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(storageKey);
        if (cancelled) return;
        if (raw) {
          const parsed = JSON.parse(raw) as SortPref<K>;
          if (parsed && typeof parsed.key === 'string' && (parsed.dir === 'asc' || parsed.dir === 'desc')) {
            setPref(parsed);
          }
        }
      } catch { /* ignore */ }
      if (!cancelled) setReady(true);
    })();
    return () => { cancelled = true; };
  }, [storageKey]);

  useEffect(() => {
    if (!ready) return;
    AsyncStorage.setItem(storageKey, JSON.stringify(pref)).catch(() => {});
  }, [storageKey, pref, ready]);

  const set = useCallback((next: SortPref<K>) => setPref(next), []);

  const toggle = useCallback((key: K) => {
    setPref((cur) => {
      if (cur.key === key) {
        return { key, dir: cur.dir === 'asc' ? 'desc' : 'asc' };
      }
      return { key, dir: defaultDirFor ? defaultDirFor(key) : 'asc' };
    });
  }, [defaultDirFor]);

  return { pref, set, toggle, ready };
}
