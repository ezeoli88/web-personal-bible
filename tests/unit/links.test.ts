import { afterEach, describe, expect, it, vi } from "vitest";
import type { Verse } from "../../src/core/types/bible";
import { shareOrCopy } from "../../src/platform/share";
import { formatVerseParam, parseVerseParam, validateReaderSearch } from "../../src/web/layout/bookRoute";
import { buildVerseShare } from "../../src/web/share/verseShare";

const verse = (number: number, text: string): Verse => ({
  id: `ntv-43-3-${number}`,
  chapterId: "book-43-chapter-3",
  number,
  text,
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("reader links", () => {
  it("parses one verse, ranges and lists", () => {
    expect(parseVerseParam(16)).toEqual([16]);
    expect(parseVerseParam("16")).toEqual([16]);
    expect(parseVerseParam("16-18")).toEqual([16, 17, 18]);
    expect(parseVerseParam("5, 1-3,2")).toEqual([1, 2, 3, 5]);
    for (const invalid of [0, -1, "", "16-", "18-16", "1,,2", "a", "1-500", 1.5]) {
      expect(parseVerseParam(invalid)).toBeUndefined();
    }
  });

  it("formats verses back to the shortest param", () => {
    expect(formatVerseParam([])).toBeUndefined();
    expect(formatVerseParam([16])).toBe(16);
    expect(formatVerseParam([18, 16, 17])).toBe("16-18");
    expect(formatVerseParam([1, 2, 3, 5])).toBe("1-3,5");
  });

  it("keeps only valid verses and translations in the search", () => {
    expect(validateReaderSearch({ v: "16-17", t: "RV1960" })).toEqual({ v: "16-17", t: "RV1960" });
    expect(validateReaderSearch({ v: "x", t: "NVI" })).toEqual({ v: undefined, t: undefined });
    expect(validateReaderSearch({ v: "3,1,2" })).toEqual({ v: "1-3", t: undefined });
  });
});

describe("verse sharing", () => {
  it("builds the text without footnote markers and a link with verses and translation", () => {
    const payload = buildVerseShare({
      bookName: "Juan",
      chapterNumber: 3,
      slug: "juan",
      translation: "NTV",
      verses: [verse(18, "No hay condenación."), verse(16, "Porque tanto amó Dios [1] al mundo.")],
      origin: "https://biblia.example",
    });
    expect(payload).toEqual({
      title: "Juan 3:16, 18 (NTV)",
      text: "«16 Porque tanto amó Dios al mundo. 18 No hay condenación.»\nJuan 3:16, 18 (NTV)",
      url: "https://biblia.example/juan/3?v=16,18&t=NTV",
    });
  });

  it("uses the share sheet when it exists and the clipboard otherwise", async () => {
    const payload = { title: "Juan 3:16 (NTV)", text: "«Texto»\nJuan 3:16 (NTV)", url: "https://biblia.example/juan/3?v=16&t=NTV" };
    const share = vi.fn(async () => {});
    const writeText = vi.fn(async () => {});
    vi.stubGlobal("navigator", { share, clipboard: { writeText } });
    await expect(shareOrCopy(payload)).resolves.toBe("shared");
    expect(share).toHaveBeenCalledWith(payload);

    share.mockRejectedValueOnce(new DOMException("cancelado", "AbortError"));
    await expect(shareOrCopy(payload)).resolves.toBe("cancelled");
    expect(writeText).not.toHaveBeenCalled();

    vi.stubGlobal("navigator", { clipboard: { writeText } });
    await expect(shareOrCopy(payload)).resolves.toBe("copied");
    expect(writeText).toHaveBeenCalledWith(`${payload.text}\n${payload.url}`);
  });
});
