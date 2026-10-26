// Ported from biblia-ntv-app/src/hooks/useWordsAnalysis.ts
import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  BibleAIClientError,
  defineWordsStream,
  defineWordsStreamWithoutLexicon,
  identifyWords,
} from "../lib/aiClient";
import { WORD_DEFINITION_CACHE_TTL, wordDefinitionQueryKey } from "../lib/wordDefinitionsCache";
import type { CachedWordDefinition } from "../lib/wordDefinitionsCache";
import type { BiblePassage, WordEntry, WordsLanguage } from "../types/ai";

type WordsFlowStep = "idle" | "identifying" | "browsing" | "defining" | "complete" | "error";

/** Lexicon failures after which the server can still identify words with AI alone. */
const LEXICON_FALLBACK_CODES = new Set(["INVALID_REFERENCE", "LEXICON_NOT_FOUND", "LEXICON_ERROR"]);

async function identifyWithFallback(passage: BiblePassage, signal: AbortSignal) {
  try {
    return await identifyWords(passage, true, { signal });
  } catch (err) {
    if (!(err instanceof BibleAIClientError) || !LEXICON_FALLBACK_CODES.has(err.code ?? "")) throw err;
    return identifyWords(passage, false, { signal });
  }
}

export function useWordsAnalysis() {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<WordsFlowStep>("idle");
  const [words, setWords] = useState<WordEntry[]>([]);
  const [activeWord, setActiveWord] = useState<WordEntry | null>(null);
  const [definitions, setDefinitions] = useState("");
  const [notes, setNotes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<"lexicon" | "llm" | null>(null);
  const [language, setLanguage] = useState<WordsLanguage | null>(null);
  const requestControllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => {
    requestControllerRef.current?.abort();
    requestControllerRef.current = null;
  }, []);

  const startIdentification = useCallback(async (passage: BiblePassage) => {
    requestControllerRef.current?.abort();
    const controller = new AbortController();
    requestControllerRef.current = controller;
    setStep("identifying");
    setWords([]);
    setActiveWord(null);
    setError(null);
    setDefinitions("");
    setNotes([]);
    setSource(null);
    setLanguage(null);

    try {
      const response = await identifyWithFallback(passage, controller.signal);
      if (requestControllerRef.current !== controller) return;
      setWords(response.words);
      setSource(response.source === "lexicon" ? "lexicon" : "llm");
      setLanguage(response.language || null);
      setStep("browsing");
    } catch (err) {
      if (requestControllerRef.current !== controller || controller.signal.aborted) return;
      if (err instanceof BibleAIClientError && err.code === "REQUEST_ABORTED") return;
      setError(err instanceof Error ? err.message : "Error desconocido");
      setStep("error");
    } finally {
      if (requestControllerRef.current === controller) requestControllerRef.current = null;
    }
  }, []);

  const startDefinition = useCallback(async (passage: BiblePassage, word: WordEntry) => {
    requestControllerRef.current?.abort();
    const controller = new AbortController();
    requestControllerRef.current = controller;
    setActiveWord(word);
    setStep("defining");
    setError(null);
    setDefinitions("");
    setNotes([]);

    try {
      // Words identified without the lexicon have no tokenId.
      const queryKey = wordDefinitionQueryKey(passage, word.tokenId ?? `llm:${word.language}:${word.original}`);
      const cached = queryClient.getQueryState<CachedWordDefinition>(queryKey);
      const age = cached ? Date.now() - cached.dataUpdatedAt : Infinity;
      if (cached?.data && !cached.isInvalidated && age >= 0 && age < WORD_DEFINITION_CACHE_TTL) {
        setDefinitions(cached.data.fullContent);
        setNotes(cached.data.notes);
        setStep("complete");
        return;
      }
      if (cached) queryClient.removeQueries({ queryKey, exact: true });
      let completed: CachedWordDefinition | undefined;
      const callbacks: Parameters<typeof defineWordsStream>[2] = {
        onText: (_chunk, accumulated) => {
          if (requestControllerRef.current === controller) setDefinitions(accumulated);
        },
        onEnd: (event) => {
          if (requestControllerRef.current !== controller) return;
          if (event.fullContent.trim()) {
            completed = { fullContent: event.fullContent, notes: event.notes || [] };
          }
        },
        onError: (err) => {
          if (requestControllerRef.current !== controller) return;
          setError(err.message);
          setStep("error");
        },
      };
      await (word.tokenId
        ? defineWordsStream(passage, [word.tokenId], callbacks, { signal: controller.signal })
        : defineWordsStreamWithoutLexicon(passage, [word], callbacks, { signal: controller.signal }));
      if (requestControllerRef.current !== controller || controller.signal.aborted) return;
      if (!completed) throw new Error("El servidor no devolvió una definición completa. Volvé a intentarlo.");
      queryClient.setQueryData(queryKey, completed);
      setDefinitions(completed.fullContent);
      setNotes(completed.notes);
      setStep("complete");
    } catch (err) {
      if (requestControllerRef.current !== controller || controller.signal.aborted) return;
      if (err instanceof BibleAIClientError && err.code === "REQUEST_ABORTED") return;
      setError(err instanceof Error ? err.message : "Error desconocido");
      setStep("error");
    } finally {
      if (requestControllerRef.current === controller) requestControllerRef.current = null;
    }
  }, [queryClient]);

  const backToWords = useCallback(() => {
    requestControllerRef.current?.abort();
    requestControllerRef.current = null;
    setStep("browsing");
    setActiveWord(null);
    setDefinitions("");
    setNotes([]);
    setError(null);
  }, []);

  const reset = useCallback(() => {
    requestControllerRef.current?.abort();
    requestControllerRef.current = null;
    setStep("idle");
    setWords([]);
    setActiveWord(null);
    setDefinitions("");
    setNotes([]);
    setError(null);
    setSource(null);
    setLanguage(null);
  }, []);

  return {
    step,
    words,
    activeWord,
    definitions,
    notes,
    error,
    source,
    language,
    startIdentification,
    startDefinition,
    backToWords,
    reset,
  };
}
