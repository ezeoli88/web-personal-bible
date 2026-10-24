// Ported from biblia-ntv-app/src/providers/ThemeProvider.tsx
// Adapted to localStorage (`theme-mode`) and `data-theme` on <html>. Light is the default.
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { readStorage, writeStorage } from "../../platform/storage";
import { getTheme, type Theme, type ThemeMode } from "../theme";

const STORAGE_KEY = "theme-mode";

interface ThemeContextValue {
  mode: ThemeMode;
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function isThemeMode(value: unknown): value is ThemeMode {
  return value === "light" || value === "dark";
}

function readInitialMode(): ThemeMode {
  const stored = readStorage(STORAGE_KEY);
  return isThemeMode(stored) ? stored : "light";
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

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(() => {
    const initial = readInitialMode();
    applyTheme(initial);
    return initial;
  });

  const toggleTheme = useCallback(() => {
    setMode((current) => {
      const next: ThemeMode = current === "light" ? "dark" : "light";
      writeStorage(STORAGE_KEY, next);
      applyTheme(next);
      return next;
    });
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ mode, theme: getTheme(mode), toggleTheme }),
    [mode, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme debe usarse dentro de ThemeProvider");
  return context;
}
