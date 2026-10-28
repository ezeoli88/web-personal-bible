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
    expect(screen.getByText("Te queda 1 pregunta sobre este pasaje.")).toBeInTheDocument();
  });

  it("stops after 3 questions", async () => {
    const user = userEvent.setup();
    let count = 0;
    vi.stubGlobal("fetch", vi.fn(async () => sse(`Respuesta ${++count}.`)));
    renderPanel();

    await user.click(screen.getByTestId("ai-mode-ask"));
    for (const question of ["Uno", "Dos", "Tres"]) {
      await user.type(screen.getByLabelText("Tu pregunta"), question);
      await user.click(screen.getByRole("button", { name: "Enviar" }));
      expect(await screen.findByText(`Respuesta ${count}.`)).toBeInTheDocument();
    }
    expect(screen.getByTestId("ask-limit")).toHaveTextContent("Llegaste a las 3 preguntas");
    expect(screen.queryByLabelText("Tu pregunta")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "¿Cómo puedo aplicarlo hoy?" })).not.toBeInTheDocument();
  });

  it("shows how many monthly AI requests are left", () => {
    render(
      <QueryClientProvider client={createAppQueryClient()}>
        <BibleAiPanel
          open
          passage={passage}
          access="allowed"
          quota={{ limit: 100, used: 58, remaining: 42, resetsAt: "2026-11-01T00:00:00.000Z" }}
          onClose={vi.fn()}
          onLogin={vi.fn()}
        />
      </QueryClientProvider>,
    );
    expect(screen.getByTestId("ai-quota")).toHaveTextContent("Te quedan 42 de 100 consultas de IA este mes.");
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

  it("answers the shortcuts without using questions and sends them with the next question", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string) as { mode: string; step?: string };
      if (body.mode === "history") return sse("Juan escribe para creyentes de Asia.");
      if (body.mode === "words" && body.step === "identify") {
        return Response.json({
          type: "words-identification",
          mode: "words",
          step: "identify",
          words: [{ spanish: "mundo", original: "κόσμον", transliteration: "kosmon", language: "greek", hint: "el mundo creado" }],
          maxSelectable: 3,
        });
      }
      if (body.mode === "words") {
        return new Response(
          'data: {"type":"end","mode":"words","step":"define","fullContent":"Kosmos es el mundo habitado."}\n\n',
          { headers: { "content-type": "text/event-stream" } },
        );
      }
      return sse("Lo amó entero [16].");
    });
    vi.stubGlobal("fetch", fetchMock);
    renderPanel();

    await user.click(screen.getByTestId("ai-mode-ask"));
    await user.click(screen.getByTestId("study-history"));
    const conversation = screen.getByTestId("ask-conversation");
    expect(await within(conversation).findByText("Juan escribe para creyentes de Asia.")).toBeInTheDocument();
    expect(screen.queryByTestId("study-history")).not.toBeInTheDocument();

    await user.click(screen.getByTestId("study-words"));
    const words = await screen.findByTestId("chat-key-words");
    expect(within(conversation).queryByText("Kosmos es el mundo habitado.")).not.toBeInTheDocument();
    await user.click(within(words).getByText("mundo"));
    expect(await within(conversation).findByText("Kosmos es el mundo habitado.")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Tu pregunta"), "¿Qué mundo?");
    await user.click(screen.getByRole("button", { name: "Enviar" }));
    expect(await within(conversation).findByText("Lo amó entero [16].")).toBeInTheDocument();
    const question = JSON.parse(fetchMock.mock.calls.at(-1)![1].body as string);
    expect(question).toMatchObject({
      mode: "ask",
      question: "¿Qué mundo?",
      history: [],
      studies: [
        { kind: "history", content: "Juan escribe para creyentes de Asia." },
        { kind: "words", content: "«mundo»: Kosmos es el mundo habitado." },
      ],
    });
    expect(screen.getByText("Te quedan 2 preguntas sobre este pasaje.")).toBeInTheDocument();
  });
});
