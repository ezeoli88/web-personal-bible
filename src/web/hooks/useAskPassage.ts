import { useCallback, useEffect, useRef, useState } from "react";
import { askPassageStream, BibleAIClientError, MAX_QUESTIONS_PER_PASSAGE } from "../../core/lib/aiClient";
import type { BiblePassage, ChatTurn } from "../../core/types/ai";
import { isOnline } from "../../platform/network";
import { notify } from "../../platform/notify";

export const MAX_QUESTION_LENGTH = 500;

export type AskStatus = "idle" | "loading" | "streaming";

/** The question being answered right now, and what has arrived of its answer. */
export interface PendingTurn {
  question: string;
  answer: string;
}

/**
 * A conversation about one passage, of up to MAX_QUESTIONS_PER_PASSAGE questions
 * to keep the cost down. Each finished question and answer joins `turns`, which
 * go with the next question so follow-ups have context.
 */
export function useAskPassage(options: {
  passage: BiblePassage | null;
  /** Returns true when the error was a sign-in or access problem the panel handles. */
  onAccessError?: (error: unknown) => boolean;
}) {
  const { passage, onAccessError } = options;
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [pending, setPending] = useState<PendingTurn | null>(null);
  const [status, setStatus] = useState<AskStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const asked = turns.filter((turn) => turn.role === "user").length + (pending ? 1 : 0);
  const remaining = Math.max(0, MAX_QUESTIONS_PER_PASSAGE - asked);

  const stop = useCallback(() => {
    controllerRef.current?.abort("stop");
    controllerRef.current = null;
  }, []);

  const reset = useCallback(() => {
    controllerRef.current?.abort("reset");
    controllerRef.current = null;
    setTurns([]);
    setPending(null);
    setStatus("idle");
    setError(null);
  }, []);

  // A new passage starts a new conversation.
  useEffect(() => reset, [passage, reset]);

  const ask = useCallback(async (rawQuestion: string) => {
    const question = rawQuestion.trim().slice(0, MAX_QUESTION_LENGTH);
    if (!passage || !question || controllerRef.current || remaining === 0) return;
    if (!(await isOnline())) {
      notify("Sin conexión", "Necesitás conexión a internet para usar la IA.");
      return;
    }
    const history = turns;
    const controller = new AbortController();
    controllerRef.current = controller;
    setError(null);
    setPending({ question, answer: "" });
    setStatus("loading");
    const current = () => controllerRef.current === controller;
    // Keeps what arrived: a stopped answer still joins the conversation.
    const finish = (answer: string) => {
      setTurns((previous) => answer.trim()
        ? [...previous, { role: "user", content: question }, { role: "assistant", content: answer }]
        : previous);
      setPending(null);
      setStatus("idle");
    };
    let received = "";
    try {
      await askPassageStream(passage, question, history, {
        onStart: () => {
          if (current()) setStatus("streaming");
        },
        onText: (_chunk, accumulated) => {
          if (!current()) return;
          received = accumulated;
          setPending({ question, answer: accumulated });
        },
        onEnd: (event) => {
          if (current()) finish(event.fullContent);
        },
      }, { signal: controller.signal });
    } catch (requestError) {
      if (requestError instanceof BibleAIClientError && requestError.code === "REQUEST_ABORTED") {
        if (controller.signal.reason === "stop") finish(received);
        return;
      }
      if (!current()) return;
      setPending(null);
      setStatus("idle");
      if (onAccessError?.(requestError)) return;
      setError(requestError instanceof Error ? requestError.message : "No se pudo responder la pregunta.");
    } finally {
      if (current()) controllerRef.current = null;
    }
  }, [onAccessError, passage, remaining, turns]);

  return { turns, pending, status, error, remaining, ask, stop, reset };
}
