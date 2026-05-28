export interface ThemeColors {
  base:             string; // --color-base
  surface:          string; // --color-surface
  surfaceElevated:  string; // --color-surface-elevated
  sidebarBg:        string; // --color-sidebar-bg
  accent:           string; // --color-accent
  accentHover:      string; // --color-accent-hover
  text:             string; // --color-text
  textMuted:        string; // --color-text-muted
  textDim:          string; // --color-text-dim
  border:           string; // --color-border
}

export interface Theme {
  id:      string;
  name:    string;
  builtIn: boolean;
  colors:  ThemeColors;
}

export const COLOR_FIELDS: { key: keyof ThemeColors; label: string }[] = [
  { key: "sidebarBg",       label: "Frame"            },
  { key: "base",            label: "Background"       },
  { key: "surface",         label: "Surface"          },
  { key: "surfaceElevated", label: "Surface Elevated" },
  { key: "border",          label: "Border"           },
  { key: "accent",          label: "Accent"           },
  { key: "accentHover",     label: "Accent Hover"     },
  { key: "text",            label: "Text"             },
  { key: "textMuted",       label: "Muted Text"       },
  { key: "textDim",         label: "Dim Text"         },
];

export const BUILT_IN_THEMES: Theme[] = [
  {
    id: "default", name: "Localify", builtIn: true,
    colors: {
      base: "#121212", surface: "#181818", surfaceElevated: "#282828", sidebarBg: "#000000",
      accent: "#1db954", accentHover: "#1ed760",
      text: "#ffffff", textMuted: "#b3b3b3", textDim: "#6a6a6a", border: "#282828",
    },
  },
  {
    id: "midnight", name: "Midnight", builtIn: true,
    colors: {
      base: "#0d1117", surface: "#161b22", surfaceElevated: "#21262d", sidebarBg: "#010409",
      accent: "#58a6ff", accentHover: "#79b8ff",
      text: "#e6edf3", textMuted: "#8b949e", textDim: "#484f58", border: "#30363d",
    },
  },
  {
    id: "amber", name: "Amber", builtIn: true,
    colors: {
      base: "#1a0f0a", surface: "#221510", surfaceElevated: "#332018", sidebarBg: "#0d0805",
      accent: "#f5a623", accentHover: "#ffbb4a",
      text: "#fff8e7", textMuted: "#c8a882", textDim: "#7a5c30", border: "#3e2006",
    },
  },
  {
    id: "arctic", name: "Arctic", builtIn: true,
    colors: {
      base: "#0f1923", surface: "#162330", surfaceElevated: "#1e3040", sidebarBg: "#060c10",
      accent: "#38bdf8", accentHover: "#7dd3fc",
      text: "#e2f3ff", textMuted: "#7da8c5", textDim: "#3e6480", border: "#243545",
    },
  },
  {
    id: "rose", name: "Rose", builtIn: true,
    colors: {
      base: "#160b1d", surface: "#1e1028", surfaceElevated: "#2a1636", sidebarBg: "#0d0610",
      accent: "#f472b6", accentHover: "#fb9ed6",
      text: "#fde8f4", textMuted: "#b87ea0", textDim: "#6b3d57", border: "#3b1f4f",
    },
  },
  {
    id: "forest", name: "Forest", builtIn: true,
    colors: {
      base: "#0c1610", surface: "#111e15", surfaceElevated: "#19291d", sidebarBg: "#040c06",
      accent: "#4ade80", accentHover: "#86efac",
      text: "#e8f8ed", textMuted: "#7bb88c", textDim: "#3d6649", border: "#243628",
    },
  },
  {
    id: "dracula", name: "Dracula", builtIn: true,
    colors: {
      base: "#1e1f29", surface: "#282a36", surfaceElevated: "#343746", sidebarBg: "#191a23",
      accent: "#bd93f9", accentHover: "#d0abff",
      text: "#f8f8f2", textMuted: "#6272a4", textDim: "#44475a", border: "#44475a",
    },
  },
  {
    id: "sepia", name: "Sepia", builtIn: true,
    colors: {
      base: "#1a1710", surface: "#22200f", surfaceElevated: "#302d1c", sidebarBg: "#0e0c08",
      accent: "#e8c96a", accentHover: "#f0d88a",
      text: "#f5ead0", textMuted: "#a89060", textDim: "#6e5c3a", border: "#3d3921",
    },
  },
];

const ACTIVE_ID_KEY = "localify:theme-active";

export function applyTheme(theme: Theme): void {
  const s = document.documentElement.style;
  const c = theme.colors;
  s.setProperty("--color-base",             c.base);
  s.setProperty("--color-surface",          c.surface);
  s.setProperty("--color-surface-elevated", c.surfaceElevated);
  s.setProperty("--color-sidebar-bg",       c.sidebarBg);
  s.setProperty("--color-accent",           c.accent);
  s.setProperty("--color-accent-hover",     c.accentHover);
  s.setProperty("--color-text",             c.text);
  s.setProperty("--color-text-muted",       c.textMuted);
  s.setProperty("--color-text-dim",         c.textDim);
  s.setProperty("--color-border",           c.border);
}

// Called synchronously in main.tsx before React renders to prevent flash.
export function bootstrapTheme(): void {
  const activeId = localStorage.getItem(ACTIVE_ID_KEY) ?? "default";
  const builtIn  = BUILT_IN_THEMES.find(t => t.id === activeId);
  if (builtIn) { applyTheme(builtIn); return; }
  try {
    const raw     = localStorage.getItem("localify:themes-custom");
    const customs = raw ? (JSON.parse(raw) as Theme[]) : [];
    const custom  = customs.find(t => t.id === activeId);
    if (custom) applyTheme(custom);
  } catch { /* ignore parse errors */ }
}
