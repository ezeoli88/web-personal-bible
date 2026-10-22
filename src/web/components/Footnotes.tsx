import { useEffect, useRef } from "react";
import styles from "./Footnotes.module.css";

export interface FootnoteEntry {
  verseNumber: number;
  text: string;
}

interface Props {
  open: boolean;
  footnotes: FootnoteEntry[];
  onClose: () => void;
}

export function Footnotes({ open, footnotes, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);

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
      data-testid="footnotes"
      aria-label="Notas al pie"
      onClose={onClose}
    >
      <div className={styles.header}>
        <h2 className={styles.title}>Notas al pie</h2>
        <button type="button" className={styles.close} onClick={onClose} aria-label="Cerrar notas">✕</button>
      </div>
      <div className={styles.content}>
        {footnotes.map((footnote) => (
          <div key={`${footnote.verseNumber}-${footnote.text}`} className={styles.item}>
            <span className={styles.verseLabel}>v. {footnote.verseNumber}</span>
            <p className={styles.text}>{footnote.text}</p>
          </div>
        ))}
      </div>
    </dialog>
  );
}
