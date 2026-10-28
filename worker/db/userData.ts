/**
 * The reader's own data: marks, study notebook and last reading place.
 * Every function takes the signed-in email; nothing here trusts an email from the body.
 */

export const TRANSLATIONS = ["NTV", "LBLA", "RV1960", "RV2004", "PDT", "BTX3"] as const;
export const HIGHLIGHTS = ["yellow", "green", "blue", "pink", "orange"] as const;
export const NOTEBOOK_KINDS = ["ai", "ask", "word"] as const;

export const LIMITS = {
  annotations: 5000,
  notebook: 500,
  verseText: 2000,
  note: 4000,
  title: 300,
  reference: 100,
  content: 20000,
  tags: 8,
  tag: 30,
  /** Changes sent in one request. */
  batch: 200,
} as const;

export interface Annotation {
  bookNumber: number;
  chapter: number;
  verse: number;
  text: string;
  translation: string;
  highlight?: string;
  bookmarked?: boolean;
  note?: string;
  updatedAt: number;
}

export interface VerseKey {
  bookNumber: number;
  chapter: number;
  verse: number;
}

export interface NotebookEntry {
  id: string;
  kind: string;
  title: string;
  reference: string;
  translation: string;
  place: { bookNumber: number; chapter: number; verses: number[] } | null;
  content: string;
  tags: string[];
  createdAt: number;
}

export interface ReadingProgress {
  slug: string;
  chapter: number;
  verse: number;
  translation: string;
}

export interface UserData {
  annotations: Annotation[];
  notebook: NotebookEntry[];
  lastReading: ReadingProgress | null;
}

// ---------- validation ----------

type Json = Record<string, unknown>;

function isRecord(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function positiveInt(value: unknown, max = 10_000): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0 && value <= max;
}

function boundedString(value: unknown, max: number): value is string {
  return typeof value === "string" && value.length <= max;
}

function oneOf<T extends string>(list: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (list as readonly string[]).includes(value);
}

export function parseVerseKey(value: unknown): VerseKey | null {
  if (!isRecord(value)) return null;
  const { bookNumber, chapter, verse } = value;
  if (!positiveInt(bookNumber, 66) || !positiveInt(chapter, 150) || !positiveInt(verse, 200)) return null;
  return { bookNumber, chapter, verse };
}

/** Null when invalid. An annotation with nothing left (no color, bookmark or note) is invalid too. */
export function parseAnnotation(value: unknown): Annotation | null {
  const key = parseVerseKey(value);
  if (!key || !isRecord(value)) return null;
  if (!boundedString(value.text, LIMITS.verseText) || !oneOf(TRANSLATIONS, value.translation)) return null;
  if (value.highlight !== undefined && !oneOf(HIGHLIGHTS, value.highlight)) return null;
  if (value.bookmarked !== undefined && typeof value.bookmarked !== "boolean") return null;
  if (value.note !== undefined && !boundedString(value.note, LIMITS.note)) return null;
  if (typeof value.updatedAt !== "number" || !Number.isFinite(value.updatedAt)) return null;
  const note = typeof value.note === "string" && value.note.trim() ? value.note.trim() : undefined;
  const annotation: Annotation = {
    ...key,
    text: value.text,
    translation: value.translation,
    updatedAt: Math.trunc(value.updatedAt),
  };
  if (value.highlight) annotation.highlight = value.highlight as string;
  if (value.bookmarked) annotation.bookmarked = true;
  if (note) annotation.note = note;
  return annotation.highlight || annotation.bookmarked || annotation.note ? annotation : null;
}

export function parseTags(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const tags: string[] = [];
  for (const tag of value) {
    if (typeof tag !== "string") return null;
    const clean = tag.trim().replace(/^#/, "").replace(/\s+/g, " ").toLowerCase().slice(0, LIMITS.tag);
    if (clean && !tags.includes(clean)) tags.push(clean);
  }
  return tags.slice(0, LIMITS.tags);
}

export function parseNotebookEntry(value: unknown): NotebookEntry | null {
  if (!isRecord(value)) return null;
  const { id, kind, title, reference, translation, content, createdAt, place } = value;
  if (typeof id !== "string" || !/^[A-Za-z0-9-]{8,64}$/.test(id)) return null;
  if (!oneOf(NOTEBOOK_KINDS, kind) || !oneOf(TRANSLATIONS, translation)) return null;
  if (!boundedString(title, LIMITS.title) || !boundedString(reference, LIMITS.reference)) return null;
  if (!boundedString(content, LIMITS.content) || !content.trim()) return null;
  if (typeof createdAt !== "number" || !Number.isFinite(createdAt)) return null;
  const tags = value.tags === undefined ? [] : parseTags(value.tags);
  if (!tags) return null;
  let parsedPlace: NotebookEntry["place"] = null;
  if (place !== null && place !== undefined) {
    if (!isRecord(place) || !positiveInt(place.bookNumber, 66) || !positiveInt(place.chapter, 150) || !Array.isArray(place.verses)) return null;
    const verses = place.verses.filter((verse): verse is number => positiveInt(verse, 200)).slice(0, 50);
    parsedPlace = { bookNumber: place.bookNumber, chapter: place.chapter, verses };
  }
  return { id, kind, title: title.trim(), reference, translation, place: parsedPlace, content, tags, createdAt: Math.trunc(createdAt) };
}

export function parseReadingProgress(value: unknown): ReadingProgress | null {
  if (!isRecord(value)) return null;
  const { slug, chapter, verse, translation } = value;
  if (typeof slug !== "string" || !/^[a-z0-9-]{1,40}$/.test(slug)) return null;
  if (!positiveInt(chapter, 150) || !positiveInt(verse, 200) || !oneOf(TRANSLATIONS, translation)) return null;
  return { slug, chapter, verse, translation };
}

// ---------- queries ----------

interface AnnotationRow {
  book: number;
  chapter: number;
  verse: number;
  text: string;
  translation: string;
  highlight: string | null;
  bookmarked: number;
  note: string | null;
  updated_at: number;
}

interface NotebookRow {
  id: string;
  kind: string;
  title: string;
  reference: string;
  translation: string;
  place: string | null;
  content: string;
  tags: string;
  created_at: number;
}

function safeJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function mapAnnotation(row: AnnotationRow): Annotation {
  const annotation: Annotation = {
    bookNumber: row.book,
    chapter: row.chapter,
    verse: row.verse,
    text: row.text,
    translation: row.translation,
    updatedAt: row.updated_at,
  };
  if (row.highlight) annotation.highlight = row.highlight;
  if (row.bookmarked === 1) annotation.bookmarked = true;
  if (row.note) annotation.note = row.note;
  return annotation;
}

function mapNotebook(row: NotebookRow): NotebookEntry {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    reference: row.reference,
    translation: row.translation,
    place: safeJson(row.place, null),
    content: row.content,
    tags: safeJson<string[]>(row.tags, []),
    createdAt: row.created_at,
  };
}

