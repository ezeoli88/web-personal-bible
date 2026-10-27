import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createAppQueryClient } from "../../src/core/providers/QueryProvider";
import type { BiblePassage } from "../../src/core/types/ai";
import { BibleAiPanel } from "../../src/web/components/BibleAiPanel";

const passage: BiblePassage = {
  reference: "Juan 3:16",
  translation: "NTV",
  verses: [{ id: "ntv-43-3-16", text: "Porque de tal manera amó Dios al mundo." }],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Guía para grupo pequeño", () => {
  it("asks for the meeting length and streams the guide", async () => {
    const user = userEvent.setup();
    const guide = "**Tema:** El amor que da.\n\n### Para empezar · 10 min\n- ¿Qué regalo te costó dar?";
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => new Response([
      'data: {"type":"start","mode":"group"}\n\n',
      `data: ${JSON.stringify({ type: "text", content: guide })}\n\n`,
      `data: ${JSON.stringify({ type: "end", mode: "group", fullContent: guide })}\n\n`,
    ].join(""), { headers: { "content-type": "text/event-stream" } }));
    vi.stubGlobal("fetch", fetchMock);
    render(
      <QueryClientProvider client={createAppQueryClient()}>
        <BibleAiPanel open passage={passage} access="allowed" onClose={vi.fn()} onLogin={vi.fn()} />
      </QueryClientProvider>,
    );

    await user.click(screen.getByTestId("ai-mode-group"));
    expect(screen.getByText("¿Cuánto dura el encuentro?")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: /60 minutos/ }));

    expect(await screen.findByText(/Qué regalo te costó dar/)).toBeInTheDocument();
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body as string)).toMatchObject({ mode: "group", duration: 60, passage });
    expect(screen.getByRole("button", { name: "Copiar" })).toBeInTheDocument();
  });
});
