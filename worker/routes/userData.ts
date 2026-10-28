import type { Context, Hono } from "hono";
import { requireAllowed, requireSession } from "../auth/middleware";
import {
  countRows,
  deleteNotebookEntry,
  insertNotebookEntries,
  LIMITS,
  parseAnnotation,
  parseNotebookEntry,
  parseReadingProgress,
  parseTags,
  parseVerseKey,
  readUserData,
  saveAnnotations,
  saveReadingProgress,
  setNotebookTags,
  type Annotation,
  type NotebookEntry,
  type VerseKey,
} from "../db/userData";
import { apiError, readLimitedBody } from "../lib/http";
import type { AppEnv } from "../app-env";

const MAX_BODY_BYTES = 64 * 1024;
const MAX_IMPORT_BYTES = 2 * 1024 * 1024;

async function readJson(c: Context<AppEnv>, maxBytes = MAX_BODY_BYTES): Promise<unknown | "too-large" | "invalid"> {
  const body = await readLimitedBody(c.req.raw, maxBytes);
  if (body === "too-large") return "too-large";
  try {
    return JSON.parse(new TextDecoder().decode(body)) as unknown;
  } catch {
    return "invalid";
  }
}

function badBody(c: Context<AppEnv>, body: unknown) {
  return body === "too-large"
    ? apiError(c, 413, "PAYLOAD_TOO_LARGE", "El cuerpo supera el tamaño permitido.")
    : apiError(c, 400, "INVALID_BODY", "Los datos no tienen el formato esperado.");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Parses every item or none: one invalid item rejects the request. */
function parseAll<T>(value: unknown, parse: (item: unknown) => T | null, max: number): T[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > max) return null;
  const items = value.map(parse);
  return items.every((item) => item !== null) ? items as T[] : null;
}

export function registerUserDataRoutes(app: Hono<AppEnv>): void {
  app.use("/api/user-data/*", requireSession, requireAllowed);
  app.use("/api/user-data", requireSession, requireAllowed);

  app.get("/api/user-data", async (c) => {
    c.header("Cache-Control", "no-store");
    return c.json(await readUserData(c.env.DB, c.get("email")));
  });

  // Marks: the changed verses and the ones left with nothing.
  app.post("/api/user-data/annotations", async (c) => {
    const body = await readJson(c);
    if (!isRecord(body)) return badBody(c, body);
    const upsert = parseAll<Annotation>(body.upsert, parseAnnotation, LIMITS.batch);
    const remove = parseAll<VerseKey>(body.remove, parseVerseKey, LIMITS.batch);
    if (!upsert || !remove) return badBody(c, "invalid");
    const email = c.get("email");
    if (upsert.length > 0 && await countRows(c.env.DB, email, "verse_annotations") + upsert.length > LIMITS.annotations) {
      return apiError(c, 413, "TOO_MANY_ANNOTATIONS", `Se pueden guardar hasta ${LIMITS.annotations} versículos marcados.`);
    }
    await saveAnnotations(c.env.DB, email, upsert, remove);
    return c.json({ ok: true });
  });

  app.post("/api/user-data/notebook", async (c) => {
    const body = await readJson(c);
    const entry = parseNotebookEntry(body);
    if (!entry) return badBody(c, body);
    const email = c.get("email");
    if (await countRows(c.env.DB, email, "notebook_entries") >= LIMITS.notebook) {
      return apiError(c, 413, "NOTEBOOK_FULL", `El cuaderno admite hasta ${LIMITS.notebook} entradas.`);
    }
    await insertNotebookEntries(c.env.DB, email, [entry]);
    return c.json({ ok: true });
  });

  app.patch("/api/user-data/notebook/:id", async (c) => {
    const body = await readJson(c);
    const tags = isRecord(body) ? parseTags(body.tags) : null;
    if (!tags) return badBody(c, body);
    const found = await setNotebookTags(c.env.DB, c.get("email"), c.req.param("id"), tags);
    return found ? c.json({ ok: true, tags }) : apiError(c, 404, "NOT_FOUND", "La entrada no existe.");
  });

  app.delete("/api/user-data/notebook/:id", async (c) => {
    await deleteNotebookEntry(c.env.DB, c.get("email"), c.req.param("id"));
    return c.json({ ok: true });
  });

  app.put("/api/user-data/reading", async (c) => {
    const body = await readJson(c);
    const reading = parseReadingProgress(body);
    if (!reading) return badBody(c, body);
    await saveReadingProgress(c.env.DB, c.get("email"), reading);
    return c.json({ ok: true });
  });

  // What a reader kept on the device before marks moved to the account.
  // Merges without overwriting: newer marks win, existing entries and places stay.
  app.post("/api/user-data/import", async (c) => {
    const body = await readJson(c, MAX_IMPORT_BYTES);
    if (!isRecord(body)) return badBody(c, body);
    const annotations = Array.isArray(body.annotations)
      ? body.annotations.slice(0, LIMITS.annotations).map(parseAnnotation).filter((item): item is Annotation => item !== null)
      : [];
    const notebook = Array.isArray(body.notebook)
      ? body.notebook.slice(0, LIMITS.notebook).map(parseNotebookEntry).filter((item): item is NotebookEntry => item !== null)
      : [];
    const reading = body.lastReading ? parseReadingProgress(body.lastReading) : null;
    const email = c.get("email");
    for (let start = 0; start < annotations.length; start += LIMITS.batch) {
      await saveAnnotations(c.env.DB, email, annotations.slice(start, start + LIMITS.batch), [], true);
    }
    for (let start = 0; start < notebook.length; start += LIMITS.batch) {
      await insertNotebookEntries(c.env.DB, email, notebook.slice(start, start + LIMITS.batch));
    }
    if (reading) await saveReadingProgress(c.env.DB, email, reading, true);
    return c.json(await readUserData(c.env.DB, email));
  });
}
