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

const RESULTS = [
  { pk: 3, translation: "NTV", book: 43, chapter: 8, verse: 12, text: "Yo soy la <mark>luz</mark> del mundo." },
  { pk: 1, translation: "NTV", book: 1, chapter: 1, verse: 3, text: "Entonces Dios dijo: «Que haya luz»; y hubo luz." },
  { pk: 2, translation: "NTV", book: 40, chapter: 5, verse: 14, text: "Ustedes son la luz del mundo." },
];

describe("search", () => {
  it("turns words typed in «Ir a» into a search, filters by testament and opens a verse", async () => {
    const searched: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo) => {
      const url = String(input);
      if (url.includes("/api/me")) return Response.json({ authenticated: false });
      if (url.includes("/v2/find/")) {
        searched.push(url);
        return Response.json({ exact_matches: 3, results: RESULTS });
      }
      if (url.includes("bolls.life")) return Response.json([{ pk: 1, verse: 12, text: "Yo soy la luz del mundo." }]);
      return new Response("no", { status: 404 });
    }));
    Element.prototype.scrollIntoView = vi.fn();
    const user = userEvent.setup();
    const router = createAppRouter(createAppQueryClient());
    render(<RouterProvider router={router} />);
    await router.navigate({ to: "/" });

    const [field] = await screen.findAllByRole("textbox", { name: "Ir a una referencia o buscar" });
    await user.type(field, "luz del mundo{Enter}");
    await waitFor(() => expect(router.state.resolvedLocation?.href).toBe("/buscar?q=luz+del+mundo"));

    expect(await screen.findByText("3 versículos con «luz del mundo» en la NTV")).toBeInTheDocument();
    expect(searched).toHaveLength(1);
    const hits = screen.getAllByTestId("search-hit");
    expect(hits.map((hit) => hit.querySelector("span")?.textContent)).toEqual(["Génesis 1:3", "Mateo 5:14", "Juan 8:12"]);
    expect(hits[2].querySelector("mark")).toHaveTextContent("luz del mundo");

    await user.click(screen.getByRole("link", { name: "Nuevo Testamento" }));
    await waitFor(() => expect(screen.getAllByTestId("search-hit")).toHaveLength(2));
    expect(searched).toHaveLength(1);

    await user.click(screen.getByText("Juan 8:12"));
    await waitFor(() => expect(router.state.resolvedLocation?.href).toBe("/juan/8?v=12"));
  });

  it("asks for a longer query and explains when nothing matches", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo) => {
      const url = String(input);
      if (url.includes("/api/me")) return Response.json({ authenticated: false });
      if (url.includes("/v2/find/")) return Response.json({ exact_matches: 0, results: [] });
      return new Response("no", { status: 404 });
    }));
    const router = createAppRouter(createAppQueryClient());
    render(<RouterProvider router={router} />);
    await router.navigate({ to: "/buscar", search: { q: "zz" } });
    expect(await screen.findByText("Escribí al menos 3 letras.")).toBeInTheDocument();
    await router.navigate({ to: "/buscar", search: { q: "zzzz" } });
    expect(await screen.findByText("No encontramos «zzzz» en la NTV.")).toBeInTheDocument();
  });
});
