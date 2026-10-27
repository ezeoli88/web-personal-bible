import { useEffect, useMemo } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useBibleRepository } from "../../../core/hooks/DatabaseProvider";
import { parseVerseParam, resolveChapterRoute, validateReaderSearch } from "../../../web/layout/bookRoute";
import { ChapterReaderPage } from "../../../web/pages/ChapterReaderPage";

export const Route = createFileRoute("/$book/$chapter/")({
  validateSearch: validateReaderSearch,
  beforeLoad: ({ params, search }) => {
    const resolved = resolveChapterRoute(params.book, params.chapter);
    if (!resolved.canonical) {
      throw redirect({
        to: "/$book/$chapter",
        params: { book: resolved.slug, chapter: String(resolved.chapterNumber) },
        search: { v: search.v, t: search.t },
        replace: true,
      });
    }
    return resolved;
  },
  component: ReaderRoute,
});

function ReaderRoute() {
  const { v, t } = Route.useSearch();
  const navigate = Route.useNavigate();
  const resolved = Route.useRouteContext();
  const { setTranslation } = useBibleRepository();
  const focusVerses = useMemo(() => parseVerseParam(v), [v]);

  // A shared link opens its translation once; afterwards the reader's choice rules.
  useEffect(() => {
    if (!t) return;
    void setTranslation(t);
    void navigate({ search: (previous) => ({ ...previous, t: undefined }), replace: true, resetScroll: false });
  }, [navigate, setTranslation, t]);

  return (
    <ChapterReaderPage
      bookName={resolved.book.name}
      bookId={resolved.bookId}
      chapterId={resolved.chapterId}
      chapterNumber={resolved.chapterNumber}
      slug={resolved.slug}
      focusVerses={focusVerses}
    />
  );
}
