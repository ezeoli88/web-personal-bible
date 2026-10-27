import { RouterProvider } from "@tanstack/react-router";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createAppQueryClient } from "../../src/core/providers/QueryProvider";
import { createAppRouter } from "../../src/router";

afterEach(() => {
  vi.unstubAllGlobals();
  delete (Element.prototype as Partial<Element>).scrollIntoView;
});

function stubBolls() {
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo) => {
    const url = String(input);
    if (url.includes("/api/me")) return Response.json({ authenticated: false });
    if (url.includes("bolls.life")) {
      return Response.json([1, 2, 3].map((number) => ({ pk: number, verse: number, text: `Versículo ${number} [1]` })));
    }
    return new Response("no", { status: 404 });
  }));
  Element.prototype.scrollIntoView = vi.fn();
}

function verseRow(number: number): HTMLElement {
  return document.getElementById(`verse-${number}`)!;
}

describe("highlights, bookmarks and notes", () => {
  it("marks verses from the reader and lists them in Guardados", async () => {
    stubBolls();
    const user = userEvent.setup();
    const router = createAppRouter(createAppQueryClient());
    render(<RouterProvider router={router} />);
    await router.navigate({ to: "/$book/$chapter", params: { book: "juan", chapter: "3" }, search: { v: undefined } });
    await screen.findByText("Versículo 2");

    await user.click(verseRow(1));
    await user.click(verseRow(2));
    await user.click(screen.getByRole("button", { name: "Marcar" }));
    expect(screen.getByText("Para escribir una nota, elegí un solo versículo.")).toBeInTheDocument();
    await user.click(screen.getByTestId("highlight-yellow"));
    expect(screen.queryByTestId("selection-action-bar")).not.toBeInTheDocument();
    expect(verseRow(1).querySelector("[data-highlight]")).toHaveAttribute("data-highlight", "yellow");
    expect(verseRow(2).querySelector("[data-highlight]")).toHaveAttribute("data-highlight", "yellow");

    await user.click(verseRow(2));
    await user.click(screen.getByRole("button", { name: "Marcar" }));
    await user.click(screen.getByTestId("toggle-bookmark"));
    expect(within(verseRow(2)).getByTestId("verse-bookmark")).toBeInTheDocument();

    await user.click(verseRow(3));
    await user.click(screen.getByRole("button", { name: "Marcar" }));
    await user.type(screen.getByLabelText("Nota"), "Nacer de nuevo");
    await user.click(screen.getByRole("button", { name: "Guardar nota" }));
    const noteButton = within(verseRow(3)).getByTestId("verse-note");
    await user.click(noteButton);
    expect(screen.getByLabelText("Nota")).toHaveValue("Nacer de nuevo");
    await user.click(screen.getByRole("button", { name: "Cerrar" }));

    await router.navigate({ to: "/guardados" });
    await screen.findByTestId("saved-page");
    expect(screen.getAllByTestId("saved-item")).toHaveLength(1);
    expect(screen.getByText("Juan 3:2")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /Subrayados/ }));
    expect(screen.getAllByTestId("saved-item")).toHaveLength(2);

    await user.click(screen.getByRole("tab", { name: /Notas/ }));
    expect(screen.getByText("Nacer de nuevo")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Quitar nota de Juan 3:3" }));
    expect(screen.getByText("Todavía no escribiste notas.")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /Marcadores/ }));
    await user.click(screen.getByText("Juan 3:2"));
    await waitFor(() => expect(router.state.resolvedLocation?.href).toBe("/juan/3?v=2"));
  }, 15_000);
});
