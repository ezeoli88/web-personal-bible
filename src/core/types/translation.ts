// Ported from biblia-ntv-app/src/types/translation.ts

/**
 * Traducciones en español que la app ofrece. Los códigos son los de Bolls.life
 * y los mismos que acepta el backend (server-agent-ntv-app).
 */
export const SUPPORTED_TRANSLATIONS = ["NTV", "LBLA", "RV1960", "RV2004", "PDT", "BTX3"] as const;

export type BibleTranslation = (typeof SUPPORTED_TRANSLATIONS)[number];

export const DEFAULT_TRANSLATION: BibleTranslation = "NTV";

/**
 * Traducciones que la app ya no ofrece. Bolls.life dejó de servir la NVI
 * (Biblica, Inc. pidió retirarla) y ahora devuelve un aviso en lugar del texto.
 */
export const LEGACY_TRANSLATION_MAP: Readonly<Record<string, BibleTranslation>> = {
  NVI: "NTV",
};

export const TRANSLATION_LABELS: Record<BibleTranslation, string> = {
  NTV: "Nueva Traducción Viviente",
  LBLA: "La Biblia de las Américas",
  RV1960: "Reina-Valera 1960",
  RV2004: "Reina Valera Gómez 2004",
  PDT: "Palabra de Dios para Todos",
  BTX3: "La Biblia Textual, 3.ª edición",
};

/** Crédito del texto bíblico, con el titular de los derechos cuando se pudo verificar. */
export const TRANSLATION_NOTICES: Record<BibleTranslation, string> = {
  NTV: "Texto bíblico: Nueva Traducción Viviente (NTV) © Tyndale House Foundation.",
  LBLA: "Texto bíblico: La Biblia de las Américas (LBLA) © The Lockman Foundation.",
  RV1960: "Texto bíblico: Reina-Valera 1960 (RV1960).",
  RV2004: "Texto bíblico: Reina Valera Gómez (RV2004) © Humberto Gómez Caballero.",
  PDT: "Texto bíblico: La Palabra de Dios para Todos (PDT) © Bible League International.",
  BTX3: "Texto bíblico: La Biblia Textual, 3.ª edición (BTX3) © Sociedad Bíblica Iberoamericana.",
};

export type BollsChapterEndpoint = "get-chapter" | "get-text";

/**
 * Endpoint de Bolls.life para pedir un capítulo. `get-chapter` agrega notas al
 * pie (campo `comment`). Se usa solo donde las notas son legibles: en LBLA
 * vienen mezcladas con referencias en húngaro y RV2004 no trae notas.
 */
export const TRANSLATION_CHAPTER_ENDPOINTS: Record<BibleTranslation, BollsChapterEndpoint> = {
  NTV: "get-chapter",
  LBLA: "get-text",
  RV1960: "get-text",
  RV2004: "get-text",
  PDT: "get-chapter",
  BTX3: "get-chapter",
};

export function isSupportedTranslation(value: unknown): value is BibleTranslation {
  return (
    typeof value === "string" &&
    (SUPPORTED_TRANSLATIONS as readonly string[]).includes(value)
  );
}

export function normalizeTranslation(value: unknown): BibleTranslation {
  if (isSupportedTranslation(value)) return value;
  if (typeof value === "string") {
    const upper = value.toUpperCase();
    if (isSupportedTranslation(upper)) return upper;
    const mapped = LEGACY_TRANSLATION_MAP[upper];
    if (mapped) return mapped;
  }
  return DEFAULT_TRANSLATION;
}

export function getTranslationIdPrefix(translation: BibleTranslation): string {
  return translation.toLowerCase();
}
