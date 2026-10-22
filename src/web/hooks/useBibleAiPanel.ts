import { useCallback, useEffect, useRef, useState } from "react";
import {
  askBibleAIStream,
  BibleAIClientError,
  getBibleAIMenu,
} from "../../core/lib/aiClient";
import { useWordsAnalysis } from "../../core/hooks/useWordsAnalysis";
import { AI_MODE_LABELS, type AIMenuOption, type AIMode, type BiblePassage } from "../../core/types/ai";
import { TRANSLATION_LABELS } from "../../core/types/translation";
import { isOnline } from "../../platform/network";
import { copyText } from "../../platform/clipboard";
import { notify } from "../../platform/notify";

export type PanelAccess = "loading" | "anonymous" | "denied" | "allowed";

export type PanelView =
  | "auth-loading"
  | "login-required"
  | "not-allowed"
  | "menu-loading"
  | "menu-error"
  | "menu"
  | "loading"
  | "streaming"
  | "response"
  | "words";

export function useBibleAiPanel(options: {
  open: boolean;
  passage: BiblePassage | null;
  access: PanelAccess;
}) {
  const { open, passage, access } = options;
  const [viewState, setViewState] = useState<PanelView>("menu-loading");
  const [currentMode, setCurrentMode] = useState<AIMode | null>(null);
  const [menuOptions, setMenuOptions] = useState<AIMenuOption[]>([]);
  const [menuTitle, setMenuTitle] = useState("¿Qué te gustaría saber?");
  const [menuFooter, setMenuFooter] = useState("");
  const [response, setResponse] = useState("");
  const [notes, setNotes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const requestControllerRef = useRef<AbortController | null>(null);
  const words = useWordsAnalysis();

  const explain = useCallback((requestError: Error): string => {
    if (requestError instanceof BibleAIClientError && requestError.code === "INVALID_TRANSLATION" && passage) {
      const label = TRANSLATION_LABELS[passage.translation] ?? passage.translation;
      return `La IA todavía no está disponible para ${label} (${passage.translation}). ` +
        "Podés seguir leyendo o elegir otra traducción.";
    }
    return requestError.message;
  }, [passage]);

  const stopRequest = useCallback(() => {
    requestControllerRef.current?.abort();
    requestControllerRef.current = null;
  }, []);

  const applyAccessError = useCallback((requestError: unknown): boolean => {
    if (!(requestError instanceof BibleAIClientError)) return false;
    if (requestError.code === "UNAUTHENTICATED") {
      setViewState("login-required");
      return true;
    }
    if (requestError.code === "NOT_ALLOWED") {
      setViewState("not-allowed");
      return true;
    }
    return false;
  }, []);

  const loadMenu = useCallback(async () => {
    if (!passage) return;
    stopRequest();
    const controller = new AbortController();
    requestControllerRef.current = controller;
    setViewState("menu-loading");
    setError(null);
    setNotes([]);
    try {
      const menu = await getBibleAIMenu(passage, { signal: controller.signal });
      if (requestControllerRef.current !== controller) return;
      setMenuOptions(menu.options);
      setMenuTitle(menu.title || "¿Qué te gustaría saber?");
      setMenuFooter(menu.footer || "");
      setViewState("menu");
    } catch (requestError) {
      if (requestError instanceof BibleAIClientError && requestError.code === "REQUEST_ABORTED") return;
      if (applyAccessError(requestError)) return;
      const normalized = requestError instanceof Error ? requestError : new Error("No se pudo cargar el menú.");
      setError(explain(normalized));
      setViewState("menu-error");
    } finally {
      if (requestControllerRef.current === controller) requestControllerRef.current = null;
    }
  }, [applyAccessError, explain, passage, stopRequest]);

  useEffect(() => {
    if (!open) return;
    if (access === "loading") {
      setViewState("auth-loading");
      return;
    }
    if (access === "anonymous") {
      setViewState("login-required");
      return;
    }
    if (access === "denied") {
      setViewState("not-allowed");
      return;
    }
    if (!passage) return;
    void loadMenu();
    return () => {
      stopRequest();
    };
  }, [access, loadMenu, open, passage, stopRequest]);

  const selectMode = useCallback(async (mode: AIMode) => {
    if (!passage) return;
    if (!(await isOnline())) {
      notify("Sin conexión", "Necesitás conexión a internet para usar la IA.");
      return;
    }
    setCurrentMode(mode);
    setError(null);
    setResponse("");
    setNotes([]);
    if (mode === "words") {
      words.reset();
      setViewState("words");
      await words.startIdentification(passage);
      return;
    }
    stopRequest();
    const controller = new AbortController();
    requestControllerRef.current = controller;
    setViewState("loading");
    try {
      await askBibleAIStream(passage, mode, {
        onStart: () => setViewState("streaming"),
        onText: (_chunk, accumulated) => setResponse(accumulated),
        onEnd: (event) => {
          setResponse(event.fullContent);
          setNotes(event.notes || []);
          setViewState("response");
        },
        onError: (requestError) => {
          if (applyAccessError(requestError)) return;
          setError(explain(requestError));
          setViewState("response");
        },
      }, { signal: controller.signal });
    } catch (requestError) {
      if (requestError instanceof BibleAIClientError && requestError.code === "REQUEST_ABORTED") return;
      if (!applyAccessError(requestError)) setViewState("response");
    } finally {
      if (requestControllerRef.current === controller) requestControllerRef.current = null;
    }
  }, [applyAccessError, explain, passage, stopRequest, words]);

  const backToMenu = useCallback(() => {
    stopRequest();
    setViewState("menu");
    setResponse("");
    setNotes([]);
    setError(null);
    setCurrentMode(null);
    words.reset();
  }, [stopRequest, words]);

  const copyResponse = useCallback(async () => {
    if (!response) return;
    try {
      await copyText(response);
      notify("Copiado", "La respuesta se copió al portapapeles.");
    } catch (copyError) {
      notify("No se pudo copiar", copyError instanceof Error ? copyError.message : "Probá de nuevo.");
    }
  }, [response]);

  return {
    viewState,
    currentMode,
    menuOptions,
    menuTitle,
    menuFooter,
    response,
    notes,
    error,
    words,
    labels: AI_MODE_LABELS,
    loadMenu,
    selectMode,
    backToMenu,
    copyResponse,
  };
}
