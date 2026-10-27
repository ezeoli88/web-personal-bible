/** Lowercase without accents, keeping a map from each folded character to its place in the original. */
function fold(text: string): { folded: string; origin: number[] } {
  let folded = "";
  const origin: number[] = [];
  for (let index = 0; index < text.length; index += 1) {
    const base = text[index].normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
    for (const char of base) {
      folded += char;
      origin.push(index);
    }
  }
  return { folded, origin };
}

export function foldText(text: string): string {
  return fold(text).folded;
}

/** Short words that would mark half of every verse if highlighted on their own. */
const STOPWORDS = new Set(["del", "las", "los", "una", "uno", "que", "con", "por", "para", "sus", "les", "como", "pero", "sin", "mas"]);

/** The whole query, plus each meaningful word (three letters or more) when the query has several. */
export function searchTerms(query: string): string[] {
  const whole = foldText(query.trim().replace(/\s+/g, " "));
  if (!whole) return [];
  const words = whole.split(" ").filter((word) => word.length >= 3 && !STOPWORDS.has(word));
  return [...new Set([whole, ...(whole.includes(" ") ? words : [])])];
}

export interface TextPart {
  text: string;
  match: boolean;
}

/**
 * Splits `text` into the parts that match one of `terms` and the rest, ignoring
 * case and accents: «amo» marks «amó». The longest term wins where two overlap.
 */
export function splitMatches(text: string, terms: string[]): TextPart[] {
  const { folded, origin } = fold(text);
  const marked = new Array<boolean>(text.length).fill(false);
  for (const term of [...terms].sort((a, b) => b.length - a.length)) {
    if (!term) continue;
    let from = 0;
    let at: number;
    while ((at = folded.indexOf(term, from)) >= 0) {
      const start = origin[at];
      const end = origin[at + term.length - 1];
      for (let index = start; index <= end; index += 1) marked[index] = true;
      from = at + term.length;
    }
  }
  const parts: TextPart[] = [];
  for (let index = 0; index < text.length; index += 1) {
    const last = parts[parts.length - 1];
    if (last && last.match === marked[index]) last.text += text[index];
    else parts.push({ text: text[index], match: marked[index] });
  }
  return parts;
}
