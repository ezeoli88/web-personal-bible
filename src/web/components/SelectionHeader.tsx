import { CloseIcon } from "../ui/icons";
import styles from "./SelectionHeader.module.css";

interface Props {
  reference: string;
  count: number;
  maxCount: number;
  translation: string;
  onCancel: () => void;
}

/** Replaces the top bar while verses are selected: what is selected and how to leave. */
export function SelectionHeader({ reference, count, maxCount, translation, onCancel }: Props) {
  return (
    <div className={styles.header} data-testid="selection-header">
      <button type="button" className={styles.close} aria-label="Cancelar selección" onClick={onCancel}>
        <CloseIcon />
      </button>
      <div className={styles.text}>
        <span className={styles.reference}>{reference}</span>
        <span className={styles.count} aria-live="polite">
          {count} de {maxCount} versículo{maxCount === 1 ? "" : "s"} · {translation}
        </span>
      </div>
    </div>
  );
}
