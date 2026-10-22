// Ported from biblia-ntv-app/src/lib/bollsText.ts

export function bollsHtmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/** `<p ...>` cuyo contenido está todo en negrita/cursiva: un título de sección. */
const SECTION_HEADING =
  /<p\b[^>]*>\s*(?:<(?:b|i|strong|em)\b[^>]*>\s*)+[^<]*(?:<\/(?:b|i|strong|em)>\s*)+<\/p>/gi;

/**
 * Limpia el texto de un versículo de Bolls.life.
 * Además de quitar el HTML, resuelve dos rarezas de algunas traducciones (PDT):
 * - Títulos de sección incrustados como `<p align='center'><b><i>Título</i></b></p>`,
 *   que se quitan para que no queden pegados al versículo ni se manden a la IA.
 * - El texto completo envuelto entre comillas simples (`'...'`), que se quitan.
 */
export function bollsVerseToPlainText(html: string): string {
  let text = html.trim();
  if (text.length >= 2 && text.startsWith("'") && text.endsWith("'")) {
    text = text.slice(1, -1);
  }
  const withoutHeadings = text.replace(SECTION_HEADING, " ");
  return bollsHtmlToPlainText(withoutHeadings) || bollsHtmlToPlainText(text);
}
