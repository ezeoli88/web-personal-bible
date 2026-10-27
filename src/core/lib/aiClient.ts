// Ported from biblia-ntv-app/src/lib/aiClient.ts
// Same exports and signatures, except the deprecated askBibleAI and the added
// defineWordsStreamWithoutLexicon. Transport is same-origin fetch.
import { EventSourceParserStream } from "eventsource-parser/stream";
import type { EventSourceMessage } from "eventsource-parser/stream";
import {
  type AIMenuResponse,
  type AIMode,
  type APIError,
  type BiblePassage,
  type ChatTurn,
  type IdentifiedWord,
  type StreamCallbacks,
  type StreamErrorEvent,
  type StreamEvent,
  type WordsDefineEndEvent,
  type WordsDefineErrorEvent,
  type WordsDefineStartEvent,
  type WordsIdentifyResponse,
  type WordStudyResponse,
} from "../types/ai";

const ENDPOINT = "/api/bible-ai/stream";
const TIMEOUT_MS = 60000;

interface FetchOptions {
  timeout?: number;
  signal?: AbortSignal;
}

interface WordsDefineCallbacks {
  onStart?: (event: WordsDefineStartEvent) => void;
  onText?: (content: string, accumulated: string) => void;
  onEnd?: (event: WordsDefineEndEvent) => void;
  onError?: (error: Error) => void;
}

export class BibleAIClientError extends Error {
  code?: string;
  status?: number;

  constructor(message: string, code?: string, status?: number) {
    super(message);
    this.name = "BibleAIClientError";
    this.code = code;
    this.status = status;
  }
}

function headers(): Headers {
  return new Headers({
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
  });
}

function streamErrorToError(event: StreamErrorEvent | WordsDefineErrorEvent): BibleAIClientError {
  return new BibleAIClientError(
    event.message || event.error || "Error en la respuesta de la IA",
    event.code,
  );
}

async function responseToError(response: Response, fallback: string): Promise<BibleAIClientError> {
  let payload: Partial<APIError> | null = null;
  let rawText = "";
  try {
    rawText = await response.text();
    payload = rawText ? JSON.parse(rawText) as Partial<APIError> : null;
  } catch {
    payload = null;
  }
  const message = payload?.message || payload?.error || rawText || fallback;
  return new BibleAIClientError(message, payload?.code, response.status);
}

function createRequestController(signal?: AbortSignal) {
  const controller = new AbortController();
  const handleAbort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener("abort", handleAbort);
  return {
    controller,
    cleanup: () => signal?.removeEventListener("abort", handleAbort),
  };
}

function getAbortError(externalSignal?: AbortSignal): BibleAIClientError {
  if (externalSignal?.aborted) {
    return new BibleAIClientError("Solicitud cancelada.", "REQUEST_ABORTED");
  }
  return new BibleAIClientError(
    "La solicitud tardó demasiado. Intentá de nuevo.",
    "REQUEST_TIMEOUT",
  );
}

function parseEvent(data: string): { type?: string } | null {
  if (!data.trim()) return null;
  try {
    return JSON.parse(data) as { type?: string };
  } catch {
    console.warn("[aiClient] No se pudo interpretar un evento SSE:", data);
    return null;
  }
}

async function readSse(
  response: Response,
  onMessage: (message: EventSourceMessage) => void,
): Promise<void> {
  if (!response.body) {
    throw new BibleAIClientError("Respuesta vacía del servidor.", "EMPTY_RESPONSE", response.status);
  }
  const reader = response.body
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(new EventSourceParserStream())
    .getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return;
      onMessage(value);
    }
  } finally {
    reader.releaseLock();
  }
}

