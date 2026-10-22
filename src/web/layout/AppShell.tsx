import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { bookSlug } from "../../core/lib/bookSlugs";
import { useBooks } from "../../core/hooks/useBibleQueries";
import { useAuth } from "../auth/AuthProvider";
import { AccountBox } from "../auth/AccountBox";
import { BookItem } from "../components/BookItem";
import { TestamentFilter } from "../components/TestamentFilter";
import { ThemeToggle } from "../components/ThemeToggle";
import { TranslationSelector } from "../components/TranslationSelector";
import { BookFilterProvider, useBookFilter } from "./bookFilter";
import { crumbsFor, logicalParent } from "./paths";
import styles from "./AppShell.module.css";

function ShellFrame({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const href = useRouterState({ select: (state) => state.location.href });
  const auth = useAuth();
  const navigate = useNavigate();
  const go = (path: string) => {
    if (path === "/" || path === "") {
      void navigate({ to: "/" });
      return;
    }
    if (path === "/admin") {
      void navigate({ to: "/admin" });
      return;
    }
    const [book, chapter, leaf] = path.split("/").filter(Boolean);
    if (!chapter) {
      void navigate({ to: "/$book", params: { book } });
      return;
    }
    if (leaf === "versiculos") {
      void navigate({ to: "/$book/$chapter/versiculos", params: { book, chapter } });
      return;
    }
    void navigate({
      to: "/$book/$chapter",
      params: { book, chapter },
      search: { v: undefined },
    });
  };
  const { filter, setFilter } = useBookFilter();
  const { data: books = [] } = useBooks();
  const parent = logicalParent(pathname);
  const bookName = books.find((book) => bookSlug(book.orderIndex) === pathname.split("/")[1])?.name;
  const crumbs = crumbsFor(pathname, bookName);
  const title = crumbs[crumbs.length - 1]?.label ?? "Biblia";
  const visibleBooks = books.filter((book) => filter === "ALL" || book.testament === filter);

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brandRow}>
          <Link className={styles.brand} to="/">Biblia</Link>
          <ThemeToggle />
        </div>
        <TranslationSelector />
        <TestamentFilter selected={filter} onSelect={setFilter} />
        <nav className={styles.bookList} aria-label="Libros">
          {visibleBooks.map((book) => (
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
        </nav>
        <AccountBox status={auth.status} email={auth.email} role={auth.role} returnTo={href} />
      </aside>
      <div className={styles.main}>
        <header className={styles.topbar}>
          {parent ? (
            <button type="button" className={styles.back} onClick={() => go(parent)}>
              ←
            </button>
          ) : <span />}
          <h1 className={styles.topTitle}>{title}</h1>
          <AccountBox status={auth.status} email={auth.email} role={auth.role} returnTo={href} />
        </header>
        <nav className={styles.crumbs} aria-label="Migas de pan">
          {crumbs.map((crumb, index) => (
            <span key={crumb.href} className={styles.crumb}>
              {index > 0 ? <span aria-hidden="true"> / </span> : null}
              {index === crumbs.length - 1 ? crumb.label : (
                <a href={crumb.href} onClick={(event) => { event.preventDefault(); go(crumb.href); }}>
                  {crumb.label}
                </a>
              )}
            </span>
          ))}
        </nav>
        <div className={styles.reading}>{children}</div>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <BookFilterProvider>
      <ShellFrame>{children}</ShellFrame>
    </BookFilterProvider>
  );
}
