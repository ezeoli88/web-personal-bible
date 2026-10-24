import { useNavigate } from "@tanstack/react-router";
import { useBibleRepository } from "../../core/hooks/DatabaseProvider";
import { useVersesByChapter } from "../../core/hooks/useBibleQueries";
import { BollsTranslationUnavailableError } from "../../core/api/BollsBibleClient";
import styles from "./pages.module.css";

interface Props {
  chapterId: string;
  bookName: string;
  chapterNumber: number;
  slug: string;
}

export function VersesPage({ chapterId, bookName, chapterNumber, slug }: Props) {
  const navigate = useNavigate();
  const { translation } = useBibleRepository();
  const { data: verses = [], isPending, error } = useVersesByChapter(chapterId);

  function openReader(verseNumber?: number) {
    void navigate({
      to: "/$book/$chapter",
      params: { book: slug, chapter: String(chapterNumber) },
      search: { v: verseNumber },
      // El lector hace scroll al versículo; si el router resetea el scroll
      // después, lo deja arriba de todo (pasa cuando el capítulo ya está en caché).
      resetScroll: verseNumber === undefined,
    });
  }

  if (error) {
    return (
      <p className={styles.error}>
        {error instanceof BollsTranslationUnavailableError
          ? error.message
          : "Error cargando versículos. Verificá tu conexión a internet."}
      </p>
    );
  }
  if (isPending) return <p className={styles.status}>Cargando versículos...</p>;

  return (
    <section>
      <h2 className={styles.title}>{bookName} {chapterNumber} · {translation}</h2>
      <div className={styles.grid}>
        {verses.map((verse) => (
          <button key={verse.id} type="button" className={styles.verseNumber} onClick={() => openReader(verse.number)}>
            {verse.number}
          </button>
        ))}
      </div>
      <button type="button" className={styles.floating} onClick={() => openReader()}>
        Leer capítulo completo
      </button>
    </section>
  );
}
