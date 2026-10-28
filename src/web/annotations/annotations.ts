import { isSupportedTranslation, type BibleTranslation } from "../../core/types/translation";
import { getUserDataState, sendChange, updateUserData, useUserDataState } from "../userData/userData";

export const HIGHLIGHT_COLORS = ["yellow", "green", "blue", "pink", "orange"] as const;
export type HighlightColor = (typeof HIGHLIGHT_COLORS)[number];

export const HIGHLIGHT_LABELS: Record<HighlightColor, string> = {
  yellow: "Amarillo",
  green: "Verde",
  blue: "Celeste",
  pink: "Rosa",
  orange: "Naranja",
};

/** A verse's place in the Bible, the same in every translation. */
export interface VerseLocation {
  bookNumber: number;
  chapter: number;
  verse: number;
}

/**
 * What the reader saved on one verse. `text` and `translation` are the verse as
 * it was read when it was marked, so the saved list shows it without a fetch.
 */
export interface VerseAnnotation extends VerseLocation {
  text: string;
  translation: BibleTranslation;
  highlight?: HighlightColor;
  bookmarked?: boolean;
  note?: string;
  updatedAt: number;
}

export type AnnotationTarget = VerseLocation & { text: string; translation: BibleTranslation };

/** `null` removes the highlight or the note; `bookmarked: false` removes the bookmark. */
export interface AnnotationPatch {
  highlight?: HighlightColor | null;
  bookmarked?: boolean;
  note?: string | null;
}

type AnnotationMap = Readonly<Record<string, VerseAnnotation>>;

export function annotationKey({ bookNumber, chapter, verse }: VerseLocation): string {
  return `${bookNumber}:${chapter}:${verse}`;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isHighlightColor(value: unknown): value is HighlightColor {
  return HIGHLIGHT_COLORS.includes(value as HighlightColor);
}

function sanitize(value: unknown): VerseAnnotation | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<VerseAnnotation>;
  if (!isPositiveInteger(item.bookNumber) || !isPositiveInteger(item.chapter) || !isPositiveInteger(item.verse)) return null;
  if (typeof item.text !== "string" || !isSupportedTranslation(item.translation)) return null;
  const annotation: VerseAnnotation = {
    bookNumber: item.bookNumber,
    chapter: item.chapter,
    verse: item.verse,
    text: item.text,
    translation: item.translation,
    updatedAt: typeof item.updatedAt === "number" ? item.updatedAt : 0,
  };
  if (isHighlightColor(item.highlight)) annotation.highlight = item.highlight;
  if (item.bookmarked === true) annotation.bookmarked = true;
  if (typeof item.note === "string" && item.note.trim()) annotation.note = item.note;
  return isEmpty(annotation) ? null : annotation;
}

function isEmpty(annotation: VerseAnnotation): boolean {
  return !annotation.highlight && !annotation.bookmarked && !annotation.note;
}

function toMap(list: readonly unknown[]): AnnotationMap {
  const map: Record<string, VerseAnnotation> = {};
  for (const entry of list) {
    const annotation = sanitize(entry);
    if (annotation) map[annotationKey(annotation)] = annotation;
  }
  return map;
}

// The map is rebuilt only when the server copy changes, so React sees a stable snapshot.
let cache: { list: readonly unknown[]; map: AnnotationMap } | null = null;

function mapOf(list: readonly unknown[]): AnnotationMap {
  if (!cache || cache.list !== list) cache = { list, map: toMap(list) };
  return cache.map;
}

function snapshot(): AnnotationMap {
  return mapOf(getUserDataState().data.annotations);
}

export function readAnnotations(): AnnotationMap {
  return snapshot();
}

/**
 * Applies the same change to every target and saves it in the reader's account.
 * A verse left with nothing saved is removed. Does nothing while signed out.
 */
export function updateAnnotations(targets: AnnotationTarget[], patch: AnnotationPatch, now = Date.now()): void {
  if (getUserDataState().status !== "ready") return;
  const next: Record<string, VerseAnnotation> = { ...snapshot() };
  const upsert: VerseAnnotation[] = [];
  const remove: VerseLocation[] = [];
  for (const target of targets) {
    const key = annotationKey(target);
    const annotation: VerseAnnotation = {
      ...next[key],
      bookNumber: target.bookNumber,
      chapter: target.chapter,
      verse: target.verse,
      text: target.text,
      translation: target.translation,
      updatedAt: now,
    };
    if (patch.highlight !== undefined) {
      if (patch.highlight) annotation.highlight = patch.highlight;
      else delete annotation.highlight;
    }
    if (patch.bookmarked !== undefined) {
      if (patch.bookmarked) annotation.bookmarked = true;
      else delete annotation.bookmarked;
    }
    if (patch.note !== undefined) {
      const note = patch.note?.trim();
      if (note) annotation.note = note;
      else delete annotation.note;
    }
    if (isEmpty(annotation)) {
      delete next[key];
      remove.push({ bookNumber: target.bookNumber, chapter: target.chapter, verse: target.verse });
    } else {
      next[key] = annotation;
      upsert.push(annotation);
    }
  }
  const list = Object.values(next);
  cache = { list, map: next };
  updateUserData((data) => ({ ...data, annotations: list }));
  void sendChange("POST", "/api/user-data/annotations", { upsert, remove });
}

/** Removes one kind of mark from a verse, keeping the others. */
export function removeAnnotationPart(location: VerseLocation, part: "highlight" | "bookmarked" | "note"): void {
  const current = snapshot()[annotationKey(location)];
  if (!current) return;
  const patch: AnnotationPatch = part === "bookmarked" ? { bookmarked: false } : { [part]: null };
  updateAnnotations([current], patch, current.updatedAt);
}

export function useAnnotations(): AnnotationMap {
  return mapOf(useUserDataState().data.annotations);
}
