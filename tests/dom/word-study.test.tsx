import { QueryClientProvider } from "@tanstack/react-query";
import { createRootRoute, createRoute, createRouter, createMemoryHistory, Outlet, RouterProvider } from "@tanstack/react-router";
import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DatabaseProvider } from "../../src/core/hooks/DatabaseProvider";
import { createAppQueryClient } from "../../src/core/providers/QueryProvider";
import type { BiblePassage, WordStudyResponse } from "../../src/core/types/ai";
import { bookBars, WordStudyCard } from "../../src/web/wordStudy/WordStudyCard";

const passage: BiblePassage = {
  reference: "Juan 3:16",
  translation: "NTV",
  verses: [{ id: "ntv-43-3-16", text: "Porque tanto amó Dios al mundo." }],
};

const study: WordStudyResponse = {
  type: "word-study",
  mode: "words",
  step: "study",
  reference: "Juan 3:16",
  word: {
    tokenId: "Jn.3.16:4",
    reference: "Jn.3.16",
    original: "ἠγάπησεν",
    lemma: "ἀγαπάω",
    transliteration: "agapaō",
    strong: "G25",
    pos: "verb",
    parsing: "V-AAI-3S",
    def: "to love",
    language: "greek",
  },
  occurrences: {
    by: "strong",
    total: 143,
    verses: 130,
    testament: "NT",
    byBook: [
      { book: "Jn", bookNumber: 43, count: 37 },
      { book: "1Jn", bookNumber: 62, count: 31 },
    ],
    examples: [{ reference: "Jn.3.35", bookNumber: 43, chapter: 3, verse: 35 }],
  },
};

function renderCard() {
  const rootRoute = createRootRoute({ component: () => <Outlet /> });
  const routes = [
    createRoute({
      getParentRoute: () => rootRoute,
      path: "/",
      component: () => <WordStudyCard passage={passage} tokenId="Jn.3.16:4" />,
    }),
    createRoute({ getParentRoute: () => rootRoute, path: "/$book/$chapter", component: () => <p>Capítulo</p> }),
  ];
  const router = createRouter({
    routeTree: rootRoute.addChildren(routes),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  return render(
    <QueryClientProvider client={createAppQueryClient()}>
      <DatabaseProvider>
        <RouterProvider router={router} />
      </DatabaseProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Estudio de palabra", () => {
  it("shows the lexicon card, the books and other verses", async () => {
    const requests: unknown[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/bible-ai/stream") {
        requests.push(JSON.parse(String(init?.body)));
        return Response.json(study);
      }
      if (url.endsWith("/get-verses/")) {
        return Response.json([[{ pk: 1, verse: 35, text: "El Padre ama a su Hijo." }]]);
      }
      return new Response("no", { status: 404 });
    }));
    renderCard();

    const card = await screen.findByTestId("word-study");
    expect(within(card).getByText("ἀγαπάω")).toBeInTheDocument();
    expect(within(card).getByText("Verbo")).toBeInTheDocument();
    expect(within(card).getByText("143 veces en 130 versículos")).toBeInTheDocument();
    expect(within(card).getByText("Dónde aparece más en el Nuevo Testamento")).toBeInTheDocument();
    expect(within(card).getByText("1 Juan")).toBeInTheDocument();
    expect(await within(card).findByText("El Padre ama a su Hijo.")).toBeInTheDocument();
    expect(within(card).getByRole("link", { name: /Juan 3:35/ })).toHaveAttribute("href", "/juan/3?v=35");
    expect(requests).toEqual([{
      mode: "words",
      step: "study",
      useLexicon: true,
      selectedTokenIds: ["Jn.3.16:4"],
      passage,
    }]);
  });

  it("adds up the books after the first six", () => {
    const byBook = Array.from({ length: 8 }, (_, index) => ({ book: "x", bookNumber: 40 + index, count: 10 - index }));
    const bars = bookBars(byBook);
    expect(bars).toHaveLength(7);
    expect(bars.at(-1)).toEqual({ key: "rest", label: "Otros libros", count: 3 + 4 });
  });
});
