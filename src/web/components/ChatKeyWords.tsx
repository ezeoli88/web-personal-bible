import { useEffect } from "react";
import { useWordsAnalysis } from "../../core/hooks/useWordsAnalysis";
import type { BiblePassage } from "../../core/types/ai";
import { SaveToNotebookButton } from "../notebook/SaveToNotebookButton";
import { WordStudyCard } from "../wordStudy/WordStudyCard";
import { PassageReading } from "./PassageReading";
import { StreamingText } from "./StreamingText";
import { WordList } from "./WordList";
import panelStyles from "./BibleAiPanel.module.css";
import styles from "./AskPassageChat.module.css";

interface Props {
  passage: BiblePassage;
  /** Called with each definition once it is complete. */
  onDefined: (word: string, definition: string) => void;
  /** Leaves the panel to read another verse from the word study. */
  onNavigate?: () => void;
}

/** The key words shortcut: the passage's words first, then the definition of the one the reader taps. */
export function ChatKeyWords({ passage, onDefined, onNavigate }: Props) {
  const words = useWordsAnalysis();
  const { startIdentification } = words;
  const active = words.activeWord;
  const activeLabel = active ? (active.spanish || active.hint || active.original) : null;

  useEffect(() => {
    void startIdentification(passage);
  }, [passage, startIdentification]);

  useEffect(() => {
    if (words.step === "complete" && activeLabel && words.definitions) onDefined(activeLabel, words.definitions);
  }, [activeLabel, onDefined, words.definitions, words.step]);

  if (words.step === "idle" || words.step === "identifying") {
    return (
      <div className={styles.answer}>
        <PassageReading passage={passage} status="Preparando las palabras del pasaje..." />
      </div>
    );
  }

  if (words.words.length === 0) {
    return (
      <div className={styles.answer}>
        <p className={panelStyles.error} role="alert">⚠️ {words.error ?? "No encontramos palabras para este pasaje."}</p>
        <button type="button" className={styles.save} onClick={() => void startIdentification(passage)}>Reintentar</button>
      </div>
    );
  }

  return (
    <>
      <div className={styles.answer} data-testid="chat-key-words">
        <p className={styles.hint}>Tocá una palabra para ver su definición.</p>
        <WordList
          words={words.words}
          passageReference={passage.reference}
          source={words.source}
          onWordPress={(word) => void words.startDefinition(passage, word)}
        />
      </div>
      {active ? (
        <>
          <p className={styles.question}>Palabra: {activeLabel}</p>
          <div className={styles.answer} aria-busy={words.step === "defining" ? true : undefined}>
            {words.step === "error" ? (
              <>
                <p className={panelStyles.error} role="alert">⚠️ {words.error}</p>
                <button type="button" className={styles.save} onClick={() => void words.startDefinition(passage, active)}>
                  Reintentar
                </button>
              </>
            ) : words.definitions ? (
              <StreamingText text={words.definitions} isStreaming={words.step === "defining"} />
            ) : (
              <PassageReading passage={passage} status={`Buscando el significado de «${activeLabel}»...`} />
            )}
            {words.step === "complete" && active.tokenId ? (
              <WordStudyCard passage={passage} tokenId={active.tokenId} onNavigate={onNavigate} />
            ) : null}
            {words.notes.map((note) => <p key={note} className={panelStyles.note}>• {note}</p>)}
            {words.step === "complete" && words.definitions ? (
              <SaveToNotebookButton
                className={styles.save}
                passage={passage}
                kind="word"
                title={`Palabra: ${activeLabel}`}
                content={words.definitions}
              />
            ) : null}
          </div>
        </>
      ) : null}
    </>
  );
}
