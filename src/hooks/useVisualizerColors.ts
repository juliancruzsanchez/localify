import { useState, useCallback } from "react";

export interface ModeColors {
  primary: string;
  secondary: string;
}

export interface VisualizerColors {
  bars:      ModeColors & { peak: string };
  alchemy:   ModeColors;
  plasma:    ModeColors;
  vortex:    ModeColors;
  radial:    ModeColors;
  synthgrid: ModeColors & { sun: string; stars: string };
  tunnel:    ModeColors;
  ocean:     ModeColors;
  warp:      ModeColors;
  hypno:     ModeColors;
  dna:       ModeColors;
  melt:      ModeColors;
}

export const DEFAULT_COLORS: VisualizerColors = {
  bars:      { primary: "#00b8ff", secondary: "#003399", peak: "#00f0ff" },
  alchemy:   { primary: "#00d060", secondary: "#9900ff" },
  plasma:    { primary: "#40c8ff", secondary: "#0055ee" },
  vortex:    { primary: "#ff6600", secondary: "#ffdd44" },
  radial:    { primary: "#ff00cc", secondary: "#00ffaa" },
  synthgrid: { primary: "#ff14c8", secondary: "#8c1eff", sun: "#ff7020", stars: "#ffffff" },
  tunnel:    { primary: "#b050ff", secondary: "#0064ff" },
  ocean:     { primary: "#00e8ff", secondary: "#0010cc" },
  warp:      { primary: "#00aaff", secondary: "#ff44cc" },
  hypno:     { primary: "#ff00aa", secondary: "#00ffdd" },
  dna:       { primary: "#00ff88", secondary: "#ff0088" },
  melt:      { primary: "#ff4400", secondary: "#8800ff" },
};

const STORAGE_KEY = "localify:visualizer-colors";

function load(): VisualizerColors {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return Object.fromEntries(
        Object.entries(DEFAULT_COLORS).map(([k, v]) => [k, { ...v, ...parsed[k] }]),
      ) as VisualizerColors;
    }
  } catch {}
  return DEFAULT_COLORS;
}

export function useVisualizerColors() {
  const [colors, setColors] = useState<VisualizerColors>(load);

  const updateColor = useCallback((
    mode: keyof VisualizerColors,
    key: string,
    value: string,
  ) => {
    setColors(prev => {
      const next = { ...prev, [mode]: { ...(prev[mode] as object), [key]: value } };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const resetColors = useCallback(() => {
    setColors(DEFAULT_COLORS);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  }, []);

  return { colors, updateColor, resetColors };
}
