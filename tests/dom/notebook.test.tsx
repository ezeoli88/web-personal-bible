import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createAppQueryClient } from "../../src/core/providers/QueryProvider";
import type { BiblePassage } from "../../src/core/types/ai";
import { createAppRouter } from "../../src/router";
import { BibleAiPanel } from "../../src/web/components/BibleAiPanel";
import { addNotebookEntry } from "../../src/web/notebook/notebook";

const passage: BiblePassage = {
  reference: "Juan 3:16",
  translation: "NTV",
  verses: [{ id: "ntv-43-3-16", text: "Porque de tal manera amó Dios al mundo." }],
};

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("Cuaderno de estudio", () => {
  it("keeps an answer from the chat", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn(async () => new Response([
      'data: {"type":"start","mode":"ask"}\n\n',
      'data: {"type":"end","mode":"ask","fullContent":"Dios amó al mundo [16]."}\n\n',
    ].join(""), { headers: { "content-type": "text/event-stream" } })));
    render(
      <QueryClientProvider client={createAppQueryClient()}>
        <BibleAiPanel open passage={passage} access="allowed" onClose={vi.fn()} onLogin={vi.fn()} />
      </QueryClientProvider>,
    );
    await user.click(screen.getByTestId("ai-mode-ask"));
    await user.type(screen.getByLabelText("Tu pregunta"), "¿A quién amó Dios?");
    await user.click(screen.getByRole("button", { name: "Enviar" }));
    await user.click(await screen.findByRole("button", { name: "Guardar en el cuaderno" }));

    expect(screen.getByRole("button", { name: "En el cuaderno ✓" })).toBeDisabled();
    const saved = JSON.parse(localStorage.getItem("study-notebook")!);
    expect(saved).toMatchObject([{ kind: "ask", title: "¿A quién amó Dios?", content: "Dios amó al mundo [16].", reference: "Juan 3:16" }]);
  });

  it("lists entries in Guardados, filters by tag and removes them", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo) => (
      String(input).includes("/api/me") ? Response.json({ authenticated: false }) : new Response("no", { status: 404 })
    )));
    addNotebookEntry({ kind: "ai", title: "Reflexión", content: "El amor de Dios **da**.", passage }, 1);
    addNotebookEntry({ kind: "word", title: "Palabra: amó", content: "Amor que elige.", passage }, 2);
    const user = userEvent.setup();
    const router = createAppRouter(createAppQueryClient());
    render(<RouterProvider router={router} />);
    await router.navigate({ to: "/guardados" });

    await user.click(await screen.findByRole("tab", { name: /Cuaderno/ }));
    const notebook = screen.getByTestId("notebook");
    expect(within(notebook).getAllByTestId("notebook-entry")).toHaveLength(2);
    expect(within(notebook).getAllByRole("link", { name: "Juan 3:16 · NTV" })[0]).toHaveAttribute("href", "/juan/3?v=16&t=NTV");

    const [word] = within(notebook).getAllByTestId("notebook-entry");
    await user.type(within(word).getByLabelText("Agregar etiqueta"), "amor{Enter}");
    expect(within(word).getByText("#amor")).toBeInTheDocument();
    await user.click(within(notebook).getByRole("button", { name: "#amor" }));
    expect(within(notebook).getAllByTestId("notebook-entry")).toHaveLength(1);

    await user.click(within(notebook).getByRole("button", { name: "Quitar «Palabra: amó» del cuaderno" }));
    expect(within(notebook).getAllByTestId("notebook-entry")).toHaveLength(1);
    expect(within(notebook).getByText("Reflexión")).toBeInTheDocument();
    await user.click(within(notebook).getByRole("button", { name: "Quitar «Reflexión» del cuaderno" }));
    expect(await screen.findByText("Tu cuaderno está vacío.")).toBeInTheDocument();
  });
});
