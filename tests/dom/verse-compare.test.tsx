import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DatabaseProvider } from "../../src/core/hooks/DatabaseProvider";
import { createAppQueryClient } from "../../src/core/providers/QueryProvider";
import type { Verse } from "../../src/core/types/bible";
import { TRANSLATION_NOTICES } from "../../src/core/types/translation";
import { SelectionActionBar } from "../../src/web/components/SelectionActionBar";
import { VerseCompareSheet } from "../../src/web/components/VerseCompareSheet";

const verse: Verse = {
  id: "ntv-43-3-16",
  chapterId: "book-43-chapter-3",
  number: 16,
  text: "Porque Dios amó tanto al mundo",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SelectionActionBar compare", () => {
  it("compares only a single verse", () => {
    const onCompare = vi.fn();
    const view = render(<SelectionActionBar count={1} onAskAI={vi.fn()} onCompare={onCompare} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "⇄ Comparar" }));
    expect(onCompare).toHaveBeenCalledOnce();
    view.rerender(<SelectionActionBar count={2} onAskAI={vi.fn()} onCompare={onCompare} onCancel={vi.fn()} />);
    expect(screen.getByRole("button", { name: "⇄ Comparar" })).toBeDisabled();
  });
});

describe("VerseCompareSheet", () => {
  it("loads every other translation in parallel, marks the current one and handles errors per version", async () => {
    let failRv2004 = true;
    const fetchMock = vi.fn(async (url: string) => {
      const [, translation, book, chapter, number] = /get-verse\/(\w+)\/(\d+)\/(\d+)\/(\d+)/.exec(String(url))!;
      expect([book, chapter, number]).toEqual(["43", "3", "16"]);
      if (translation === "RV2004" && failRv2004) return new Response("boom", { status: 500 });
      return Response.json({ pk: 1, verse: 16, text: `Texto ${translation}` });
    });
    vi.stubGlobal("fetch", fetchMock);
    const onSelect = vi.fn();

    render(
      <QueryClientProvider client={createAppQueryClient()}>
        <DatabaseProvider>
          <VerseCompareSheet verse={verse} reference="Juan 3:16" onSelectTranslation={onSelect} onClose={vi.fn()} />
        </DatabaseProvider>
      </QueryClientProvider>,
    );

    expect(screen.getByText("Juan 3:16")).toBeInTheDocument();
    const ntv = screen.getByTestId("compare-NTV");
    expect(within(ntv).getByText(verse.text)).toBeInTheDocument();
    expect(within(ntv).getByText("Actual")).toBeInTheDocument();
    expect(within(ntv).getByText(TRANSLATION_NOTICES.NTV)).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/NTV/"))).toBe(false);

    expect(await screen.findByText("Texto LBLA")).toBeInTheDocument();
    expect(await screen.findByText("Texto BTX3")).toBeInTheDocument();
    expect(within(screen.getByTestId("compare-LBLA")).queryByText("Actual")).toBeNull();
    expect(within(screen.getByTestId("compare-LBLA")).getByText(TRANSLATION_NOTICES.LBLA)).toBeInTheDocument();

    const rv2004 = screen.getByTestId("compare-RV2004");
    expect(await within(rv2004).findByText("No se pudo cargar este versículo.", {}, { timeout: 4000 })).toBeInTheDocument();
    failRv2004 = false;
    fireEvent.click(within(rv2004).getByRole("button", { name: "Reintentar" }));
    expect(await within(rv2004).findByText("Texto RV2004")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Leer en La Biblia de las Américas" }));
    expect(onSelect).toHaveBeenCalledWith("LBLA");
  });
});
