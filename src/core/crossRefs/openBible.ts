// Converts OpenBible.info's cross_references.txt (CC-BY) into one compact file per book.

/** OSIS book codes in canonical order: index + 1 is the Bolls book number. */
export const OSIS_BOOKS = [
  "Gen", "Exod", "Lev", "Num", "Deut", "Josh", "Judg", "Ruth", "1Sam", "2Sam", "1Kgs", "2Kgs", "1Chr", "2Chr",
  "Ezra", "Neh", "Esth", "Job", "Ps", "Prov", "Eccl", "Song", "Isa", "Jer", "Lam", "Ezek", "Dan", "Hos", "Joel",
  "Amos", "Obad", "Jonah", "Mic", "Nah", "Hab", "Zeph", "Hag", "Zech", "Mal",
  "Matt", "Mark", "Luke", "John", "Acts", "Rom", "1Cor", "2Cor", "Gal", "Eph", "Phil", "Col", "1Thess", "2Thess",
  "1Tim", "2Tim", "Titus", "Phlm", "Heb", "Jas", "1Pet", "2Pet", "1John", "2John", "3John", "Jude", "Rev",
] as const;

const BOOK_NUMBERS = new Map<string, number>(OSIS_BOOKS.map((code, index) => [code, index + 1]));

/**
 * One connection: [book, chapter, verse, endChapter, endVerse, votes].
 * `endChapter` and `endVerse` are 0 for a single verse.
 */
export type CrossReference = [number, number, number, number, number, number];

/** Connections of one book, keyed by "chapter:verse", most voted first. */
export type BookCrossReferences = Record<string, CrossReference[]>;

/** Enough to explore a verse without shipping the long tail of single votes. */
export const MAX_PER_VERSE = 15;

interface OsisVerse {
  book: number;
  chapter: number;
  verse: number;
}

function parseOsis(value: string): OsisVerse | null {
  const match = /^([1-3]?[A-Za-z]+)\.(\d+)\.(\d+)$/.exec(value);
  const book = match ? BOOK_NUMBERS.get(match[1]) : undefined;
  if (!match || !book) return null;
  return { book, chapter: Number(match[2]), verse: Number(match[3]) };
}

/** Rows with fewer votes than `minVotes` (people marked them as unhelpful) are dropped. */
export function convertOpenBible(text: string, minVotes = 1): Map<number, BookCrossReferences> {
  const books = new Map<number, BookCrossReferences>();
  for (const line of text.split(/\r?\n/)) {
    const [fromValue, toValue, votesValue] = line.split("\t");
    if (!fromValue || !toValue || fromValue.startsWith("From")) continue;
    const votes = Number(votesValue);
    if (!Number.isFinite(votes) || votes < minVotes) continue;
    const from = parseOsis(fromValue);
    const [startValue, endValue] = toValue.split("-");
    const start = parseOsis(startValue);
    const end = endValue ? parseOsis(endValue) : null;
    if (!from || !start || (endValue && (!end || end.book !== start.book))) continue;
    const reference: CrossReference = [
      start.book,
      start.chapter,
      start.verse,
      end ? end.chapter : 0,
      end ? end.verse : 0,
      votes,
    ];
    let book = books.get(from.book);
    if (!book) books.set(from.book, (book = {}));
    (book[`${from.chapter}:${from.verse}`] ??= []).push(reference);
  }
  for (const book of books.values()) {
    for (const [key, list] of Object.entries(book)) {
      book[key] = list.sort((a, b) => b[5] - a[5]).slice(0, MAX_PER_VERSE);
    }
  }
  return books;
}
