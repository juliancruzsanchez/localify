import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useQueryClient } from "@tanstack/react-query";
import { useUiStore } from "@/store/uiStore";
import { queryKeys } from "./keys";

export interface YtdlpSearchResult {
  id: string;
  title: string;
  uploader: string;
  duration_secs: number;
  thumbnail_url: string;
}

export interface YtdlpStatus {
  available: boolean;
  version: string | null;
  managed: boolean;
}

export interface YtdlpProgress {
  video_id: string;
  status: "downloading" | "processing" | "done" | "error";
  pct: number;
  track_id: string | null;
}

export type DownloadState =
  | { status: "idle" }
  | { status: "downloading"; pct: number }
  | { status: "processing"; pct: number }
  | { status: "done"; track_id: string | null }
  | { status: "error"; message?: string };

export type InstallState =
  | { status: "idle" }
  | { status: "installing"; pct: number }
  | { status: "done" }
  | { status: "error"; message: string };

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useYtdlpStatus() {
  const [status, setStatus] = useState<YtdlpStatus | null>(null);

  const refresh = useCallback(() => {
    invoke<YtdlpStatus>("ytdlp_check")
      .then(setStatus)
      .catch(() => setStatus({ available: false, version: null, managed: false }));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { status, refresh };
}

export function useYtdlpInstall(onDone: () => void) {
  const [state, setState] = useState<InstallState>({ status: "idle" });

  useEffect(() => {
    const unlisten = listen<{ pct: number; done: boolean }>(
      "ytdlp:install_progress",
      ({ payload }) => {
        if (payload.done) {
          setState({ status: "done" });
          onDone();
        } else {
          setState({ status: "installing", pct: payload.pct });
        }
      },
    );
    return () => { unlisten.then((fn) => fn()); };
  }, [onDone]);

  const install = useCallback(() => {
    setState({ status: "installing", pct: 0 });
    invoke("ytdlp_install").catch((e: unknown) => {
      setState({ status: "error", message: String(e) });
    });
  }, []);

  return { state, install };
}

export function useYtdlpSearch(query: string, enabled: boolean) {
  const [results, setResults] = useState<YtdlpSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Track the query that's currently in-flight so stale events are ignored
  const activeQueryRef = useRef<string>("");

  useEffect(() => {
    if (!enabled || query.trim().length === 0) {
      setResults([]);
      setLoading(false);
      return;
    }

    activeQueryRef.current = query;
    let cancelled = false;
    setResults([]);
    setLoading(true);
    setError(null);

    // Subscribe to streaming results — each fires as soon as yt-dlp prints a line,
    // so the first result typically appears within 2–3 s instead of waiting for all 8.
    const unlistenPromise = listen<{ query: string; result: YtdlpSearchResult }>(
      "ytdlp:search_result",
      ({ payload }) => {
        if (!cancelled && payload.query === activeQueryRef.current) {
          setResults((prev) => [...prev, payload.result]);
          setLoading(false);
        }
      },
    );

    // The IPC call resolves with the authoritative final list once yt-dlp exits.
    // Replace the streamed list with it to handle any edge cases (duplicates, ordering).
    invoke<YtdlpSearchResult[]>("ytdlp_search", { query, limit: 8 })
      .then((res) => {
        if (!cancelled && query === activeQueryRef.current) {
          setResults(res);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!cancelled && query === activeQueryRef.current) {
          setError(String(e));
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
      unlistenPromise.then((fn) => fn());
    };
  }, [query, enabled]);

  return { results, loading, error };
}

export function useYtdlpDownload() {
  const [downloads, setDownloads] = useState<Record<string, DownloadState>>({});
  const setDownload = useUiStore((s) => s.setDownload);
  const queryClient = useQueryClient();

  useEffect(() => {
    const unlisten = listen<YtdlpProgress>("ytdlp:progress", ({ payload }) => {
      const { video_id, status, pct, track_id } = payload;
      const next: DownloadState =
        status === "done"
          ? { status: "done", track_id }
          : status === "error"
            ? { status: "error" }
            : { status, pct } as DownloadState;
      setDownload(video_id, next);
      setDownloads((prev) => {
        if (status === "done" && track_id) {
          queryClient.invalidateQueries({ queryKey: queryKeys.tracks() });
          queryClient.invalidateQueries({ queryKey: queryKeys.albums() });
        }
        return { ...prev, [video_id]: next };
      });
    });
    return () => { unlisten.then((fn) => fn()); };
  }, [queryClient]);

  const download = useCallback((result: YtdlpSearchResult) => {
    setDownloads((prev) => ({ ...prev, [result.id]: { status: "downloading", pct: 0 } }));
    invoke("ytdlp_download", {
      videoId: result.id,
      title: result.title,
      artist: result.uploader,
    }).catch((e: unknown) => {
      const message = String(e).replace(/^.*Error:\s*/i, "");
      setDownloads((prev) => ({ ...prev, [result.id]: { status: "error", message } }));
    });
  }, []);

  return { downloads, download };
}
