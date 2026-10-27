import clsx from "clsx";
import type { ChapterNavigation, ChapterNavigationInfo } from "../../core/types/bible";
import { ChevronLeftIcon, ChevronRightIcon } from "../ui/icons";
import styles from "./ChapterArrows.module.css";

interface Props {
  navigation: ChapterNavigation;
  onNavigate: (info: ChapterNavigationInfo) => void;
}

/** Floating previous/next chapter buttons for phones; desktop keeps the footer and the arrow keys. */
export function ChapterArrows({ navigation, onNavigate }: Props) {
  const { previous, next } = navigation;
  if (!previous && !next) return null;
  return (
    <nav className={styles.arrows} aria-label="Cambiar de capítulo">
      {previous ? (
        <button
          type="button"
          className={clsx(styles.arrow, styles.previous)}
          aria-label={`Capítulo anterior: ${previous.bookName} ${previous.chapterNumber}`}
          onClick={() => onNavigate(previous)}
        >
          <ChevronLeftIcon />
        </button>
      ) : null}
      {next ? (
        <button
          type="button"
          className={clsx(styles.arrow, styles.next)}
          aria-label={`Capítulo siguiente: ${next.bookName} ${next.chapterNumber}`}
          onClick={() => onNavigate(next)}
        >
          <ChevronRightIcon />
        </button>
      ) : null}
    </nav>
  );
}
