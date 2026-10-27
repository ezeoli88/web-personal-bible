// Downloads OpenBible.info's cross references (CC-BY) and writes public/xrefs/<book>.json.
// Skips the download when the files already exist; `--force` rebuilds them.
// A failed download only warns: the reader hides Conexiones when the files are missing.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { strFromU8, unzipSync } from "fflate";
import { convertOpenBible, OSIS_BOOKS } from "../src/core/crossRefs/openBible";

const SOURCE = process.env.XREFS_SOURCE ?? "https://a.openbible.info/data/cross-references.zip";
const target = path.join(path.dirname(fileURLToPath(import.meta.url)), "../public/xrefs");

async function main() {
  const force = process.argv.includes("--force");
  const complete = OSIS_BOOKS.every((_, index) => existsSync(path.join(target, `${index + 1}.json`)));
  if (complete && !force) return;

  let zip: Uint8Array;
  try {
    const response = await fetch(SOURCE);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    zip = new Uint8Array(await response.arrayBuffer());
  } catch (error) {
    console.warn(`[xrefs] No se pudieron descargar las referencias cruzadas (${SOURCE}): ${String(error)}`);
    console.warn("[xrefs] El build sigue sin Conexiones. Corré `npm run gen:xrefs` cuando haya conexión.");
    return;
  }

  const files = unzipSync(zip);
  const name = Object.keys(files).find((file) => file.endsWith(".txt"));
  if (!name) throw new Error("El zip de OpenBible no trae cross_references.txt");
  const books = convertOpenBible(strFromU8(files[name]));

  mkdirSync(target, { recursive: true });
  let total = 0;
  for (let bookNumber = 1; bookNumber <= OSIS_BOOKS.length; bookNumber += 1) {
    const book = books.get(bookNumber) ?? {};
    total += Object.values(book).reduce((sum, list) => sum + list.length, 0);
    writeFileSync(path.join(target, `${bookNumber}.json`), JSON.stringify(book));
  }
  console.log(`[xrefs] ${total} conexiones escritas en public/xrefs`);
}

await main();
