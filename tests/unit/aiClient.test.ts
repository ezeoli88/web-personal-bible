import { afterEach, describe, expect, it, vi } from "vitest";
import { ASK_HISTORY_TURNS, askBibleAIStream, askPassageStream, BibleAIClientError, getBibleAIMenu } from "../../src/core/lib/aiClient";
import type { BiblePassage } from "../../src/core/types/ai";

const passage: BiblePassage = {
  reference: "Juan 3:16",
  translation: "NTV",
  verses: [{ id: "ntv-43-3-16", text: "Porque de tal manera amó Dios al mundo." }],
};

function sse(chunks: string[], status = 200): Response {
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Response(stream, { status, headers: { "content-type": "text/event-stream" } });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("aiClient", () => {
  it("accumulates split SSE frames and ignores quality events", async () => {
    const frame = [
      'data: {"type":"start","mode":"reflection"}\n\n',
      'data: {"type":"quality","score":1}\n\n',
      'data: {"type":"text","content":"Ho"}\n\n',
      'data: {"type":"text","content":"la"}\n\n',
      'data: {"type":"end","mode":"reflection","fullContent":"Hola"}\n\n',
    ].join("");
    const mid = Math.floor(frame.length / 2);
    vi.stubGlobal("fetch", vi.fn(async () => sse([frame.slice(0, mid), frame.slice(mid)])));
    const seen: string[] = [];
    await askBibleAIStream(passage, "reflection", {
      onText: (_chunk, accumulated) => seen.push(accumulated),
    });
    expect(seen).toEqual(["Ho", "Hola"]);
  });

  it("surfaces an SSE error and an incomplete stream", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => sse([
      'data: {"type":"error","message":"falló","code":"BAD"}\n\n',
    ])));
    const onError = vi.fn();
    await expect(askBibleAIStream(passage, "reflection", { onError })).rejects.toMatchObject({ code: "BAD" });
    expect(onError).toHaveBeenCalledOnce();

    vi.stubGlobal("fetch", vi.fn(async () => sse(['data: {"type":"text","content":"x"}\n\n'])));
    await expect(askBibleAIStream(passage, "reflection", {})).rejects.toMatchObject({ code: "INCOMPLETE_STREAM" });
  });

  it("keeps HTTP error codes from JSON bodies", async () => {
    for (const [status, code] of [[401, "UNAUTHENTICATED"], [403, "NOT_ALLOWED"], [429, "RATE_LIMIT_EXCEEDED"]] as const) {
      vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: "no", code }, { status })));
      await expect(askBibleAIStream(passage, "reflection", {})).rejects.toMatchObject({ code, status });
    }
  });

  it("times out and does not notify when the caller aborts", async () => {
    vi.stubGlobal("fetch", vi.fn((_url: string, init?: RequestInit) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        const error = new Error("aborted");
        error.name = "AbortError";
        reject(error);
      });
    })));
    await expect(askBibleAIStream(passage, "reflection", {}, { timeout: 15 })).rejects.toMatchObject({
      code: "REQUEST_TIMEOUT",
    });

    const controller = new AbortController();
    controller.abort();
    const onError = vi.fn();
    await expect(askBibleAIStream(passage, "reflection", { onError }, { signal: controller.signal })).rejects.toBeInstanceOf(BibleAIClientError);
    expect(onError).not.toHaveBeenCalled();
  });

  it("rejects a menu payload that is not a menu", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ type: "answer" })));
    await expect(getBibleAIMenu(passage)).rejects.toMatchObject({ code: "INVALID_MENU_RESPONSE" });
  });
});

describe("askPassageStream", () => {
  it("sends the question with only the last turns", async () => {
    const fetchMock = vi.fn(async () => sse([
      'data: {"type":"start","mode":"ask"}\n\n',
      'data: {"type":"end","mode":"ask","fullContent":"Sí [16]."}\n\n',
    ]));
    vi.stubGlobal("fetch", fetchMock);
    const history = Array.from({ length: 8 }, (_, index) => ({
      role: index % 2 === 0 ? "user" as const : "assistant" as const,
      content: `turno ${index}`,
    }));
    const onEnd = vi.fn();
    await askPassageStream(passage, "¿Amó Dios al mundo?", history, { onEnd });

    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body).toMatchObject({ mode: "ask", question: "¿Amó Dios al mundo?", passage });
    expect(body.history).toHaveLength(ASK_HISTORY_TURNS);
    expect(body.history[0]).toEqual({ role: "user", content: "turno 2" });
    expect(onEnd).toHaveBeenCalledWith(expect.objectContaining({ fullContent: "Sí [16]." }));
  });
});
