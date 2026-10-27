import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BIBLE_BOOKS } from "../../src/core/data/bibleStructure";
import { pageMeta } from "../../src/web/seo/pageMeta";
import { DEFAULT_DESCRIPTION, SITE_ORIGIN } from "../../src/web/seo/site";
import { renderSitemap, sitemapUrls } from "../../src/web/seo/sitemap";

describe("pageMeta", () => {
  it("names the passage of every route", () => {
    expect(pageMeta("/", "NTV").title).toBe("Biblia · Leer y estudiar en español");
    expect(pageMeta("/juan", "NTV")).toEqual({
      title: "Juan · Biblia",
      description: "Leé Juan en español: elegí uno de sus 21 capítulos.",
    });
    expect(pageMeta("/abdias", "NTV").description).toBe("Leé Abdías en español: elegí uno de su capítulo.");
    expect(pageMeta("/juan/3/versiculos", "NTV").title).toBe("Juan 3 · Versículos · Biblia");
    expect(pageMeta("/juan/3", "RV1960")).toEqual({
      title: "Juan 3 (RV1960) · Biblia",
      description: "Leé Juan 3 en la Reina-Valera 1960 y comparalo con otras traducciones en español.",
    });
    expect(pageMeta("/admin", "NTV").title).toBe("Accesos · Biblia");
    expect(pageMeta("/nada", "NTV").title).toBe("Página no encontrada · Biblia");
    expect(pageMeta("/juan/22", "NTV").title).toBe("Página no encontrada · Biblia");
  });
});

describe("sitemap and robots", () => {
  it("lists the home page, every book and every chapter", () => {
    const urls = sitemapUrls();
    const chapters = BIBLE_BOOKS.reduce((total, book) => total + book.chapters, 0);
    expect(urls).toHaveLength(1 + BIBLE_BOOKS.length + chapters);
    expect(new Set(urls).size).toBe(urls.length);
    expect(urls).toContain(`${SITE_ORIGIN}/juan/3`);
    expect(urls).toContain(`${SITE_ORIGIN}/1-corintios/13`);
    const xml = renderSitemap();
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml.match(/<loc>/g)).toHaveLength(urls.length);
    for (const url of urls) expect(url).toMatch(/^https:\/\/[a-z0-9.-]+\/[a-z0-9/-]*$/);
  });

  it("points robots.txt at the sitemap and keeps private paths out", () => {
    const robots = readFileSync(new URL("../../public/robots.txt", import.meta.url), "utf8");
    expect(robots).toContain(`Sitemap: ${SITE_ORIGIN}/sitemap.xml`);
    for (const path of ["/admin", "/api/", "/auth/"]) expect(robots).toContain(`Disallow: ${path}`);
  });

  it("ships the default description in index.html", () => {
    const html = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
    expect(html).toContain(`<meta name="description" content="${DEFAULT_DESCRIPTION}" />`);
  });
});
