import { RouterProvider } from "@tanstack/react-router";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createAppQueryClient } from "../../src/core/providers/QueryProvider";
import { createAppRouter } from "../../src/router";

afterEach(() => {
  vi.unstubAllGlobals();
  delete (Element.prototype as Partial<Element>).scrollIntoView;
});

describe("VersesPage", () => {
  it("leaves the chosen verse on screen after the router finishes the navigation", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo) => {
      const url = String(input);
      if (url.includes("/api/me")) return Response.json({ authenticated: false });
      if (url.includes("bolls.life")) {
        return Response.json([1, 2, 3, 4, 5].map((number) => ({ pk: number, verse: number, text: `Versículo ${number}` })));
      }
      return new Response("no", { status: 404 });
    }));
    // La página de versículos ya dejó el capítulo en caché, así que el lector hace
    // scroll en su primer render. Un scroll arriba después de eso deshace el salto.
    const scrolls: string[] = [];
    vi.stubGlobal("scrollTo", vi.fn(() => scrolls.push("top")));
    Element.prototype.scrollIntoView = vi.fn(function (this: Element) {
      scrolls.push(this.id);
    });

    const router = createAppRouter(createAppQueryClient());
    render(<RouterProvider router={router} />);
    await router.navigate({ to: "/$book/$chapter/versiculos", params: { book: "juan", chapter: "3" } });
    await user.click(await screen.findByRole("button", { name: "4" }));

    await waitFor(() => {
      expect(router.state.resolvedLocation?.href).toBe("/juan/3?v=4");
      expect(scrolls).toContain("verse-4");
    });
    expect(scrolls.at(-1)).toBe("verse-4");
  });
});
