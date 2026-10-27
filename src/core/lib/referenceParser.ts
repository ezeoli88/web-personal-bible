// Parses what a reader types ("Jn 3:16", "1 cor 13", "salmo 23:1-3") into a passage.
import { BIBLE_BOOKS, type BibleBookInfo } from "../data/bibleStructure";

/** Common Spanish abbreviations beyond full names and unique prefixes, by book number. */
const BOOK_ALIASES: Record<number, string[]> = {
  1: ["gn"], 2: ["ex"], 3: ["lv"], 4: ["nm"], 5: ["dt"], 6: ["jos"], 7: ["jue", "jc"], 8: ["rt"],
  9: ["1s"], 10: ["2s"], 11: ["1r"], 12: ["2r"], 13: ["1cr"], 14: ["2cr"], 16: ["ne"], 17: ["est"],
  18: ["jb"], 19: ["sal", "salmo", "sl"], 20: ["pr"], 21: ["ec", "ecl"], 22: ["cnt", "cantar", "cantar de los cantares"],
  23: ["is"], 24: ["jr"], 25: ["lm"], 26: ["ez"], 27: ["dn"], 28: ["os"], 29: ["jl"], 30: ["am"],
  31: ["abd"], 32: ["jon"], 33: ["mi", "miq"], 34: ["na"], 35: ["hab"], 36: ["sof"], 37: ["ag"], 38: ["zac"],
  39: ["mal"], 40: ["mt"], 41: ["mr", "mc", "mar"], 42: ["lc"], 43: ["jn"], 44: ["hch"], 45: ["ro"],
  46: ["1co"], 47: ["2co"], 48: ["ga"], 49: ["ef"], 50: ["fil", "flp"], 51: ["col"], 52: ["1ts"], 53: ["2ts"],
  54: ["1ti"], 55: ["2ti"], 56: ["tit"], 57: ["flm"], 58: ["he"], 59: ["stg", "sant"], 60: ["1p"], 61: ["2p"],
  62: ["1j", "1jn"], 63: ["2j", "2jn"], 64: ["3j", "3jn"], 65: ["jud"], 66: ["ap"],
};

export interface ParsedReference {
  book: BibleBookInfo;
  chapter?: number;
  /** Verse numbers in order; a range expands to every verse in it. */
  verses?: number[];
}

/** Lowercase, no accents or dots, single spaces and a leading book number glued ("1 cor" → "1cor"). */
function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\./g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^([123])\s+(?=\D)/, "$1");
}

const booksByKey = new Map<string, BibleBookInfo>();
const fullNames: Array<[string, BibleBookInfo]> = [];
for (const book of BIBLE_BOOKS) {
  const name = normalize(book.name);
  booksByKey.set(name, book);
  fullNames.push([name, book]);
  for (const alias of BOOK_ALIASES[book.bookNumber] ?? []) booksByKey.set(alias, book);
}

function findBook(key: string): BibleBookInfo | null {
  const exact = booksByKey.get(key);
  if (exact) return exact;
  if (key.length < 2) return null;
  const matches = fullNames.filter(([name]) => name.startsWith(key));
  return matches.length === 1 ? matches[0][1] : null;
}

const REFERENCE = /^(.+?)(?:\s*(\d+)(?:\s*[:,]\s*(\d+)(?:\s*-\s*(\d+))?)?)?$/;

export function parseReference(input: string): ParsedReference | null {
  const match = normalize(input).match(REFERENCE);
  if (!match) return null;
  const [, bookPart, chapterText, startText, endText] = match;
  const book = findBook(bookPart.trim());
  if (!book) return null;
  if (!chapterText) return { book };

  let chapter = Number(chapterText);
  let start = startText ? Number(startText) : undefined;
  let end = endText ? Number(endText) : start;
  // In one-chapter books ("Judas 3") the number is the verse.
  if (book.chapters === 1 && start === undefined && chapter > 1) {
    start = chapter;
    end = chapter;
    chapter = 1;
  }
  if (chapter < 1 || chapter > book.chapters) return null;
  if (start === undefined || end === undefined) return { book, chapter };
  if (start < 1 || end < start || end - start > 199) return null;
  return { book, chapter, verses: Array.from({ length: end - start + 1 }, (_, index) => start + index) };
}
