// Ported from biblia-ntv-app/src/types/bible.ts
// RootStackParamList belonged to React Navigation and is not part of the web client.

export type Testament = "AT" | "NT";

export interface Book {
  id: string;
  name: string;
  testament: Testament;
  orderIndex: number;
}

export interface Chapter {
  id: string;
  bookId: string;
  number: number;
}

export interface Verse {
  id: string;
  chapterId: string;
  number: number;
  text: string;
  footnote?: string;
}

export interface ChapterNavigationInfo {
  chapterId: string;
  chapterNumber: number;
  bookId: string;
  bookName: string;
}

export interface ChapterNavigation {
  previous: ChapterNavigationInfo | null;
  next: ChapterNavigationInfo | null;
}
