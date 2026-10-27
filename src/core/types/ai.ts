// Ported from biblia-ntv-app/src/types/ai.ts
import type { BibleTranslation } from "./translation";

export interface BiblePassage {
  reference: string;
  translation: BibleTranslation;
  verses: Array<{
    id: string;
    text: string;
  }>;
}

export type AIMode = "reflection" | "history" | "words" | "structure" | "ask";

/** One earlier turn of a conversation about a passage. */
export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface AIMenuOption {
  id: AIMode;
  label: string;
  hint: string;
}

export interface AIMenuResponse {
  type: "menu";
  title: string;
  options: AIMenuOption[];
  footer: string;
}

export interface BibleAIRequest {
  passage: BiblePassage;
  mode: AIMode | "menu";
  step?: WordsStep;
}

export interface BibleAIResponse {
  type: "answer";
  content: string;
}

export interface BibleAIError {
  type: "error";
  message: string;
}

export interface StreamStartEvent {
  type: "start";
  mode: AIMode;
  step?: WordsStep;
  reference?: string;
}

export interface StreamTextEvent {
  type: "text";
  content: string;
}

export interface StreamEndEvent {
  type: "end";
  mode: AIMode;
  step?: WordsStep;
  fullContent: string;
  notes?: string[];
}

export interface StreamErrorEvent {
  type: "error";
  error?: string;
  message?: string;
  code?: string;
}

export type StreamEvent = StreamStartEvent | StreamTextEvent | StreamEndEvent | StreamErrorEvent;

export type WordsStep = "identify" | "define";
export type WordsLanguage = "hebrew" | "greek";

export interface IdentifiedWord {
  tokenId?: string;
  spanish: string;
  original: string;
  transliteration: string;
  language: WordsLanguage;
  hint: string;
}

export interface IdentifiedWordLexicon extends IdentifiedWord {
  tokenId: string;
  reference: string;
  isKeyword: boolean;
  lemma: string;
  strong: string | null;
  pos: string;
  parsing: string;
}

export interface WordsIdentifyResponse {
  type: "words-identification";
  mode: "words";
  step: "identify";
  reference?: string;
  language?: WordsLanguage;
  words: IdentifiedWord[] | IdentifiedWordLexicon[];
  maxSelectable: number;
  source?: "lexicon" | "llm";
}

export interface WordsDefineStartEvent {
  type: "start";
  mode: "words";
  step: "define";
  reference?: string;
  selectedTokenIds?: string[];
}

export interface WordsDefineTextEvent {
  type: "text";
  content: string;
}

export interface WordsDefineEndEvent {
  type: "end";
  mode: "words";
  step: "define";
  fullContent: string;
  notes?: string[];
}

export interface WordsDefineErrorEvent {
  type: "error";
  error?: string;
  message?: string;
  code?: string;
}

export type WordsDefineEvent =
  | WordsDefineStartEvent
  | WordsDefineTextEvent
  | WordsDefineEndEvent
  | WordsDefineErrorEvent;

export interface WordEntry extends IdentifiedWord {
  reference?: string;
  isKeyword?: boolean;
  lemma?: string;
  strong?: string | null;
  pos?: string;
  parsing?: string;
}

export interface APIError {
  error?: string;
  message?: string;
  code: string;
  details?: string;
  fallbackAvailable?: boolean;
}

export interface StreamCallbacks {
  onStart?: (event: StreamStartEvent) => void;
  onText?: (content: string, accumulated: string) => void;
  onEnd?: (event: StreamEndEvent) => void;
  onError?: (error: Error) => void;
}

export const AI_MODE_LABELS: Record<AIMode, { emoji: string; label: string; description: string }> = {
  reflection: {
    emoji: "💭",
    label: "Reflexión",
    description: "Una reflexión devocional sobre este pasaje",
  },
  history: {
    emoji: "📜",
    label: "Contexto histórico",
    description: "El trasfondo histórico y cultural",
  },
  words: {
    emoji: "🔤",
    label: "Palabras clave",
    description: "Significado de palabras importantes en griego/hebreo",
  },
  structure: {
    emoji: "🏗️",
    label: "Estructura",
    description: "Análisis de la estructura literaria",
  },
  ask: {
    emoji: "💬",
    label: "Preguntale al pasaje",
    description: "Tus preguntas, respondidas desde el texto",
  },
};

/**
 * Same content as logosagent-api's fixed MENU_RESPONSE, plus «Preguntale al pasaje»,
 * which the web opens as a chat instead of a single answer.
 */
export const AI_MENU: AIMenuResponse = {
  type: "menu",
  title: "¿Qué te gustaría hacer con este pasaje?",
  options: [
    { id: "ask", label: "Preguntale al pasaje", hint: "Hacé tus preguntas y seguí la conversación" },
    { id: "reflection", label: "Reflexión breve", hint: "Idea + aplicación + pregunta" },
    { id: "history", label: "Contexto histórico", hint: "2–4 puntos culturales/históricos" },
    { id: "words", label: "Palabras clave (hebreo/griego)", hint: "Palabras por versículo y sus significados" },
    { id: "structure", label: "Estructura / idea central", hint: "Cómo se organiza el argumento" },
  ],
  footer: "Elegí una opción para continuar.",
};

/** A word's card from the lexicon, with where else it appears (no AI involved). */
export interface WordStudyResponse {
  type: "word-study";
  mode: "words";
  step: "study";
  reference?: string;
  word: {
    tokenId: string;
    reference: string;
    original: string;
    lemma: string;
    transliteration: string;
    strong: string | null;
    pos: string;
    parsing: string;
    def: string;
    language: WordsLanguage;
  };
  occurrences: {
    by: "strong" | "lemma";
    total: number;
    verses: number;
    testament: "OT" | "NT";
    /** Most frequent first; bookNumber is 1–66 as in bolls.life. */
    byBook: Array<{ book: string; bookNumber: number; count: number }>;
    examples: Array<{ reference: string; bookNumber: number; chapter: number; verse: number }>;
  };
}
