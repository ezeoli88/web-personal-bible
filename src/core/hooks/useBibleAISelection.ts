// Ported from biblia-ntv-app/src/hooks/useBibleAISelection.ts
import { useCallback, useMemo, useState } from "react";
import type { Verse } from "../types/bible";
import { MAX_AI_VERSES } from "../lib/passageBuilder";

interface UseBibleAISelectionReturn {
  selectedIds: Set<string>;
  selectedVerses: Verse[];
  isSelectionActive: boolean;
  isAtLimit: boolean;
  maxSelectable: number;
  toggleVerse: (verse: Verse) => void;
  startSelection: (verse: Verse) => void;
  clearSelection: () => void;
  isSelected: (verseId: string) => boolean;
}

export function useBibleAISelection(allVerses: Verse[]): UseBibleAISelectionReturn {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const selectedVerses = useMemo(() => {
    return allVerses
      .filter((verse) => selectedIds.has(verse.id))
      .sort((left, right) => left.number - right.number);
  }, [allVerses, selectedIds]);

  const isSelectionActive = selectedIds.size > 0;
  const isAtLimit = selectedIds.size >= MAX_AI_VERSES;

  const toggleVerse = useCallback((verse: Verse) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(verse.id)) next.delete(verse.id);
      else if (next.size < MAX_AI_VERSES) next.add(verse.id);
      return next;
    });
  }, []);

  const startSelection = useCallback((verse: Verse) => {
    setSelectedIds(new Set([verse.id]));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const isSelected = useCallback((verseId: string) => selectedIds.has(verseId), [selectedIds]);

  return {
    selectedIds,
    selectedVerses,
    isSelectionActive,
    isAtLimit,
    maxSelectable: MAX_AI_VERSES,
    toggleVerse,
    startSelection,
    clearSelection,
    isSelected,
  };
}
