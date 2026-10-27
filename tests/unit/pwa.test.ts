import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FONT_SCALES } from "../../src/core/providers/ThemeProvider";
import { darkTheme, lightTheme, typography } from "../../src/core/theme";
import { pwaManifest, pwaWorkbox, serviceWorkerBypassPatterns, serviceWorkerBypasses } from "../../src/web/pwa/pwaConfig";

function pngSize(path: string) {
  const bytes = readFileSync(path);
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let index = 0; index < signature.length; index += 1) {
    expect(bytes[index]).toBe(signature[index]);
  }
  const width = ((bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19]) >>> 0;
  const height = ((bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23]) >>> 0;
  return { width, height };
}

describe("service worker bypass", () => {
  it("leaves API, auth, and the Access login redirect on the network", () => {
    expect(serviceWorkerBypasses("/api/me")).toBe(true);
    expect(serviceWorkerBypasses("/api/bible-ai/stream")).toBe(true);
    expect(serviceWorkerBypasses("/api/admin/allowed-emails")).toBe(true);
    expect(serviceWorkerBypasses("/auth/login?returnTo=%2Fjuan%2F3")).toBe(true);
    expect(serviceWorkerBypasses("/auth/callback?code=abc&state=xyz")).toBe(true);
    expect(serviceWorkerBypasses("/auth/logout")).toBe(true);
    expect(serviceWorkerBypasses("/")).toBe(false);
    expect(serviceWorkerBypasses("/juan/3")).toBe(false);
    expect(serviceWorkerBypasses("/juan/3?v=16")).toBe(false);
    expect(serviceWorkerBypasses("/?login=denied")).toBe(false);
    expect(serviceWorkerBypasses("/?next=/api/me")).toBe(false);
    expect(serviceWorkerBypasses("/manifest.webmanifest")).toBe(false);
    expect(serviceWorkerBypasses("/sw.js")).toBe(false);
  });

  it("uses that denylist and does not add a runtime cache", () => {
    expect(pwaWorkbox.navigateFallbackDenylist).toBe(serviceWorkerBypassPatterns);
    expect(pwaWorkbox.navigateFallback).toBe("index.html");
    expect(pwaWorkbox.navigationPreload).toBe(false);
    expect(pwaWorkbox).not.toHaveProperty("runtimeCaching");
  });
});

describe("web manifest", () => {
  it("is an installable standalone app rooted at /", () => {
    expect(pwaManifest.name).toBe("Biblia");
    expect(pwaManifest.short_name).toBe("Biblia");
    expect(pwaManifest.start_url).toBe("/");
    expect(pwaManifest.scope).toBe("/");
    expect(pwaManifest.display).toBe("standalone");
    expect(pwaManifest.theme_color).toBe(lightTheme.colors.primary);
    expect(pwaManifest.background_color).toBe(lightTheme.colors.background);
    expect(pwaManifest.icons?.map((icon) => `${icon.sizes}:${icon.purpose}`).sort()).toEqual([
      "192x192:any",
      "192x192:maskable",
      "512x512:any",
      "512x512:maskable",
    ]);
  });

  it("ships opaque png icons at the declared sizes", () => {
    for (const icon of pwaManifest.icons ?? []) {
      const size = pngSize(icon.src.replace(/^\//, "public/"));
      const expected = Number(icon.sizes?.split("x")[0]);
      expect(size).toEqual({ width: expected, height: expected });
      expect(readFileSync(icon.src.replace(/^\//, "public/"))[25]).toBe(2);
    }
    expect(pngSize("public/apple-touch-icon.png")).toEqual({ width: 180, height: 180 });
  });
});

describe("app icon", () => {
  const icon = readFileSync(new URL("../../public/icons/icon.svg", import.meta.url), "utf8");
  const favicon = readFileSync(new URL("../../public/favicon.svg", import.meta.url), "utf8");

  it("draws an open bible on the theme blue", () => {
    expect(icon).toContain('<rect id="plate" width="32" height="32" fill="#1a73e8"/>');
    expect(icon).not.toContain('rx="6"');
    expect(icon).toContain('id="open-bible"');
    expect(icon.match(/<path /g)?.length).toBe(5);
    expect(favicon).toContain('<rect id="plate" width="32" height="32" rx="6" fill="#1a73e8"/>');
    const book = (svg: string) => svg.slice(svg.indexOf('<g id="open-bible">'));
    expect(book(favicon)).toBe(book(icon));
  });
});

describe("installable document", () => {
  const html = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
  const shell = readFileSync(new URL("../../src/web/layout/AppShell.module.css", import.meta.url), "utf8");
  const themeInit = readFileSync(new URL("../../public/theme-init.js", import.meta.url), "utf8");
  const headers = readFileSync(new URL("../../public/_headers", import.meta.url), "utf8");

  it("includes the iOS install tags and a cover viewport", () => {
    expect(html).toContain('rel="apple-touch-icon"');
    expect(html).toContain('href="/apple-touch-icon.png"');
    expect(html).toContain('name="apple-mobile-web-app-capable" content="yes"');
    expect(html).toContain('name="apple-mobile-web-app-status-bar-style" content="black-translucent"');
    expect(html).toContain("viewport-fit=cover");
  });

  it("pads the shell with every safe-area inset", () => {
    expect(shell).toContain("env(safe-area-inset-top, 0px)");
    expect(shell).toContain("env(safe-area-inset-right, 0px)");
    expect(shell).toContain("env(safe-area-inset-bottom, 0px)");
    expect(shell).toContain("env(safe-area-inset-left, 0px)");
  });

  it("keeps the status bar color aligned with the active theme", () => {
    expect(themeInit).toContain(lightTheme.colors.background);
    expect(themeInit).toContain(darkTheme.colors.background);
  });

  it("applies the stored text size before the first paint with the same scales", () => {
    expect(themeInit).toContain(`[${FONT_SCALES.filter((scale) => scale !== 1).join(", ")}]`);
    expect(themeInit).toContain(`${typography.body.fontSize} * scale`);
    expect(themeInit).toContain(`${typography.body.lineHeight} * scale`);
  });

  it("opts out of the browser's forced dark mode so the light theme stays light", () => {
    const global = readFileSync(new URL("../../src/styles/global.css", import.meta.url), "utf8");
    expect(html).toContain('<meta name="color-scheme" content="only light" />');
    expect(themeInit).toContain('"only " + mode');
    expect(global).toContain(":root { color-scheme: only light; }");
    expect(global).toContain(':root[data-theme="dark"] { color-scheme: only dark; }');
    expect(global).not.toContain("prefers-color-scheme");
  });

  it("lets the service worker load from the same origin without caching auth", () => {
    expect(headers).toContain("script-src 'self'");
    expect(headers).toContain("worker-src 'self'");
    expect(headers).not.toContain("unsafe-inline");
    expect(headers).toContain("/sw.js");
    expect(headers).toContain("/manifest.webmanifest");
    expect(headers).toContain("Cache-Control: no-cache");
  });
});
