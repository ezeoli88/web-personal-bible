// Spanish book slugs without accents, derived from the canonical names.
import { BIBLE_BOOKS, type BibleBookInfo } from "../data/bibleStructure";

export function slugifyBookName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const bySlug = new Map<string, BibleBookInfo>();
const byNumber = new Map<number, BibleBookInfo>();

for (const book of BIBLE_BOOKS) {
  bySlug.set(slugifyBookName(book.name), book);
  byNumber.set(book.bookNumber, book);
}

export function bookSlug(bookNumber: number): string | null {
  const book = byNumber.get(bookNumber);
  return book ? slugifyBookName(book.name) : null;
}

export function bookFromSlug(slug: string): BibleBookInfo | null {
  return bySlug.get(slug) ?? null;
}

export function bookFromNumber(bookNumber: number): BibleBookInfo | null {
  return byNumber.get(bookNumber) ?? null;
}

export interface ResolvedBook {
  book: BibleBookInfo;
  slug: string;
  /** False when the URL used a numeric book id and should redirect to the slug. */
  canonical: boolean;
}

export function resolveBookParam(param: string): ResolvedBook | null {
  if (/^\d+$/.test(param)) {
    const book = bookFromNumber(Number(param));
    if (!book) return null;
    return { book, slug: slugifyBookName(book.name), canonical: false };
  }
  const book = bookFromSlug(param);
  if (!book) return null;
  return { book, slug: param, canonical: true };
}
