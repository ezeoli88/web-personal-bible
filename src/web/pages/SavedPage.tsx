import { useState } from "react";
import { Link } from "@tanstack/react-router";
import clsx from "clsx";
import { useBibleRepository } from "../../core/hooks/DatabaseProvider";
import { bookFromNumber, bookSlug } from "../../core/lib/bookSlugs";
import { BookmarkIcon } from "../annotations/AnnotateSheet";
import {
  HIGHLIGHT_COLORS,
  HIGHLIGHT_LABELS,
  removeAnnotationPart,
  useAnnotations,
  type HighlightColor,
  type VerseAnnotation,
} from "../annotations/annotations";
import { NotebookView } from "../notebook/NotebookView";
import { useNotebook } from "../notebook/notebook";
import styles from "./SavedPage.module.css";

type AnnotationTab = "bookmarks" | "highlights" | "notes";
type Tab = AnnotationTab | "notebook";

const TABS: Array<{ value: Tab; label: string; empty: string }> = [
  { value: "bookmarks", label: "Marcadores", empty: "Todavía no agregaste marcadores." },
  { value: "highlights", label: "Subrayados", empty: "Todavía no subrayaste versículos." },
  { value: "notes", label: "Notas", empty: "Todavía no escribiste notas." },
  { value: "notebook", label: "Cuaderno", empty: "" },
];

const PART: Record<AnnotationTab, "bookmarked" | "highlight" | "note"> = {
  bookmarks: "bookmarked",
  highlights: "highlight",
  notes: "note",
};

function belongsTo(tab: Tab, annotation: VerseAnnotation): boolean {
  return tab !== "notebook" && Boolean(annotation[PART[tab]]);
}

export function SavedPage() {
  const annotations = useAnnotations();
  const { translation: current } = useBibleRepository();
  const notebook = useNotebook();
  const all = Object.values(annotations).sort((a, b) => b.updatedAt - a.updatedAt);
  const counts = Object.fromEntries(TABS.map(({ value }) => [
    value,
    value === "notebook" ? notebook.length : all.filter((item) => belongsTo(value, item)).length,
  ])) as Record<Tab, number>;
  const [tab, setTab] = useState<Tab>(() => TABS.find(({ value }) => counts[value] > 0)?.value ?? "bookmarks");
  const [color, setColor] = useState<HighlightColor | null>(null);
  const usedColors = HIGHLIGHT_COLORS.filter((item) => all.some((annotation) => annotation.highlight === item));
  const items = all.filter((item) => belongsTo(tab, item) && (tab !== "highlights" || !color || item.highlight === color));
  const activeTab = TABS.find(({ value }) => value === tab)!;

  return (
    <section data-testid="saved-page">
      <h2 className={styles.title}>Guardados</h2>
      <p className={styles.intro}>
        Tus marcadores, subrayados, notas y el cuaderno de estudio se guardan en este dispositivo.
      </p>
      <div className={styles.tabs} role="tablist" aria-label="Tipo de marca">
        {TABS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            className={clsx(styles.tab, tab === value && styles.tabActive)}
            onClick={() => setTab(value)}
          >
            {label} <span className={styles.count}>{counts[value]}</span>
          </button>
        ))}
      </div>

      {tab === "highlights" && usedColors.length > 1 ? (
        <div className={styles.colors} aria-label="Filtrar por color">
          <button
            type="button"
            className={clsx(styles.colorChip, !color && styles.colorChipActive)}
            aria-pressed={!color}
            onClick={() => setColor(null)}
          >
            Todos
          </button>
          {usedColors.map((item) => (
            <button
              key={item}
              type="button"
              className={clsx(styles.colorChip, color === item && styles.colorChipActive)}
              aria-pressed={color === item}
              onClick={() => setColor(item)}
            >
              <span className={styles.dot} style={{ background: `var(--hl-${item})` }} aria-hidden="true" />
              {HIGHLIGHT_LABELS[item]}
            </button>
          ))}
        </div>
      ) : null}

      {tab === "notebook" ? (
        <NotebookView notes={all.filter((item) => item.note)} />
      ) : items.length === 0 ? (
        <div className={styles.empty} role="status">
          <p>{activeTab.empty}</p>
          <p className={styles.hint}>
            En el lector, tocá un versículo y elegí <strong>Marcar</strong>.
          </p>
        </div>
      ) : (
        <ul className={styles.list} role="tabpanel" aria-label={activeTab.label}>
          {items.map((item) => {
            const book = bookFromNumber(item.bookNumber);
            const slug = bookSlug(item.bookNumber);
            if (!book || !slug) return null;
            const reference = `${book.name} ${item.chapter}:${item.verse}`;
            return (
              <li key={`${item.bookNumber}:${item.chapter}:${item.verse}`} className={styles.item} data-testid="saved-item">
                <Link
                  className={styles.link}
                  to="/$book/$chapter"
                  params={{ book: slug, chapter: String(item.chapter) }}
                  search={{ v: item.verse, t: item.translation === current ? undefined : item.translation }}
                >
                  <span className={styles.reference}>
                    {tab === "bookmarks" ? <BookmarkIcon className={styles.bookmark} /> : null}
                    {reference}
                    <span className={styles.translation}>{item.translation}</span>
                  </span>
                  {tab === "notes" ? <span className={styles.note}>{item.note}</span> : null}
                  <span
                    className={clsx(styles.text, tab === "notes" && styles.textQuoted)}
                    style={tab === "highlights" && item.highlight ? { background: `var(--hl-${item.highlight})` } : undefined}
                  >
                    {item.text}
                  </span>
                </Link>
                <button
                  type="button"
                  className={styles.remove}
                  aria-label={`Quitar ${activeTab.label.toLowerCase().replace(/s$/, "")} de ${reference}`}
                  onClick={() => removeAnnotationPart(item, PART[tab])}
                >
                  Quitar
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
