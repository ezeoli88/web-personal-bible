import { describe, expect, it, vi } from "vitest";
import { BollsBibleClient, BollsTranslationUnavailableError } from "../../src/core/api/BollsBibleClient";
import { BollsBibleRepository } from "../../src/core/repositories/BollsBibleRepository";
import type { BollsBibleClient as Client } from "../../src/core/api/BollsBibleClient";

describe("BollsBibleClient", () => {
  it("loads a chapter and rejects a takedown notice", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes("/NTV/43/3")) {
        return Response.json([{ pk: 1, verse: 16, text: "Porque", comment: "nota" }]);
      }
      return Response.json([{ pk: 1, verse: 1, text: "me prohibió usar la traducción" }]);
    });
    vi.stubGlobal("fetch", fetchMock);
    const client = new BollsBibleClient();
    await expect(client.getChapter("NTV", 43, 3)).resolves.toMatchObject([{ verse: 16, text: "Porque" }]);
    await expect(client.getChapter("NVI" as "NTV", 1, 1)).rejects.toBeInstanceOf(BollsTranslationUnavailableError);
    vi.unstubAllGlobals();
  });
});

describe("BollsBibleRepository", () => {
  const client = {
    getChapter: vi.fn(async () => [{ pk: 1, verse: 1, text: "<b>En el principio</b>", comment: "<i>nota</i>" }]),
  } as unknown as Client;

  it("lists books and chapters from the canon, not the network", async () => {
    const repository = new BollsBibleRepository(client, "NTV");
    const books = await repository.getBooks();
    expect(books).toHaveLength(66);
    expect(books[0]).toMatchObject({ name: "Génesis", testament: "AT" });
    expect(await repository.getBooks("NT")).toHaveLength(27);
    const chapters = await repository.getChaptersByBook("book-1");
    expect(chapters).toHaveLength(50);
    expect(chapters[0].id).toBe("book-1-chapter-1");
  });

  it("maps verses to plain text and walks chapter navigation", async () => {
    const repository = new BollsBibleRepository(client, "NTV");
    const verses = await repository.getVersesByChapter("book-1-chapter-1");
    expect(verses[0]).toMatchObject({ id: "ntv-1-1-1", text: "En el principio", footnote: "nota" });
    const first = await repository.getChapterNavigation("book-1-chapter-1", "book-1");
    expect(first.previous).toBeNull();
    expect(first.next?.chapterNumber).toBe(2);
    const last = await repository.getChapterNavigation("book-66-chapter-22", "book-66");
    expect(last.next).toBeNull();
    expect(last.previous?.bookName).toBe("Apocalipsis");
  });
});
