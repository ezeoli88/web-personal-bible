import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { useBibleRepository } from "../../core/hooks/DatabaseProvider";
import { bookFromSlug, bookSlug } from "../../core/lib/bookSlugs";
import { useBooks } from "../../core/hooks/useBibleQueries";
import { useAuth } from "../auth/AuthProvider";
import { AccountBox } from "../auth/AccountBox";
import { AccountMenu } from "../auth/AccountMenu";
import { BookItem } from "../components/BookItem";
import { ChapterPicker } from "../components/ChapterPicker";
import { GoToReference } from "../components/GoToReference";
import { TestamentFilter } from "../components/TestamentFilter";
import { ReadingSettings } from "../components/ReadingSettings";
import { TranslationSelector } from "../components/TranslationSelector";
import { BookFilterProvider, useBookFilter } from "./bookFilter";
import { crumbsFor, logicalParent } from "./paths";
import { InstallAppButton } from "../pwa/InstallAppButton";
import { pageMeta } from "../seo/pageMeta";
import { ChevronDownIcon, ChevronLeftIcon } from "../ui/icons";
import styles from "./AppShell.module.css";

/** The book and chapter of a reader path (`/romanos/12`), or null on any other page. */
function readerLocation(pathname: string) {
  const [bookParam, chapterParam, leaf] = pathname.split("/").filter(Boolean);
  if (!bookParam || !chapterParam || leaf) return null;
  const book = bookFromSlug(bookParam);
  const chapter = Number(chapterParam);
  if (!book || !Number.isInteger(chapter) || chapter < 1 || chapter > book.chapters) return null;
  return { slug: bookParam, book, chapter };
}

function ShellFrame({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const href = useRouterState({ select: (state) => state.location.href });
  const auth = useAuth();
  const navigate = useNavigate();
  const { translation } = useBibleRepository();
  const [pickerOpen, setPickerOpen] = useState(false);
  const reader = readerLocation(pathname);

  useEffect(() => {
    const meta = pageMeta(pathname, translation);
    document.title = meta.title;
    document.querySelector('meta[name="description"]')?.setAttribute("content", meta.description);
  }, [pathname, translation]);

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
          <ReadingSettings />
        </div>
        <GoToReference />
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
        <InstallAppButton />
        <AccountBox status={auth.status} email={auth.email} role={auth.role} returnTo={href} />
      </aside>
      <div className={styles.main}>
        <header className={styles.topbar}>
          {parent ? (
            <button type="button" className={styles.back} aria-label="Volver" onClick={() => go(parent)}>
              <ChevronLeftIcon size={24} />
            </button>
          ) : null}
          <h1 className={styles.topTitle}>
            {reader ? (
              <button
                type="button"
                className={styles.titleButton}
                aria-haspopup="dialog"
                aria-label={`Elegir capítulo (${reader.book.name} ${reader.chapter})`}
                onClick={() => setPickerOpen(true)}
              >
                <span className={styles.titleText}>{reader.book.name} {reader.chapter}</span>
                <ChevronDownIcon size={18} />
              </button>
            ) : title}
          </h1>
          <div className={styles.topActions}>
            {reader ? <TranslationSelector chip /> : null}
            <ReadingSettings />
            <AccountMenu status={auth.status} email={auth.email} role={auth.role} returnTo={href} />
          </div>
        </header>
        {reader ? (
          <ChapterPicker
            open={pickerOpen}
            onClose={() => setPickerOpen(false)}
            slug={reader.slug}
            bookName={reader.book.name}
            chapters={reader.book.chapters}
            current={reader.chapter}
          />
        ) : null}
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
