import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { bookSlug } from "../../core/lib/bookSlugs";
import { useBooks } from "../../core/hooks/useBibleQueries";
import { notify } from "../../platform/notify";
import { BookItem } from "../components/BookItem";
import { TestamentFilter } from "../components/TestamentFilter";
import { TranslationSelector } from "../components/TranslationSelector";
import { useBookFilter } from "../layout/bookFilter";
import styles from "./pages.module.css";

interface Props {
  loginDenied?: boolean;
}

export function BooksPage({ loginDenied = false }: Props) {
  const navigate = useNavigate();
  const { filter, setFilter } = useBookFilter();
  const { data: books = [], isLoading } = useBooks();
  const visible = books.filter((book) => filter === "ALL" || book.testament === filter);

  useEffect(() => {
    if (!loginDenied) return;
    notify("Ese correo no tiene acceso");
    void navigate({ to: "/", search: {}, replace: true });
  }, [loginDenied, navigate]);

  return (
    <section>
      <div className={styles.mobileHeader}>
        <h2 className={styles.title}>Biblia</h2>
        <TranslationSelector />
        <TestamentFilter selected={filter} onSelect={setFilter} />
      </div>
      <p className={styles.desktopHint}>Elegí un libro de la lista.</p>
      {isLoading ? <p className={styles.status}>Cargando libros...</p> : null}
      <div className={styles.mobileList}>
        {visible.map((book) => (
          <BookItem
            key={book.id}
            book={book}
            onPress={() => {
              const slug = bookSlug(book.orderIndex);
              if (!slug) return;
              void navigate({ to: "/$book", params: { book: slug } });
            }}
          />
        ))}
      </div>
    </section>
  );
}
