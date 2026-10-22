import { notFound, redirect } from "@tanstack/react-router";
import { resolveBookParam } from "../../core/lib/bookSlugs";
import { makeBookId, makeChapterId } from "../../core/lib/ids";

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
