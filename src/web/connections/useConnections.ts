import { useQuery } from "@tanstack/react-query";
import { BollsBibleClient } from "../../core/api/BollsBibleClient";
import type { BookCrossReferences, CrossReference } from "../../core/crossRefs/openBible";
import { bollsVerseToPlainText } from "../../core/lib/bollsText";
import { useBibleRepository } from "../../core/hooks/DatabaseProvider";

const client = new BollsBibleClient();

/**
 * The book's connections from `/xrefs/<book>.json`, built by `npm run gen:xrefs`.
 * Null when the file is missing, so the reader simply shows no Conexiones.
 */
export function useBookConnections(bookNumber: number) {
  return useQuery<BookCrossReferences | null>({
    queryKey: ["xrefs", bookNumber],
    enabled: Number.isInteger(bookNumber) && bookNumber > 0,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    queryFn: async ({ signal }) => {
      try {
        const response = await fetch(`/xrefs/${bookNumber}.json`, { signal });
        // A missing file falls through to the SPA's index.html.
        if (!response.ok || !response.headers.get("content-type")?.includes("json")) return null;
        const payload: unknown = await response.json();
        return payload && typeof payload === "object" && !Array.isArray(payload) ? payload as BookCrossReferences : null;
      } catch (error) {
        if (signal.aborted) throw error;
        return null;
      }
    },
  });
}

export function connectionKey(reference: CrossReference): string {
  return reference.slice(0, 5).join("-");
}

/** The verse numbers a connection covers inside its first chapter (ranges across chapters stop there). */
export function connectionVerses([, chapter, verse, endChapter, endVerse]: CrossReference): number[] {
  if (!endVerse) return [verse];
  const last = endChapter === chapter ? endVerse : verse + 4;
  const verses: number[] = [];
  for (let number = verse; number <= Math.min(last, verse + 9); number += 1) verses.push(number);
  return verses;
}

/** Text of each connection in the current translation, keyed by `connectionKey`. */
export function useConnectionTexts(references: CrossReference[]) {
  const { translation } = useBibleRepository();
  return useQuery<Record<string, string>>({
    queryKey: ["xref-texts", translation, references.map(connectionKey)],
    enabled: references.length > 0,
    staleTime: Infinity,
    queryFn: async ({ signal }) => {
      const groups = await client.getVerses(
        references.map((reference) => ({
          translation,
          book: reference[0],
          chapter: reference[1],
          verses: connectionVerses(reference),
        })),
        signal,
      );
      const texts: Record<string, string> = {};
      references.forEach((reference, index) => {
        texts[connectionKey(reference)] = groups[index]
          .map((verse) => bollsVerseToPlainText(verse.text))
          .filter(Boolean)
          .join(" ");
      });
      return texts;
    },
  });
}
