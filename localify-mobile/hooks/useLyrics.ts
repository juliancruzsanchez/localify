import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

export interface LyricLine {
  time_ms: number;
  text: string;
}

/** Fetch synced lyrics for a track from the desktop HTTP server. */
export function useLyrics(trackId: string | null | undefined, baseUrl: string | null) {
  const { data: lines = null, isLoading } = useQuery<LyricLine[] | null>({
    queryKey: ['lyrics', trackId, baseUrl],
    queryFn: async () => {
      const res = await fetch(`${baseUrl}/api/lyrics/${trackId}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!trackId && !!baseUrl,
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
  if (!lines || lines.length === 0) return -1;
  let idx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].time_ms <= positionMs) idx = i;
    else break;
  }
  return idx;
}

/** Fetches the dominant color for a track's artwork from the desktop server. */
export function useArtworkColor(trackId: string | null | undefined, baseUrl: string | null): string {
  const [color, setColor] = useState('#1a1a1a');

  useEffect(() => {
    if (!trackId || !baseUrl) { setColor('#1a1a1a'); return; }
    let cancelled = false;
    fetch(`${baseUrl}/api/artwork_color/${trackId}`)
      .then((r) => r.json())
      .then((data: { color?: string }) => {
        if (!cancelled && data?.color) setColor(data.color);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [trackId, baseUrl]);

  return color;
}
