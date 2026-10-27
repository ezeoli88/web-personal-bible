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

/** The verse under the middle of the screen, or null over a gap, the action bar or a dialog. */
function verseAtScreenCenter(): number | null {
  const first = document.querySelector<HTMLElement>("[data-verse-number]");
  if (!first || typeof document.elementFromPoint !== "function") return null;
  const { left, width } = first.getBoundingClientRect();
  const verse = document.elementFromPoint(left + width / 2, window.innerHeight / 2)?.closest<HTMLElement>("[data-verse-number]");
  return verse ? Number(verse.dataset.verseNumber) : null;
}

/**
 * Remembers the chapter being read and, once scrolling settles, the verse in
 * the middle of the screen. It starts from `startVerse` (the linked verse) or the first one.
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

    let timer: number | undefined;
    const onScroll = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const verse = verseAtScreenCenter();
        if (verse) save(verse);
      }, SAVE_DELAY_MS);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.clearTimeout(timer);
    };
  }, [chapter, slug, startVerse, translation, verses]);
}
