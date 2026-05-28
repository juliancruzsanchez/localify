import { useState, useCallback } from "react";
import { BUILT_IN_THEMES, applyTheme, type Theme } from "@/lib/themes";

const ACTIVE_ID_KEY = "localify:theme-active";
const CUSTOM_KEY    = "localify:themes-custom";

function loadCustom(): Theme[] {
  try {
    const raw = localStorage.getItem(CUSTOM_KEY);
    return raw ? (JSON.parse(raw) as Theme[]) : [];
  } catch { return []; }
}

function loadActiveId(): string {
  return localStorage.getItem(ACTIVE_ID_KEY) ?? "default";
}

export function useTheme() {
  const [customThemes, setCustomThemes] = useState<Theme[]>(loadCustom);
  const [activeId, setActiveId]         = useState<string>(loadActiveId);

  const allThemes   = [...BUILT_IN_THEMES, ...customThemes];
  const activeTheme = allThemes.find(t => t.id === activeId) ?? BUILT_IN_THEMES[0];

  const activateTheme = useCallback((id: string) => {
    const theme = [...BUILT_IN_THEMES, ...loadCustom()].find(t => t.id === id);
    if (!theme) return;
    setActiveId(id);
    localStorage.setItem(ACTIVE_ID_KEY, id);
    applyTheme(theme);
  }, []);

  const saveCustomTheme = useCallback((theme: Theme) => {
    setCustomThemes(prev => {
      const next = prev.some(t => t.id === theme.id)
        ? prev.map(t => (t.id === theme.id ? theme : t))
        : [...prev, theme];
      localStorage.setItem(CUSTOM_KEY, JSON.stringify(next));
      return next;
    });
    // Make the saved theme active
    setActiveId(theme.id);
    localStorage.setItem(ACTIVE_ID_KEY, theme.id);
    applyTheme(theme);
  }, []);

  const deleteCustomTheme = useCallback((id: string, currentActiveId: string) => {
    setCustomThemes(prev => {
      const next = prev.filter(t => t.id !== id);
      localStorage.setItem(CUSTOM_KEY, JSON.stringify(next));
      return next;
    });
    if (currentActiveId === id) {
      setActiveId("default");
      localStorage.setItem(ACTIVE_ID_KEY, "default");
      applyTheme(BUILT_IN_THEMES[0]);
    }
  }, []);

  return { allThemes, activeTheme, activeId, customThemes, activateTheme, saveCustomTheme, deleteCustomTheme };
}
