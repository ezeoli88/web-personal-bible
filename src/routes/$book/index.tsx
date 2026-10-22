import { createFileRoute } from "@tanstack/react-router";
import { makeBookId } from "../../core/lib/ids";
import { redirectCanonicalBook } from "../../web/layout/bookRoute";
import { ChaptersPage } from "../../web/pages/ChaptersPage";

export const Route = createFileRoute("/$book/")({
  beforeLoad: ({ params }) => redirectCanonicalBook(params.book),
  component: BookChapters,
});

function BookChapters() {
  const resolved = Route.useRouteContext();
  return (
    <ChaptersPage
      bookId={makeBookId(resolved.book.bookNumber)}
      bookName={resolved.book.name}
      slug={resolved.slug}
    />
  );
}
