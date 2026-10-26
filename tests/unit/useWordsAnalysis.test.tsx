// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useWordsAnalysis } from "../../src/core/hooks/useWordsAnalysis";
import type { BiblePassage, IdentifiedWord } from "../../src/core/types/ai";

const passage: BiblePassage = {
  reference: "Juan 3:16,18",
  translation: "NTV",
  verses: [
    { id: "ntv-43-3-16", text: "Porque de tal manera amó Dios al mundo." },
    { id: "ntv-43-3-18", text: "No hay condenación para todo el que cree en él." },
  ],
};

const aiWord: IdentifiedWord = {
  spanish: "mundo",
  original: "κόσμον",
  transliteration: "kosmon",
  language: "greek",
  hint: "el mundo creado",
};

function renderWords() {
  const client = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useWordsAnalysis(), { wrapper });
}

function requestBodies(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.map((call) => JSON.parse((call[1] as RequestInit).body as string));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useWordsAnalysis", () => {
  it("falls back to AI-only identification and definition when the lexicon cannot help", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json(
        { error: "Verse or range not found in lexicon", code: "LEXICON_NOT_FOUND", fallbackAvailable: true },
        { status: 404 },
      ))
      .mockResolvedValueOnce(Response.json({
        type: "words-identification",
        mode: "words",
        step: "identify",
        words: [aiWord],
        maxSelectable: 3,
      }))
      .mockResolvedValueOnce(new Response(
        'data: {"type":"end","mode":"words","step":"define","fullContent":"Definición"}\n\n',
        { headers: { "content-type": "text/event-stream" } },
      ));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderWords();

    await act(() => result.current.startIdentification(passage));
    expect(result.current.step).toBe("browsing");
    expect(result.current.source).toBe("llm");
    expect(result.current.words).toEqual([aiWord]);

    await act(() => result.current.startDefinition(passage, result.current.words[0]));
    expect(result.current.step).toBe("complete");
    expect(result.current.definitions).toBe("Definición");

    const [lexicon, fallback, define] = requestBodies(fetchMock);
    expect(lexicon).toMatchObject({ step: "identify", useLexicon: true });
    expect(fallback).toMatchObject({ step: "identify", useLexicon: false });
    expect(define).toMatchObject({
      step: "define",
      useLexicon: false,
      selectedWords: [{ spanish: "mundo", original: "κόσμον", transliteration: "kosmon", language: "greek" }],
    });
    expect(define.selectedWords[0]).not.toHaveProperty("hint");
  });

  it("does not retry without the lexicon for unrelated errors", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json(
      { error: "Demasiadas solicitudes", code: "RATE_LIMIT_EXCEEDED" },
      { status: 429 },
    ));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderWords();

    await act(() => result.current.startIdentification(passage));
    expect(result.current.step).toBe("error");
    expect(result.current.error).toBe("Demasiadas solicitudes");
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
