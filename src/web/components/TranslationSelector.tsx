import { useCallback, useState } from "react";
import clsx from "clsx";
import { useBibleRepository } from "../../core/hooks/DatabaseProvider";
import { TRANSLATION_LABELS, type BibleTranslation } from "../../core/types/translation";
import styles from "./TranslationSelector.module.css";

interface Props {
  compact?: boolean;
}

export function TranslationSelector({ compact = false }: Props) {
  const { availableTranslations, setTranslation, translation } = useBibleRepository();
  const [open, setOpen] = useState(false);
  const disabled = availableTranslations.length <= 1;
  const close = useCallback(() => setOpen(false), []);
  const handleSelect = useCallback((item: BibleTranslation) => {
    setOpen(false);
    void setTranslation(item);
  }, [setTranslation]);

  return (
    <div className={clsx(styles.container, compact && styles.containerCompact)}>
      {!compact ? <span className={styles.label}>Traducción</span> : null}
      <button
        type="button"
        className={clsx(styles.field, compact && styles.fieldCompact)}
        data-testid="translation-select"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Traducción: ${TRANSLATION_LABELS[translation]}`}
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <span className={styles.fieldCode}>{translation}</span>
        <span className={styles.fieldLabel}>{TRANSLATION_LABELS[translation]}</span>
      </button>
      {open ? (
        <div className={styles.overlay} role="presentation">
          <button
            type="button"
            className={styles.backdrop}
            data-testid="translation-select-backdrop"
            aria-label="Cerrar lista de traducciones"
            onClick={close}
          />
          <div className={styles.sheet} role="listbox" aria-label="Elegí una traducción">
            <div className={styles.sheetHeader}>
              <span className={styles.sheetTitle}>Elegí una traducción</span>
              <button type="button" className={styles.closeButton} onClick={close}>✕</button>
            </div>
            {availableTranslations.map((item) => {
              const selected = item === translation;
              return (
                <button
                  key={item}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  data-testid={`translation-option-${item}`}
                  className={clsx(styles.option, selected && styles.optionSelected)}
                  onClick={() => handleSelect(item)}
                >
                  <span className={clsx(styles.optionCode, selected && styles.optionCodeSelected)}>{item}</span>
                  <span className={styles.optionLabel}>{TRANSLATION_LABELS[item]}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
