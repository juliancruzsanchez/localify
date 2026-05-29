import { invoke } from "@tauri-apps/api/core";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

export interface LyricLine {
  time_ms: number;
  text: string;
}

export function useLyrics(trackId: string | null | undefined) {
  const { data: lines = null, isLoading } = useQuery<LyricLine[] | null>({
    queryKey: ["lyrics", trackId],
    queryFn: () => invoke<LyricLine[] | null>("get_lyrics", { trackId: trackId! }),
    enabled: !!trackId,
    staleTime: 1000 * 60 * 30,
    retry: false,
  });
  return { lines, isLoading };
}

/** Returns the index of the active lyric line at the given playback position. */
export function useCurrentLyricIndex(
  lines: LyricLine[] | null,
  positionMs: number,
): number {
  return useMemo(() => {
    if (!lines || lines.length === 0) return -1;
    let idx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].time_ms <= positionMs) idx = i;
      else break;
    }
    return idx;
  }, [lines, positionMs]);
}
