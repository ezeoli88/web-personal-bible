import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import clsx from "clsx";
import { BollsTranslationUnavailableError } from "../../core/api/BollsBibleClient";
import { useBibleRepository } from "../../core/hooks/DatabaseProvider";
import { bookSlug } from "../../core/lib/bookSlugs";
import { searchTerms, splitMatches } from "../search/textMatch";
import { MIN_QUERY_LENGTH, inTestament, useBibleSearch, type SearchTestament } from "../search/useBibleSearch";
import styles from "./SearchPage.module.css";

const PAGE_SIZE = 50;

const FILTERS: Array<{ value?: SearchTestament; label: string }> = [
  { value: undefined, label: "Toda la Biblia" },
  { value: "at", label: "Antiguo Testamento" },
  { value: "nt", label: "Nuevo Testamento" },
];

interface Props {
  query: string;
  testament?: SearchTestament;
}

export function SearchPage({ query, testament }: Props) {
  const navigate = useNavigate();
  const { translation } = useBibleRepository();
  const [draft, setDraft] = useState(query);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const search = useBibleSearch(query);
  const trimmed = query.trim();
  const tooShort = trimmed.length > 0 && trimmed.length < MIN_QUERY_LENGTH;
  const hits = (search.data?.hits ?? []).filter((hit) => inTestament(hit, testament));
  const terms = searchTerms(trimmed);

  useEffect(() => setDraft(query), [query]);
  useEffect(() => setVisible(PAGE_SIZE), [query, testament, translation]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void navigate({ to: "/buscar", search: { q: draft.trim() || undefined, en: testament }, replace: true });
  }

  return (
    <section data-testid="search-page">
      <h2 className={styles.title}>Buscar</h2>
      <form className={styles.form} role="search" onSubmit={onSubmit}>
        <input
          className={styles.input}
          type="search"
          enterKeyHint="search"
          autoComplete="off"
          aria-label="Buscar en la Biblia"
          placeholder="Una palabra o frase, por ejemplo «luz del mundo»"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button type="submit" className={styles.button} disabled={draft.trim().length < MIN_QUERY_LENGTH}>Buscar</button>
      </form>
      <div className={styles.filters} role="group" aria-label="Dónde buscar">
        {FILTERS.map((filter) => (
          <Link
            key={filter.label}
            className={clsx(styles.filter, testament === filter.value && styles.filterActive)}
            aria-pressed={testament === filter.value}
            to="/buscar"
            search={{ q: query || undefined, en: filter.value }}
            replace
          >
            {filter.label}
          </Link>
        ))}
      </div>

      {!trimmed ? (
        <p className={styles.hint}>
          Buscá en la {translation} una palabra («gracia») o una frase («luz del mundo»). No hace falta poner tildes.
          Para ir a un pasaje, escribí la referencia en «Ir a…».
        </p>
      ) : tooShort ? (
        <p className={styles.hint}>Escribí al menos {MIN_QUERY_LENGTH} letras.</p>
      ) : search.isPending ? (
        <p className={styles.status} role="status">Buscando «{trimmed}»…</p>
      ) : search.error ? (
        <div className={styles.error} role="alert">
          <p>
            {search.error instanceof BollsTranslationUnavailableError
              ? search.error.message
              : "No se pudo buscar. Verificá tu conexión a internet."}
          </p>
          <button type="button" className={styles.retry} onClick={() => void search.refetch()}>Reintentar</button>
        </div>
      ) : (
        <>
          <p className={styles.count} role="status">
            {hits.length === 0
              ? `No encontramos «${trimmed}» en la ${translation}.`
              : `${hits.length} versículo${hits.length === 1 ? "" : "s"} con «${trimmed}» en la ${translation}`}
            {search.data?.truncated ? ". Se muestran los primeros 1024: probá con una frase más precisa." : ""}
          </p>
          {hits.length === 0 ? (
            <p className={styles.hint}>Probá con otra forma de la palabra («amor» en vez de «amó») o con otra traducción.</p>
          ) : (
            <ol className={styles.list}>
              {hits.slice(0, visible).map((hit) => {
                const slug = bookSlug(hit.bookNumber);
                if (!slug) return null;
                return (
                  <li key={`${hit.bookNumber}-${hit.chapter}-${hit.verse}`} className={styles.item} data-testid="search-hit">
                    <Link
                      className={styles.link}
                      to="/$book/$chapter"
                      params={{ book: slug, chapter: String(hit.chapter) }}
                      search={{ v: hit.verse }}
                    >
                      <span className={styles.reference}>{hit.bookName} {hit.chapter}:{hit.verse}</span>
                      <span className={styles.text}>
                        {splitMatches(hit.text, terms).map((part, index) => (
                          part.match ? <mark key={index} className={styles.mark}>{part.text}</mark> : <span key={index}>{part.text}</span>
                        ))}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          )}
          {hits.length > visible ? (
            <button type="button" className={styles.more} onClick={() => setVisible((count) => count + PAGE_SIZE)}>
              Ver {Math.min(PAGE_SIZE, hits.length - visible)} más
            </button>
          ) : null}
        </>
      )}
    </section>
  );
}
