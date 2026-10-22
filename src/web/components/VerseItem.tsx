import { useEffect, useRef, type KeyboardEvent, type MouseEvent, type PointerEvent } from "react";
import clsx from "clsx";
import type { Verse } from "../../core/types/bible";
import styles from "./VerseItem.module.css";

const LONG_PRESS_MS = 400;

interface Props {
  verse: Verse;
  focused?: boolean;
  selected?: boolean;
  selectionActive?: boolean;
  onPress?: (verse: Verse) => void;
  onLongPress?: (verse: Verse) => void;
  onEscape?: () => void;
  onFootnotePress?: () => void;
}

function selectedText(): string {
  return window.getSelection?.()?.toString() ?? "";
}

export function VerseItem({
  verse,
  focused = false,
  selected = false,
  selectionActive = false,
  onPress,
  onLongPress,
  onEscape,
  onFootnotePress,
}: Props) {
  const timer = useRef<number | null>(null);
  const consumedLongPress = useRef(false);

  useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
  }, []);

  function clearTimer() {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }

  function beginLongPress() {
    clearTimer();
    timer.current = window.setTimeout(() => {
      timer.current = null;
      consumedLongPress.current = true;
      onLongPress?.(verse);
    }, LONG_PRESS_MS);
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    beginLongPress();
  }

  function onClick() {
    if (consumedLongPress.current) {
      consumedLongPress.current = false;
      return;
    }
    if (!selectionActive || !onPress) return;
    if (selectedText().length > 0) return;
    onPress(verse);
  }

  function onMarkerClick(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    if (selectionActive) onPress?.(verse);
    else onLongPress?.(verse);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      onEscape?.();
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (selectionActive) onPress?.(verse);
      else onLongPress?.(verse);
    }
  }

  const parts = verse.text.split(/(\[\d+\])/g);

  return (
    <div
      className={clsx(styles.container, selected && styles.selected, focused && !selected && styles.focused)}
      data-testid="verse-item"
      data-verse-number={verse.number}
      id={`verse-${verse.number}`}
      role="group"
      tabIndex={0}
      aria-pressed={selected}
      onPointerDown={onPointerDown}
      onPointerUp={clearTimer}
      onPointerLeave={clearTimer}
      onPointerCancel={clearTimer}
      onClick={onClick}
      onKeyDown={onKeyDown}
    >
      <button
        type="button"
        className={clsx(styles.marker, selected && styles.markerSelected)}
        data-testid="verse-marker"
        aria-label={selected ? `Quitar versículo ${verse.number}` : `Seleccionar versículo ${verse.number}`}
        onClick={onMarkerClick}
      >
        {selected ? "✓" : ""}
      </button>
      <p className={clsx(styles.text, selected && styles.textSelected)}>
        <span className={styles.number}>{verse.number} </span>
        {parts.map((part, index) => {
          if (/^\[\d+\]$/.test(part)) {
            return (
              <button
                key={index}
                type="button"
                className={styles.footnote}
                data-testid="verse-footnote"
                onClick={(event) => {
                  event.stopPropagation();
                  onFootnotePress?.();
                }}
              >
                {part}
              </button>
            );
          }
          return <span key={index}>{part}</span>;
        })}
      </p>
    </div>
  );
}
