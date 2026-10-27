import { existsSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { VitePWA } from "vite-plugin-pwa";
import { pwaManifest, pwaWorkbox } from "./src/web/pwa/pwaConfig";
import { renderSitemap } from "./src/web/seo/sitemap";

function stripStrayWorkerManifest(): Plugin {
  return {
    name: "biblia-strip-worker-manifest",
    apply: "build",
    applyToEnvironment(environment) {
      return environment.name !== "client";
    },
    closeBundle() {
      const manifest = resolve(this.environment.config.build.outDir, "manifest.webmanifest");
      if (existsSync(manifest)) unlinkSync(manifest);
    },
  };
}

function bibliaDevManifest(): Plugin {
  return {
    name: "biblia-dev-manifest",
    apply: "serve",
    transformIndexHtml(html) {
      if (html.includes('rel="manifest"')) return html;
      return html.replace("</head>", '    <link rel="manifest" href="/manifest.webmanifest" />\n  </head>');
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = req.url?.split("?")[0];
        if (path !== "/manifest.webmanifest") {
          next();
          return;
        }
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/manifest+json");
        res.setHeader("Cache-Control", "no-cache");
        res.end(JSON.stringify(pwaManifest));
      });
    },
  };
}

function bibliaSitemap(): Plugin {
  return {
    name: "biblia-sitemap",
    apply: "build",
    applyToEnvironment(environment) {
      return environment.name === "client";
    },
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "sitemap.xml", source: renderSitemap() });
    },
  };
}

export default defineConfig({
  plugins: [
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
      routesDirectory: "./src/routes",
      generatedRouteTree: "./src/routeTree.gen.ts",
    }),
    react(),
    VitePWA({
      // Registration lives in src/main.tsx. An injected inline script would be
      // blocked by the document CSP (`script-src 'self'`).
      injectRegister: false,
      registerType: "autoUpdate",
      includeManifestIcons: false,
      manifest: pwaManifest,
      workbox: pwaWorkbox,
      devOptions: { enabled: false },
    }),
    bibliaDevManifest(),
    bibliaSitemap(),
    stripStrayWorkerManifest(),
    cloudflare(),
  ],
});
