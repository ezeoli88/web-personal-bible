import { MAX_AI_VERSES } from "../../core/lib/passageBuilder";
import styles from "./SelectionActionBar.module.css";

interface Props {
  count: number;
  maxCount?: number;
  onAskAI: () => void;
  onCompare?: () => void;
  onShare?: () => void;
  onCancel: () => void;
}

export function SelectionActionBar({ count, maxCount = MAX_AI_VERSES, onAskAI, onCompare, onShare, onCancel }: Props) {
  return (
    <div className={styles.container} data-testid="selection-action-bar">
      <p className={styles.countText}>
        {count}/{maxCount} versículo{count === 1 ? "" : "s"}
      </p>
      <div className={styles.actions}>
        <button type="button" className={styles.cancelButton} onClick={onCancel}>Cancelar</button>
        {onCompare ? (
          <button
            type="button"
            className={styles.compareButton}
            disabled={count === 0}
            title={count === 1 ? "Ver este versículo en otras versiones" : "Ver estos versículos en otras versiones"}
            onClick={onCompare}
          >
            ⇄ Comparar
          </button>
        ) : null}
        {onShare ? (
          <button
            type="button"
            className={styles.shareButton}
            disabled={count === 0}
            title="Compartir el texto y un enlace a estos versículos"
            onClick={onShare}
          >
            Compartir
          </button>
        ) : null}
        <button type="button" className={styles.aiButton} onClick={onAskAI}>Preguntarle a la IA</button>
      </div>
    </div>
  );
}
