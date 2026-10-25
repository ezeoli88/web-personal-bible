import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import type { BiblePassage } from "../../core/types/ai";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";
import styles from "./PassageReading.module.css";

interface Props {
  passage: BiblePassage;
  status: string;
}

const STEP_MS = 170;
const SLOW_MS = 8000;
export const SLOW_NOTICE = "Está tardando más de lo normal. Seguimos esperando la respuesta…";

function verseNumber(id: string): string | null {
  return id.match(/-(\d+)$/)?.[1] ?? null;
}

export function PassageReading({ passage, status }: Props) {
  const reducedMotion = usePrefersReducedMotion();
  const [slow, setSlow] = useState(false);
  const [current, setCurrent] = useState(-1);

  const verses = useMemo(() => {
    let wordIndex = 0;
    return passage.verses.map((verse) => {
      const text = verse.text.replace(/\[\d+\]/g, "").replace(/\s+/g, " ").trim();
      const words = text ? text.split(" ").map((word) => ({ word, index: wordIndex++ })) : [];
      return { id: verse.id, number: verseNumber(verse.id), words };
    });
  }, [passage]);
  const totalWords = verses.reduce((total, verse) => total + verse.words.length, 0);

  useEffect(() => {
    const id = setTimeout(() => setSlow(true), SLOW_MS);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    if (reducedMotion || totalWords === 0) return;
    const id = setInterval(() => {
      setCurrent((index) => (index + 1 >= totalWords ? -1 : index + 1));
    }, STEP_MS);
    return () => clearInterval(id);
  }, [reducedMotion, totalWords]);

  return (
    <div className={clsx(styles.reading, reducedMotion && styles.still)} data-testid="passage-reading">
      <div className={styles.status}>
        <span className={styles.dots} aria-hidden="true"><i /><i /><i /></span>
        <span role="status">{slow ? SLOW_NOTICE : status}</span>
      </div>
      <p className={styles.reference}>{passage.reference} · {passage.translation}</p>
      {verses.map((verse) => (
        <p key={verse.id} className={styles.verse}>
          {verse.number ? <sup className={styles.number}>{verse.number}</sup> : null}
          {verse.words.map(({ word, index }, position) => (
            <span key={index}>
              {position > 0 ? " " : null}
              <span
                className={clsx(
                  styles.word,
                  index < current && styles.read,
                  index === current && styles.lit,
                )}
              >
                {word}
              </span>
            </span>
          ))}
        </p>
      ))}
    </div>
  );
}
