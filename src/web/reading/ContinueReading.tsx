import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useBibleRepository } from "../../core/hooks/DatabaseProvider";
import { readLastReading } from "./lastReading";
import styles from "./ContinueReading.module.css";

export function ContinueReading() {
  const [last] = useState(readLastReading);
  const { translation } = useBibleRepository();
  if (!last) return null;
  return (
    <Link
      className={styles.card}
      data-testid="continue-reading"
      to="/$book/$chapter"
      params={{ book: last.slug, chapter: String(last.chapter) }}
      search={{ v: last.verse, t: last.translation === translation ? undefined : last.translation }}
    >
      <span className={styles.label}>Continuar leyendo</span>
      <span className={styles.reference}>
        {last.bookName} {last.chapter}:{last.verse}
        <span className={styles.translation}>{last.translation}</span>
      </span>
      <span className={styles.arrow} aria-hidden="true">→</span>
    </Link>
  );
}
