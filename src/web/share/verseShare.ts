import { formatVerseReference } from "../../core/lib/passageBuilder";
import type { Verse } from "../../core/types/bible";
import type { BibleTranslation } from "../../core/types/translation";
import type { SharePayload } from "../../platform/share";
import { formatVerseParam } from "../layout/bookRoute";

interface VerseShareParams {
  bookName: string;
  chapterNumber: number;
  slug: string;
  translation: BibleTranslation;
  verses: Verse[];
  origin: string;
}

function plainVerseText(text: string): string {
  return text.replace(/\[\d+\]/g, "").replace(/\s+/g, " ").trim();
}

/** Link that opens the same verses, highlighted, in the same translation. */
export function verseLink(origin: string, slug: string, chapterNumber: number, verseNumbers: number[], translation: BibleTranslation): string {
  const verses = formatVerseParam(verseNumbers);
  const search = verses === undefined ? `?t=${translation}` : `?v=${verses}&t=${translation}`;
  return `${origin}/${slug}/${chapterNumber}${search}`;
}

export function buildVerseShare({ bookName, chapterNumber, slug, translation, verses, origin }: VerseShareParams): SharePayload {
  const ordered = [...verses].sort((left, right) => left.number - right.number);
  const numbers = ordered.map((verse) => verse.number);
  const body = ordered.length === 1
    ? plainVerseText(ordered[0].text)
    : ordered.map((verse) => `${verse.number} ${plainVerseText(verse.text)}`).join(" ");
  const reference = `${formatVerseReference(bookName, chapterNumber, numbers)} (${translation})`;
  return {
    title: reference,
    text: `«${body}»\n${reference}`,
    url: verseLink(origin, slug, chapterNumber, numbers, translation),
  };
}
