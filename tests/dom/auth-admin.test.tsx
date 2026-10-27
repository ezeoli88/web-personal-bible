import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createAppQueryClient } from "../../src/core/providers/QueryProvider";
import type { BiblePassage } from "../../src/core/types/ai";
import { createAppRouter } from "../../src/router";
import { savePendingSelection, readPendingSelection } from "../../src/web/auth/pendingSelection";
import { BibleAiPanel } from "../../src/web/components/BibleAiPanel";
import { AdminPage } from "../../src/web/pages/AdminPage";

const passage: BiblePassage = {
  reference: "Juan 3:16",
  translation: "NTV",
  verses: [{ id: "ntv-43-3-16", text: "Porque de tal manera amó Dios al mundo." }],
};

function sse(text: string): Response {
  const body = [
    'data: {"type":"start","mode":"reflection"}\n\n',
    `data: ${JSON.stringify({ type: "text", content: text })}\n\n`,
    `data: ${JSON.stringify({ type: "end", mode: "reflection", fullContent: text })}\n\n`,
  ].join("");
  return new Response(body, { headers: { "content-type": "text/event-stream" } });
}

function controlledSse(signal?: AbortSignal | null) {
  const encoder = new TextEncoder();
  let streamController!: ReadableStreamDefaultController<Uint8Array>;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      streamController = controller;
    },
  });
  signal?.addEventListener("abort", () => streamController.error(new DOMException("Aborted", "AbortError")));
  return {
    response: new Response(stream, { headers: { "content-type": "text/event-stream" } }),
    send: (event: object) => streamController.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`)),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("BibleAiPanel", () => {
  it("asks anonymous readers to sign in and blocks a disabled email", () => {
    const onLogin = vi.fn();
    const client = createAppQueryClient();
    const { rerender } = render(
      <QueryClientProvider client={client}>
        <BibleAiPanel open passage={passage} access="anonymous" onClose={vi.fn()} onLogin={onLogin} />
      </QueryClientProvider>,
    );
    expect(screen.getByTestId("login-prompt")).toBeInTheDocument();
    rerender(
      <QueryClientProvider client={client}>
        <BibleAiPanel open passage={passage} access="denied" onClose={vi.fn()} onLogin={onLogin} />
      </QueryClientProvider>,
    );
    expect(screen.getByTestId("not-allowed")).toHaveTextContent("Tu correo no tiene acceso a la IA. Pedíselo al administrador.");
  });

  it("shows the menu without asking the server and streams a reflection", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async () => sse("Paz"));
    vi.stubGlobal("fetch", fetchMock);
    render(
      <QueryClientProvider client={createAppQueryClient()}>
        <BibleAiPanel open passage={passage} access="allowed" onClose={vi.fn()} onLogin={vi.fn()} />
      </QueryClientProvider>,
    );
    expect(screen.getAllByTestId(/^ai-mode-/).map((option) => option.dataset.testid)).toEqual([
      "ai-mode-ask", "ai-mode-reflection", "ai-mode-history", "ai-mode-words", "ai-mode-structure",
    ]);
    expect(fetchMock).not.toHaveBeenCalled();
    await user.click(screen.getByTestId("ai-mode-reflection"));
    expect(await screen.findByText("Paz")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copiar" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("shows a skeleton status while the session loads", () => {
    render(
      <QueryClientProvider client={createAppQueryClient()}>
        <BibleAiPanel open passage={passage} access="loading" onClose={vi.fn()} onLogin={vi.fn()} />
      </QueryClientProvider>,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Cargando opciones de análisis...");
    expect(screen.getByTestId("menu-skeleton")).toHaveAttribute("aria-hidden", "true");
  });

  it("asks to sign in again when the session expired before choosing a mode", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: "no", code: "UNAUTHENTICATED" }, { status: 401 })));
    render(
      <QueryClientProvider client={createAppQueryClient()}>
        <BibleAiPanel open passage={passage} access="allowed" onClose={vi.fn()} onLogin={vi.fn()} />
      </QueryClientProvider>,
    );
    await user.click(screen.getByTestId("ai-mode-reflection"));
    expect(await screen.findByTestId("login-prompt")).toBeInTheDocument();
  });

  it("shows the passage while waiting and keeps the partial text after Detener", async () => {
    const user = userEvent.setup();
    let stream: ReturnType<typeof controlledSse> | undefined;
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
      stream = controlledSse(init?.signal);
      return stream.response;
    }));
    render(
      <QueryClientProvider client={createAppQueryClient()}>
        <BibleAiPanel open passage={passage} access="allowed" onClose={vi.fn()} onLogin={vi.fn()} />
      </QueryClientProvider>,
    );
    await user.click(await screen.findByTestId("ai-mode-reflection"));
    await waitFor(() => expect(stream).toBeDefined());
    stream!.send({ type: "start", mode: "reflection" });
    expect(await screen.findByTestId("passage-reading")).toHaveTextContent("Porque de tal manera amó Dios al mundo.");
    expect(screen.getByText("Consultando sobre reflexión...")).toBeInTheDocument();

    stream!.send({ type: "text", content: "Texto parcial" });
    expect(await screen.findByText("Texto parcial")).toBeInTheDocument();
    expect(screen.queryByTestId("passage-reading")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "← Volver al menú" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Detener" }));
    expect(screen.getByText("Texto parcial")).toBeInTheDocument();
    expect(screen.getByText("Detuviste la respuesta antes de que terminara.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "← Volver al menú" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Copiar" })).toBeInTheDocument();
    expect(screen.queryByTestId("streaming-caret")).not.toBeInTheDocument();
  });
});

describe("pendingSelection", () => {
  it("restores the saved verses and opens the panel on the same chapter", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo) => {
      const url = String(input);
      if (url.includes("/api/me")) return Response.json({ authenticated: false });
      if (url.includes("bolls.life")) {
        return Response.json([{ pk: 1, verse: 16, text: "Porque de tal manera amó Dios al mundo." }]);
      }
      return new Response("no", { status: 404 });
    }));
    savePendingSelection({ path: "/juan/3", verseIds: ["ntv-43-3-16"], translation: "NTV" });
    const router = createAppRouter(createAppQueryClient());
    render(<RouterProvider router={router} />);
    await router.navigate({ to: "/$book/$chapter", params: { book: "juan", chapter: "3" }, search: { v: undefined } });
    expect(await screen.findByTestId("login-prompt")).toBeInTheDocument();
    expect(screen.getByTestId("selection-header")).toHaveTextContent("1 de 10 versículos");
    expect(readPendingSelection()).toBeNull();
  });

  it("discards a pending selection for another chapter", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo) => {
      const url = String(input);
      if (url.includes("/api/me")) return Response.json({ authenticated: false });
      if (url.includes("bolls.life")) return Response.json([{ pk: 1, verse: 1, text: "En el principio" }]);
      return new Response("no", { status: 404 });
    }));
    savePendingSelection({ path: "/genesis/1", verseIds: ["ntv-1-1-1"], translation: "NTV" });
    const router = createAppRouter(createAppQueryClient());
    render(<RouterProvider router={router} />);
    await router.navigate({ to: "/$book/$chapter", params: { book: "juan", chapter: "3" }, search: { v: undefined } });
    await screen.findByText(/Juan 3/);
    expect(screen.queryByTestId("bible-ai-panel")).not.toBeInTheDocument();
    expect(readPendingSelection()).toBeNull();
  });
});

describe("AccountBox", () => {
  it("shows sign-in, and the admin link only for the administrator", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ authenticated: false })));
    const anonymous = createAppRouter(createAppQueryClient());
    const first = render(<RouterProvider router={anonymous} />);
    await anonymous.navigate({ to: "/" });
    const login = await screen.findAllByRole("link", { name: "Ingresar" });
    expect(login[0]).toHaveAttribute("href", expect.stringContaining("/auth/login?returnTo="));
    first.unmount();

    vi.stubGlobal("fetch", vi.fn(async () => Response.json({
      authenticated: true,
      email: "ekiolivier@gmail.com",
      role: "admin",
    })));
    const admin = createAppRouter(createAppQueryClient());
    const second = render(<RouterProvider router={admin} />);
    await admin.navigate({ to: "/" });
    expect(await screen.findAllByText("ekiolivier@gmail.com")).not.toHaveLength(0);
    expect(screen.getAllByRole("link", { name: "Administrar accesos" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Salir" })[0].closest("form")).toHaveAttribute("action", "/auth/logout");
    second.unmount();

    vi.stubGlobal("fetch", vi.fn(async () => Response.json({
      authenticated: true,
      email: "lector@example.com",
      role: "user",
    })));
    const userRouter = createAppRouter(createAppQueryClient());
    render(<RouterProvider router={userRouter} />);
    await userRouter.navigate({ to: "/" });
    expect(await screen.findAllByText("lector@example.com")).not.toHaveLength(0);
    expect(screen.queryByRole("link", { name: "Administrar accesos" })).not.toBeInTheDocument();
  });
});

interface EmailRow {
  email: string;
  enabled: boolean;
  addedBy: string;
  addedAt: string;
  updatedBy: null;
  updatedAt: null;
}

describe("AdminPage", () => {
  function install(initial: EmailRow[], syncOk = true) {
    const emails = [...initial];
    let synced = syncOk;
    const calls: Array<{ url: string; method: string; body?: { email?: string; enabled?: boolean } }> = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const body = init?.body ? JSON.parse(String(init.body)) as { email?: string; enabled?: boolean } : undefined;
      calls.push({ url, method, body });
      if (method === "GET") {
        return Response.json({
          adminEmail: "ekiolivier@gmail.com",
          emails,
          sync: { ok: synced, at: "2026-01-01 00:00:00" },
        });
      }
      if (method === "POST" && url.endsWith("/allowed-emails")) {
        emails.push({
          email: body?.email ?? "",
          enabled: true,
          addedBy: "ekiolivier@gmail.com",
          addedAt: "2026-01-02 00:00:00",
          updatedBy: null,
          updatedAt: null,
        });
        return Response.json({ saved: true, synced: true });
      }
      if (method === "PATCH") {
        const email = decodeURIComponent(url.split("/").pop() ?? "");
        const row = emails.find((item) => item.email === email);
        if (row && typeof body?.enabled === "boolean") row.enabled = body.enabled;
        synced = false;
        return Response.json({ saved: true, synced: false, error: "falló access" });
      }
      if (url.endsWith("/sync")) {
        synced = true;
        return Response.json({ saved: true, synced: true });
      }
      return new Response("no", { status: 404 });
    }));
    return { calls, emails };
  }

  function renderAdmin() {
    return render(
      <QueryClientProvider client={createAppQueryClient()}>
        <AdminPage />
      </QueryClientProvider>,
    );
  }

  it("adds a new email and rehabilitates a disabled one", async () => {
    const user = userEvent.setup();
    const { calls } = install([{
      email: "off@example.com",
      enabled: false,
      addedBy: "ekiolivier@gmail.com",
      addedAt: "2026-01-01 00:00:00",
      updatedBy: null,
      updatedAt: null,
    }]);
    renderAdmin();
    await screen.findByText("off@example.com");
    await user.type(screen.getByRole("textbox"), "nuevo@example.com");
    await user.click(screen.getByRole("button", { name: "Agregar" }));
    await waitFor(() => expect(calls.some((call) => call.method === "POST" && call.body?.email === "nuevo@example.com")).toBe(true));

    await user.clear(screen.getByRole("textbox"));
    await user.type(screen.getByRole("textbox"), "off@example.com");
    await user.click(screen.getByRole("button", { name: "Rehabilitar" }));
    await waitFor(() => expect(calls.some((call) => call.method === "PATCH" && call.body?.enabled === true)).toBe(true));
  });

  it("filters, confirms disable, hides the admin switch and retries a failed sync", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const { calls } = install([
      {
        email: "on@example.com",
        enabled: true,
        addedBy: "ekiolivier@gmail.com",
        addedAt: "2026-01-01 00:00:00",
        updatedBy: null,
        updatedAt: null,
      },
      {
        email: "off@example.com",
        enabled: false,
        addedBy: "ekiolivier@gmail.com",
        addedAt: "2026-01-01 00:00:00",
        updatedBy: null,
        updatedAt: null,
      },
    ], false);
    renderAdmin();
    expect(await screen.findByTestId("admin-row-admin")).toHaveTextContent("Administrador");
    expect(screen.queryByRole("switch", { name: /ekiolivier/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /borrar|eliminar/i })).not.toBeInTheDocument();
    expect(screen.getByTestId("admin-sync")).toHaveTextContent("Guardado, pero no se pudo actualizar Cloudflare Access");

    await user.click(screen.getByTestId("admin-filter-disabled"));
    expect(screen.queryByTestId("admin-row-on@example.com")).not.toBeInTheDocument();
    expect(screen.getByTestId("admin-row-off@example.com")).toBeInTheDocument();

    await user.click(screen.getByTestId("admin-filter-all"));
    await user.click(screen.getByTestId("admin-switch-on@example.com"));
    expect(confirm).toHaveBeenCalled();
    expect(calls.some((call) => call.method === "PATCH")).toBe(false);

    confirm.mockReturnValue(true);
    await user.click(screen.getByTestId("admin-switch-on@example.com"));
    await waitFor(() => expect(calls.some((call) => call.method === "PATCH" && call.body?.enabled === false)).toBe(true));

    await user.click(screen.getByTestId("admin-retry"));
    await waitFor(() => expect(calls.some((call) => call.method === "POST" && call.url.endsWith("/api/admin/sync"))).toBe(true));
    expect(await screen.findByText(/Access sincronizado/)).toBeInTheDocument();
  });
});
