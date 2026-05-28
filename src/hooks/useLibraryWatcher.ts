import { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { useQueryClient } from "@tanstack/react-query";

interface ScanResult {
  added: number;
  updated: number;
  removed: number;
  skipped: number;
  duration_ms: number;
  errors: string[];
}

export function useLibraryWatcher() {
  const queryClient = useQueryClient();
  const [isScanning, setIsScanning] = useState(false);
  const [lastResult, setLastResult] = useState<ScanResult | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const startedPromise = listen<null>("library:watcher-scan-started", () => {
      if (hideTimerRef.current !== null) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
      setIsScanning(true);
      setLastResult(null);
    });

    const finishedPromise = listen<ScanResult>("library:watcher-scan-finished", (event) => {
      setIsScanning(false);
      setLastResult(event.payload);

      for (const key of ["tracks", "albums", "artists", "home"]) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }

      const { added, updated, removed } = event.payload;
      if (added + updated + removed > 0) {
        hideTimerRef.current = setTimeout(() => {
          setLastResult(null);
          hideTimerRef.current = null;
        }, 3000);
      } else {
        setLastResult(null);
      }
    });

    return () => {
      startedPromise.then((f) => f());
      finishedPromise.then((f) => f());
      if (hideTimerRef.current !== null) {
        clearTimeout(hideTimerRef.current);
      }
    };
  }, [queryClient]);

  return { isScanning, lastResult };
}
