import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { askBibleAIStream, BibleAIClientError } from "../../core/lib/aiClient";
import { AI_MENU, AI_MODE_LABELS, type AIMode, type BiblePassage, type GroupDuration } from "../../core/types/ai";
import { TRANSLATION_LABELS } from "../../core/types/translation";
import { isOnline } from "../../platform/network";
import { copyText } from "../../platform/clipboard";
import { notify } from "../../platform/notify";
import { meQueryKey } from "../auth/useMe";
import { useAskPassage } from "./useAskPassage";

export type PanelAccess = "loading" | "anonymous" | "denied" | "allowed";

export type PanelView =
  | "auth-loading"
  | "login-required"
  | "not-allowed"
  | "menu"
  | "loading"
  | "streaming"
  | "response"
  | "ask"
  | "group-setup";

export function useBibleAiPanel(options: {
  open: boolean;
  passage: BiblePassage | null;
  access: PanelAccess;
}) {
  const { open, passage, access } = options;
  const [viewState, setViewState] = useState<PanelView>("auth-loading");
  const [currentMode, setCurrentMode] = useState<AIMode | null>(null);
  const [response, setResponse] = useState("");
  const [notes, setNotes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [stopped, setStopped] = useState(false);
  const requestControllerRef = useRef<AbortController | null>(null);
  const queryClient = useQueryClient();

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

  const chat = useAskPassage({ passage, onAccessError: applyAccessError });
  const resetChat = chat.reset;

  // Each AI request uses the monthly quota: refresh it when the panel closes.
  useEffect(() => {
    if (!open) return;
    return () => {
      void queryClient.invalidateQueries({ queryKey: meQueryKey });
    };
  }, [open, queryClient]);

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
    // The menu is static: an expired session or an unsupported translation
    // surfaces when a mode is requested.
    stopRequest();
    setError(null);
    setNotes([]);
    setViewState("menu");
    return () => {
      stopRequest();
      resetChat();
    };
  }, [access, open, passage, resetChat, stopRequest]);

  /** `duration` is required for the group guide: without it the panel asks for one. */
  const selectMode = useCallback(async (mode: AIMode, duration?: GroupDuration) => {
    if (!passage) return;
    if (!(await isOnline())) {
      notify("Sin conexión", "Necesitás conexión a internet para usar la IA.");
      return;
    }
    setCurrentMode(mode);
    setError(null);
    setResponse("");
    setNotes([]);
    setStopped(false);
    if (mode === "group" && !duration) {
      setViewState("group-setup");
      return;
    }
    if (mode === "ask") {
      resetChat();
      setViewState("ask");
      return;
    }
    stopRequest();
    const controller = new AbortController();
    requestControllerRef.current = controller;
    setViewState("loading");
    try {
      await askBibleAIStream(passage, mode, {
        onStart: () => {
          if (requestControllerRef.current === controller) setViewState("streaming");
        },
        onText: (_chunk, accumulated) => {
          if (requestControllerRef.current === controller) setResponse(accumulated);
        },
        onEnd: (event) => {
          if (requestControllerRef.current !== controller) return;
          setResponse(event.fullContent);
          setNotes(event.notes || []);
          setViewState("response");
        },
        onError: (requestError) => {
          if (requestControllerRef.current !== controller) return;
          if (applyAccessError(requestError)) return;
          setError(explain(requestError));
          setViewState("response");
        },
      }, { signal: controller.signal, duration });
    } catch (requestError) {
      if (requestError instanceof BibleAIClientError && requestError.code === "REQUEST_ABORTED") return;
      if (requestControllerRef.current !== controller) return;
      if (!applyAccessError(requestError)) setViewState("response");
    } finally {
      if (requestControllerRef.current === controller) requestControllerRef.current = null;
    }
  }, [applyAccessError, explain, passage, resetChat, stopRequest]);

  const backToMenu = useCallback(() => {
    stopRequest();
    setViewState("menu");
    setResponse("");
    setNotes([]);
    setError(null);
    setStopped(false);
    setCurrentMode(null);
    resetChat();
  }, [resetChat, stopRequest]);

  const stopResponse = useCallback(() => {
    if (!response) {
      backToMenu();
      return;
    }
    stopRequest();
    setStopped(true);
    setViewState("response");
  }, [backToMenu, response, stopRequest]);

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
    menuOptions: AI_MENU.options,
    menuTitle: AI_MENU.title,
    menuFooter: AI_MENU.footer,
    response,
    notes,
    error,
    stopped,
    chat,
    labels: AI_MODE_LABELS,
    selectMode,
    backToMenu,
    stopResponse,
    copyResponse,
  };
}
