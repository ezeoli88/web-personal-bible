import { useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import clsx from "clsx";
import { bookFromNumber, bookSlug } from "../../core/lib/bookSlugs";
import { copyText } from "../../platform/clipboard";
import { notify } from "../../platform/notify";
import type { VerseAnnotation } from "../annotations/annotations";
import { MarkdownText } from "../components/MarkdownText";
import { formatVerseParam } from "../layout/bookRoute";
import {
  NOTEBOOK_KIND_LABELS,
  normalizeTag,
  notebookToMarkdown,
  removeNotebookEntry,
  setNotebookTags,
  useNotebook,
  type NotebookEntry,
} from "./notebook";
import styles from "./NotebookView.module.css";

interface Props {
  /** The reader's verse notes, which go into the export too. */
  notes: VerseAnnotation[];
}

function TagEditor({ entry }: { entry: NotebookEntry }) {
  const [draft, setDraft] = useState("");

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const tags = draft.split(",").map(normalizeTag).filter(Boolean);
    if (tags.length > 0) setNotebookTags(entry.id, [...entry.tags, ...tags]);
    setDraft("");
  }

  return (
    <div className={styles.tags}>
      {entry.tags.map((tag) => (
        <span key={tag} className={styles.tag}>
          #{tag}
          <button
            type="button"
            className={styles.tagRemove}
            aria-label={`Quitar la etiqueta ${tag}`}
            onClick={() => setNotebookTags(entry.id, entry.tags.filter((item) => item !== tag))}
          >
            ✕
          </button>
        </span>
      ))}
      <form className={styles.tagForm} onSubmit={onSubmit}>
        <label className={styles.visuallyHidden} htmlFor={`tag-${entry.id}`}>Agregar etiqueta</label>
        <input
          id={`tag-${entry.id}`}
          className={styles.tagInput}
          placeholder="+ etiqueta"
          maxLength={60}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
      </form>
    </div>
  );
}

function download(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/markdown;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** The study notebook: AI answers, questions and words the reader kept, with tags. */
export function NotebookView({ notes }: Props) {
  const entries = useNotebook();
  const [tag, setTag] = useState<string | null>(null);
  const allTags = [...new Set(entries.flatMap((entry) => entry.tags))].sort();
  const activeTag = tag && allTags.includes(tag) ? tag : null;
  const shown = activeTag ? entries.filter((entry) => entry.tags.includes(activeTag)) : entries;

  function markdown() {
    return notebookToMarkdown(shown, activeTag ? [] : notes.map((note) => ({
      reference: `${bookFromNumber(note.bookNumber)?.name ?? ""} ${note.chapter}:${note.verse}`,
      note: note.note ?? "",
      text: note.text,
    })));
  }

  async function copyAll() {
    try {
      await copyText(markdown());
      notify("Copiado", "El cuaderno se copió al portapapeles.");
    } catch (error) {
      notify("No se pudo copiar", error instanceof Error ? error.message : "Probá de nuevo.");
    }
  }

  if (entries.length === 0) {
    return (
      <div className={styles.empty} role="status">
        <p>Tu cuaderno está vacío.</p>
        <p className={styles.hint}>
          En el panel de IA, tocá <strong>Guardar en el cuaderno</strong> en una respuesta, una pregunta o una palabra.
        </p>
      </div>
    );
  }

  return (
    <div data-testid="notebook">
      {allTags.length > 0 ? (
        <div className={styles.filters} aria-label="Filtrar por etiqueta">
          <button type="button" className={clsx(styles.filter, !activeTag && styles.filterActive)} aria-pressed={!activeTag} onClick={() => setTag(null)}>
            Todo
          </button>
          {allTags.map((item) => (
            <button
              key={item}
              type="button"
              className={clsx(styles.filter, activeTag === item && styles.filterActive)}
              aria-pressed={activeTag === item}
              onClick={() => setTag(item)}
            >
              #{item}
            </button>
          ))}
        </div>
      ) : null}

      <ul className={styles.list}>
        {shown.map((entry) => {
          const slug = entry.place ? bookSlug(entry.place.bookNumber) : null;
          return (
            <li key={entry.id} className={styles.entry} data-testid="notebook-entry">
              <div className={styles.meta}>
                <span className={styles.kind}>{NOTEBOOK_KIND_LABELS[entry.kind]}</span>
                {entry.place && slug ? (
                  <Link
                    className={styles.reference}
                    to="/$book/$chapter"
                    params={{ book: slug, chapter: String(entry.place.chapter) }}
                    search={{ v: formatVerseParam(entry.place.verses), t: entry.translation }}
                  >
                    {entry.reference} · {entry.translation}
                  </Link>
                ) : (
                  <span className={styles.reference}>{entry.reference} · {entry.translation}</span>
                )}
              </div>
              <h3 className={styles.entryTitle}>{entry.title}</h3>
              <div className={styles.content}><MarkdownText>{entry.content}</MarkdownText></div>
              <TagEditor entry={entry} />
              <button
                type="button"
                className={styles.remove}
                aria-label={`Quitar «${entry.title}» del cuaderno`}
                onClick={() => removeNotebookEntry(entry.id)}
              >
                Quitar
              </button>
            </li>
          );
        })}
      </ul>

      <div className={styles.actions}>
        <button type="button" className={styles.action} onClick={() => void copyAll()}>Copiar</button>
        <button type="button" className={styles.action} onClick={() => download("cuaderno-de-estudio.md", markdown())}>
          Descargar (.md)
        </button>
      </div>
      <p className={styles.hint}>
        {activeTag ? `Se exportan las entradas con #${activeTag}.` : "La exportación incluye también tus notas de versículos."}
      </p>
    </div>
  );
}
