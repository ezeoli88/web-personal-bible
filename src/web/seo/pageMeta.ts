import { bookFromSlug } from "../../core/lib/bookSlugs";
import { TRANSLATION_LABELS, type BibleTranslation } from "../../core/types/translation";
import { DEFAULT_DESCRIPTION, SITE_NAME } from "./site";

export interface PageMeta {
  title: string;
  description: string;
}

const notFound: PageMeta = { title: `Página no encontrada · ${SITE_NAME}`, description: DEFAULT_DESCRIPTION };

/** Title and description for each route, so tabs, history and search results name the passage. */
export function pageMeta(pathname: string, translation: BibleTranslation): PageMeta {
  const [bookParam, chapterParam, leaf] = pathname.split("/").filter(Boolean);
  if (!bookParam) return { title: `${SITE_NAME} · Leer y estudiar en español`, description: DEFAULT_DESCRIPTION };
  if (bookParam === "admin") return { title: `Accesos · ${SITE_NAME}`, description: DEFAULT_DESCRIPTION };
  if (bookParam === "buscar") {
    return { title: `Buscar · ${SITE_NAME}`, description: "Buscá una palabra o frase en la Biblia." };
  }
  if (bookParam === "guardados") {
    return { title: `Guardados · ${SITE_NAME}`, description: "Tus marcadores, subrayados y notas." };
  }
  const book = bookFromSlug(bookParam);
  if (!book) return notFound;
  if (!chapterParam) {
    const chapters = book.chapters === 1 ? "su capítulo" : `sus ${book.chapters} capítulos`;
    return {
      title: `${book.name} · ${SITE_NAME}`,
      description: `Leé ${book.name} en español: elegí uno de ${chapters}.`,
    };
  }
  const chapter = Number(chapterParam);
  if (!Number.isInteger(chapter) || chapter < 1 || chapter > book.chapters) return notFound;
  if (leaf === "versiculos") {
    return {
      title: `${book.name} ${chapter} · Versículos · ${SITE_NAME}`,
      description: `Elegí un versículo de ${book.name} ${chapter}.`,
    };
  }
  return {
    title: `${book.name} ${chapter} (${translation}) · ${SITE_NAME}`,
    description: `Leé ${book.name} ${chapter} en la ${TRANSLATION_LABELS[translation]} y comparalo con otras traducciones en español.`,
  };
}
