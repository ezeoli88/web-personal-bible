import type { BibleTranslation } from "../../core/types/translation";

const KEY = "bw-pending-selection";

export interface PendingSelection {
  path: string;
  verseIds: string[];
  translation: BibleTranslation;
}

export function savePendingSelection(value: PendingSelection): void {
  sessionStorage.setItem(KEY, JSON.stringify(value));
}

export function readPendingSelection(): PendingSelection | null {
  const raw = sessionStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PendingSelection>;
    if (!parsed || typeof parsed.path !== "string" || !Array.isArray(parsed.verseIds)) return null;
    if (typeof parsed.translation !== "string") return null;
    return {
      path: parsed.path,
      verseIds: parsed.verseIds.filter((id): id is string => typeof id === "string"),
      translation: parsed.translation as BibleTranslation,
    };
  } catch {
    return null;
  }
}

export function clearPendingSelection(): void {
  sessionStorage.removeItem(KEY);
}