export async function getBibleAIMenu(
  passage: BiblePassage,
  options: FetchOptions = {},
): Promise<AIMenuResponse> {
  const { timeout = TIMEOUT_MS, signal } = options;
  const { controller, cleanup } = createRequestController(signal);
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ mode: "menu", passage }),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw await responseToError(response, "Error cargando las opciones de análisis");
    }
    const payload: unknown = await response.json();
    if (
      typeof payload !== "object" ||
      payload === null ||
      (payload as AIMenuResponse).type !== "menu" ||
      !Array.isArray((payload as AIMenuResponse).options)
    ) {
      throw new BibleAIClientError("Respuesta de menú inválida.", "INVALID_MENU_RESPONSE");
    }
    return payload as AIMenuResponse;
  } catch (error) {
    if (error instanceof BibleAIClientError) throw error;
    if (error instanceof Error && error.name === "AbortError") throw getAbortError(signal);
    throw error;
  } finally {
    clearTimeout(timeoutId);
    cleanup();
  }
}

export function askBibleAIStream(
  passage: BiblePassage,
  mode: AIMode,
  callbacks: StreamCallbacks,
  options: FetchOptions = {},
): Promise<void> {
  return streamRequest(
    { passage, mode },
    callbacks,
    options,
    "Error de conexión. Verificá tu internet.",
  );
}

/** Questions per conversation; logosagent-api rejects a fourth one with QUESTION_LIMIT_REACHED. */
export const MAX_QUESTIONS_PER_PASSAGE = 3;

/** Asks a free question about the passage, with the earlier turns of the conversation. */
export function askPassageStream(
  passage: BiblePassage,
  question: string,
  history: ChatTurn[],
  callbacks: StreamCallbacks,
  options: FetchOptions = {},
): Promise<void> {
  return streamRequest(
    { passage, mode: "ask", question, history },
    callbacks,
    options,
    "Error de conexión. Verificá tu internet.",
  );
}

export async function identifyWords(
  passage: BiblePassage,
  useLexicon = true,
  options: FetchOptions = {},
): Promise<WordsIdentifyResponse> {
  const { timeout = TIMEOUT_MS, signal } = options;
  const { controller, cleanup } = createRequestController(signal);
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ mode: "words", step: "identify", useLexicon, passage }),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw await responseToError(response, "Error identificando palabras");
    }
    const payload: unknown = await response.json();
    if (
      typeof payload !== "object" ||
      payload === null ||
      (payload as WordsIdentifyResponse).type !== "words-identification" ||
      !Array.isArray((payload as WordsIdentifyResponse).words)
    ) {
      throw new BibleAIClientError("Respuesta inválida al identificar palabras.", "INVALID_WORDS_RESPONSE");
    }
    return payload as WordsIdentifyResponse;
  } catch (error) {
    if (error instanceof BibleAIClientError) throw error;
    if (error instanceof Error && error.name === "AbortError") throw getAbortError(signal);
    throw error;
  } finally {
    clearTimeout(timeoutId);
    cleanup();
  }
}

/** One lexicon word's card and concordance. */
export async function getWordStudy(
  passage: BiblePassage,
  tokenId: string,
  options: FetchOptions = {},
): Promise<WordStudyResponse> {
  const { timeout = TIMEOUT_MS, signal } = options;
  const { controller, cleanup } = createRequestController(signal);
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ mode: "words", step: "study", useLexicon: true, selectedTokenIds: [tokenId], passage }),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw await responseToError(response, "Error cargando el estudio de la palabra");
    }
    const payload: unknown = await response.json();
    if (
      typeof payload !== "object" ||
      payload === null ||
      (payload as WordStudyResponse).type !== "word-study" ||
      !Array.isArray((payload as WordStudyResponse).occurrences?.byBook)
    ) {
      throw new BibleAIClientError("Respuesta inválida del estudio de palabra.", "INVALID_WORD_STUDY_RESPONSE");
    }
    return payload as WordStudyResponse;
  } catch (error) {
    if (error instanceof BibleAIClientError) throw error;
    if (error instanceof Error && error.name === "AbortError") throw getAbortError(signal);
    throw error;
  } finally {
    clearTimeout(timeoutId);
    cleanup();
  }
}

