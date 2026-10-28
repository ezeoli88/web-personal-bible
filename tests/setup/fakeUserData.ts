import { clearUserData, loadUserData } from "../../src/web/userData/userData";

type Key = { bookNumber: number; chapter: number; verse: number };

/** An in-memory `/api/user-data`, enough for the browser tests. */
export function fakeUserDataApi(initial: { annotations?: unknown[]; notebook?: unknown[]; lastReading?: unknown } = {}) {
  const data = {
    annotations: [...(initial.annotations ?? [])] as Array<Key & Record<string, unknown>>,
    notebook: [...(initial.notebook ?? [])] as Array<{ id: string } & Record<string, unknown>>,
    lastReading: (initial.lastReading ?? null) as unknown,
  };
  const requests: Array<{ method: string; path: string; body: unknown }> = [];
  const same = (a: Key, b: Key) => a.bookNumber === b.bookNumber && a.chapter === b.chapter && a.verse === b.verse;

  function handle(input: RequestInfo | URL, init?: RequestInit): Response | null {
    const path = new URL(String(input), "http://localhost").pathname;
    if (!path.startsWith("/api/user-data")) return null;
    const method = (init?.method ?? "GET").toUpperCase();
    const body = init?.body ? JSON.parse(String(init.body)) as Record<string, any> : undefined;
    requests.push({ method, path, body });
    if (method === "GET") return Response.json(data);
    if (path === "/api/user-data/import") {
      data.annotations.push(...(body!.annotations ?? []));
      data.notebook.push(...(body!.notebook ?? []));
      data.lastReading ??= body!.lastReading ?? null;
      return Response.json(data);
    }
    if (path === "/api/user-data/annotations") {
      for (const item of [...(body!.upsert ?? []), ...(body!.remove ?? [])]) {
        data.annotations = data.annotations.filter((existing) => !same(existing, item));
      }
      data.annotations.push(...(body!.upsert ?? []));
      return Response.json({ ok: true });
    }
    if (path === "/api/user-data/reading") {
      data.lastReading = body;
      return Response.json({ ok: true });
    }
    if (path === "/api/user-data/notebook") {
      data.notebook.unshift(body as { id: string });
      return Response.json({ ok: true });
    }
    const id = decodeURIComponent(path.split("/").pop()!);
    if (method === "DELETE") data.notebook = data.notebook.filter((entry) => entry.id !== id);
    if (method === "PATCH") data.notebook = data.notebook.map((entry) => (entry.id === id ? { ...entry, tags: body!.tags } : entry));
    return Response.json({ ok: true });
  }

  return { data, requests, handle };
}

export const TEST_READER = "lector@example.com";

/** `/api/me` for a signed-in reader with access. */
export function signedInMe(): Response {
  return Response.json({ authenticated: true, email: TEST_READER, role: "user", aiQuota: null });
}

/** Loads the reader's data straight into the store, for tests that do not render the app. */
export async function signInWith(api: ReturnType<typeof fakeUserDataApi>): Promise<void> {
  const previous = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => api.handle(input, init) ?? new Response("no", { status: 404 })) as typeof fetch;
  try {
    await loadUserData(TEST_READER);
  } finally {
    globalThis.fetch = previous;
  }
}

export { clearUserData };
