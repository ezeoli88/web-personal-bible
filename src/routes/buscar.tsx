import { createFileRoute } from "@tanstack/react-router";
import { SearchPage } from "../web/pages/SearchPage";
import type { SearchTestament } from "../web/search/useBibleSearch";

export interface SearchParams {
  q?: string;
  en?: SearchTestament;
}

export const Route = createFileRoute("/buscar")({
  validateSearch: (search: Record<string, unknown>): SearchParams => ({
    q: typeof search.q === "string" && search.q.trim() ? search.q.slice(0, 100) : undefined,
    en: search.en === "at" || search.en === "nt" ? search.en : undefined,
  }),
  component: SearchRoute,
});

function SearchRoute() {
  const { q, en } = Route.useSearch();
  return <SearchPage query={q ?? ""} testament={en} />;
}
