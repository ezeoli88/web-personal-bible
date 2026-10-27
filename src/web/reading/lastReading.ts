import { useEffect } from "react";
import { bookFromSlug } from "../../core/lib/bookSlugs";
import type { Verse } from "../../core/types/bible";
import { isSupportedTranslation, type BibleTranslation } from "../../core/types/translation";
import { readStorage, writeStorage } from "../../platform/storage";

const STORAGE_KEY = "last-reading";
const SAVE_DELAY_MS = 400;

export interface LastReading {
  slug: string;
  bookName: string;
  chapter: number;
  verse: number;
  translation: BibleTranslation;
}

type StoredReading = Omit<LastReading, "bookName">;

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

export function readLastReading(): LastReading | null {
  const raw = readStorage(STORAGE_KEY);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<StoredReading> | null;
    const book = typeof value?.slug === "string" ? bookFromSlug(value.slug) : null;
    if (!value || !book || !isSupportedTranslation(value.translation)) return null;
    if (!isPositiveInteger(value.chapter) || value.chapter > book.chapters || !isPositiveInteger(value.verse)) return null;
    return { slug: value.slug!, bookName: book.name, chapter: value.chapter, verse: value.verse, translation: value.translation };
  } catch {
    return null;
  }
}

export function writeLastReading(reading: StoredReading): void {
  const { slug, chapter, verse, translation } = reading;
  writeStorage(STORAGE_KEY, JSON.stringify({ slug, chapter, verse, translation }));
}

/**
 * Remembers the chapter being read and the verse in the middle of the screen,
 * starting from `startVerse` (the linked verse) or the first one.
 */
export function useRememberReading(options: {
  slug: string;
  chapter: number;
  translation: BibleTranslation;
  verses: Verse[];
  startVerse?: number;
}) {
  const { slug, chapter, translation, verses, startVerse } = options;

  useEffect(() => {
    if (verses.length === 0) return;
    const save = (verse: number) => writeLastReading({ slug, chapter, verse, translation });
    save(startVerse ?? verses[0].number);
    if (typeof IntersectionObserver === "undefined") return;

    let timer: number | undefined;
    const visible = new Set<number>();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const verse = Number((entry.target as HTMLElement).dataset.verseNumber);
        if (entry.isIntersecting) visible.add(verse);
        else visible.delete(verse);
      }
      if (visible.size === 0) return;
      window.clearTimeout(timer);
      const current = Math.min(...visible);
      timer = window.setTimeout(() => save(current), SAVE_DELAY_MS);
    }, { rootMargin: "-45% 0px -45% 0px" });
    document.querySelectorAll<HTMLElement>("[data-verse-number]").forEach((element) => observer.observe(element));
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, [chapter, slug, startVerse, translation, verses]);
}
