import { useCallback, useEffect, useRef, useState } from "react";
import { askBibleAIStream, askPassageStream, BibleAIClientError, MAX_QUESTIONS_PER_PASSAGE } from "../../core/lib/aiClient";
import type { BiblePassage, ChatTurn, StreamCallbacks, StudyKind, StudyNote } from "../../core/types/ai";
import { isOnline } from "../../platform/network";
import { notify } from "../../platform/notify";

export const MAX_QUESTION_LENGTH = 500;

export type AskStatus = "idle" | "loading" | "streaming";

/** Shortcuts answered by the model in one go; the word list has its own flow. */
export type StreamedStudy = Exclude<StudyKind, "words">;

/** One entry of the conversation, in the order the reader asked for it. */
export type ChatItem =
  | { id: number; kind: "question"; question: string; answer: string }
  | { id: number; kind: StreamedStudy; answer: string }
  | { id: number; kind: "words" };

/**
 * A conversation about one passage: up to MAX_QUESTIONS_PER_PASSAGE free
 * questions to keep the cost down, plus the study shortcuts (context, key
 * words, structure), which do not use those questions. Finished questions go
 * with the next one as `history`, and what the shortcuts showed as `studies`.
 */
export function useAskPassage(options: {
  passage: BiblePassage | null;
  /** Returns true when the error was a sign-in or access problem the panel handles. */
  onAccessError?: (error: unknown) => boolean;
}) {
  const { passage, onAccessError } = options;
  const [items, setItems] = useState<ChatItem[]>([]);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [status, setStatus] = useState<AskStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const nextIdRef = useRef(0);
  // Definitions the reader opened from the key words, by word.
  const wordNotesRef = useRef(new Map<string, string>());
  const asked = items.filter((item) => item.kind === "question").length;
  const remaining = Math.max(0, MAX_QUESTIONS_PER_PASSAGE - asked);
  const used = new Set<StudyKind>(items.flatMap((item) => (item.kind === "question" ? [] : [item.kind])));

  const stop = useCallback(() => {
    controllerRef.current?.abort("stop");
    controllerRef.current = null;
  }, []);

  const reset = useCallback(() => {
    controllerRef.current?.abort("reset");
    controllerRef.current = null;
    wordNotesRef.current = new Map();
    setItems([]);
    setPendingId(null);
    setStatus("idle");
    setError(null);
  }, []);

  // A new passage starts a new conversation.
  useEffect(() => reset, [passage, reset]);

  const run = useCallback(async (
    item: Extract<ChatItem, { answer: string }>,
    request: (callbacks: StreamCallbacks, signal: AbortSignal) => Promise<void>,
  ) => {
    if (!(await isOnline())) {
      notify("Sin conexión", "Necesitás conexión a internet para usar la IA.");
      return;
    }
    const controller = new AbortController();
    controllerRef.current = controller;
    setError(null);
    setItems((previous) => [...previous, item]);
    setPendingId(item.id);
    setStatus("loading");
    const current = () => controllerRef.current === controller;
    const setAnswer = (answer: string) => setItems((previous) => previous.map((entry) => (
      entry.id === item.id ? { ...entry, answer } : entry
    )));
    // Keeps what arrived: a stopped answer still joins the conversation.
    const finish = (answer: string) => {
      if (answer.trim()) setAnswer(answer);
      else setItems((previous) => previous.filter((entry) => entry.id !== item.id));
      setPendingId(null);
      setStatus("idle");
    };
    let received = "";
    try {
      await request({
        onStart: () => {
          if (current()) setStatus("streaming");
        },
        onText: (_chunk, accumulated) => {
          if (!current()) return;
          received = accumulated;
          setAnswer(accumulated);
        },
        onEnd: (event) => {
          if (current()) finish(event.fullContent);
        },
      }, controller.signal);
    } catch (requestError) {
      if (requestError instanceof BibleAIClientError && requestError.code === "REQUEST_ABORTED") {
        if (controller.signal.reason === "stop") finish(received);
        return;
      }
      if (!current()) return;
      finish("");
      if (onAccessError?.(requestError)) return;
      setError(requestError instanceof Error ? requestError.message : "No se pudo responder.");
    } finally {
      if (current()) controllerRef.current = null;
    }
  }, [onAccessError]);

  const ask = useCallback(async (rawQuestion: string) => {
    const question = rawQuestion.trim().slice(0, MAX_QUESTION_LENGTH);
    if (!passage || !question || controllerRef.current || remaining === 0) return;
    const history: ChatTurn[] = items.flatMap((item) => (item.kind === "question" && item.answer.trim()
      ? [{ role: "user" as const, content: item.question }, { role: "assistant" as const, content: item.answer }]
      : []));
    const studies: StudyNote[] = items.flatMap((item) => (
      (item.kind === "history" || item.kind === "structure") && item.answer.trim()
        ? [{ kind: item.kind, content: item.answer }]
        : []
    ));
    if (wordNotesRef.current.size > 0) {
      const content = [...wordNotesRef.current].map(([word, definition]) => `«${word}»: ${definition}`).join("\n\n");
      studies.push({ kind: "words", content });
    }
    await run(
      { id: nextIdRef.current++, kind: "question", question, answer: "" },
      (callbacks, signal) => askPassageStream(passage, question, history, callbacks, { signal, studies }),
    );
  }, [items, passage, remaining, run]);

  const study = useCallback(async (kind: StudyKind) => {
    if (!passage || used.has(kind)) return;
    if (kind === "words") {
      setItems((previous) => [...previous, { id: nextIdRef.current++, kind: "words" }]);
      return;
    }
    if (controllerRef.current) return;
    await run(
      { id: nextIdRef.current++, kind, answer: "" },
      (callbacks, signal) => askBibleAIStream(passage, kind, callbacks, { signal }),
    );
  }, [passage, run, used]);

  /** A definition opened from the key words, sent as context with the next questions. */
  const noteWord = useCallback((word: string, definition: string) => {
    wordNotesRef.current.set(word, definition);
  }, []);

  return { items, pendingId, status, error, remaining, used, ask, study, noteWord, stop, reset };
}
