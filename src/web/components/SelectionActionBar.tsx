import type { ReactNode } from "react";
import { CompareIcon, CopyIcon, ShareIcon, SparkleIcon } from "../ui/icons";
import styles from "./SelectionActionBar.module.css";

interface Props {
  count: number;
  onAskAI: () => void;
  onCompare?: () => void;
  onShare?: () => void;
  onCopy?: () => void;
}

function Action({ icon, label, title, disabled, onClick }: {
  icon: ReactNode;
  label: string;
  title: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" className={styles.action} title={title} disabled={disabled} onClick={onClick}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

/** Actions for the selected verses. Cancelling and the count live in SelectionHeader. */
export function SelectionActionBar({ count, onAskAI, onCompare, onShare, onCopy }: Props) {
  const none = count === 0;
  return (
    <div className={styles.container} data-testid="selection-action-bar">
      {onCompare ? (
        <Action
          icon={<CompareIcon />}
          label="Comparar"
          title={count === 1 ? "Ver este versículo en otras versiones" : "Ver estos versículos en otras versiones"}
          disabled={none}
          onClick={onCompare}
        />
      ) : null}
      {onShare ? (
        <Action icon={<ShareIcon />} label="Compartir" title="Compartir el texto y un enlace a estos versículos" disabled={none} onClick={onShare} />
      ) : null}
      {onCopy ? (
        <Action icon={<CopyIcon />} label="Copiar" title="Copiar el texto, la referencia y un enlace" disabled={none} onClick={onCopy} />
      ) : null}
      <button type="button" className={styles.aiButton} disabled={none} onClick={onAskAI}>
        <SparkleIcon size={18} />
        Preguntar a la IA
      </button>
    </div>
  );
}
