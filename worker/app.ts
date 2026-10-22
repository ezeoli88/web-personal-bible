import { Hono } from "hono";
import type { AppDeps, AppEnv } from "./app-env";
import { sameOrigin } from "./middleware/sameOrigin";
import { apiError, logEvent } from "./lib/http";
import { registerAdminRoutes } from "./routes/admin";
import { registerAiProxy } from "./routes/aiProxy";
import { registerAuthRoutes } from "./routes/auth";
import { registerMeRoute } from "./routes/me";

export type { AppDeps };

export function createApp(deps: AppDeps = {}): Hono<AppEnv> {
  const app = new Hono<AppEnv>();
  app.use("*", sameOrigin);
  registerAuthRoutes(app, deps);
  registerMeRoute(app);
  registerAiProxy(app, deps);
  registerAdminRoutes(app, deps);

  app.notFound((c) => {
    if (c.req.path.startsWith("/api/") || c.req.path.startsWith("/auth/")) {
      return apiError(c, 404, "NOT_FOUND", "Ruta no encontrada");
    }
    return c.text("Not found", 404);
  });

  app.onError((error, c) => {
    logEvent("request.unhandled_error", {
      method: c.req.method,
      path: c.req.path,
      error: error instanceof Error ? error.message : String(error),
    }, "error");
    return apiError(c, 500, "INTERNAL_ERROR", "Error interno del servidor");
  });

  return app;
}
