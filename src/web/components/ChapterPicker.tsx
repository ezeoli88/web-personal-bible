import { useEffect, useId, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import clsx from "clsx";
import { CloseIcon } from "../ui/icons";
import { GoToReference } from "./GoToReference";
import styles from "./ChapterPicker.module.css";

interface Props {
  open: boolean;
  onClose: () => void;
  slug: string;
  bookName: string;
  chapters: number;
  current: number;
}

/** Opened from the reader's title: jump to a chapter of the same book or to any reference. */
export function ChapterPicker({ open, onClose, slug, bookName, chapters, current }: Props) {
  const navigate = useNavigate();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  function goToChapter(chapter: number) {
    onClose();
    void navigate({ to: "/$book/$chapter", params: { book: slug, chapter: String(chapter) }, search: {} });
  }

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby={titleId}
      data-testid="chapter-picker"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className={styles.sheet}>
        <div className={styles.handle} aria-hidden="true" />
        <div className={styles.header}>
          <h2 id={titleId} className={styles.title}>{bookName}</h2>
          <button
            type="button"
            className={styles.changeBook}
            onClick={() => {
              onClose();
              void navigate({ to: "/" });
            }}
          >
            Cambiar libro
          </button>
          <button type="button" className={styles.close} aria-label="Cerrar" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>
        <GoToReference onNavigate={onClose} />
        <p className={styles.label}>Capítulo</p>
        <div className={styles.grid}>
          {Array.from({ length: chapters }, (_, index) => index + 1).map((chapter) => (
            <button
              key={chapter}
              type="button"
              className={clsx(styles.chapter, chapter === current && styles.current)}
              aria-current={chapter === current ? "page" : undefined}
              onClick={() => goToChapter(chapter)}
            >
              {chapter}
            </button>
          ))}
        </div>
      </div>
    </dialog>
  );
}
