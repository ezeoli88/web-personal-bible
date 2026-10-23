import { useEffect, useRef } from "react";
import clsx from "clsx";
import { BollsTranslationUnavailableError } from "../../core/api/BollsBibleClient";
import { useBibleRepository } from "../../core/hooks/DatabaseProvider";
import { useVerseComparison } from "../../core/hooks/useBibleQueries";
import type { Verse } from "../../core/types/bible";
import {
  TRANSLATION_LABELS,
  TRANSLATION_NOTICES,
  type BibleTranslation,
} from "../../core/types/translation";
import styles from "./VerseCompareSheet.module.css";

interface Props {
  /** Versículos seleccionados en la traducción actual; vacío = cerrado. */
  verses: Verse[];
  reference: string;
  onSelectTranslation: (translation: BibleTranslation) => void;
  onClose: () => void;
}

export function VerseCompareSheet({ verses, reference, onSelectTranslation, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { translation: current } = useBibleRepository();
  const entries = useVerseComparison(verses);
  const open = verses.length > 0;
  const plural = verses.length > 1;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      data-testid="verse-compare"
      aria-label={`Comparar ${reference}`}
      onClose={onClose}
    >
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Comparar versiones</h2>
          <p className={styles.reference}>{reference}</p>
        </div>
        <button type="button" className={styles.close} onClick={onClose} aria-label="Cerrar comparativa">✕</button>
      </div>
      <ul className={styles.list}>
        {entries.map((entry) => {
          const isCurrent = entry.translation === current;
          return (
            <li
              key={entry.translation}
              className={clsx(styles.item, isCurrent && styles.itemCurrent)}
              data-testid={`compare-${entry.translation}`}
            >
              <button
                type="button"
                className={styles.choose}
                aria-current={isCurrent ? "true" : undefined}
                aria-label={isCurrent
                  ? `${TRANSLATION_LABELS[entry.translation]} (versión actual)`
                  : `Leer en ${TRANSLATION_LABELS[entry.translation]}`}
                onClick={() => onSelectTranslation(entry.translation)}
              >
                <span className={styles.versionRow}>
                  <span className={styles.code}>{entry.translation}</span>
                  <span className={styles.label}>{TRANSLATION_LABELS[entry.translation]}</span>
                  {isCurrent ? <span className={styles.badge}>Actual</span> : null}
                </span>
                {entry.verses ? (
                  <span className={styles.passage}>
                    {verses.map(({ number }) => {
                      const match = entry.verses?.find((item) => item.number === number);
                      return (
                        <span key={number} className={styles.text} data-testid={`compare-${entry.translation}-${number}`}>
                          <span className={styles.number}>{number}</span>
                          {match ? match.text : <span className={styles.missing}>No incluido en esta versión.</span>}
                        </span>
                      );
                    })}
                  </span>
                ) : entry.error ? (
                  <span className={styles.error} role="alert">
                    {entry.error instanceof BollsTranslationUnavailableError
                      ? "Esta traducción no está disponible en este momento."
                      : plural ? "No se pudieron cargar estos versículos." : "No se pudo cargar este versículo."}
                  </span>
                ) : (
                  <span className={styles.loading}>Cargando…</span>
                )}
              </button>
              {entry.error && !entry.verses ? (
                <button type="button" className={styles.retry} onClick={() => void entry.refetch()}>
                  Reintentar
                </button>
              ) : null}
              <p className={styles.copyright}>{TRANSLATION_NOTICES[entry.translation]}</p>
            </li>
          );
        })}
      </ul>
    </dialog>
  );
}
