// Ported from biblia-ntv-app/src/lib/wordDefinitionsCache.ts
import type { BiblePassage } from "../types/ai";

export const WORD_DEFINITION_CACHE_TTL = 5 * 60 * 1000;
export const WORD_DEFINITION_QUERY_KEY = ["word-definition", 3] as const;

export interface CachedWordDefinition {
  fullContent: string;
  notes: string[];
}

export function wordDefinitionQueryKey(passage: BiblePassage, tokenId: string) {
  return [...WORD_DEFINITION_QUERY_KEY, {
    tokenId,
    reference: passage.reference,
    translation: passage.translation,
    verses: passage.verses.map(({ id, text }) => ({ id, text })),
  }] as const;
}
