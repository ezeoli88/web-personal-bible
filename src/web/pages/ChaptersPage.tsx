import { useNavigate } from "@tanstack/react-router";
import { useBibleRepository } from "../../core/hooks/DatabaseProvider";
import { useChaptersByBook } from "../../core/hooks/useBibleQueries";
import { ChapterItem } from "../components/ChapterItem";
import styles from "./pages.module.css";

interface Props {
  bookId: string;
  bookName: string;
  slug: string;
}

export function ChaptersPage({ bookId, bookName, slug }: Props) {
  const navigate = useNavigate();
  const { translation } = useBibleRepository();
  const { data: chapters = [], isPending, error } = useChaptersByBook(bookId);

  if (error) {
    return <p className={styles.error}>Error cargando capítulos. Verificá tu conexión a internet.</p>;
  }
  if (isPending) return <p className={styles.status}>Cargando capítulos...</p>;

  return (
    <section>
      <h2 className={styles.title}>{bookName} · {translation}</h2>
      <div className={styles.grid}>
        {chapters.map((chapter) => (
          <ChapterItem
            key={chapter.id}
            chapter={chapter}
            onPress={() => void navigate({
              to: "/$book/$chapter/versiculos",
              params: { book: slug, chapter: String(chapter.number) },
            })}
          />
        ))}
      </div>
    </section>
  );
}
