// Ported from biblia-ntv-app/src/theme/index.ts
// Tokens only: React Native and React Navigation imports are not part of the web client.

export type ThemeMode = "light" | "dark";

export interface ThemeColors {
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  border: string;
  highlight: string;
  selection: string;
  primary: string;
  onPrimary: string;
  error: string;
}

export interface Theme {
  colors: ThemeColors;
  spacing: typeof spacing;
  typography: typeof typography;
  borderRadius: typeof borderRadius;
}

export const spacing = {
  xs: 4,
  s: 8,
  m: 16,
  l: 24,
  xl: 32,
};

export const typography = {
  title: {
    fontSize: 22,
    fontWeight: "700" as const,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: "600" as const,
  },
  body: {
    fontSize: 18,
    lineHeight: 28,
  },
  caption: {
    fontSize: 14,
  },
  verseNumber: {
    fontSize: 12,
    fontWeight: "700" as const,
  },
};

export const borderRadius = {
  s: 4,
  m: 8,
  l: 12,
  round: 9999,
};

export const lightTheme: Theme = {
  colors: {
    background: "#ffffff",
    surface: "#f8f9fa",
    text: "#202124",
    textSecondary: "#5f6368",
    textTertiary: "#9aa0a6",
    border: "#dadce0",
    highlight: "#e8f0fe",
    selection: "#dbeafe",
    primary: "#1a73e8",
    onPrimary: "#ffffff",
    error: "#d93025",
  },
  spacing,
  typography,
  borderRadius,
};

export const darkTheme: Theme = {
  colors: {
    background: "#121417",
    surface: "#1e2126",
    text: "#e8eaed",
    textSecondary: "#9aa0a6",
    textTertiary: "#80868b",
    border: "#3c4043",
    highlight: "#1a3a5c",
    selection: "#234a78",
    primary: "#8ab4f8",
    onPrimary: "#121417",
    error: "#f28b82",
  },
  spacing,
  typography,
  borderRadius,
};

export function getTheme(mode: ThemeMode): Theme {
  return mode === "dark" ? darkTheme : lightTheme;
}
