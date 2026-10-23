// Ported from biblia-ntv-app/src/repositories/BollsBibleRepository.ts
// Verse and chapter id helpers live in lib/ids.ts.
import type { BibleRepository } from "./BibleRepository";
import type { Book, Chapter, ChapterNavigation, ChapterNavigationInfo, Testament, Verse } from "../types/bible";
import type { BollsBibleClient } from "../api/BollsBibleClient";
import { BIBLE_BOOKS, type BibleBookInfo } from "../data/bibleStructure";
import { bollsHtmlToPlainText, bollsVerseToPlainText } from "../lib/bollsText";
import { makeBookId, makeChapterId, makeVerseId, parseBookNumber, parseChapterInfo } from "../lib/ids";
import type { BibleTranslation } from "../types/translation";

function bookInfoToBook(info: BibleBookInfo): Book {
  return {
    id: makeBookId(info.bookNumber),
    name: info.name,
    testament: info.testament,
    orderIndex: info.bookNumber,
  };
}

export class BollsBibleRepository implements BibleRepository {
  private client: BollsBibleClient;
  private translation: BibleTranslation;

  constructor(client: BollsBibleClient, translation: BibleTranslation) {
    this.client = client;
    this.translation = translation;
  }

  async getBooks(testament?: Testament): Promise<Book[]> {
    const books = testament ? BIBLE_BOOKS.filter((book) => book.testament === testament) : BIBLE_BOOKS;
    return books.map(bookInfoToBook);
  }

  async getChaptersByBook(bookId: string): Promise<Chapter[]> {
    const bookNumber = parseBookNumber(bookId);
    const bookInfo = BIBLE_BOOKS.find((book) => book.bookNumber === bookNumber);
    if (!bookInfo) return [];
    const chapters: Chapter[] = [];
    for (let number = 1; number <= bookInfo.chapters; number += 1) {
      chapters.push({ id: makeChapterId(bookNumber, number), bookId, number });
    }
    return chapters;
  }

  async getVersesByChapter(chapterId: string, signal?: AbortSignal): Promise<Verse[]> {
    const { bookNumber, chapterNumber } = parseChapterInfo(chapterId);
    if (!Number.isFinite(bookNumber) || !Number.isFinite(chapterNumber)) {
      throw new Error("Capítulo inválido");
    }
    const bollsVerses = await this.client.getChapter(this.translation, bookNumber, chapterNumber, signal);
    return bollsVerses.map((verse) => ({
      id: makeVerseId(this.translation, bookNumber, chapterNumber, verse.verse),
      chapterId,
      number: verse.verse,
      text: bollsVerseToPlainText(verse.text),
      ...(verse.comment ? { footnote: bollsHtmlToPlainText(verse.comment) } : {}),
    }));
  }

  async getVerse(chapterId: string, verseNumber: number, signal?: AbortSignal): Promise<Verse> {
    const { bookNumber, chapterNumber } = parseChapterInfo(chapterId);
    if (!Number.isFinite(bookNumber) || !Number.isFinite(chapterNumber)) {
      throw new Error("Capítulo inválido");
    }
    const verse = await this.client.getVerse(this.translation, bookNumber, chapterNumber, verseNumber, signal);
    return {
      id: makeVerseId(this.translation, bookNumber, chapterNumber, verse.verse),
      chapterId,
      number: verse.verse,
      text: bollsVerseToPlainText(verse.text),
    };
  }

  async getBookById(bookId: string): Promise<Book | null> {
    const bookNumber = parseBookNumber(bookId);
    const bookInfo = BIBLE_BOOKS.find((book) => book.bookNumber === bookNumber);
    return bookInfo ? bookInfoToBook(bookInfo) : null;
  }

  async getChapterNavigation(chapterId: string, bookId: string): Promise<ChapterNavigation> {
    const { bookNumber, chapterNumber } = parseChapterInfo(chapterId);
    const currentBookIndex = BIBLE_BOOKS.findIndex((book) => book.bookNumber === bookNumber);
    if (currentBookIndex === -1) return { previous: null, next: null };
    const currentBook = BIBLE_BOOKS[currentBookIndex];
    void bookId;
    return {
      previous: this.getPreviousChapter(chapterNumber, currentBook, currentBookIndex),
      next: this.getNextChapter(chapterNumber, currentBook, currentBookIndex),
    };
  }

  private getPreviousChapter(
    currentChapterNumber: number,
    currentBook: BibleBookInfo,
    currentBookIndex: number,
  ): ChapterNavigationInfo | null {
    if (currentChapterNumber > 1) {
      const prevChapter = currentChapterNumber - 1;
      return {
        chapterId: makeChapterId(currentBook.bookNumber, prevChapter),
        chapterNumber: prevChapter,
        bookId: makeBookId(currentBook.bookNumber),
        bookName: currentBook.name,
      };
    }
    if (currentBookIndex === 0) return null;
    const prevBook = BIBLE_BOOKS[currentBookIndex - 1];
    return {
      chapterId: makeChapterId(prevBook.bookNumber, prevBook.chapters),
      chapterNumber: prevBook.chapters,
      bookId: makeBookId(prevBook.bookNumber),
      bookName: prevBook.name,
    };
  }

  private getNextChapter(
    currentChapterNumber: number,
    currentBook: BibleBookInfo,
    currentBookIndex: number,
  ): ChapterNavigationInfo | null {
    if (currentChapterNumber < currentBook.chapters) {
      const nextChapter = currentChapterNumber + 1;
      return {
        chapterId: makeChapterId(currentBook.bookNumber, nextChapter),
        chapterNumber: nextChapter,
        bookId: makeBookId(currentBook.bookNumber),
        bookName: currentBook.name,
      };
    }
    if (currentBookIndex === BIBLE_BOOKS.length - 1) return null;
    const nextBook = BIBLE_BOOKS[currentBookIndex + 1];
    return {
      chapterId: makeChapterId(nextBook.bookNumber, 1),
      chapterNumber: 1,
      bookId: makeBookId(nextBook.bookNumber),
      bookName: nextBook.name,
    };
  }
}
