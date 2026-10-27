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

describe("shared links", () => {
  function stubBolls() {
    const requested: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo) => {
      const url = String(input);
      if (url.includes("/api/me")) return Response.json({ authenticated: false });
      if (url.includes("bolls.life")) {
        requested.push(url);
        return Response.json([1, 2, 3, 4].map((number) => ({ pk: number, verse: number, text: `Versículo ${number} [1]` })));
      }
      return new Response("no", { status: 404 });
    }));
    Element.prototype.scrollIntoView = vi.fn();
    return requested;
  }

  it("opens the link's translation once, highlights its verses and drops t from the URL", async () => {
    const requested = stubBolls();
    const router = createAppRouter(createAppQueryClient());
    render(<RouterProvider router={router} />);
    await router.navigate({ to: "/$book/$chapter", params: { book: "juan", chapter: "3" }, search: { v: "2-3", t: "RV1960" } });

    await waitFor(() => expect(router.state.resolvedLocation?.href).toBe("/juan/3?v=2-3"));
    expect(localStorage.getItem("bible-translation")).toBe("RV1960");
    await waitFor(() => expect(requested.some((url) => url.includes("/RV1960/"))).toBe(true));
    const focused = (await screen.findAllByTestId("verse-item")).filter((item) => /focused/.test(item.className));
    expect(focused.map((item) => item.dataset.verseNumber)).toEqual(["2", "3"]);
  });

  it("shares the selected verses as text plus a link", async () => {
    const user = userEvent.setup();
    stubBolls();
    const router = createAppRouter(createAppQueryClient());
    render(<RouterProvider router={router} />);
    await router.navigate({ to: "/$book/$chapter", params: { book: "juan", chapter: "3" }, search: {} });

    await user.click(await screen.findByRole("group", { name: "Versículo 3" }));
    await user.click(screen.getByRole("group", { name: "Versículo 1" }));
    expect(screen.getByTestId("selection-header")).toHaveTextContent("Juan 3:1, 3");
    await user.click(screen.getByRole("button", { name: "Compartir" }));
    await waitFor(async () => {
      expect(await navigator.clipboard.readText()).toBe(
        "«1 Versículo 1 3 Versículo 3»\nJuan 3:1, 3 (NTV)\nhttp://localhost:3000/juan/3?v=1,3&t=NTV",
      );
    });
  });
});

describe("continue reading", () => {
  it("remembers the chapter read and offers to continue from the home page", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo) => {
      const url = String(input);
      if (url.includes("/api/me")) return Response.json({ authenticated: false });
      if (url.includes("get-books")) return Response.json([]);
      if (url.includes("bolls.life")) {
        return Response.json([1, 2, 3].map((number) => ({ pk: number, verse: number, text: `Versículo ${number}` })));
      }
      return new Response("no", { status: 404 });
    }));
    Element.prototype.scrollIntoView = vi.fn();
    const router = createAppRouter(createAppQueryClient());
    render(<RouterProvider router={router} />);

    await router.navigate({ to: "/" });
    expect(screen.queryByTestId("continue-reading")).not.toBeInTheDocument();

    await router.navigate({ to: "/$book/$chapter", params: { book: "romanos", chapter: "8" }, search: { v: 2 } });
    await screen.findAllByTestId("verse-item");
    expect(JSON.parse(localStorage.getItem("last-reading")!)).toEqual({ slug: "romanos", chapter: 8, verse: 2, translation: "NTV" });

    await router.navigate({ to: "/" });
    const card = await screen.findByTestId("continue-reading");
    expect(card).toHaveTextContent("Romanos 8:2");
    await user.click(card);
    await waitFor(() => expect(router.state.resolvedLocation?.href).toBe("/romanos/8?v=2"));
  });

  it("saves the verse in the middle of the screen once scrolling stops", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo) => {
      const url = String(input);
      if (url.includes("/api/me")) return Response.json({ authenticated: false });
      if (url.includes("bolls.life")) {
        return Response.json([1, 2, 3].map((number) => ({ pk: number, verse: number, text: `Versículo ${number}` })));
      }
      return new Response("no", { status: 404 });
    }));
    const router = createAppRouter(createAppQueryClient());
    render(<RouterProvider router={router} />);
    await router.navigate({ to: "/$book/$chapter", params: { book: "juan", chapter: "3" }, search: {} });
    const items = await screen.findAllByTestId("verse-item");
    expect(JSON.parse(localStorage.getItem("last-reading")!).verse).toBe(1);

    const centered = items[2].querySelector("p")!;
    Object.defineProperty(document, "elementFromPoint", { configurable: true, value: vi.fn(() => centered) });
    try {
      window.dispatchEvent(new Event("scroll"));
      await waitFor(() => expect(JSON.parse(localStorage.getItem("last-reading")!).verse).toBe(3));
    } finally {
      delete (document as Partial<Document>).elementFromPoint;
    }
  });

  it("ignores a stored position that no longer makes sense", async () => {
    const { readLastReading } = await import("../../src/web/reading/lastReading");
    for (const stored of [
      "{",
      JSON.stringify({ slug: "juan", chapter: 22, verse: 1, translation: "NTV" }),
      JSON.stringify({ slug: "nada", chapter: 1, verse: 1, translation: "NTV" }),
      JSON.stringify({ slug: "juan", chapter: 3, verse: 0, translation: "NTV" }),
      JSON.stringify({ slug: "juan", chapter: 3, verse: 16, translation: "NVI" }),
    ]) {
      localStorage.setItem("last-reading", stored);
      expect(readLastReading()).toBeNull();
    }
    localStorage.setItem("last-reading", JSON.stringify({ slug: "juan", chapter: 3, verse: 16, translation: "RV1960" }));
    expect(readLastReading()).toEqual({ slug: "juan", bookName: "Juan", chapter: 3, verse: 16, translation: "RV1960" });
  });
});

describe("go to reference", () => {
  it("jumps to the typed passage and explains an unknown reference", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo) => {
      const url = String(input);
      if (url.includes("/api/me")) return Response.json({ authenticated: false });
      if (url.includes("bolls.life")) return Response.json([]);
      return new Response("no", { status: 404 });
    }));
    Element.prototype.scrollIntoView = vi.fn();
    const router = createAppRouter(createAppQueryClient());
    render(<RouterProvider router={router} />);
    await router.navigate({ to: "/" });

    const [field] = await screen.findAllByRole("textbox", { name: "Ir a una referencia o buscar" });
    await user.type(field, "xyz 3{Enter}");
    expect(screen.getByRole("alert")).toHaveTextContent("No reconozco esa referencia");

    await user.clear(field);
    await user.type(field, "1 cor 13:4-7{Enter}");
    await waitFor(() => expect(router.state.resolvedLocation?.href).toBe("/1-corintios/13?v=4-7"));
    await waitFor(() => expect(document.title).toBe("1 Corintios 13 (NTV) · Biblia"));
  });
});
