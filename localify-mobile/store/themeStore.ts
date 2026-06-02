import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceElevated: string;
  tabBar: string;
  accent: string;
  accentHover: string;
  text: string;
  textMuted: string;
  textDim: string;
  border: string;
  error: string;
}

export interface AppTheme {
  id: string;
  name: string;
  colors: ThemeColors;
}

export const BUILT_IN_THEMES: AppTheme[] = [
  {
    id: 'default', name: 'Localify',
    colors: {
      background: '#121212', surface: '#181818', surfaceElevated: '#282828', tabBar: '#000000',
      accent: '#1db954', accentHover: '#1ed760',
      text: '#ffffff', textMuted: '#b3b3b3', textDim: '#6a6a6a', border: '#282828', error: '#ef4444',
    },
  },
  {
    id: 'midnight', name: 'Midnight',
    colors: {
      background: '#0d1117', surface: '#161b22', surfaceElevated: '#21262d', tabBar: '#010409',
      accent: '#58a6ff', accentHover: '#79b8ff',
      text: '#e6edf3', textMuted: '#8b949e', textDim: '#484f58', border: '#30363d', error: '#f85149',
    },
  },
  {
    id: 'amber', name: 'Amber',
    colors: {
      background: '#1a0f0a', surface: '#221510', surfaceElevated: '#332018', tabBar: '#0d0805',
      accent: '#f5a623', accentHover: '#ffbb4a',
      text: '#fff8e7', textMuted: '#c8a882', textDim: '#7a5c30', border: '#3e2006', error: '#ef4444',
    },
  },
  {
    id: 'arctic', name: 'Arctic',
    colors: {
      background: '#0f1923', surface: '#162330', surfaceElevated: '#1e3040', tabBar: '#060c10',
      accent: '#38bdf8', accentHover: '#7dd3fc',
      text: '#e2f3ff', textMuted: '#7da8c5', textDim: '#3e6480', border: '#243545', error: '#f87171',
    },
  },
  {
    id: 'rose', name: 'Rose',
    colors: {
      background: '#160b1d', surface: '#1e1028', surfaceElevated: '#2a1636', tabBar: '#0d0610',
      accent: '#f472b6', accentHover: '#fb9ed6',
      text: '#fde8f4', textMuted: '#b87ea0', textDim: '#6b3d57', border: '#3b1f4f', error: '#f87171',
    },
  },
  {
    id: 'forest', name: 'Forest',
    colors: {
      background: '#0c1610', surface: '#111e15', surfaceElevated: '#19291d', tabBar: '#040c06',
      accent: '#4ade80', accentHover: '#86efac',
      text: '#e8f8ed', textMuted: '#7bb88c', textDim: '#3d6649', border: '#243628', error: '#f87171',
    },
  },
  {
    id: 'dracula', name: 'Dracula',
    colors: {
      background: '#1e1f29', surface: '#282a36', surfaceElevated: '#343746', tabBar: '#191a23',
      accent: '#bd93f9', accentHover: '#d0abff',
      text: '#f8f8f2', textMuted: '#6272a4', textDim: '#44475a', border: '#44475a', error: '#ff5555',
    },
  },
  {
    id: 'sepia', name: 'Sepia',
    colors: {
      background: '#1a1710', surface: '#22200f', surfaceElevated: '#302d1c', tabBar: '#0e0c08',
      accent: '#e8c96a', accentHover: '#f0d88a',
      text: '#f5ead0', textMuted: '#a89060', textDim: '#6e5c3a', border: '#3d3921', error: '#ef4444',
    },
  },
];

const THEME_KEY = 'localify:theme-active';

interface ThemeState {
  activeThemeId: string;
  colors: ThemeColors;
  setTheme: (themeId: string) => Promise<void>;
  loadTheme: () => Promise<void>;
}

export const useThemeStore = create<ThemeState>((set) => ({
  activeThemeId: 'default',
  colors: BUILT_IN_THEMES[0].colors,

  setTheme: async (themeId: string) => {
    const theme = BUILT_IN_THEMES.find((t) => t.id === themeId) ?? BUILT_IN_THEMES[0];
    await AsyncStorage.setItem(THEME_KEY, themeId);
    set({ activeThemeId: themeId, colors: theme.colors });
  },

  loadTheme: async () => {
    try {
      const stored = await AsyncStorage.getItem(THEME_KEY);
      if (stored) {
        const theme = BUILT_IN_THEMES.find((t) => t.id === stored);
        if (theme) set({ activeThemeId: stored, colors: theme.colors });
      }
    } catch {}
  },
}));

export function useColors(): ThemeColors {
  return useThemeStore((s) => s.colors);
}
