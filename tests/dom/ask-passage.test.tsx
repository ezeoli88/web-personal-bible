import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
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

function sse(text: string): Response {
  const body = [
    'data: {"type":"start","mode":"ask"}\n\n',
    `data: ${JSON.stringify({ type: "text", content: text })}\n\n`,
    `data: ${JSON.stringify({ type: "end", mode: "ask", fullContent: text })}\n\n`,
  ].join("");
  return new Response(body, { headers: { "content-type": "text/event-stream" } });
}

function renderPanel() {
  return render(
    <QueryClientProvider client={createAppQueryClient()}>
      <BibleAiPanel open passage={passage} access="allowed" onClose={vi.fn()} onLogin={vi.fn()} />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Preguntale al pasaje", () => {
  it("answers a question and sends it as context for the next one", async () => {
    const user = userEvent.setup();
    const answers = ["Dios amó al mundo entero [16].", "Dio a su Hijo [16]."];
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => sse(answers.shift()!));
    vi.stubGlobal("fetch", fetchMock);
    renderPanel();

    await user.click(screen.getByTestId("ai-mode-ask"));
    expect(screen.getByText("¿Qué enseña este pasaje sobre Dios?")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Tu pregunta"), "¿A quién amó Dios?");
    await user.click(screen.getByRole("button", { name: "Enviar" }));

    const conversation = screen.getByTestId("ask-conversation");
    expect(await within(conversation).findByText("Dios amó al mundo entero [16].")).toBeInTheDocument();
    expect(within(conversation).getByText("¿A quién amó Dios?")).toBeInTheDocument();
    expect(screen.getByLabelText("Tu pregunta")).toHaveValue("");
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body as string)).toMatchObject({
      mode: "ask",
      question: "¿A quién amó Dios?",
      history: [],
    });

    await user.click(screen.getByRole("button", { name: "¿Cómo puedo aplicarlo hoy?" }));
    expect(await within(conversation).findByText("Dio a su Hijo [16].")).toBeInTheDocument();
    expect(JSON.parse(fetchMock.mock.calls[1]![1].body as string)).toMatchObject({
      question: "¿Cómo puedo aplicarlo hoy?",
      history: [
        { role: "user", content: "¿A quién amó Dios?" },
        { role: "assistant", content: "Dios amó al mundo entero [16]." },
      ],
    });
    expect(screen.queryByRole("button", { name: "¿Cómo puedo aplicarlo hoy?" })).not.toBeInTheDocument();
  });

  it("starts over after going back to the menu", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn(async () => sse("Respuesta.")));
    renderPanel();

    await user.click(screen.getByTestId("ai-mode-ask"));
    await user.click(screen.getByRole("button", { name: "¿Qué enseña este pasaje sobre Dios?" }));
    expect(await screen.findByText("Respuesta.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "← Volver al menú" }));
    await user.click(screen.getByTestId("ai-mode-ask"));
    expect(screen.queryByText("Respuesta.")).not.toBeInTheDocument();
  });

  it("shows the server error and keeps the question box", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: "La pregunta es demasiado larga", code: "QUESTION_TOO_LONG" }, { status: 400 })));
    renderPanel();

    await user.click(screen.getByTestId("ai-mode-ask"));
    await user.type(screen.getByLabelText("Tu pregunta"), "¿Por qué?");
    await user.click(screen.getByRole("button", { name: "Enviar" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("La pregunta es demasiado larga"));
    expect(screen.getByLabelText("Tu pregunta")).toBeEnabled();
  });
});
