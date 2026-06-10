import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import type { TrackSummary } from '../hooks/useLibrary';

const STATS_KEY = 'localify:stats:v1';
const MAX_HISTORY = 5000;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PlayEvent {
  trackId: string;
  title: string;
  artist: string;
  playedAt: number;   // unix ms
  listenedMs: number; // actual ms listened (updated on track change)
}

interface StatsState {
  history: PlayEvent[];
  loaded: boolean;

  // Actions
  loadStats: () => Promise<void>;
  recordPlay: (track: TrackSummary, baseUrl: string | null) => void;
  finalizePlay: (trackId: string, listenedMs: number, baseUrl: string | null) => void;

  // Queries
  topTracks: (limit?: number) => Array<{ id: string; title: string; artist: string; count: number; ms: number }>;
  topArtists: (limit?: number) => Array<{ artist: string; count: number; ms: number }>;
  todayMs: () => number;
  weekMs: () => number;
  allTimeMs: () => number;
  todayCount: () => number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function startOfWeek(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d.getTime();
}

async function persist(history: PlayEvent[]) {
  try {
    await AsyncStorage.setItem(STATS_KEY, JSON.stringify(history));
  } catch {
    // silently ignore storage errors
  }
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useStatsStore = create<StatsState>((set, get) => ({
  history: [],
  loaded: false,

  loadStats: async () => {
    if (get().loaded) return;
    try {
      const raw = await AsyncStorage.getItem(STATS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as PlayEvent[];
        set({ history: Array.isArray(parsed) ? parsed : [], loaded: true });
      } else {
        set({ loaded: true });
      }
    } catch {
      set({ loaded: true });
    }
  },

  recordPlay: (track: TrackSummary, baseUrl: string | null) => {
    const event: PlayEvent = {
      trackId: track.id,
      title:   track.title,
      artist:  track.artist,
      playedAt: Date.now(),
      listenedMs: 0,
    };
    set((s) => {
      const history = [...s.history, event].slice(-MAX_HISTORY);
      persist(history);
      return { history };
    });

    // Fire-and-forget: report play to server for host-side AI/analytics tracking
    if (baseUrl) {
      fetch(`${baseUrl}/api/stats/record`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ track_id: track.id, source: 'mobile' }),
      }).catch(() => {});
    }
  },

  // Call when the track ends or user switches tracks with elapsed time
  finalizePlay: (trackId: string, listenedMs: number, baseUrl: string | null) => {
    set((s) => {
      const history = [...s.history];
      for (let i = history.length - 1; i >= 0; i--) {
        if (history[i].trackId === trackId && history[i].listenedMs === 0) {
          history[i] = { ...history[i], listenedMs };
          break;
        }
      }
      persist(history);
      return { history };
    });

    // Update server with final listen duration for host-side AI/analytics
    if (listenedMs > 0 && baseUrl) {
      fetch(`${baseUrl}/api/stats/record`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          track_id: trackId,
          listen_ms: listenedMs,
          completed: listenedMs > 0,
          source: 'mobile',
        }),
      }).catch(() => {});
    }
  },

  topTracks: (limit = 10) => {
    const counts: Record<string, { id: string; title: string; artist: string; count: number; ms: number }> = {};
    for (const e of get().history) {
      if (!counts[e.trackId]) {
        counts[e.trackId] = { id: e.trackId, title: e.title, artist: e.artist, count: 0, ms: 0 };
      }
      counts[e.trackId].count++;
      counts[e.trackId].ms += e.listenedMs;
    }
    return Object.values(counts)
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  },

  topArtists: (limit = 10) => {
    const counts: Record<string, { artist: string; count: number; ms: number }> = {};
    for (const e of get().history) {
      if (!counts[e.artist]) counts[e.artist] = { artist: e.artist, count: 0, ms: 0 };
      counts[e.artist].count++;
      counts[e.artist].ms += e.listenedMs;
    }
    return Object.values(counts)
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  },

  todayMs: () => {
    const dayStart = startOfDay(Date.now());
    return get().history.reduce((sum, e) => (e.playedAt >= dayStart ? sum + e.listenedMs : sum), 0);
  },

  weekMs: () => {
    const weekStart = startOfWeek(Date.now());
    return get().history.reduce((sum, e) => (e.playedAt >= weekStart ? sum + e.listenedMs : sum), 0);
  },

  allTimeMs: () => get().history.reduce((sum, e) => sum + e.listenedMs, 0),

  todayCount: () => {
    const dayStart = startOfDay(Date.now());
    return get().history.filter((e) => e.playedAt >= dayStart).length;
  },
}));
