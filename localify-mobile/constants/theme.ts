// Re-export theme utilities from the theme store
export { useColors, BUILT_IN_THEMES, useThemeStore } from '../store/themeStore';
export type { ThemeColors, AppTheme } from '../store/themeStore';

// Static layout constants (don't change with theme)
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const FontSize = {
  xs: 11,
  sm: 13,
  md: 14,
  base: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const Radius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 24,
  full: 9999,
};
