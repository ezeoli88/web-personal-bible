import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import {
  HIGHLIGHT_COLORS,
  HIGHLIGHT_LABELS,
  annotationKey,
  updateAnnotations,
  useAnnotations,
  type AnnotationPatch,
  type AnnotationTarget,
} from "./annotations";
import { LoginPrompt } from "../auth/LoginPrompt";
import type { PanelAccess } from "../hooks/useBibleAiPanel";
import { useUserDataState } from "../userData/userData";
import styles from "./AnnotateSheet.module.css";

interface Props {
  /** Verses to mark; empty = closed. */
  targets: AnnotationTarget[];
  reference: string;
  /** `note` opens with the note field focused. */
  focus?: "note";
  /** Marks are saved in the reader's account: signed out, the sheet asks to sign in. */
  access: PanelAccess;
  onLogin: () => void;
  /** Called after a change is saved, so the reader can clear its selection. */
  onDone: () => void;
  onClose: () => void;
}

export function AnnotateSheet({ targets, reference, focus, access, onLogin, onDone, onClose }: Props) {
  const userData = useUserDataState();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const annotations = useAnnotations();
  const open = targets.length > 0;
  const current = targets.map((target) => annotations[annotationKey(target)]);
  const single = targets.length === 1;
  const savedNote = single ? current[0]?.note ?? "" : "";
  const [note, setNote] = useState(savedNote);
  const allBookmarked = open && current.every((annotation) => annotation?.bookmarked);
  const activeColor = open && current.every((annotation) => annotation?.highlight === current[0]?.highlight)
    ? current[0]?.highlight
    : undefined;
  const anyHighlight = current.some((annotation) => annotation?.highlight);

  useEffect(() => {
    if (open) setNote(savedNote);
    // Only when the sheet opens: typing must not be reset by the saved value.
  }, [open, targets]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      if (focus === "note") noteRef.current?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [focus, open]);

  function apply(patch: AnnotationPatch) {
    updateAnnotations(targets, patch);
    onDone();
  }

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      data-testid="annotate-sheet"
      aria-label={`Marcar ${reference}`}
      onClose={onClose}
    >
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Marcar</h2>
          <p className={styles.reference}>{reference}</p>
        </div>
        <button type="button" className={styles.close} onClick={onClose} aria-label="Cerrar">✕</button>
      </div>

      {userData.status !== "ready" ? (
        !open ? null : access === "anonymous" ? (
          <LoginPrompt onLogin={onLogin} message="Iniciá sesión para guardar subrayados, marcadores y notas en tu cuenta." />
        ) : (
          <p className={styles.hint} role="status">
            {access === "denied"
              ? "Tu correo no tiene acceso para guardar marcas. Pedíselo al administrador."
              : userData.status === "error"
                ? "No se pudieron cargar tus marcas. Probá de nuevo en un momento."
                : "Cargando tus marcas…"}
          </p>
        )
      ) : (
      <>
      <fieldset className={styles.group}>
        <legend className={styles.legend}>Subrayar</legend>
        <div className={styles.colors}>
          {HIGHLIGHT_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              className={clsx(styles.swatch, activeColor === color && styles.swatchActive)}
              style={{ background: `var(--hl-${color})` }}
              aria-label={`Subrayar en ${HIGHLIGHT_LABELS[color].toLowerCase()}`}
              aria-pressed={activeColor === color}
              data-testid={`highlight-${color}`}
              onClick={() => apply({ highlight: color })}
            />
          ))}
          {anyHighlight ? (
            <button type="button" className={styles.clear} onClick={() => apply({ highlight: null })}>
              Quitar color
            </button>
          ) : null}
        </div>
      </fieldset>

      <button
        type="button"
        className={styles.bookmark}
        data-testid="toggle-bookmark"
        aria-pressed={allBookmarked}
        onClick={() => apply({ bookmarked: !allBookmarked })}
      >
        <BookmarkIcon filled={allBookmarked} />
        {allBookmarked ? "Quitar marcador" : "Agregar marcador"}
      </button>

      <div className={styles.group}>
        <label className={styles.legend} htmlFor="annotate-note">Nota</label>
        {single ? (
          <>
            <textarea
              ref={noteRef}
              id="annotate-note"
              className={styles.note}
              rows={4}
              maxLength={4000}
              placeholder="Lo que te llamó la atención, una pregunta, una oración…"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
            <div className={styles.noteActions}>
              {savedNote ? (
                <button type="button" className={styles.secondary} onClick={() => apply({ note: null })}>
                  Borrar nota
                </button>
              ) : null}
              <button
                type="button"
                className={styles.primary}
                disabled={note.trim() === savedNote.trim()}
                onClick={() => apply({ note })}
              >
                Guardar nota
              </button>
            </div>
          </>
        ) : (
          <p className={styles.hint}>Para escribir una nota, elegí un solo versículo.</p>
        )}
      </div>
      </>
      )}
    </dialog>
  );
}

export function BookmarkIcon({ filled = true, className }: { filled?: boolean; className?: string }) {
  return (
    <svg className={className} width="14" height="18" viewBox="0 0 14 18" aria-hidden="true">
      <path
        d="M1 1h12v16l-6-4.5L1 17z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
