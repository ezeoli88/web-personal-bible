// Ported from biblia-ntv-app/src/hooks/DatabaseProvider.tsx
// Adapted: the translation is stored in localStorage under `bible-translation` and validated.
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { BollsBibleRepository } from "../repositories/BollsBibleRepository";
import { BollsBibleClient } from "../api/BollsBibleClient";
import type { BibleRepository } from "../repositories/BibleRepository";
import {
  normalizeTranslation,
  SUPPORTED_TRANSLATIONS,
  type BibleTranslation,
} from "../types/translation";
import { readStorage, writeStorage } from "../../platform/storage";

const STORAGE_KEY = "bible-translation";

interface DatabaseContextValue {
  repository: BibleRepository;
  /** Repositorio de otra traducción, sin cambiar la elegida (p.ej. para comparar versículos). */
  getRepository: (translation: BibleTranslation) => BibleRepository;
  translation: BibleTranslation;
  availableTranslations: BibleTranslation[];
  setTranslation: (translation: BibleTranslation | string) => Promise<void>;
  isLoading: boolean;
  error: Error | null;
}

const bollsClient = new BollsBibleClient();
const DatabaseContext = createContext<DatabaseContextValue | undefined>(undefined);
const AVAILABLE_TRANSLATIONS: BibleTranslation[] = [...SUPPORTED_TRANSLATIONS];
const repositories = new Map<BibleTranslation, BibleRepository>();

function getRepository(translation: BibleTranslation): BibleRepository {
  let repository = repositories.get(translation);
  if (!repository) {
    repository = new BollsBibleRepository(bollsClient, translation);
    repositories.set(translation, repository);
  }
  return repository;
}

function readInitialTranslation(): BibleTranslation {
  return normalizeTranslation(readStorage(STORAGE_KEY));
}

export function DatabaseProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [translation, setTranslationState] = useState<BibleTranslation>(readInitialTranslation);

  const repository = useMemo(() => getRepository(translation), [translation]);

  const setTranslation = useCallback(async (requestedTranslation: BibleTranslation | string) => {
    const nextTranslation = normalizeTranslation(requestedTranslation);
    if (nextTranslation === translation || !AVAILABLE_TRANSLATIONS.includes(nextTranslation)) return;
    await queryClient.cancelQueries({ queryKey: ["verses"] });
    writeStorage(STORAGE_KEY, nextTranslation);
    setTranslationState(nextTranslation);
  }, [queryClient, translation]);

  const value = useMemo<DatabaseContextValue>(() => ({
    repository,
    getRepository,
    translation,
    availableTranslations: AVAILABLE_TRANSLATIONS,
    setTranslation,
    isLoading: false,
    error: null,
  }), [repository, setTranslation, translation]);

  return <DatabaseContext.Provider value={value}>{children}</DatabaseContext.Provider>;
}

export function useBibleRepository() {
  const context = useContext(DatabaseContext);
  if (!context) throw new Error("useBibleRepository debe usarse dentro de DatabaseProvider");
  return context;
}
