import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import type { CrossReference } from "../../core/crossRefs/openBible";
import { bookFromNumber, bookSlug } from "../../core/lib/bookSlugs";
import { formatVerseParam } from "../layout/bookRoute";
import { connectionKey, connectionVerses, useConnectionTexts } from "./useConnections";
import styles from "./ConnectionsSheet.module.css";

const PAGE_SIZE = 8;

interface Props {
  /** Connections of the open verse, most voted first; empty = closed. */
  references: CrossReference[];
  reference: string;
  onClose: () => void;
}

export function formatConnection([book, chapter, verse, endChapter, endVerse]: CrossReference): string {
  const name = bookFromNumber(book)?.name ?? "";
  if (!endVerse) return `${name} ${chapter}:${verse}`;
  if (endChapter === chapter) return `${name} ${chapter}:${verse}-${endVerse}`;
  return `${name} ${chapter}:${verse}–${endChapter}:${endVerse}`;
}

export function ConnectionsSheet({ references, reference, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const open = references.length > 0;
  const shown = references.slice(0, visible);
  const texts = useConnectionTexts(shown);
  const maxVotes = references[0]?.[5] ?? 1;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
    if (open) setVisible(PAGE_SIZE);
  }, [open, references]);

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      data-testid="connections-sheet"
      aria-label={`Conexiones de ${reference}`}
      onClose={onClose}
    >
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Conexiones</h2>
          <p className={styles.reference}>{reference} · las más votadas primero</p>
        </div>
        <button type="button" className={styles.close} onClick={onClose} aria-label="Cerrar conexiones">✕</button>
      </div>
      <ul className={styles.list}>
        {shown.map((item) => {
          const key = connectionKey(item);
          const slug = bookSlug(item[0]);
          const text = texts.data?.[key];
          const crossesChapter = item[4] > 0 && item[3] !== item[1];
          return (
            <li key={key} className={styles.item} data-testid="connection">
              {slug ? (
                <Link
                  className={styles.link}
                  to="/$book/$chapter"
                  params={{ book: slug, chapter: String(item[1]) }}
                  search={{ v: formatVerseParam(connectionVerses(item)) }}
                  onClick={onClose}
                >
                  <span className={styles.row}>
                    <span className={styles.target}>{formatConnection(item)}</span>
                    <span
                      className={styles.relevance}
                      role="img"
                      aria-label={`Relevancia ${Math.round((item[5] / maxVotes) * 100)} %`}
                    >
                      <i style={{ width: `${Math.max(8, Math.round((item[5] / maxVotes) * 100))}%` }} />
                    </span>
                  </span>
                  {text ? (
                    <span className={styles.text}>{text}{crossesChapter ? " …" : ""}</span>
                  ) : texts.isPending ? (
                    <span className={styles.loading}>Cargando…</span>
                  ) : (
                    <span className={styles.loading}>Tocá para leerlo.</span>
                  )}
                </Link>
              ) : null}
            </li>
          );
        })}
      </ul>
      {references.length > visible ? (
        <button type="button" className={styles.more} onClick={() => setVisible((count) => count + PAGE_SIZE)}>
          Ver {Math.min(PAGE_SIZE, references.length - visible)} más
        </button>
      ) : null}
      <p className={styles.credit}>
        Referencias cruzadas de <a href="https://www.openbible.info/labs/cross-references/" target="_blank" rel="noreferrer">OpenBible.info</a> (CC-BY).
      </p>
    </dialog>
  );
}
