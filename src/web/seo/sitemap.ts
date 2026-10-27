import { BIBLE_BOOKS } from "../../core/data/bibleStructure";
import { slugifyBookName } from "../../core/lib/bookSlugs";
import { SITE_ORIGIN } from "./site";

/** Home, every book and every chapter. Slugs are [a-z0-9-], so they need no XML escaping. */
export function sitemapUrls(): string[] {
  const urls = [`${SITE_ORIGIN}/`];
  for (const book of BIBLE_BOOKS) {
    const slug = slugifyBookName(book.name);
    urls.push(`${SITE_ORIGIN}/${slug}`);
    for (let chapter = 1; chapter <= book.chapters; chapter += 1) urls.push(`${SITE_ORIGIN}/${slug}/${chapter}`);
  }
  return urls;
}

export function renderSitemap(): string {
  const entries = sitemapUrls().map((url) => `  <url><loc>${url}</loc></url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;
}
