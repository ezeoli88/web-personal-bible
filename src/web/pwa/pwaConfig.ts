import type { ManifestOptions } from "vite-plugin-pwa";
import { lightTheme } from "../../core/theme";

/**
 * Navigation URLs the service worker must not handle.
 *
 * Workbox tests `navigateFallbackDenylist` against `pathname + search`.
 * Keeping these on the network lets Cloudflare Access follow the OIDC
 * redirects for `/auth/login` and `/auth/callback`, and lets `/api/*`
 * (including the AI stream) stay uncached. A runtime route, even
 * NetworkOnly, would still call `respondWith` and can break those redirects.
 */
export const serviceWorkerBypassPatterns: RegExp[] = [/^\/api\//, /^\/auth\//];

export function serviceWorkerBypasses(pathnameAndSearch: string): boolean {
  return serviceWorkerBypassPatterns.some((pattern) => pattern.test(pathnameAndSearch));
}

export const pwaManifest = {
  id: "/",
  name: "Biblia",
  short_name: "Biblia",
  description: "Lectura de la Biblia",
  lang: "es",
  start_url: "/",
  scope: "/",
  display: "standalone",
  background_color: lightTheme.colors.background,
  theme_color: lightTheme.colors.primary,
  icons: [
    { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    { src: "/icons/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
    { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
} satisfies Partial<ManifestOptions>;

export const pwaWorkbox = {
  navigateFallback: "index.html",
  navigateFallbackDenylist: serviceWorkerBypassPatterns,
  // App shell and static files only. The web manifest is added by
  // vite-plugin-pwa; including it here as well would precache it twice.
  globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
  globIgnores: ["**/node_modules/**/*", "**/*.map"],
  navigationPreload: false,
  skipWaiting: true,
  clientsClaim: true,
  cleanupOutdatedCaches: true,
};
