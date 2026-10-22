import type { Testament } from "../../core/types/bible";
import styles from "./TestamentFilter.module.css";
import clsx from "clsx";

export type FilterValue = Testament | "ALL";

interface Props {
  selected: FilterValue;
  onSelect: (value: FilterValue) => void;
}

const OPTIONS: { label: string; value: FilterValue }[] = [
  { label: "Todos", value: "ALL" },
  { label: "AT", value: "AT" },
  { label: "NT", value: "NT" },
];

export function TestamentFilter({ selected, onSelect }: Props) {
  return (
    <div className={styles.container} role="tablist" aria-label="Testamento">
      {OPTIONS.map((option) => {
        const isActive = selected === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={clsx(styles.tab, isActive && styles.activeTab)}
            onClick={() => onSelect(option.value)}
          >
            <span className={clsx(styles.text, isActive && styles.activeText)}>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
