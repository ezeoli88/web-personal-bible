import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DatabaseProvider } from "../../src/core/hooks/DatabaseProvider";
import { createAppQueryClient } from "../../src/core/providers/QueryProvider";
import type { Verse } from "../../src/core/types/bible";
import { TRANSLATION_NOTICES } from "../../src/core/types/translation";
import { SelectionActionBar } from "../../src/web/components/SelectionActionBar";
import { VerseCompareSheet } from "../../src/web/components/VerseCompareSheet";

const ntvVerse = (number: number, text = `NTV ${number}`): Verse => ({
  id: `ntv-43-3-${number}`,
  chapterId: "book-43-chapter-3",
  number,
  text,
});

const verse = ntvVerse(16, "Porque Dios amó tanto al mundo");

type ChapterHandler = (translation: string) => Response | undefined;

/** Mockea los endpoints de capítulo de Bolls (get-chapter / get-text). */
function stubChapterFetch(handler: ChapterHandler = () => undefined) {
  const fetchMock = vi.fn(async (url: string) => {
    const match = /\/(get-chapter|get-text)\/(\w+)\/(\d+)\/(\d+)\//.exec(String(url));
    if (!match) throw new Error(`Unexpected request: ${url}`);
    const [, , translation, book, chapter] = match;
    expect([book, chapter]).toEqual(["43", "3"]);
    const custom = handler(translation);
    if (custom) return custom;
    return Response.json([15, 16, 17, 18, 19].map((number) => ({
      pk: number,
      verse: number,
      text: `${translation} ${number}`,
    })));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderSheet(verses: Verse[], reference: string, onSelect = vi.fn()) {
  return render(
    <QueryClientProvider client={createAppQueryClient()}>
      <DatabaseProvider>
        <VerseCompareSheet verses={verses} reference={reference} onSelectTranslation={onSelect} onClose={vi.fn()} />
      </DatabaseProvider>
    </QueryClientProvider>,
  );
}

function requestsFor(fetchMock: ReturnType<typeof stubChapterFetch>, translation: string) {
  return fetchMock.mock.calls.filter(([url]) => String(url).includes(`/${translation}/`));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SelectionActionBar compare", () => {
  it("compares one or several verses", () => {
    const onCompare = vi.fn();
    const view = render(<SelectionActionBar count={1} onAskAI={vi.fn()} onCompare={onCompare} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "⇄ Comparar" }));
    view.rerender(<SelectionActionBar count={3} onAskAI={vi.fn()} onCompare={onCompare} onCancel={vi.fn()} />);
    const button = screen.getByRole("button", { name: "⇄ Comparar" });
    expect(button).toBeEnabled();
    fireEvent.click(button);
    expect(onCompare).toHaveBeenCalledTimes(2);
    view.rerender(<SelectionActionBar count={0} onAskAI={vi.fn()} onCompare={onCompare} onCancel={vi.fn()} />);
    expect(screen.getByRole("button", { name: "⇄ Comparar" })).toBeDisabled();
  });
});

describe("VerseCompareSheet", () => {
  it("loads every other translation in parallel, marks the current one and handles errors per version", async () => {
    let failRv2004 = true;
    const fetchMock = stubChapterFetch((translation) =>
      translation === "RV2004" && failRv2004 ? new Response("boom", { status: 500 }) : undefined);
    const onSelect = vi.fn();

    renderSheet([verse], "Juan 3:16", onSelect);

    expect(screen.getByText("Juan 3:16")).toBeInTheDocument();
    const ntv = screen.getByTestId("compare-NTV");
    expect(within(ntv).getByText(verse.text)).toBeInTheDocument();
    expect(within(ntv).getByText("Actual")).toBeInTheDocument();
    expect(within(ntv).getByText(TRANSLATION_NOTICES.NTV)).toBeInTheDocument();
    expect(requestsFor(fetchMock, "NTV")).toHaveLength(0);
    // Todas las demás versiones se piden a la vez, sin esperar a ninguna.
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(5));

    expect(await screen.findByText("LBLA 16")).toBeInTheDocument();
    expect(await screen.findByText("BTX3 16")).toBeInTheDocument();
    expect(screen.queryByText("LBLA 15")).toBeNull();
    expect(within(screen.getByTestId("compare-LBLA")).queryByText("Actual")).toBeNull();
    expect(within(screen.getByTestId("compare-LBLA")).getByText(TRANSLATION_NOTICES.LBLA)).toBeInTheDocument();
    expect(requestsFor(fetchMock, "LBLA")).toHaveLength(1);

    const rv2004 = screen.getByTestId("compare-RV2004");
    expect(await within(rv2004).findByText("No se pudo cargar este versículo.", {}, { timeout: 4000 })).toBeInTheDocument();
    failRv2004 = false;
    fireEvent.click(within(rv2004).getByRole("button", { name: "Reintentar" }));
    expect(await within(rv2004).findByText("RV2004 16")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Leer en La Biblia de las Américas" }));
    expect(onSelect).toHaveBeenCalledWith("LBLA");
  });

  it("shows every selected verse in order with its number, one chapter request per version", async () => {
    const fetchMock = stubChapterFetch((translation) =>
      translation === "PDT"
        ? Response.json([{ pk: 1, verse: 16, text: "PDT 16" }])
        : undefined);
    const selected = [ntvVerse(16), ntvVerse(18)];

    renderSheet(selected, "Juan 3:16, 18");

    expect(screen.getByRole("dialog", { name: "Comparar Juan 3:16, 18" })).toBeInTheDocument();
    const ntv = screen.getByTestId("compare-NTV");
    expect(within(ntv).getByTestId("compare-NTV-16")).toHaveTextContent("16NTV 16");
    expect(within(ntv).getByTestId("compare-NTV-18")).toHaveTextContent("18NTV 18");

    const lbla = screen.getByTestId("compare-LBLA");
    expect(await within(lbla).findByText("LBLA 16")).toBeInTheDocument();
    const lines = within(lbla).getAllByTestId(/^compare-LBLA-\d+$/);
    expect(lines.map((line) => line.textContent)).toEqual(["16LBLA 16", "18LBLA 18"]);
    expect(within(lbla).queryByText("LBLA 17")).toBeNull();
    // El copyright va debajo de los versículos de cada versión.
    const notice = within(lbla).getByText(TRANSLATION_NOTICES.LBLA);
    expect(lines[1].compareDocumentPosition(notice) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    const pdt = screen.getByTestId("compare-PDT");
    expect(await within(pdt).findByText("PDT 16")).toBeInTheDocument();
    expect(within(pdt).getByTestId("compare-PDT-18")).toHaveTextContent("No incluido en esta versión.");
    expect(within(pdt).getByText(TRANSLATION_NOTICES.PDT)).toBeInTheDocument();

    for (const translation of ["LBLA", "RV1960", "RV2004", "PDT", "BTX3"]) {
      expect(requestsFor(fetchMock, translation)).toHaveLength(1);
    }
    expect(requestsFor(fetchMock, "NTV")).toHaveLength(0);
  });
});
