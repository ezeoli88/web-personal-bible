import { useEffect, useRef, useState, type FormEvent } from "react";
import type { BiblePassage, StudyKind } from "../../core/types/ai";
import { MAX_QUESTION_LENGTH, type useAskPassage } from "../hooks/useAskPassage";
import { ChatKeyWords } from "./ChatKeyWords";
import { SaveToNotebookButton } from "../notebook/SaveToNotebookButton";
import { MarkdownText } from "./MarkdownText";
import { PassageReading } from "./PassageReading";
import { StreamingText } from "./StreamingText";
import panelStyles from "./BibleAiPanel.module.css";
import styles from "./AskPassageChat.module.css";

/** Questions that fit almost any passage, for a reader who does not know where to start. */
export const STARTER_QUESTIONS = [
  "¿Qué enseña este pasaje sobre Dios?",
  "¿Qué significaba esto para sus primeros lectores?",
  "¿Cómo puedo aplicarlo hoy?",
];

/** Study shortcuts at the top of the chat; each one can be opened once per conversation. */
export const STUDY_SHORTCUTS: Array<{ kind: StudyKind; emoji: string; label: string }> = [
  { kind: "history", emoji: "📜", label: "Contexto histórico" },
  { kind: "words", emoji: "🔤", label: "Palabras clave" },
  { kind: "structure", emoji: "🏗️", label: "Estructura" },
];

const STUDY_LABELS = Object.fromEntries(STUDY_SHORTCUTS.map((shortcut) => [shortcut.kind, shortcut])) as Record<
  StudyKind,
  (typeof STUDY_SHORTCUTS)[number]
>;

interface Props {
  passage: BiblePassage;
  chat: ReturnType<typeof useAskPassage>;
  onBack: () => void;
  /** Leaves the panel to read another verse from a word study. */
  onNavigate?: () => void;
}

export function AskPassageChat({ passage, chat, onBack, onNavigate }: Props) {
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const busy = chat.status !== "idle";
  const exhausted = chat.remaining === 0;
  const questions = chat.items.flatMap((item) => (item.kind === "question" ? [item] : []));
  const asked = new Set(questions.map((item) => item.question));
  const suggestions = STARTER_QUESTIONS.filter((question) => !asked.has(question));
  const shortcuts = STUDY_SHORTCUTS.filter((shortcut) => !chat.used.has(shortcut.kind));
  const lastItem = chat.items.at(-1);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: "end" });
  }, [chat.items.length, lastItem]);

  function send(question: string) {
    if (busy || !question.trim()) return;
    setDraft("");
    void chat.ask(question);
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    send(draft);
  }

  function renderAnswer(id: number, answer: string, status: string) {
    if (id !== chat.pendingId) return <MarkdownText>{answer}</MarkdownText>;
    return answer ? <StreamingText text={answer} isStreaming /> : <PassageReading passage={passage} status={status} />;
  }

  return (
    <div className={panelStyles.response}>
      <div className={panelStyles.modeHeader}>
        <span aria-hidden="true">💬</span>
        <span>Preguntale al pasaje</span>
      </div>
      <p className={styles.reference}>{passage.reference} · {passage.translation}</p>

      <div className={panelStyles.scroller} aria-busy={busy ? true : undefined} data-testid="ask-conversation">
        {chat.items.length === 0 ? (
          <p className={styles.intro}>
            Empezá por un atajo para estudiar el pasaje o hacé hasta 3 preguntas. Las respuestas se apoyan en el texto y marcan los versículos entre corchetes.
          </p>
        ) : null}
        {chat.items.map((item) => {
          if (item.kind === "words") {
            return (
              <div key={item.id}>
                <p className={styles.question}>🔤 Palabras clave</p>
                <ChatKeyWords passage={passage} onDefined={chat.noteWord} onNavigate={onNavigate} />
              </div>
            );
          }
          const shortcut = item.kind === "question" ? null : STUDY_LABELS[item.kind];
          const title = item.kind === "question" ? item.question : STUDY_LABELS[item.kind].label;
          return (
            <div key={item.id}>
              <p className={styles.question}>{shortcut ? `${shortcut.emoji} ${shortcut.label}` : title}</p>
              <div className={styles.answer}>
                {renderAnswer(
                  item.id,
                  item.answer,
                  shortcut ? `Consultando sobre ${shortcut.label.toLowerCase()}...` : "Buscando la respuesta en el pasaje...",
                )}
                {item.id !== chat.pendingId ? (
                  <SaveToNotebookButton
                    className={styles.save}
                    passage={passage}
                    kind={shortcut ? "ai" : "ask"}
                    title={title}
                    content={item.answer}
                  />
                ) : null}
              </div>
            </div>
          );
        })}
        {chat.error ? <p className={panelStyles.error} role="alert">⚠️ {chat.error}</p> : null}
        {!busy && shortcuts.length > 0 ? (
          <div className={styles.suggestions}>
            <p className={styles.label}>Estudiá el pasaje</p>
            <div className={styles.shortcuts}>
              {shortcuts.map((shortcut) => (
                <button
                  key={shortcut.kind}
                  type="button"
                  className={styles.shortcut}
                  data-testid={`study-${shortcut.kind}`}
                  onClick={() => void chat.study(shortcut.kind)}
                >
                  <span aria-hidden="true">{shortcut.emoji}</span> {shortcut.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {!busy && !exhausted && suggestions.length > 0 ? (
          <div className={styles.suggestions}>
            <p className={styles.label}>{questions.length > 0 ? "Seguí preguntando" : "Para empezar"}</p>
            {suggestions.map((question) => (
              <button key={question} type="button" className={styles.suggestion} onClick={() => send(question)}>
                {question}
              </button>
            ))}
          </div>
        ) : null}
        <div ref={endRef} />
      </div>
      <p role="status" className={panelStyles.visuallyHidden}>
        {chat.status === "idle" && chat.items.length > 0 ? "Respuesta lista" : ""}
      </p>

      {exhausted ? (
        <p className={styles.limit} data-testid="ask-limit">
          Llegaste a las 3 preguntas sobre este pasaje. Los atajos siguen disponibles; para seguir preguntando, elegí otros versículos.
        </p>
      ) : (
      <form className={styles.composer} onSubmit={onSubmit}>
        <label htmlFor="ask-passage-input" className={panelStyles.visuallyHidden}>Tu pregunta</label>
        <input
          id="ask-passage-input"
          className={styles.input}
          placeholder={questions.length > 0 ? "Hacé otra pregunta…" : "Preguntá sobre este pasaje…"}
          autoComplete="off"
          maxLength={MAX_QUESTION_LENGTH}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button type="submit" className={styles.send} disabled={busy || !draft.trim()}>Enviar</button>
      </form>
      )}
      {!exhausted && questions.length > 0 && !busy ? (
        <p className={styles.remaining}>
          {chat.remaining === 1 ? "Te queda 1 pregunta sobre este pasaje." : `Te quedan ${chat.remaining} preguntas sobre este pasaje.`}
        </p>
      ) : null}
      <div className={panelStyles.actions}>
        {busy ? (
          <button type="button" className={panelStyles.secondary} onClick={chat.stop}>
            <span className={panelStyles.stopIcon} aria-hidden="true" />
            Detener
          </button>
        ) : (
          <button type="button" className={panelStyles.secondary} onClick={onBack}>← Volver al menú</button>
        )}
      </div>
    </div>
  );
}
