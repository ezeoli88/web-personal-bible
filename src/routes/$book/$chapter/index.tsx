import { createFileRoute, redirect } from "@tanstack/react-router";
import { positiveVerse, resolveChapterRoute } from "../../../web/layout/bookRoute";
import { ChapterReaderPage } from "../../../web/pages/ChapterReaderPage";

export const Route = createFileRoute("/$book/$chapter/")({
  validateSearch: (search: Record<string, unknown>) => ({ v: positiveVerse(search.v) }),
  beforeLoad: ({ params, search }) => {
    const resolved = resolveChapterRoute(params.book, params.chapter);
    if (!resolved.canonical) {
      throw redirect({
        to: "/$book/$chapter",
        params: { book: resolved.slug, chapter: String(resolved.chapterNumber) },
        search: { v: search.v },
        replace: true,
      });
    }
    return resolved;
  },
  component: ReaderRoute,
});

function ReaderRoute() {
  const { v } = Route.useSearch();
  const resolved = Route.useRouteContext();
  return (
    <ChapterReaderPage
      bookName={resolved.book.name}
      bookId={resolved.bookId}
      chapterId={resolved.chapterId}
      chapterNumber={resolved.chapterNumber}
      slug={resolved.slug}
      focusVerseNumber={v}
    />
  );
}
