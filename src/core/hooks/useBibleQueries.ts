// Ported from biblia-ntv-app/src/hooks/useBibleQueries.ts
import { useQuery } from "@tanstack/react-query";
import { useBibleRepository } from "./DatabaseProvider";
import type { Testament } from "../types/bible";

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

export function useChapterNavigation(chapterId: string, bookId: string) {
  const { repository } = useBibleRepository();
  return useQuery({
    queryKey: ["chapterNav", chapterId, bookId],
    queryFn: () => repository.getChapterNavigation(chapterId, bookId),
    enabled: !!chapterId && !!bookId,
  });
}
