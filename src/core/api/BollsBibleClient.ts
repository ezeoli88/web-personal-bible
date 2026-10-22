// Ported from biblia-ntv-app/src/api/BollsBibleClient.ts
import { TRANSLATION_CHAPTER_ENDPOINTS, type BibleTranslation } from "../types/translation";

export interface BollsVerse {
  pk: number;
  verse: number;
  text: string;
  chapter?: number;
  book?: number;
  translation?: string;
  comment?: string;
}

export interface BollsBook {
  bookid: number;
  name: string;
  chronorder: number;
  chapters: number;
}

const TAKEDOWN_MARKERS = ["me prohibió usar la traducción", "prohibited me from using"];

export class BollsTranslationUnavailableError extends Error {
  translation: BibleTranslation;

  constructor(translation: BibleTranslation) {
    super(
      `La traducción ${translation} no está disponible en este momento: ` +
        "el proveedor devolvió un aviso en lugar del texto bíblico. Probá con otra traducción.",
    );
    this.name = "BollsTranslationUnavailableError";
    this.translation = translation;
  }
}

export function isBollsTakedownNotice(verses: BollsVerse[]): boolean {
  if (verses.length === 0) return false;
  const hasMarker = verses.some((verse) => TAKEDOWN_MARKERS.some((marker) => verse.text.includes(marker)));
  if (hasMarker) return true;
  if (verses.length < 2) return false;
  const first = verses[0].text.trim();
  return first.length > 0 && verses.every((verse) => verse.text.trim() === first);
}

export class BollsBibleClient {
  private baseUrl: string;

  constructor(baseUrl = "https://bolls.life") {
    this.baseUrl = baseUrl;
  }

  async getBooks(translation: BibleTranslation, signal?: AbortSignal): Promise<BollsBook[]> {
    const response = await fetch(`${this.baseUrl}/get-books/${translation}/`, { signal });
    if (!response.ok) throw new Error(`Bolls API error: ${response.status}`);
    return response.json();
  }

  async getChapter(
    translation: BibleTranslation,
    bookNumber: number,
    chapterNumber: number,
    signal?: AbortSignal,
  ): Promise<BollsVerse[]> {
    const endpoint = TRANSLATION_CHAPTER_ENDPOINTS[translation];
    const response = await fetch(
      `${this.baseUrl}/${endpoint}/${translation}/${bookNumber}/${chapterNumber}/`,
      { signal },
    );
    if (!response.ok) throw new Error(`Bolls API error: ${response.status}`);

    const payload: unknown = await response.json();
    if (!Array.isArray(payload)) throw new Error("Respuesta inválida de Bolls");

    const verses = payload.filter(
      (value): value is BollsVerse =>
        typeof value === "object" &&
        value !== null &&
        typeof (value as BollsVerse).verse === "number" &&
        typeof (value as BollsVerse).text === "string",
    );

    if (isBollsTakedownNotice(verses)) throw new BollsTranslationUnavailableError(translation);
    return verses;
  }

  async getVerse(
    translation: BibleTranslation,
    bookNumber: number,
    chapterNumber: number,
    verseNumber: number,
    signal?: AbortSignal,
  ): Promise<BollsVerse> {
    const response = await fetch(
      `${this.baseUrl}/get-verse/${translation}/${bookNumber}/${chapterNumber}/${verseNumber}/`,
      { signal },
    );
    if (!response.ok) throw new Error(`Bolls API error: ${response.status}`);

    const payload: unknown = await response.json();
    if (
      typeof payload !== "object" ||
      payload === null ||
      typeof (payload as BollsVerse).verse !== "number" ||
      typeof (payload as BollsVerse).text !== "string"
    ) {
      throw new Error("Respuesta inválida de Bolls");
    }
    if (isBollsTakedownNotice([payload as BollsVerse])) {
      throw new BollsTranslationUnavailableError(translation);
    }
    return payload as BollsVerse;
  }
}
