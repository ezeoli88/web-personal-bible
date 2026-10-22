import { useTheme } from "../../core/providers/ThemeProvider";
import styles from "./ThemeToggle.module.css";

export function ThemeToggle() {
  const { mode, toggleTheme } = useTheme();
  const isDark = mode === "dark";
  return (
    <button
      type="button"
      data-testid="theme-toggle"
      className={styles.button}
      aria-label={isDark ? "Activar tema claro" : "Activar tema oscuro"}
      onClick={toggleTheme}
    >
      {isDark ? (
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" fill="none" stroke="currentColor" strokeWidth="2" /></svg>
      ) : (
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 14.5A8.5 8.5 0 1 1 9.5 3 7 7 0 0 0 21 14.5z" fill="none" stroke="currentColor" strokeWidth="2" /></svg>
      )}
    </button>
  );
}
