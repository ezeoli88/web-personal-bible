import type { Chapter } from "../../core/types/bible";
import styles from "./ChapterItem.module.css";

interface Props {
  chapter: Chapter;
  onPress: () => void;
}

export function ChapterItem({ chapter, onPress }: Props) {
  return (
    <button type="button" className={styles.container} onClick={onPress}>
      <span className={styles.number}>{chapter.number}</span>
    </button>
  );
}
