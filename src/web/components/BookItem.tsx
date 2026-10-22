import type { Book } from "../../core/types/bible";
import styles from "./BookItem.module.css";

interface Props {
  book: Book;
  onPress: () => void;
}

export function BookItem({ book, onPress }: Props) {
  return (
    <button type="button" className={styles.container} onClick={onPress}>
      <span className={styles.content}>
        <span className={styles.name}>{book.name}</span>
        <span className={styles.testament}>
          {book.testament === "AT" ? "Antiguo Testamento" : "Nuevo Testamento"}
        </span>
      </span>
      <span className={styles.caret} aria-hidden="true" />
    </button>
  );
}
