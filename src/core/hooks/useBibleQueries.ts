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
 * Los versículos seleccionados (de un mismo capítulo) en todas las traducciones.
 * Se pide el capítulo entero por traducción, en paralelo, con la misma clave que
 * `useVersesByChapter` para compartir caché con el lector. La traducción actual
 * reutiliza el texto que ya está en pantalla.
 */
export function useVerseComparison(verses: Verse[]) {
  const { availableTranslations, getRepository, translation } = useBibleRepository();
  const chapterId = verses[0]?.chapterId;
  const results = useQueries({
    queries: availableTranslations.map((item) => ({
      queryKey: ["verses", item, chapterId],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        getRepository(item).getVersesByChapter(chapterId!, signal),
      enabled: !!chapterId && item !== translation,
      staleTime: Infinity,
      retry: 1,
    })),
  });
  const numbers = verses.map((verse) => verse.number);
  return availableTranslations.map((item, index) => {
    const result = results[index];
    const isCurrent = item === translation;
    const chapter = isCurrent ? verses : result.data;
    return {
      translation: item,
      verses: chapter?.filter((verse) => numbers.includes(verse.number)),
      isPending: isCurrent ? false : result.isPending,
      error: isCurrent ? null : result.error,
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
