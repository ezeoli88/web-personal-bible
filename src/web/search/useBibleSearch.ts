import { useQuery } from "@tanstack/react-query";
import { BollsBibleClient } from "../../core/api/BollsBibleClient";
import { bollsVerseToPlainText } from "../../core/lib/bollsText";
import { bookFromNumber } from "../../core/lib/bookSlugs";
import { useBibleRepository } from "../../core/hooks/DatabaseProvider";

const client = new BollsBibleClient();

/** Bolls rejects very short searches, and one or two letters match half the Bible anyway. */
export const MIN_QUERY_LENGTH = 3;

export type SearchTestament = "at" | "nt";

export interface SearchHit {
  bookNumber: number;
  bookName: string;
  chapter: number;
  verse: number;
  text: string;
}

export interface SearchResults {
  hits: SearchHit[];
  /** Bolls stops at 1024 verses. */
  truncated: boolean;
}

const BOLLS_LIMIT = 1024;
/** Matthew is book 40 in Bolls' numbering. */
const FIRST_NT_BOOK = 40;

export function inTestament(hit: SearchHit, testament?: SearchTestament): boolean {
  if (!testament) return true;
  return testament === "nt" ? hit.bookNumber >= FIRST_NT_BOOK : hit.bookNumber < FIRST_NT_BOOK;
}

/** The whole Bible is searched once; the testament filter runs on the results. */
export function useBibleSearch(query: string) {
  const { translation } = useBibleRepository();
  const trimmed = query.trim();
  return useQuery<SearchResults>({
    queryKey: ["search", translation, trimmed.toLowerCase()],
    enabled: trimmed.length >= MIN_QUERY_LENGTH,
    staleTime: Infinity,
    queryFn: async ({ signal }) => {
      const result = await client.search(translation, trimmed, signal);
      const hits: SearchHit[] = [];
      for (const verse of result.verses) {
        const book = bookFromNumber(verse.book);
        if (!book) continue;
        const text = bollsVerseToPlainText(verse.text).replace(/\s+/g, " ").trim();
        if (!text) continue;
        hits.push({ bookNumber: verse.book, bookName: book.name, chapter: verse.chapter, verse: verse.verse, text });
      }
      // Bible order, whatever order Bolls ranked them in.
      hits.sort((a, b) => a.bookNumber - b.bookNumber || a.chapter - b.chapter || a.verse - b.verse);
      return { hits, truncated: result.verses.length >= BOLLS_LIMIT };
    },
  });
}
