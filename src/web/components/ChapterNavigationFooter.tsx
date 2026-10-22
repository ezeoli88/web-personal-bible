import type { ChapterNavigation } from "../../core/types/bible";
import styles from "./ChapterNavigationFooter.module.css";
import clsx from "clsx";

interface Props {
  navigation: ChapterNavigation;
  onNavigate: (chapterId: string, bookId: string, bookName: string, chapterNumber: number) => void;
}

export function ChapterNavigationFooter({ navigation, onNavigate }: Props) {
  const { previous, next } = navigation;
  if (!previous && !next) return null;
  return (
    <div className={styles.container}>
      <div className={styles.divider} />
      <div className={styles.buttonsContainer}>
        <button
          type="button"
          className={clsx(styles.button, styles.buttonPrev, !previous && styles.buttonDisabled)}
          disabled={!previous}
          onClick={() => previous && onNavigate(previous.chapterId, previous.bookId, previous.bookName, previous.chapterNumber)}
        >
          <span className={styles.buttonIcon} aria-hidden="true">←</span>
          <span className={styles.buttonTextContainer}>
            <span className={styles.buttonLabel}>Anterior</span>
            {previous ? <span className={styles.buttonChapter}>{previous.bookName} {previous.chapterNumber}</span> : null}
          </span>
        </button>
        <button
          type="button"
          className={clsx(styles.button, styles.buttonNext, !next && styles.buttonDisabled)}
          disabled={!next}
          onClick={() => next && onNavigate(next.chapterId, next.bookId, next.bookName, next.chapterNumber)}
        >
          <span className={clsx(styles.buttonTextContainer, styles.textRight)}>
            <span className={styles.buttonLabel}>Siguiente</span>
            {next ? <span className={styles.buttonChapter}>{next.bookName} {next.chapterNumber}</span> : null}
          </span>
          <span className={styles.buttonIcon} aria-hidden="true">→</span>
        </button>
      </div>
    </div>
  );
}
