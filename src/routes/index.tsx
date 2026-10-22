import { createFileRoute } from "@tanstack/react-router";
import { BooksPage } from "../web/pages/BooksPage";

type IndexSearch = { login?: "denied" };

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): IndexSearch => (
    search.login === "denied" ? { login: "denied" } : {}
  ),
  component: IndexPage,
});

function IndexPage() {
  const { login } = Route.useSearch();
  return <BooksPage loginDenied={login === "denied"} />;
}
