import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { CrossReference } from "../../core/crossRefs/openBible";
import { getWordStudy } from "../../core/lib/aiClient";
import { bookFromNumber, bookSlug } from "../../core/lib/bookSlugs";
import type { BiblePassage, WordStudyResponse } from "../../core/types/ai";
import { formatPOS } from "../components/WordList";
import { connectionKey, useConnectionTexts } from "../connections/useConnections";
import { formatVerseParam } from "../layout/bookRoute";
import styles from "./WordStudyCard.module.css";

/** Books shown as bars; the rest are added up in «Otros libros». */
const TOP_BOOKS = 6;

interface Props {
  passage: BiblePassage;
  tokenId: string;
  /** Called when the reader opens one of the examples, to close the panel. */
  onNavigate?: () => void;
}

export function bookBars(byBook: WordStudyResponse["occurrences"]["byBook"]) {
  const top = byBook.slice(0, TOP_BOOKS).map((row) => ({
    key: String(row.bookNumber),
    label: bookFromNumber(row.bookNumber)?.name ?? row.book,
    count: row.count,
  }));
  const rest = byBook.slice(TOP_BOOKS).reduce((sum, row) => sum + row.count, 0);
  return rest > 0 ? [...top, { key: "rest", label: "Otros libros", count: rest }] : top;
}

function exampleRefs(study: WordStudyResponse | undefined): CrossReference[] {
  return (study?.occurrences.examples ?? []).map(({ bookNumber, chapter, verse }) => [bookNumber, chapter, verse, 0, 0, 0]);
}

/** The lexicon card of a word: form, meaning and where else it appears. */
export function WordStudyCard({ passage, tokenId, onNavigate }: Props) {
  const study = useQuery({
    queryKey: ["word-study", passage.translation, passage.reference, tokenId],
    queryFn: ({ signal }) => getWordStudy(passage, tokenId, { signal }),
    staleTime: Infinity,
    retry: false,
  });
  const examples = exampleRefs(study.data);
  const texts = useConnectionTexts(examples);

  if (study.isPending) {
    return <p className={styles.status} role="status">Buscando dónde más aparece…</p>;
  }
  if (study.isError) {
    return <p className={styles.status}>No se pudo cargar el estudio de esta palabra.</p>;
  }

  const { word, occurrences } = study.data;
  const bars = bookBars(occurrences.byBook);
  const max = Math.max(1, ...bars.map((bar) => bar.count));
  const testament = occurrences.testament === "NT" ? "el Nuevo Testamento" : "el Antiguo Testamento";

  return (
    <section className={styles.card} data-testid="word-study" aria-label={`Estudio de ${word.lemma}`}>
      <h3 className={styles.heading}>Estudio a fondo</h3>
      <div className={styles.head}>
        <span className={styles.original} lang={word.language === "greek" ? "grc" : "hbo"}>{word.lemma}</span>
        {word.transliteration ? <span className={styles.translit}>{word.transliteration}</span> : null}
      </div>
      <dl className={styles.facts}>
        <dt>En el texto</dt>
        <dd lang={word.language === "greek" ? "grc" : "hbo"}>{word.original}</dd>
        {word.pos ? (<><dt>Categoría</dt><dd>{formatPOS(word.pos)}</dd></>) : null}
        {word.strong ? (<><dt>Strong</dt><dd>{word.strong}</dd></>) : null}
        <dt>Aparece</dt>
        <dd>
          {occurrences.total === 1 ? "1 vez" : `${occurrences.total} veces`}
          {occurrences.verses !== occurrences.total ? ` en ${occurrences.verses} versículos` : ""}
        </dd>
      </dl>
      {occurrences.total > 1 ? (
        <>
          <p className={styles.section}>Dónde aparece más en {testament}</p>
          <ul className={styles.bars}>
            {bars.map((bar) => (
              <li key={bar.key} className={styles.bar}>
                <span>{bar.label}</span>
                <span className={styles.track}><i style={{ width: `${Math.max(4, Math.round((bar.count / max) * 100))}%` }} /></span>
                <span className={styles.count}>{bar.count}</span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className={styles.status}>Es la única vez que aparece en {testament}.</p>
      )}
      {examples.length > 0 ? (
        <>
          <p className={styles.section}>Otros versículos</p>
          <ul className={styles.examples}>
            {examples.map((item) => {
              const slug = bookSlug(item[0]);
              const text = texts.data?.[connectionKey(item)];
              if (!slug) return null;
              return (
                <li key={connectionKey(item)}>
                  <Link
                    className={styles.example}
                    to="/$book/$chapter"
                    params={{ book: slug, chapter: String(item[1]) }}
                    search={{ v: formatVerseParam([item[2]]) }}
                    onClick={onNavigate}
                  >
                    <span className={styles.ref}>{bookFromNumber(item[0])?.name} {item[1]}:{item[2]}</span>
                    {text ? <span className={styles.text}>{text}</span> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      ) : null}
      <p className={styles.credit}>
        Datos del léxico: {occurrences.by === "strong" ? "se cuenta por número Strong" : "se cuenta por lema"}, en el texto original.
      </p>
    </section>
  );
}
