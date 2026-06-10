import { useCallback, useEffect, useState } from "react";

/** Per-scope sort preference: which key + direction. */
export interface SortPref<K extends string> {
  key: K;
  dir: "asc" | "desc";
}

/**
 * Persist a sort preference in localStorage under `localify.sort.{scope}`.
 *
 * `toggle(key)` is the Spotify-style interaction: clicking the same key flips
 * direction; clicking a new key swaps to it with a sensible default direction
 * (asc for text keys, desc for recency keys — controlled by `defaultDirFor`).
 */
export function useSortPref<K extends string>(
  scope:           string,
  defaultPref:     SortPref<K>,
  defaultDirFor?: (key: K) => "asc" | "desc",
): {
  pref:   SortPref<K>;
  set:    (pref: SortPref<K>) => void;
  toggle: (key: K) => void;
} {
  const storageKey = `localify.sort.${scope}`;

  const [pref, setPref] = useState<SortPref<K>>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return defaultPref;
      const parsed = JSON.parse(raw) as SortPref<K>;
      if (parsed && typeof parsed.key === "string" && (parsed.dir === "asc" || parsed.dir === "desc")) {
        return parsed;
      }
    } catch { /* fall through */ }
    return defaultPref;
  });

  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(pref)); } catch { /* ignore */ }
  }, [storageKey, pref]);

  const set = useCallback((next: SortPref<K>) => setPref(next), []);

  const toggle = useCallback((key: K) => {
    setPref((cur) => {
      if (cur.key === key) {
        return { key, dir: cur.dir === "asc" ? "desc" : "asc" };
      }
      return { key, dir: defaultDirFor ? defaultDirFor(key) : "asc" };
    });
  }, [defaultDirFor]);

  return { pref, set, toggle };
}
