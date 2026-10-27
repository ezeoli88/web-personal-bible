import { useEffect, useRef, type KeyboardEvent, type PointerEvent } from "react";
import clsx from "clsx";
import type { Verse } from "../../core/types/bible";
import { BookmarkIcon } from "../annotations/AnnotateSheet";
import type { VerseAnnotation } from "../annotations/annotations";
import styles from "./VerseItem.module.css";

const LONG_PRESS_MS = 400;

interface Props {
  verse: Verse;
  /** Chapter number shown as a large initial before the first verse. */
  dropCap?: number;
  focused?: boolean;
  selected?: boolean;
  selectionActive?: boolean;
  onPress?: (verse: Verse) => void;
  onLongPress?: (verse: Verse) => void;
  onEscape?: () => void;
  onFootnotePress?: () => void;
  /** Highlight, bookmark and note the reader saved on this verse. */
  annotation?: VerseAnnotation;
  onNotePress?: (verse: Verse) => void;
}

function selectedText(): string {
  return window.getSelection?.()?.toString() ?? "";
}

export function VerseItem({
  verse,
  dropCap,
  focused = false,
  selected = false,
  selectionActive = false,
  onPress,
  onLongPress,
  onEscape,
  onFootnotePress,
  annotation,
  onNotePress,
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

  // A tap starts the selection (or toggles the verse once it is active),
  // unless the reader was selecting text or a long press already handled it.
  function onClick() {
    if (consumedLongPress.current) {
      consumedLongPress.current = false;
      return;
    }
    if (selectedText().length > 0) return;
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
  // Selection paints its own background; the highlight comes back when it ends.
  const highlight = selected ? undefined : annotation?.highlight;

  return (
    <div
      className={clsx(styles.container, selected && styles.selected, focused && !selected && styles.focused, dropCap && styles.withDropCap)}
      data-testid="verse-item"
      data-verse-number={verse.number}
      id={`verse-${verse.number}`}
      role="group"
      tabIndex={0}
      aria-label={`Versículo ${verse.number}${selected ? ", seleccionado" : ""}`}
      aria-pressed={selected}
      onPointerDown={onPointerDown}
      onPointerUp={clearTimer}
      onPointerLeave={clearTimer}
      onPointerCancel={clearTimer}
      onClick={onClick}
      onKeyDown={onKeyDown}
    >
      <p className={styles.text}>
        {dropCap ? <span className={styles.dropCap} aria-hidden="true">{dropCap}</span> : null}
        <sup className={styles.number}>
          {annotation?.bookmarked ? (
            <span className={styles.bookmark} data-testid="verse-bookmark" role="img" aria-label="Con marcador">
              <BookmarkIcon />
            </span>
          ) : null}
          {verse.number}
        </sup>
        <span
          className={clsx(highlight && styles.highlighted)}
          style={highlight ? { background: `var(--hl-${highlight})` } : undefined}
          data-highlight={highlight}
        >
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
        </span>
        {annotation?.note ? (
          <button
            type="button"
            className={styles.noteButton}
            data-testid="verse-note"
            aria-label={`Ver nota del versículo ${verse.number}`}
            title={annotation.note}
            onClick={(event) => {
              event.stopPropagation();
              onNotePress?.(verse);
            }}
          >
            ✎
          </button>
        ) : null}
      </p>
    </div>
  );
}
