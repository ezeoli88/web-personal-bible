// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useBibleAISelection } from "../../src/core/hooks/useBibleAISelection";
import type { Verse } from "../../src/core/types/bible";

const verses: Verse[] = Array.from({ length: 11 }, (_, index) => ({
  id: `ntv-43-3-${index + 1}`,
  chapterId: "book-43-chapter-3",
  number: index + 1,
  text: `Versículo ${index + 1}`,
}));

describe("useBibleAISelection", () => {
  it("starts, toggles and stops at ten verses", () => {
    const { result } = renderHook(() => useBibleAISelection(verses));
    act(() => result.current.startSelection(verses[0]));
    expect(result.current.isSelectionActive).toBe(true);
    expect(result.current.selectedVerses.map((verse) => verse.number)).toEqual([1]);

    act(() => {
      for (const verse of verses.slice(1)) result.current.toggleVerse(verse);
    });
    expect(result.current.selectedVerses).toHaveLength(10);
    expect(result.current.isAtLimit).toBe(true);
    expect(result.current.isSelected(verses[10].id)).toBe(false);

    act(() => result.current.toggleVerse(verses[0]));
    expect(result.current.isSelected(verses[0].id)).toBe(false);
    act(() => result.current.clearSelection());
    expect(result.current.isSelectionActive).toBe(false);
  });
});
