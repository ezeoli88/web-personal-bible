import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function mediaQuery(): MediaQueryList | null {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return null;
  return window.matchMedia(QUERY);
}

function subscribe(onChange: () => void): () => void {
  const query = mediaQuery();
  if (!query) return () => {};
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function getSnapshot(): boolean {
  return mediaQuery()?.matches ?? false;
}

export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
