import { MAX_AI_VERSES } from "../../core/lib/passageBuilder";
import styles from "./SelectionActionBar.module.css";

interface Props {
  count: number;
  maxCount?: number;
  onAskAI: () => void;
  onCompare?: () => void;
  onCancel: () => void;
}

export function SelectionActionBar({ count, maxCount = MAX_AI_VERSES, onAskAI, onCompare, onCancel }: Props) {
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
            disabled={count !== 1}
            title={count === 1 ? "Ver este versículo en otras versiones" : "Seleccioná un solo versículo para comparar"}
            onClick={onCompare}
          >
            ⇄ Comparar
          </button>
        ) : null}
        <button type="button" className={styles.aiButton} onClick={onAskAI}>Preguntarle a la IA</button>
      </div>
    </div>
  );
}