export function defineWordsStream(
  passage: BiblePassage,
  selectedTokenIds: string[],
  callbacks: WordsDefineCallbacks,
  options: FetchOptions = {},
): Promise<void> {
  if (selectedTokenIds.length === 0) {
    return Promise.reject(new BibleAIClientError(
      "Seleccioná al menos una palabra.",
      "EMPTY_TOKEN_SELECTION",
    ));
  }
  return streamRequest(
    { mode: "words", step: "define", useLexicon: true, selectedTokenIds, passage },
    callbacks,
    options,
    "Error de conexión. Verificá tu internet.",
  );
}

/** Define words identified without the lexicon (they have no tokenId). */
export function defineWordsStreamWithoutLexicon(
  passage: BiblePassage,
  selectedWords: IdentifiedWord[],
  callbacks: WordsDefineCallbacks,
  options: FetchOptions = {},
): Promise<void> {
  if (selectedWords.length === 0) {
    return Promise.reject(new BibleAIClientError(
      "Seleccioná al menos una palabra.",
      "EMPTY_WORD_SELECTION",
    ));
  }
  return streamRequest(
    {
      mode: "words",
      step: "define",
      useLexicon: false,
      selectedWords: selectedWords.map(({ spanish, original, transliteration, language }) => (
        { spanish, original, transliteration, language }
      )),
      passage,
    },
    callbacks,
    options,
    "Error de conexión. Verificá tu internet.",
  );
}

function streamRequest(
  body: unknown,
  callbacks: StreamCallbacks | WordsDefineCallbacks,
  options: FetchOptions,
  connectionMessage: string,
): Promise<void> {
  const { timeout = TIMEOUT_MS, signal } = options;
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(getAbortError(signal));
      return;
    }

    const { controller, cleanup: cleanupSignal } = createRequestController(signal);
    let accumulatedContent = "";
    let settled = false;
    let sawEnd = false;
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, timeout);

    const cleanup = () => {
      clearTimeout(timeoutId);
      cleanupSignal();
    };

    const finishWithError = (error: Error, notify = true) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (notify) callbacks.onError?.(error);
      reject(error);
    };

    void (async () => {
      try {
        const response = await fetch(ENDPOINT, {
          method: "POST",
          headers: headers(),
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        if (!response.ok) {
          finishWithError(await responseToError(response, connectionMessage));
          return;
        }
        await readSse(response, (message) => {
          if (settled || !message.data) return;
          const parsed = parseEvent(message.data);
          if (!parsed?.type || parsed.type === "quality") return;
          const event = parsed as StreamEvent;
          switch (event.type) {
            case "start":
              callbacks.onStart?.(event as never);
              break;
            case "text":
              accumulatedContent += event.content;
              callbacks.onText?.(event.content, accumulatedContent);
              break;
            case "end":
              sawEnd = true;
              settled = true;
              cleanup();
              callbacks.onEnd?.(event as never);
              resolve();
              break;
            case "error":
              finishWithError(streamErrorToError(event));
              break;
            default:
              break;
          }
        });
        if (!settled) {
          if (!sawEnd) {
            finishWithError(new BibleAIClientError(
              "La respuesta se cortó antes de terminar.",
              "INCOMPLETE_STREAM",
            ));
          }
        }
      } catch (error) {
        if (settled) return;
        if (error instanceof BibleAIClientError) {
          finishWithError(error);
          return;
        }
        if (error instanceof Error && error.name === "AbortError") {
          const abortedByCaller = signal?.aborted === true;
          finishWithError(getAbortError(signal), !abortedByCaller);
          return;
        }
        finishWithError(new BibleAIClientError(connectionMessage, "CONNECTION_ERROR"));
      }
    })();
  });
}

export { buildReference } from "./passageBuilder";
