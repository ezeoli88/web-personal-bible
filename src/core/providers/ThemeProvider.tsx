// Ported from biblia-ntv-app/src/providers/ThemeProvider.tsx
// Adapted to localStorage (`theme-mode`, `font-scale`) and `data-theme` on <html>.
// Light is the default; "system" follows prefers-color-scheme.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { readStorage, writeStorage } from "../../platform/storage";
import { getTheme, typography, type Theme, type ThemeMode } from "../theme";

const STORAGE_KEY = "theme-mode";
const FONT_SCALE_KEY = "font-scale";
const DARK_QUERY = "(prefers-color-scheme: dark)";

export type ThemePreference = ThemeMode | "system";

/** Reading text sizes relative to the theme's body size. Keep in sync with public/theme-init.js. */
export const FONT_SCALES: readonly number[] = [0.875, 1, 1.125, 1.25, 1.5];

interface ThemeContextValue {
  mode: ThemeMode;
  preference: ThemePreference;
  theme: Theme;
  setPreference: (preference: ThemePreference) => void;
  fontScale: number;
  setFontScale: (scale: number) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function isThemePreference(value: unknown): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

function readInitialPreference(): ThemePreference {
  const stored = readStorage(STORAGE_KEY);
  return isThemePreference(stored) ? stored : "light";
}

function readInitialFontScale(): number {
  const stored = Number(readStorage(FONT_SCALE_KEY));
  return FONT_SCALES.includes(stored) ? stored : 1;
}

function systemPrefersDark(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" &&
    window.matchMedia(DARK_QUERY).matches;
}

function setMeta(name: string, content: string) {
  const metas = document.head.querySelectorAll(`meta[name="${name}"]`);
  if (metas.length === 0) {
    const meta = document.createElement("meta");
    meta.setAttribute("name", name);
    meta.setAttribute("content", content);
    document.head.appendChild(meta);
    return;
  }
  metas.forEach((meta) => meta.setAttribute("content", content));
}

// `only` opts out of the browser's forced dark mode (Chrome Android "auto dark
// web contents", Android WebView/PWA). Without it the light theme gets
// algorithmically darkened on phones whose system theme is dark.
function applyTheme(mode: ThemeMode) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = mode;
  setMeta("color-scheme", `only ${mode}`);
  setMeta("theme-color", getTheme(mode).colors.background);
}

// Inline values on <html> override the theme.css tokens.
function applyFontScale(scale: number) {
  if (typeof document === "undefined") return;
  const { style } = document.documentElement;
  if (scale === 1) {
    style.removeProperty("--font-body-size");
    style.removeProperty("--font-body-line-height");
    return;
  }
  style.setProperty("--font-body-size", `${typography.body.fontSize * scale}px`);
  style.setProperty("--font-body-line-height", `${typography.body.lineHeight * scale}px`);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(readInitialPreference);
  const [systemDark, setSystemDark] = useState(systemPrefersDark);
  const [fontScale, setFontScaleState] = useState(readInitialFontScale);
  const mode: ThemeMode = preference === "system" ? (systemDark ? "dark" : "light") : preference;

  useEffect(() => applyTheme(mode), [mode]);
  useEffect(() => applyFontScale(fontScale), [fontScale]);

  useEffect(() => {
    if (preference !== "system" || typeof window.matchMedia !== "function") return;
    const query = window.matchMedia(DARK_QUERY);
    const update = () => setSystemDark(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, [preference]);

  const setPreference = useCallback((next: ThemePreference) => {
    writeStorage(STORAGE_KEY, next);
    if (next === "system") setSystemDark(systemPrefersDark());
    setPreferenceState(next);
  }, []);

  const setFontScale = useCallback((scale: number) => {
    if (!FONT_SCALES.includes(scale)) return;
    writeStorage(FONT_SCALE_KEY, String(scale));
    setFontScaleState(scale);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ mode, preference, theme: getTheme(mode), setPreference, fontScale, setFontScale }),
    [fontScale, mode, preference, setFontScale, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme debe usarse dentro de ThemeProvider");
  return context;
}
