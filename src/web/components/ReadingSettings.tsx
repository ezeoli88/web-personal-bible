import { useEffect, useId, useRef, useState } from "react";
import clsx from "clsx";
import { FONT_SCALES, useTheme, type ThemePreference } from "../../core/providers/ThemeProvider";
import styles from "./ReadingSettings.module.css";

const THEME_OPTIONS: Array<{ value: ThemePreference; label: string }> = [
  { value: "light", label: "Claro" },
  { value: "dark", label: "Oscuro" },
  { value: "system", label: "Sistema" },
];

export function ReadingSettings() {
  const { preference, setPreference, fontScale, setFontScale } = useTheme();
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const scaleIndex = FONT_SCALES.indexOf(fontScale);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <>
      <button
        type="button"
        className={styles.trigger}
        data-testid="reading-settings"
        aria-label="Preferencias de lectura"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <span aria-hidden="true">Aa</span>
      </button>
      <dialog
        ref={dialogRef}
        className={styles.dialog}
        aria-labelledby={titleId}
        data-testid="reading-settings-dialog"
        onClose={() => setOpen(false)}
      >
        <div className={styles.header}>
          <h2 id={titleId} className={styles.title}>Preferencias de lectura</h2>
          <button type="button" className={styles.close} onClick={() => setOpen(false)} aria-label="Cerrar preferencias">✕</button>
        </div>
        <fieldset className={styles.group}>
          <legend className={styles.legend}>Tema</legend>
          <div className={styles.segmented}>
            {THEME_OPTIONS.map((option) => (
              <label key={option.value} className={clsx(styles.segment, preference === option.value && styles.segmentActive)}>
                <input
                  type="radio"
                  // The shell renders this component twice (sidebar and top bar): each needs its own radio group.
                  name={`theme-preference-${titleId}`}
                  value={option.value}
                  checked={preference === option.value}
                  onChange={() => setPreference(option.value)}
                />
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className={styles.group}>
          <legend className={styles.legend}>Tamaño de letra</legend>
          <div className={styles.sizeRow}>
            <button
              type="button"
              className={styles.sizeButton}
              aria-label="Achicar la letra"
              disabled={scaleIndex <= 0}
              onClick={() => setFontScale(FONT_SCALES[scaleIndex - 1])}
            >
              A−
            </button>
            <output className={styles.sizeValue} aria-live="polite" data-testid="font-scale">
              {Math.round(fontScale * 100)}%
            </output>
            <button
              type="button"
              className={styles.sizeButton}
              aria-label="Agrandar la letra"
              disabled={scaleIndex >= FONT_SCALES.length - 1}
              onClick={() => setFontScale(FONT_SCALES[scaleIndex + 1])}
            >
              A+
            </button>
          </div>
          <p className={styles.preview}>Así se ve el texto de los versículos.</p>
        </fieldset>
      </dialog>
    </>
  );
}
