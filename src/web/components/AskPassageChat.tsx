import { useEffect, useRef, useState, type FormEvent } from "react";
import type { BiblePassage } from "../../core/types/ai";
import { MAX_QUESTION_LENGTH, type useAskPassage } from "../hooks/useAskPassage";
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

interface Props {
  passage: BiblePassage;
  chat: ReturnType<typeof useAskPassage>;
  onBack: () => void;
}

export function AskPassageChat({ passage, chat, onBack }: Props) {
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const busy = chat.status !== "idle";
  const exhausted = chat.remaining === 0;
  const asked = new Set(chat.turns.filter((turn) => turn.role === "user").map((turn) => turn.content));
  const suggestions = STARTER_QUESTIONS.filter((question) => !asked.has(question) && question !== chat.pending?.question);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: "end" });
  }, [chat.turns.length, chat.pending?.answer, chat.pending?.question]);

  function send(question: string) {
    if (busy || !question.trim()) return;
    setDraft("");
    void chat.ask(question);
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    send(draft);
  }

  return (
    <div className={panelStyles.response}>
      <div className={panelStyles.modeHeader}>
        <span aria-hidden="true">💬</span>
        <span>Preguntale al pasaje</span>
      </div>
      <p className={styles.reference}>{passage.reference} · {passage.translation}</p>

      <div className={panelStyles.scroller} aria-busy={busy ? true : undefined} data-testid="ask-conversation">
        {chat.turns.length === 0 && !chat.pending ? (
          <p className={styles.intro}>
            Hacé hasta 3 preguntas sobre este pasaje. Las respuestas son breves, se apoyan en el texto y marcan los versículos entre corchetes.
          </p>
        ) : null}
        {chat.turns.map((turn, index) => turn.role === "user" ? (
          <p key={index} className={styles.question}>{turn.content}</p>
        ) : (
          <div key={index} className={styles.answer}>
            <MarkdownText>{turn.content}</MarkdownText>
            <SaveToNotebookButton
              className={styles.save}
              passage={passage}
              kind="ask"
              title={chat.turns[index - 1]?.content ?? "Pregunta"}
              content={turn.content}
            />
          </div>
        ))}
        {chat.pending ? (
          <>
            <p className={styles.question}>{chat.pending.question}</p>
            <div className={styles.answer}>
              {chat.pending.answer ? (
                <StreamingText text={chat.pending.answer} isStreaming />
              ) : (
                <PassageReading passage={passage} status="Buscando la respuesta en el pasaje..." />
              )}
            </div>
          </>
        ) : null}
        {chat.error ? <p className={panelStyles.error} role="alert">⚠️ {chat.error}</p> : null}
        {!busy && !exhausted && suggestions.length > 0 ? (
          <div className={styles.suggestions}>
            <p className={styles.label}>{chat.turns.length > 0 ? "Seguí preguntando" : "Para empezar"}</p>
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
        {chat.status === "idle" && chat.turns.length > 0 ? "Respuesta lista" : ""}
      </p>

      {exhausted ? (
        <p className={styles.limit} data-testid="ask-limit">
          Llegaste a las 3 preguntas sobre este pasaje. Para seguir, elegí otros versículos.
        </p>
      ) : (
      <form className={styles.composer} onSubmit={onSubmit}>
        <label htmlFor="ask-passage-input" className={panelStyles.visuallyHidden}>Tu pregunta</label>
        <input
          id="ask-passage-input"
          className={styles.input}
          placeholder={chat.turns.length > 0 ? "Hacé otra pregunta…" : "Preguntá sobre este pasaje…"}
          autoComplete="off"
          maxLength={MAX_QUESTION_LENGTH}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button type="submit" className={styles.send} disabled={busy || !draft.trim()}>Enviar</button>
      </form>
      )}
      {!exhausted && chat.turns.length > 0 && !busy ? (
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
