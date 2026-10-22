import { createFileRoute, redirect } from "@tanstack/react-router";
import { resolveChapterRoute } from "../../../web/layout/bookRoute";
import { VersesPage } from "../../../web/pages/VersesPage";

export const Route = createFileRoute("/$book/$chapter/versiculos")({
  beforeLoad: ({ params }) => {
    const resolved = resolveChapterRoute(params.book, params.chapter);
    if (!resolved.canonical) {
      throw redirect({
        to: "/$book/$chapter/versiculos",
        params: { book: resolved.slug, chapter: String(resolved.chapterNumber) },
        replace: true,
      });
    }
    return resolved;
  },
  component: VersesRoute,
});

function VersesRoute() {
  const resolved = Route.useRouteContext();
  return (
    <VersesPage
      chapterId={resolved.chapterId}
      bookName={resolved.book.name}
      chapterNumber={resolved.chapterNumber}
      slug={resolved.slug}
    />
  );
}
