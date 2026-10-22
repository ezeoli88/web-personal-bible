import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { bollsHtmlToPlainText, bollsVerseToPlainText } from "../../src/core/lib/bollsText";
import { buildBiblePassage, buildReference, MAX_AI_VERSES } from "../../src/core/lib/passageBuilder";
import { normalizeTranslation, isSupportedTranslation } from "../../src/core/types/translation";
import { darkTheme, getTheme, lightTheme } from "../../src/core/theme";
import { parseMarkdown } from "../../src/core/lib/markdown";
import { makeBookId, makeChapterId, makeVerseId, parseBookNumber, parseChapterInfo } from "../../src/core/lib/ids";
import { bookSlug, resolveBookParam, slugifyBookName } from "../../src/core/lib/bookSlugs";
import { sanitizeReturnTo } from "../../worker/lib/returnTo";
import { logicalParent } from "../../src/web/layout/paths";
import { renderThemeCss } from "../../src/core/theme/css";
import type { Verse } from "../../src/core/types/bible";

describe("bollsText", () => {
  it("strips tags and decodes entities", () => {
    expect(bollsHtmlToPlainText("Hola<br> <b>mundo</b>&nbsp;&amp; &quot;fe&quot;")).toBe('Hola mundo & "fe"');
  });

  it("drops section headings and wrapping quotes", () => {
    const html = "'<p align='center'><b><i>Título</i></b></p> En el principio'";
    expect(bollsVerseToPlainText(html)).toBe("En el principio");
  });
});

describe("passageBuilder", () => {
  const verse = (number: number, text = `Texto ${number}`): Verse => ({
    id: `ntv-43-3-${number}`,
    chapterId: "book-43-chapter-3",
    number,
    text,
  });

  it("formats a single verse, a range and a gap", () => {
    expect(buildReference("Juan", 3, [16])).toBe("Juan 3:16");
    expect(buildReference("Juan", 3, [18, 16, 17])).toBe("Juan 3:16-18");
    expect(buildReference("Juan", 3, [16, 18])).toBe("Juan 3:16,18");
  });

  it("rejects an empty selection, the verse cap, blank text and another translation", () => {
    const base = { bookName: "Juan", chapterNumber: 3, translation: "NTV" as const };
    expect(() => buildBiblePassage({ ...base, selectedVerses: [] })).toThrow(/al menos un versículo/);
    expect(() => buildBiblePassage({
      ...base,
      selectedVerses: Array.from({ length: MAX_AI_VERSES + 1 }, (_, index) => verse(index + 1)),
    })).toThrow(/hasta 10/);
    expect(() => buildBiblePassage({ ...base, selectedVerses: [verse(1, "  ")] })).toThrow(/no contiene texto/);
    expect(() => buildBiblePassage({
      ...base,
      selectedVerses: [{ ...verse(1), id: "rv1960-43-3-1" }],
    })).toThrow(/otra traducción/);
  });

  it("builds a passage in verse order", () => {
    const passage = buildBiblePassage({
      bookName: "Juan",
      chapterNumber: 3,
      translation: "NTV",
      selectedVerses: [verse(17), verse(16)],
    });
    expect(passage.reference).toBe("Juan 3:16-17");
    expect(passage.verses.map((item) => item.id)).toEqual(["ntv-43-3-16", "ntv-43-3-17"]);
  });
});

describe("translation", () => {
  it("normalizes case, maps the retired NVI and falls back", () => {
    expect(normalizeTranslation("rv1960")).toBe("RV1960");
    expect(normalizeTranslation("NVI")).toBe("NTV");
    expect(normalizeTranslation("no-existe")).toBe("NTV");
    expect(isSupportedTranslation("PDT")).toBe(true);
    expect(isSupportedTranslation("NVI")).toBe(false);
  });
});

describe("theme", () => {
  it("keeps light and dark tokens distinct", () => {
    expect(getTheme("light")).toBe(lightTheme);
    expect(getTheme("dark")).toBe(darkTheme);
    expect(lightTheme.colors.background).not.toBe(darkTheme.colors.background);
  });
});

describe("markdown", () => {
  it("parses bold, italic and headings", () => {
    const segments = parseMarkdown("# Título\n**fuerte** y *cursiva*");
    expect(segments.some((segment) => segment.heading === 1 && segment.text === "Título")).toBe(true);
    expect(segments.some((segment) => segment.bold && segment.text === "fuerte")).toBe(true);
    expect(segments.some((segment) => segment.italic && segment.text === "cursiva")).toBe(true);
  });
});

describe("ids", () => {
  it("round-trips book, chapter and verse ids", () => {
    expect(parseBookNumber(makeBookId(43))).toBe(43);
    expect(parseChapterInfo(makeChapterId(43, 3))).toEqual({ bookNumber: 43, chapterNumber: 3 });
    expect(makeVerseId("NTV", 43, 3, 16)).toBe("ntv-43-3-16");
  });
});

describe("bookSlugs", () => {
  it("builds accent-free slugs and redirects numeric ids", () => {
    expect(slugifyBookName("Génesis")).toBe("genesis");
    expect(slugifyBookName("1 Samuel")).toBe("1-samuel");
    expect(bookSlug(43)).toBe("juan");
    expect(resolveBookParam("juan")).toMatchObject({ canonical: true, slug: "juan" });
    expect(resolveBookParam("43")).toMatchObject({ canonical: false, slug: "juan" });
    expect(resolveBookParam("no-existe")).toBeNull();
    expect(resolveBookParam("999")).toBeNull();
  });
});

describe("returnTo", () => {
  it("allows a relative path and rejects open redirects", () => {
    expect(sanitizeReturnTo(null)).toBe("/");
    expect(sanitizeReturnTo("/juan/3?v=16")).toBe("/juan/3?v=16");
    expect(sanitizeReturnTo("//evil.com")).toBe("/");
    expect(sanitizeReturnTo("https://evil.com")).toBe("/");
    expect(sanitizeReturnTo("/\\evil")).toBe("/");
    expect(sanitizeReturnTo("/juan/3\nSet-Cookie")).toBe("/");
    expect(sanitizeReturnTo("%2F%2Fevil.com")).toBe("/");
  });
});

describe("logicalParent", () => {
  it("walks back to the previous screen", () => {
    expect(logicalParent("/")).toBeNull();
    expect(logicalParent("/juan")).toBe("/");
    expect(logicalParent("/juan/3/versiculos")).toBe("/juan");
    expect(logicalParent("/juan/3")).toBe("/juan/3/versiculos");
    expect(logicalParent("/admin")).toBe("/");
  });
});

describe("theme.css", () => {
  it("matches the generator output", () => {
    const generated = readFileSync(new URL("../../src/styles/theme.css", import.meta.url), "utf8").replace(/\r\n/g, "\n");
    expect(generated).toBe(renderThemeCss());
  });
});
