// Ported from biblia-ntv-app/src/lib/passageBuilder.ts
import type { BiblePassage } from "../types/ai";
import type { Verse } from "../types/bible";
import { getTranslationIdPrefix, type BibleTranslation } from "../types/translation";

export const MAX_AI_VERSES = 10;
export const MAX_AI_CHARACTERS = 2000;

interface BuildBiblePassageParams {
  bookName: string;
  chapterNumber: number;
  selectedVerses: Verse[];
  translation: BibleTranslation;
}

export function buildReference(
  bookName: string,
  chapterNumber: number,
  verseNumbers: number[],
): string {
  if (verseNumbers.length === 0) {
    return `${bookName} ${chapterNumber}`;
  }

  const sorted = [...verseNumbers].sort((left, right) => left - right);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  if (first === last) {
    return `${bookName} ${chapterNumber}:${first}`;
  }

  const consecutive = sorted.every(
    (verse, index) => index === 0 || verse === sorted[index - 1] + 1,
  );

  return consecutive
    ? `${bookName} ${chapterNumber}:${first}-${last}`
    : `${bookName} ${chapterNumber}:${sorted.join(",")}`;
}

/** Agrupa versículos en tramos contiguos ordenados. Ej.: [5, 1, 2, 3] → ["1-3", "5"]. */
export function verseRanges(verseNumbers: number[]): string[] {
  const sorted = [...new Set(verseNumbers)].sort((left, right) => left - right);
  const ranges: string[] = [];
  let start = sorted[0];
  for (let index = 1; index <= sorted.length; index += 1) {
    const previous = sorted[index - 1];
    if (sorted[index] === previous + 1) continue;
    ranges.push(start === previous ? `${start}` : `${start}-${previous}`);
    start = sorted[index];
  }
  return ranges;
}

/**
 * Referencia legible para mostrar: agrupa tramos contiguos y separa con ", ".
 * Ej.: "Juan 3:16-18", "Juan 3:16, 18", "Juan 3:1-3, 5".
 */
export function formatVerseReference(
  bookName: string,
  chapterNumber: number,
  verseNumbers: number[],
): string {
  if (verseNumbers.length === 0) return `${bookName} ${chapterNumber}`;
  return `${bookName} ${chapterNumber}:${verseRanges(verseNumbers).join(", ")}`;
}

export function buildBiblePassage({
  bookName,
  chapterNumber,
  selectedVerses,
  translation,
}: BuildBiblePassageParams): BiblePassage {
  if (selectedVerses.length === 0) {
    throw new Error("Seleccioná al menos un versículo.");
  }

  if (selectedVerses.length > MAX_AI_VERSES) {
    throw new Error(`Podés seleccionar hasta ${MAX_AI_VERSES} versículos.`);
  }

  const idPrefix = `${getTranslationIdPrefix(translation)}-`;
  const ordered = [...selectedVerses].sort((left, right) => left.number - right.number);
  const verses = ordered.map((verse) => {
    const text = verse.text.trim();
    if (!text) {
      throw new Error(`El versículo ${verse.number} no contiene texto válido.`);
    }
    if (!verse.id.startsWith(idPrefix)) {
      throw new Error("La selección pertenece a otra traducción. Volvé a seleccionarla.");
    }

    return { id: verse.id, text };
  });

  return {
    reference: buildReference(bookName, chapterNumber, ordered.map((verse) => verse.number)),
    translation,
    verses,
  };
}

export function getPassageCharacterCount(passage: BiblePassage): number {
  return passage.verses.reduce((total, verse) => total + verse.text.length, 0);
}
