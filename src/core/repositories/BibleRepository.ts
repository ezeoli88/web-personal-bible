// Ported from biblia-ntv-app/src/repositories/BibleRepository.ts
import type { Book, Chapter, ChapterNavigation, Testament, Verse } from "../types/bible";

export interface BibleRepository {
  getBooks(testament?: Testament): Promise<Book[]>;
  getChaptersByBook(bookId: string): Promise<Chapter[]>;
  getVersesByChapter(chapterId: string, signal?: AbortSignal): Promise<Verse[]>;
  getVerse(chapterId: string, verseNumber: number, signal?: AbortSignal): Promise<Verse>;
  getBookById(bookId: string): Promise<Book | null>;
  getChapterNavigation(chapterId: string, bookId: string): Promise<ChapterNavigation>;
}