export async function readUserData(db: D1Database, email: string): Promise<UserData> {
  const [annotations, notebook, reading] = await db.batch([
    db.prepare(
      `SELECT book, chapter, verse, text, translation, highlight, bookmarked, note, updated_at
       FROM verse_annotations WHERE email = ? ORDER BY updated_at DESC`,
    ).bind(email),
    db.prepare(
      `SELECT id, kind, title, reference, translation, place, content, tags, created_at
       FROM notebook_entries WHERE email = ? ORDER BY created_at DESC`,
    ).bind(email),
    db.prepare("SELECT slug, chapter, verse, translation FROM reading_progress WHERE email = ?").bind(email),
  ]);
  return {
    annotations: (annotations.results as unknown as AnnotationRow[]).map(mapAnnotation),
    notebook: (notebook.results as unknown as NotebookRow[]).map(mapNotebook),
    lastReading: (reading.results?.[0] as ReadingProgress | undefined) ?? null,
  };
}

export async function countRows(db: D1Database, email: string, table: "verse_annotations" | "notebook_entries"): Promise<number> {
  const row = await db.prepare(`SELECT COUNT(*) AS total FROM ${table} WHERE email = ?`).bind(email).first<{ total: number }>();
  return row?.total ?? 0;
}

/**
 * Saves changed annotations and deletes cleared ones. With `onlyNewer`, an
 * existing row is kept when it was updated later (used when importing).
 */
export async function saveAnnotations(
  db: D1Database,
  email: string,
  upsert: Annotation[],
  remove: VerseKey[],
  onlyNewer = false,
): Promise<void> {
  const statements = [
    ...upsert.map((item) => db.prepare(
      `INSERT INTO verse_annotations (email, book, chapter, verse, text, translation, highlight, bookmarked, note, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (email, book, chapter, verse) DO UPDATE SET
         text = excluded.text, translation = excluded.translation, highlight = excluded.highlight,
         bookmarked = excluded.bookmarked, note = excluded.note, updated_at = excluded.updated_at
       ${onlyNewer ? "WHERE excluded.updated_at > verse_annotations.updated_at" : ""}`,
    ).bind(
      email, item.bookNumber, item.chapter, item.verse, item.text, item.translation,
      item.highlight ?? null, item.bookmarked ? 1 : 0, item.note ?? null, item.updatedAt,
    )),
    ...remove.map((key) => db.prepare(
      "DELETE FROM verse_annotations WHERE email = ? AND book = ? AND chapter = ? AND verse = ?",
    ).bind(email, key.bookNumber, key.chapter, key.verse)),
  ];
  if (statements.length > 0) await db.batch(statements);
}

/** Adds entries; an id that already exists is left as is. */
export async function insertNotebookEntries(db: D1Database, email: string, entries: NotebookEntry[]): Promise<void> {
  if (entries.length === 0) return;
  await db.batch(entries.map((entry) => db.prepare(
    `INSERT INTO notebook_entries (id, email, kind, title, reference, translation, place, content, tags, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (email, id) DO NOTHING`,
  ).bind(
    entry.id, email, entry.kind, entry.title, entry.reference, entry.translation,
    entry.place ? JSON.stringify(entry.place) : null, entry.content, JSON.stringify(entry.tags), entry.createdAt,
  )));
}

export async function setNotebookTags(db: D1Database, email: string, id: string, tags: string[]): Promise<boolean> {
  const result = await db.prepare("UPDATE notebook_entries SET tags = ? WHERE email = ? AND id = ?")
    .bind(JSON.stringify(tags), email, id).run();
  return (result.meta.changes ?? 0) > 0;
}

export async function deleteNotebookEntry(db: D1Database, email: string, id: string): Promise<void> {
  await db.prepare("DELETE FROM notebook_entries WHERE email = ? AND id = ?").bind(email, id).run();
}

/** With `onlyIfMissing`, keeps a place already saved (used when importing). */
export async function saveReadingProgress(
  db: D1Database,
  email: string,
  reading: ReadingProgress,
  onlyIfMissing = false,
  now = Date.now(),
): Promise<void> {
  await db.prepare(
    `INSERT INTO reading_progress (email, slug, chapter, verse, translation, updated_at) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (email) DO ${onlyIfMissing ? "NOTHING" : "UPDATE SET slug = excluded.slug, chapter = excluded.chapter, verse = excluded.verse, translation = excluded.translation, updated_at = excluded.updated_at"}`,
  ).bind(email, reading.slug, reading.chapter, reading.verse, reading.translation, now).run();
}
