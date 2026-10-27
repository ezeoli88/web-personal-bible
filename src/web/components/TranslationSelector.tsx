import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { useBibleRepository } from "../../core/hooks/DatabaseProvider";
import { TRANSLATION_LABELS, type BibleTranslation } from "../../core/types/translation";
import styles from "./TranslationSelector.module.css";

interface Props {
  compact?: boolean;
  /** Code-only pill for the phone top bar. */
  chip?: boolean;
}

const FOCUSABLE = "button:not([disabled]):not([tabindex='-1'])";

export function TranslationSelector({ compact = false, chip = false }: Props) {
  const { availableTranslations, setTranslation, translation } = useBibleRepository();
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const disabled = availableTranslations.length <= 1;
  const close = useCallback(() => setOpen(false), []);
  const handleSelect = useCallback((item: BibleTranslation) => {
    setOpen(false);
    void setTranslation(item);
  }, [setTranslation]);

  useEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    sheetRef.current?.querySelector<HTMLElement>("[aria-selected='true']")?.focus();
    return () => {
      document.body.style.overflow = overflow;
      trigger?.focus();
    };
  }, [open]);

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      close();
      return;
    }
    if (event.key !== "Tab" || !sheetRef.current) return;
    const focusable = Array.from(sheetRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }, [close]);

  return (
    <div className={clsx(styles.container, compact && styles.containerCompact, chip && styles.containerChip)}>
      {!compact && !chip ? <span className={styles.label}>Traducción</span> : null}
      <button
        ref={triggerRef}
        type="button"
        className={clsx(styles.field, compact && styles.fieldCompact, chip && styles.fieldChip)}
        data-testid="translation-select"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Traducción: ${TRANSLATION_LABELS[translation]}`}
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <span className={styles.fieldCode}>{translation}</span>
        {chip ? null : (
          <>
            <span className={styles.fieldLabel}>{TRANSLATION_LABELS[translation]}</span>
            <svg className={styles.chevron} viewBox="0 0 24 24" aria-hidden="true">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </>
        )}
      </button>
      {open ? createPortal(
        <div className={styles.overlay} role="presentation" onKeyDown={handleKeyDown}>
          <button
            type="button"
            tabIndex={-1}
            className={styles.backdrop}
            data-testid="translation-select-backdrop"
            aria-label="Cerrar lista de traducciones"
            onClick={close}
          />
          <div
            ref={sheetRef}
            className={styles.sheet}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            data-testid="translation-select-sheet"
          >
            <div className={styles.handle} aria-hidden="true" />
            <div className={styles.sheetHeader}>
              <h2 id={titleId} className={styles.sheetTitle}>Elegí una traducción</h2>
              <button
                type="button"
                className={styles.closeButton}
                aria-label="Cerrar"
                onClick={close}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>
            <div className={styles.list} role="listbox" aria-labelledby={titleId}>
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
                    <span className={styles.optionText}>
                      <span className={clsx(styles.optionCode, selected && styles.optionCodeSelected)}>{item}</span>
                      <span className={styles.optionLabel}>{TRANSLATION_LABELS[item]}</span>
                    </span>
                    <span className={clsx(styles.check, selected && styles.checkSelected)} aria-hidden="true">
                      {selected ? (
                        <svg viewBox="0 0 24 24">
                          <path d="m5 12.5 4.5 4.5L19 7.5" />
                        </svg>
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>,
        document.body,
      ) : null}
    </div>
  );
}
