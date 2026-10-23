// Ported from biblia-ntv-app/src/hooks/useBibleQueries.ts
import { useQueries, useQuery } from "@tanstack/react-query";
import { useBibleRepository } from "./DatabaseProvider";
import type { Testament, Verse } from "../types/bible";

export function useBooks(testament?: Testament) {
  const { repository } = useBibleRepository();
  return useQuery({
    queryKey: ["books", testament],
    queryFn: () => repository.getBooks(testament),
  });
}

export function useChaptersByBook(bookId: string) {
  const { repository } = useBibleRepository();
  return useQuery({
    queryKey: ["chapters", bookId],
    queryFn: () => repository.getChaptersByBook(bookId),
    enabled: !!bookId,
  });
}

export function useVersesByChapter(chapterId: string) {
  const { repository, translation } = useBibleRepository();
  return useQuery({
    queryKey: ["verses", translation, chapterId],
    queryFn: ({ signal }) => repository.getVersesByChapter(chapterId, signal),
    enabled: !!chapterId,
  });
}

/**
 * Un versículo en todas las traducciones, pedidas en paralelo. La traducción
 * actual reutiliza el texto que ya está en pantalla.
 */
export function useVerseComparison(verse: Verse | null) {
  const { availableTranslations, getRepository, translation } = useBibleRepository();
  const results = useQueries({
    queries: availableTranslations.map((item) => ({
      queryKey: ["verse", item, verse?.chapterId, verse?.number],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        getRepository(item).getVerse(verse!.chapterId, verse!.number, signal),
      enabled: !!verse,
      initialData: verse !== null && item === translation ? verse : undefined,
      staleTime: Infinity,
      retry: 1,
    })),
  });
  return availableTranslations.map((item, index) => {
    const result = results[index];
    return {
      translation: item,
      verse: result.data,
      isPending: result.isPending,
      error: result.error,
      refetch: result.refetch,
    };
  });
}

export function useChapterNavigation(chapterId: string, bookId: string) {
  const { repository } = useBibleRepository();
  return useQuery({
    queryKey: ["chapterNav", chapterId, bookId],
    queryFn: () => repository.getChapterNavigation(chapterId, bookId),
    enabled: !!chapterId && !!bookId,
  });
}
