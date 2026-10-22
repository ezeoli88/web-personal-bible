import type { Context } from "hono";

export interface ApiErrorBody {
  error: string;
  code: string;
}

type ErrorStatus = 400 | 401 | 403 | 404 | 413 | 415 | 429 | 500 | 502;

export function apiError(c: Context, status: ErrorStatus, code: string, error: string) {
  return c.json({ error, code } satisfies ApiErrorBody, status);
}

export function logEvent(message: string, fields: Record<string, unknown> = {}, level: "info" | "error" = "info") {
  const line = JSON.stringify({ message, ...fields });
  if (level === "error") console.error(line);
  else console.log(line);
}

export function loginErrorPage(c: Context) {
  return c.html(
    `<!doctype html><html lang="es"><meta charset="utf-8"><title>No se pudo iniciar sesión</title><body><p>No se pudo iniciar sesión, probá de nuevo.</p></body></html>`,
    400,
  );
}

export const MAX_AI_BODY_BYTES = 64 * 1024;

export async function readLimitedBody(request: Request, maxBytes: number): Promise<Uint8Array | "too-large"> {
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();

  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return "too-large";
    }
    chunks.push(value);
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}
