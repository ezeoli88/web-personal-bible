import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, sep } from "node:path";

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else out.push(path);
  }
  return out;
}

function fail(problems) {
  console.error("PWA build check failed:");
  for (const problem of problems) console.error(`- ${problem}`);
  process.exit(1);
}

const files = walk("dist");
const swPath = files.find((file) => file.endsWith("/sw.js") || file.endsWith("\\sw.js"));
const manifestPath = files.find((file) => file.endsWith("manifest.webmanifest"));
const htmlPath = files.find((file) => file.endsWith("/index.html") || file.endsWith("\\index.html"));

if (!swPath || !manifestPath || !htmlPath) {
  fail([`missing build output (sw=${swPath ?? "none"}, manifest=${manifestPath ?? "none"}, html=${htmlPath ?? "none"})`]);
}

const sw = readFileSync(swPath, "utf8");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const html = readFileSync(htmlPath, "utf8");
const problems = [];

function sourceHasPattern(segment) {
  return sw.includes(`/^\\/${segment}\\//`) || sw.includes(`"^/${segment}/"`) || sw.includes(`^/${segment}/`);
}

if (!sw.includes("denylist")) problems.push(`${swPath} has no navigateFallback denylist`);
if (!sourceHasPattern("api")) problems.push(`${swPath} does not bypass /api/*`);
if (!sourceHasPattern("auth")) problems.push(`${swPath} does not bypass /auth/*`);
if (/"\/api|"\/auth|url:"api|url:"auth/.test(sw)) problems.push(`${swPath} precaches an /api or /auth URL`);

for (const field of ["name", "short_name", "start_url", "scope", "display", "theme_color", "background_color", "icons"]) {
  if (manifest[field] == null || manifest[field] === "") problems.push(`manifest missing ${field}`);
}
if (manifest.start_url !== "/") problems.push(`manifest start_url is ${manifest.start_url}`);
if (manifest.display !== "standalone") problems.push(`manifest display is ${manifest.display}`);
const purposes = new Set((manifest.icons ?? []).map((icon) => `${icon.sizes} ${icon.purpose}`));
for (const required of ["192x192 any", "512x512 any", "192x192 maskable", "512x512 maskable"]) {
  if (!purposes.has(required)) problems.push(`manifest missing icon ${required}`);
}

const strayManifests = files.filter((file) => file.endsWith("manifest.webmanifest") && !file.split(sep).includes("client"));
if (strayManifests.length > 0) problems.push(`manifest emitted outside the client build: ${strayManifests.join(", ")}`);

const manifestLinks = html.match(/rel="manifest"/g) ?? [];
if (manifestLinks.length !== 1) problems.push(`index.html has ${manifestLinks.length} manifest links`);
if (!html.includes('rel="apple-touch-icon"')) problems.push("index.html missing apple-touch-icon");
if (!html.includes('name="apple-mobile-web-app-capable"')) problems.push("index.html missing apple-mobile-web-app-capable");
if (!html.includes('name="apple-mobile-web-app-status-bar-style"')) problems.push("index.html missing status bar meta");
if (!html.includes("viewport-fit=cover")) problems.push("index.html missing viewport-fit=cover");
if (html.includes("vite-plugin-pwa:inline-sw") || html.includes("registerSW.js")) {
  problems.push("service worker registration must stay in the app bundle so the CSP script-src 'self' policy allows it");
}

if (problems.length > 0) {
  const denylistAt = sw.indexOf("denylist");
  if (denylistAt >= 0) console.error(sw.slice(Math.max(0, denylistAt - 80), denylistAt + 240));
  fail(problems);
}

console.log(`PWA build ok (${swPath})`);
