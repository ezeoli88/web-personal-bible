import type { MiddlewareHandler } from "hono";
import { apiError } from "../lib/http";

const SAFE = new Set(["GET", "HEAD", "OPTIONS"]);

/** Rejects non-GET requests that come from another origin. */
export const sameOrigin: MiddlewareHandler = async (c, next) => {
  if (SAFE.has(c.req.method.toUpperCase())) {
    await next();
    return;
  }

  const requestOrigin = new URL(c.req.url).origin;
  const origin = c.req.header("origin");
  const fetchSite = c.req.header("sec-fetch-site");

  if (origin && origin !== requestOrigin) {
    return apiError(c, 403, "CROSS_ORIGIN", "La solicitud viene de otro sitio.");
  }
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    return apiError(c, 403, "CROSS_ORIGIN", "La solicitud viene de otro sitio.");
  }

  await next();
};
