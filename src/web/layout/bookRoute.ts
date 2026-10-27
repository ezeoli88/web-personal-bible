import { notFound, redirect } from "@tanstack/react-router";
import { resolveBookParam } from "../../core/lib/bookSlugs";
import { makeBookId, makeChapterId } from "../../core/lib/ids";
import { verseRanges } from "../../core/lib/passageBuilder";
import { isSupportedTranslation, type BibleTranslation } from "../../core/types/translation";

/** A shared link can mark at most this many verses. */
const MAX_LINKED_VERSES = 200;

/** Search params of the reader: `v` marks verses (16, 16-18 or 1-3,5), `t` opens a translation. */
export interface ReaderSearch {
  v?: number | string;
  t?: BibleTranslation;
}

export function resolveChapterRoute(bookParam: string, chapterParam: string) {
  const resolved = resolveBookParam(bookParam);
  if (!resolved) throw notFound();
  const chapterNumber = Number(chapterParam);
  if (!Number.isInteger(chapterNumber) || chapterNumber < 1 || chapterNumber > resolved.book.chapters) {
    throw notFound();
  }
  return {
    book: resolved.book,
    slug: resolved.slug,
    canonical: resolved.canonical,
    chapterNumber,
    bookId: makeBookId(resolved.book.bookNumber),
    chapterId: makeChapterId(resolved.book.bookNumber, chapterNumber),
  };
}

export function redirectCanonicalBook(bookParam: string) {
  const resolved = resolveBookParam(bookParam);
  if (!resolved) throw notFound();
  if (!resolved.canonical) {
    throw redirect({ to: "/$book", params: { book: resolved.slug }, replace: true });
  }
  return resolved;
}

export function positiveVerse(value: unknown): number | undefined {
  const parsed = typeof value === "number" ? value : typeof value === "string" && value !== "" ? Number(value) : Number.NaN;
  if (Number.isInteger(parsed) && parsed > 0) return parsed;
  return undefined;
}

/** Verses named by `?v=`: one verse, a range or a comma list of both. Undefined when invalid. */
export function parseVerseParam(value: unknown): number[] | undefined {
  const single = positiveVerse(value);
  if (single !== undefined) return [single];
  if (typeof value !== "string") return undefined;
  const verses = new Set<number>();
  for (const segment of value.replace(/\s+/g, "").split(",")) {
    const match = segment.match(/^(\d+)(?:-(\d+))?$/);
    if (!match) return undefined;
    const start = Number(match[1]);
    const end = match[2] ? Number(match[2]) : start;
    if (start < 1 || end < start || end - start >= MAX_LINKED_VERSES) return undefined;
    for (let verse = start; verse <= end; verse += 1) verses.add(verse);
    if (verses.size > MAX_LINKED_VERSES) return undefined;
  }
  return [...verses].sort((left, right) => left - right);
}

/** Inverse of parseVerseParam: a number for one verse, "16-18" or "1-3,5" otherwise. */
export function formatVerseParam(verseNumbers: number[]): number | string | undefined {
  if (verseNumbers.length === 0) return undefined;
  const ranges = verseRanges(verseNumbers);
  return ranges.length === 1 && !ranges[0].includes("-") ? Number(ranges[0]) : ranges.join(",");
}

export function validateReaderSearch(search: Record<string, unknown>): ReaderSearch {
  const verses = parseVerseParam(search.v);
  return {
    v: verses ? formatVerseParam(verses) : undefined,
    t: isSupportedTranslation(search.t) ? search.t : undefined,
  };
}
