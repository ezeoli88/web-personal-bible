import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderThemeCss } from "../src/core/theme/css";

export function themeCssPath(): string {
  return path.join(path.dirname(fileURLToPath(import.meta.url)), "../src/styles/theme.css");
}

function isDirectRun(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  return path.resolve(entry) === fileURLToPath(import.meta.url);
}

if (isDirectRun()) {
  const target = themeCssPath();
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, renderThemeCss(), "utf8");
}
