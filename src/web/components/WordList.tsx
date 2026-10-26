import type { WordEntry } from "../../core/types/ai";
import styles from "./WordList.module.css";
import clsx from "clsx";

interface Props {
  words: WordEntry[];
  onWordPress: (word: WordEntry) => void;
  passageReference?: string;
  source?: "lexicon" | "llm" | null;
}

function formatPOS(pos: string): string {
  const labels: Record<string, string> = {
    verb: "Verbo",
    noun: "Sustantivo",
    adj: "Adjetivo",
    adv: "Adverbio",
    prep: "Preposición",
    conj: "Conjunción",
    pron: "Pronombre",
    art: "Artículo",
    part: "Partícula",
    intj: "Interjección",
  };
  return labels[pos] || pos;
}

export function WordList({ words, onWordPress, passageReference, source }: Props) {
  const bookName = passageReference?.match(/^(.*?)\s+\d+(?::.*)?$/)?.[1];
  const groups = new Map<string, WordEntry[]>();
  for (const word of words) {
    const reference = word.reference || word.tokenId?.split(":")[0] || "";
    const group = groups.get(reference);
    if (group) group.push(word);
    else groups.set(reference, [word]);
  }

  return (
    <div className={styles.container} data-testid="word-list">
      {source === "lexicon" ? (
        <p className={styles.verifiedBanner}>
          <span className={styles.verifiedIcon} aria-hidden="true">✓</span>
          Texto original y referencias del léxico bíblico
        </p>
      ) : source === "llm" ? (
        <p className={styles.header} data-testid="unverified-words-note">
          Este pasaje no se pudo analizar con el léxico: la IA identificó estas palabras sin verificarlas.
        </p>
      ) : null}
      <p className={styles.header}>Tocá una palabra para ver su explicación</p>
      {Array.from(groups, ([reference, entries]) => {
        const verse = reference.match(/^(.+)\.(\d+)\.(\d+)$/);
        const title = verse ? `${bookName || verse[1]} ${verse[2]}:${verse[3]}` : passageReference;
        return (
          <section key={reference || "grupo"}>
            {title ? <h3 className={styles.verseHeader}>{title}</h3> : null}
            {entries.map((word, index) => {
              const hasLexiconData = Boolean(word.strong || word.pos);
              const label = word.spanish || word.hint || word.original;
              return (
                <button
                  key={word.tokenId || `${word.original}-${index}`}
                  type="button"
                  className={clsx(styles.wordItem, word.isKeyword && styles.keywordItem)}
                  data-testid="word-item"
                  onClick={() => onWordPress(word)}
                  aria-label={`Ver explicación de ${label}`}
                >
                  <span className={styles.wordContent}>
                    <span className={styles.wordTitle}>{label}</span>
                    {source === "lexicon" && !word.spanish && word.hint ? (
                      <span className={styles.wordOriginal}>Sentido del original</span>
                    ) : null}
                    {word.isKeyword ? <span className={styles.keywordLabel}>✦ Clave</span> : null}
                    <span className={styles.wordOriginal}>{word.original}</span>
                    {word.transliteration ? (
                      <span className={styles.wordOriginal}>
                        {word.lemma ? `Lema: ${word.lemma} · ` : ""}
                        {word.transliteration}
                      </span>
                    ) : null}
                    {hasLexiconData ? (
                      <span className={styles.badgeRow}>
                        {word.strong ? <span className={styles.strongBadge}>{word.strong}</span> : null}
                        {word.pos ? <span className={styles.posBadge}>{formatPOS(word.pos)}</span> : null}
                        <span className={styles.languageLabel}>
                          {word.language === "greek" ? "Griego" : "Hebreo"}
                        </span>
                      </span>
                    ) : null}
                    {word.hint && word.spanish && word.hint !== word.spanish ? (
                      <span className={styles.wordHint}>{word.hint}</span>
                    ) : null}
                  </span>
                  <span className={styles.chevron} aria-hidden="true">›</span>
                </button>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}
