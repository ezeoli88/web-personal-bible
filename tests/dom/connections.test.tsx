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

describe("Conexiones", () => {
  it("shows how many connections a verse has and lists them with their text", async () => {
    const posted: unknown[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/me")) return Response.json({ authenticated: false });
      if (url === "/xrefs/43.json") {
        return Response.json({ "3:16": [[45, 5, 8, 0, 0, 95], [62, 4, 9, 4, 10, 80]] });
      }
      if (url.endsWith("/get-verses/")) {
        posted.push(JSON.parse(String(init?.body)));
        return Response.json([
          [{ pk: 1, verse: 8, text: "Pero Dios mostró el gran amor que nos tiene." }],
          [{ pk: 2, verse: 9, text: "Dios mostró cuánto nos ama" }, { pk: 3, verse: 10, text: "En esto consiste el amor verdadero." }],
        ]);
      }
      if (url.includes("bolls.life")) {
        return Response.json([15, 16, 17].map((number) => ({ pk: number, verse: number, text: `Versículo ${number}` })));
      }
      return new Response("no", { status: 404 });
    }));
    Element.prototype.scrollIntoView = vi.fn();
    const user = userEvent.setup();
    const router = createAppRouter(createAppQueryClient());
    render(<RouterProvider router={router} />);
    await router.navigate({ to: "/$book/$chapter", params: { book: "juan", chapter: "3" }, search: { v: undefined } });

    const button = await screen.findByRole("button", { name: "Ver 2 conexiones del versículo 16" });
    expect(screen.getAllByTestId("verse-connections")).toHaveLength(1);
    await user.click(button);

    const sheet = screen.getByTestId("connections-sheet");
    expect(await within(sheet).findByText("Pero Dios mostró el gran amor que nos tiene.")).toBeInTheDocument();
    expect(within(sheet).getByText("1 Juan 4:9-10")).toBeInTheDocument();
    expect(within(sheet).getByText("Dios mostró cuánto nos ama En esto consiste el amor verdadero.")).toBeInTheDocument();
    expect(posted).toEqual([[
      { translation: "NTV", book: 45, chapter: 5, verses: [8] },
      { translation: "NTV", book: 62, chapter: 4, verses: [9, 10] },
    ]]);

    await user.click(within(sheet).getByText("Romanos 5:8"));
    await waitFor(() => expect(router.state.resolvedLocation?.href).toBe("/romanos/5?v=8"));
  });

  it("shows no Conexiones when the data file is missing", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo) => {
      const url = String(input);
      if (url.includes("/api/me")) return Response.json({ authenticated: false });
      if (url.startsWith("/xrefs/")) return new Response("<!doctype html>", { headers: { "content-type": "text/html" } });
      if (url.includes("bolls.life")) return Response.json([{ pk: 1, verse: 16, text: "Versículo 16" }]);
      return new Response("no", { status: 404 });
    }));
    Element.prototype.scrollIntoView = vi.fn();
    const router = createAppRouter(createAppQueryClient());
    render(<RouterProvider router={router} />);
    await router.navigate({ to: "/$book/$chapter", params: { book: "juan", chapter: "3" }, search: { v: undefined } });
    await screen.findByText("Versículo 16");
    expect(screen.queryByTestId("verse-connections")).not.toBeInTheDocument();
  });
});
