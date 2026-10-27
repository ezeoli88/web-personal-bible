import { RouterProvider } from "@tanstack/react-router";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createAppQueryClient } from "../../src/core/providers/QueryProvider";
import { createAppRouter } from "../../src/router";

type Me = { authenticated: boolean; email?: string; role?: "admin" | "user" | null };

function stubApp(me: Me = { authenticated: false }) {
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo) => {
    const url = String(input);
    if (url.includes("/api/me")) return Response.json(me);
    if (url.includes("bolls.life")) {
      return Response.json([1, 2, 3].map((number) => ({ pk: number, verse: number, text: `Versículo ${number}` })));
    }
    return new Response("no", { status: 404 });
  }));
  Element.prototype.scrollIntoView = vi.fn();
}

async function openReader(book = "juan", chapter = "3") {
  const router = createAppRouter(createAppQueryClient());
  render(<RouterProvider router={router} />);
  await router.navigate({ to: "/$book/$chapter", params: { book, chapter }, search: {} });
  await screen.findAllByTestId("verse-item");
  return router;
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete (Element.prototype as Partial<Element>).scrollIntoView;
});

describe("reader top bar", () => {
  it("names the chapter and opens a picker that jumps to another chapter or book", async () => {
    const user = userEvent.setup();
    stubApp();
    const router = await openReader();

    expect(screen.getAllByTestId("translation-select").some((chip) => chip.textContent === "NTV")).toBe(true);

    await user.click(screen.getByRole("button", { name: "Elegir capítulo (Juan 3)" }));
    const picker = screen.getByTestId("chapter-picker");
    expect(within(picker).getByRole("heading", { name: "Juan" })).toBeInTheDocument();
    expect(within(picker).getAllByRole("button", { name: /^\d+$/ })).toHaveLength(21);
    expect(within(picker).getByRole("button", { name: "3" })).toHaveAttribute("aria-current", "page");

    await user.click(within(picker).getByRole("button", { name: "5" }));
    await waitFor(() => expect(router.state.resolvedLocation?.href).toBe("/juan/5"));
    expect(screen.getByRole("button", { name: "Elegir capítulo (Juan 5)" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Elegir capítulo (Juan 5)" }));
    await user.click(within(screen.getByTestId("chapter-picker")).getByRole("button", { name: "Cambiar libro" }));
    await waitFor(() => expect(router.state.resolvedLocation?.href).toBe("/"));
  });

  it("jumps to a typed reference from the picker", async () => {
    const user = userEvent.setup();
    stubApp();
    const router = await openReader();
    await user.click(screen.getByRole("button", { name: "Elegir capítulo (Juan 3)" }));
    const picker = screen.getByTestId("chapter-picker");
    await user.type(within(picker).getByRole("textbox", { name: "Ir a una referencia" }), "ro 8:28{Enter}");
    await waitFor(() => expect(router.state.resolvedLocation?.href).toBe("/romanos/8?v=28"));
    expect(picker).not.toHaveAttribute("open");
  });

  it("shows the admin's account menu with sign out", async () => {
    const user = userEvent.setup();
    stubApp({ authenticated: true, email: "lector@example.com", role: "admin" });
    await openReader();
    const trigger = await screen.findByRole("button", { name: "Cuenta" });
    await waitFor(() => expect(trigger).toBeEnabled());
    await user.click(trigger);
    const menu = screen.getByRole("dialog", { name: "Cuenta" });
    expect(menu).toHaveTextContent("lector@example.com");
    expect(menu).toHaveTextContent("Administrador");
    expect(within(menu).getByRole("link", { name: "Administrar accesos" })).toHaveAttribute("href", "/admin");
    expect(within(menu).getByRole("button", { name: "Salir" }).closest("form")).toHaveAttribute("action", "/auth/logout");
  });

  it("offers to sign in from the account menu and comes back to the same page", async () => {
    const user = userEvent.setup();
    stubApp();
    await openReader();
    const trigger = screen.getByRole("button", { name: "Cuenta" });
    await waitFor(() => expect(trigger).toBeEnabled());
    await user.click(trigger);
    const menu = screen.getByRole("dialog", { name: "Cuenta" });
    expect(within(menu).getByRole("link", { name: "Ingresar" })).toHaveAttribute("href", "/auth/login?returnTo=%2Fjuan%2F3");
    expect(within(menu).queryByRole("button", { name: "Salir" })).not.toBeInTheDocument();
  });
});

describe("reader selection", () => {
  it("starts with a tap, swaps the top bar, copies and cancels", async () => {
    const user = userEvent.setup();
    stubApp();
    await openReader();
    expect(screen.getByRole("navigation", { name: "Cambiar de capítulo" })).toBeInTheDocument();

    await user.click(screen.getByRole("group", { name: "Versículo 2" }));
    expect(screen.getByTestId("selection-header")).toHaveTextContent("Juan 3:2");
    expect(screen.getByTestId("selection-header")).toHaveTextContent("1 de 10 versículos · NTV");
    expect(screen.queryByRole("navigation", { name: "Cambiar de capítulo" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Copiar" }));
    await waitFor(async () => {
      expect(await navigator.clipboard.readText()).toBe("«Versículo 2»\nJuan 3:2 (NTV)\nhttp://localhost:3000/juan/3?v=2&t=NTV");
    });

    await user.click(screen.getByRole("button", { name: "Cancelar selección" }));
    expect(screen.queryByTestId("selection-header")).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Versículo 2" })).toHaveAttribute("aria-pressed", "false");
  });

  it("shows the chapter number as a large initial on the first verse", async () => {
    stubApp();
    await openReader("romanos", "12");
    const [first, second] = screen.getAllByTestId("verse-item");
    expect(first.querySelector("[aria-hidden='true']")).toHaveTextContent("12");
    expect(second.querySelector("[aria-hidden='true']")).toBeNull();
  });
});
