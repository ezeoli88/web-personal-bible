// Ported from biblia-ntv-app/src/repositories/BollsBibleRepository.ts
import type { BibleTranslation } from "../types/translation";
import { getTranslationIdPrefix } from "../types/translation";

export function makeBookId(bookNumber: number): string {
  return `book-${bookNumber}`;
}

export function makeChapterId(bookNumber: number, chapterNumber: number): string {
  return `book-${bookNumber}-chapter-${chapterNumber}`;
}

export function makeVerseId(
  translation: BibleTranslation,
  bookNumber: number,
  chapterNumber: number,
  verseNumber: number,
): string {
  return `${getTranslationIdPrefix(translation)}-${bookNumber}-${chapterNumber}-${verseNumber}`;
}

export function parseBookNumber(bookId: string): number {
  const match = /^book-(\d+)$/.exec(bookId);
  return match ? Number(match[1]) : Number.NaN;
}

export function parseChapterInfo(chapterId: string): { bookNumber: number; chapterNumber: number } {
  const match = /^book-(\d+)-chapter-(\d+)$/.exec(chapterId);
  return {
    bookNumber: match ? Number(match[1]) : Number.NaN,
    chapterNumber: match ? Number(match[2]) : Number.NaN,
  };
}
