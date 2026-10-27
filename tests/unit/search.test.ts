import { afterEach, describe, expect, it, vi } from "vitest";
import { BollsBibleClient } from "../../src/core/api/BollsBibleClient";
import { searchTerms, splitMatches } from "../../src/web/search/textMatch";

afterEach(() => vi.unstubAllGlobals());

describe("search text matching", () => {
  it("marks matches ignoring case and accents, and each word of a phrase", () => {
    expect(splitMatches("Pues Dios amó tanto al mundo", searchTerms("AMO"))).toEqual([
      { text: "Pues Dios ", match: false },
      { text: "amó", match: true },
      { text: " tanto al mundo", match: false },
    ]);
    expect(searchTerms("luz  del mundo")).toEqual(["luz del mundo", "luz", "mundo"]);
    const parts = splitMatches("Yo soy la luz del mundo; ustedes son luz", searchTerms("luz del mundo"));
    expect(parts.filter((part) => part.match).map((part) => part.text)).toEqual(["luz del mundo", "luz"]);
    expect(searchTerms("   ")).toEqual([]);
  });
});

describe("BollsBibleClient.search", () => {
  it("calls /v2/find and reads both the v2 object and a bare list", async () => {
    const urls: string[] = [];
    const verse = { pk: 1, translation: "NTV", book: 43, chapter: 8, verse: 12, text: "Yo soy la <mark>luz</mark> del mundo" };
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo) => {
      urls.push(String(input));
      return urls.length === 1
        ? Response.json({ exact_matches: 7, results: [verse, { pk: 2, text: "sin libro" }] })
        : Response.json([verse]);
    }));
    const client = new BollsBibleClient();
    await expect(client.search("NTV", "luz del")).resolves.toEqual({ exactMatches: 7, verses: [verse] });
    expect(urls[0]).toBe("https://bolls.life/v2/find/NTV?search=luz+del&match_case=false&match_whole=false");
    await expect(client.search("NTV", "luz")).resolves.toEqual({ exactMatches: 1, verses: [verse] });
  });
});
