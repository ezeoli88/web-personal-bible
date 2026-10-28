import type { BiblePassage } from "../../core/types/ai";
import { isSupportedTranslation, type BibleTranslation } from "../../core/types/translation";
import { getUserDataState, sendChange, updateUserData, useUserDataState } from "../userData/userData";
const MAX_TAGS = 8;
const MAX_TAG_LENGTH = 30;

export type NotebookKind = "ai" | "ask" | "word";

export const NOTEBOOK_KIND_LABELS: Record<NotebookKind, string> = {
  ai: "Respuesta de la IA",
  ask: "Pregunta a la IA",
  word: "Palabra a fondo",
};

/** Where an entry came from, to open it again in the reader. */
export interface NotebookPlace {
  bookNumber: number;
  chapter: number;
  verses: number[];
}

/** Something the reader kept for later study: an AI answer, a question or a word. */
export interface NotebookEntry {
  id: string;
  kind: NotebookKind;
  /** «Reflexión», the question asked, the word studied… */
  title: string;
  reference: string;
  translation: BibleTranslation;
  place: NotebookPlace | null;
  /** Markdown, as the AI wrote it. */
  content: string;
  tags: string[];
  createdAt: number;
}

export type NewNotebookEntry = Pick<NotebookEntry, "kind" | "title" | "content"> & { passage: BiblePassage };

/** The reader's verse ids end in book-chapter-verse, e.g. "ntv-43-3-16". */
export function passagePlace(passage: BiblePassage): NotebookPlace | null {
  const parsed = passage.verses.map(({ id }) => id.match(/(\d+)-(\d+)-(\d+)$/));
  if (parsed.length === 0 || parsed.some((match) => !match)) return null;
  const [, book, chapter] = parsed[0]!;
  return {
    bookNumber: Number(book),
    chapter: Number(chapter),
    verses: parsed.map((match) => Number(match![3])),
  };
}

export function normalizeTag(value: string): string {
  return value.trim().replace(/^#/, "").replace(/\s+/g, " ").toLowerCase().slice(0, MAX_TAG_LENGTH);
}

function sanitize(value: unknown): NotebookEntry | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<NotebookEntry>;
  if (typeof item.id !== "string" || typeof item.title !== "string" || typeof item.content !== "string") return null;
  if (item.kind !== "ai" && item.kind !== "ask" && item.kind !== "word") return null;
  if (typeof item.reference !== "string" || !isSupportedTranslation(item.translation)) return null;
  const place = item.place;
  const validPlace = place && Number.isInteger(place.bookNumber) && Number.isInteger(place.chapter) && Array.isArray(place.verses)
    ? { bookNumber: place.bookNumber, chapter: place.chapter, verses: place.verses.filter(Number.isInteger) }
    : null;
  return {
    id: item.id,
    kind: item.kind,
    title: item.title,
    reference: item.reference,
    translation: item.translation,
    place: validPlace,
    content: item.content,
    tags: Array.isArray(item.tags) ? item.tags.filter((tag): tag is string => typeof tag === "string").map(normalizeTag).filter(Boolean) : [],
    createdAt: typeof item.createdAt === "number" ? item.createdAt : 0,
  };
}

let cache: { list: readonly unknown[]; entries: readonly NotebookEntry[] } | null = null;

function entriesOf(list: readonly unknown[]): readonly NotebookEntry[] {
  if (!cache || cache.list !== list) {
    cache = { list, entries: list.map(sanitize).filter((entry): entry is NotebookEntry => entry !== null) };
  }
  return cache.entries;
}

function snapshot(): readonly NotebookEntry[] {
  return entriesOf(getUserDataState().data.notebook);
}

function replace(entries: readonly NotebookEntry[]) {
  cache = { list: entries, entries };
  updateUserData((data) => ({ ...data, notebook: entries as unknown[] }));
}

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function readNotebook(): readonly NotebookEntry[] {
  return snapshot();
}

/**
 * Saves an entry in the reader's account, newest first. The same content saved
 * twice is kept once. Returns null while signed out.
 */
export function addNotebookEntry({ kind, title, content, passage }: NewNotebookEntry, now = Date.now()): NotebookEntry | null {
  if (getUserDataState().status !== "ready") return null;
  const entries = snapshot();
  const existing = entries.find((entry) => entry.content === content && entry.reference === passage.reference);
  if (existing) return existing;
  const entry: NotebookEntry = {
    id: newId(),
    kind,
    title: title.trim(),
    reference: passage.reference,
    translation: passage.translation,
    place: passagePlace(passage),
    content,
    tags: [],
    createdAt: now,
  };
  replace([entry, ...entries]);
  void sendChange("POST", "/api/user-data/notebook", entry);
  return entry;
}

export function isInNotebook(content: string, reference: string): boolean {
  return snapshot().some((entry) => entry.content === content && entry.reference === reference);
}

export function removeNotebookEntry(id: string): void {
  replace(snapshot().filter((entry) => entry.id !== id));
  void sendChange("DELETE", `/api/user-data/notebook/${encodeURIComponent(id)}`);
}

export function setNotebookTags(id: string, tags: string[]): void {
  const clean = [...new Set(tags.map(normalizeTag).filter(Boolean))].slice(0, MAX_TAGS);
  replace(snapshot().map((entry) => (entry.id === id ? { ...entry, tags: clean } : entry)));
  void sendChange("PATCH", `/api/user-data/notebook/${encodeURIComponent(id)}`, { tags: clean });
}

export function useNotebook(): readonly NotebookEntry[] {
  return entriesOf(useUserDataState().data.notebook);
}

/** The notebook as Markdown, to download or paste elsewhere. */
export function notebookToMarkdown(entries: readonly NotebookEntry[], notes: Array<{ reference: string; note: string; text: string }> = []): string {
  const lines = ["# Cuaderno de estudio", ""];
  for (const entry of entries) {
    lines.push(`## ${entry.title}`, "", `*${NOTEBOOK_KIND_LABELS[entry.kind]} · ${entry.reference} (${entry.translation})*`);
    if (entry.tags.length > 0) lines.push(`Etiquetas: ${entry.tags.map((tag) => `#${tag}`).join(" ")}`);
    lines.push("", entry.content.trim(), "");
  }
  if (notes.length > 0) {
    lines.push("## Mis notas", "");
    for (const note of notes) lines.push(`**${note.reference}** — ${note.note}`, `> ${note.text}`, "");
  }
  return lines.join("\n").trimEnd() + "\n";
}
