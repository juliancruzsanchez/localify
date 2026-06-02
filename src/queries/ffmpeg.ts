import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export interface FfmpegStatus {
  available: boolean;
  managed: boolean;
}

export type FfmpegInstallState =
  | { status: "idle" }
  | { status: "installing"; pct: number }
  | { status: "done" }
  | { status: "error"; message: string };

export function useFfmpegStatus() {
  const [status, setStatus] = useState<FfmpegStatus | null>(null);

  const refresh = useCallback(() => {
    invoke<FfmpegStatus>("ffmpeg_check")
      .then(setStatus)
      .catch(() => setStatus({ available: false, managed: false }));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { status, refresh };
}

export function useFfmpegInstall(onDone: () => void) {
  const [state, setState] = useState<FfmpegInstallState>({ status: "idle" });

  useEffect(() => {
    const unlisten = listen<{ pct: number; done: boolean }>(
      "ffmpeg:install_progress",
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
    invoke("ffmpeg_install").catch((e: unknown) => {
      setState({ status: "error", message: String(e) });
    });
  }, []);

  return { state, install };
}
