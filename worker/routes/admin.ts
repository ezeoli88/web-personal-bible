import type { Hono } from "hono";
import { isAdminEmail, normalizeEmail } from "../auth/authz";
import { requireAdmin, requireSession } from "../auth/middleware";
import { syncAccessPolicy } from "../access/policySync";
import {
  findAllowedEmail,
  insertAllowedEmail,
  latestSync,
  listAllowedEmails,
  recordAudit,
  setEmailEnabled,
} from "../db/allowedEmails";
import { apiError, logEvent } from "../lib/http";
import type { AppDeps, AppEnv } from "../app-env";

const EMAIL_PATTERN = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;

function parseEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = normalizeEmail(value);
  if (!EMAIL_PATTERN.test(email) || email.length > 254) return null;
  return email;
}

async function syncAndAudit(c: { env: Env }, deps: AppDeps, actor: string) {
  const result = await syncAccessPolicy(c.env, deps.fetch);
  await recordAudit(c.env.DB, {
    actor,
    action: "sync",
    email: null,
    ok: result.ok,
  });
  return result;
}

export function registerAdminRoutes(app: Hono<AppEnv>, deps: AppDeps): void {
  app.use("/api/admin/*", requireSession, requireAdmin);

  app.get("/api/admin/allowed-emails", async (c) => {
    const [emails, sync] = await Promise.all([
      listAllowedEmails(c.env.DB),
      latestSync(c.env.DB),
    ]);
    return c.json({
      adminEmail: normalizeEmail(c.env.ADMIN_EMAIL),
      emails,
      sync,
    });
  });

  app.post("/api/admin/allowed-emails", async (c) => {
    const actor = c.get("email");
    let payload: { email?: unknown };
    try {
      payload = await c.req.json();
    } catch {
      return apiError(c, 400, "INVALID_JSON", "El cuerpo no es JSON válido.");
    }
    const email = parseEmail(payload.email);
    if (!email) return apiError(c, 400, "INVALID_EMAIL", "El correo no es válido.");
    if (isAdminEmail(c.env, email)) {
      return apiError(c, 400, "ADMIN_EMAIL", "El administrador ya tiene acceso y no se puede modificar.");
    }

    const existing = await findAllowedEmail(c.env.DB, email);
    let action: "add" | "enable" = "add";
    try {
      if (!existing) {
        await insertAllowedEmail(c.env.DB, email, actor);
      } else if (!existing.enabled) {
        action = "enable";
        await setEmailEnabled(c.env.DB, email, true, actor);
      } else {
        const result = await syncAndAudit(c, deps, actor);
        return c.json({ saved: true, synced: result.ok, unchanged: true, error: result.error });
      }
      await recordAudit(c.env.DB, { actor, action, email, ok: true });
    } catch (error) {
      await recordAudit(c.env.DB, { actor, action, email, ok: false });
      logEvent("admin.write_failed", { action, error: error instanceof Error ? error.message : String(error) }, "error");
      return apiError(c, 500, "INTERNAL_ERROR", "No se pudo guardar el correo.");
    }

    const result = await syncAndAudit(c, deps, actor);
    return c.json({ saved: true, synced: result.ok, error: result.error });
  });

  app.patch("/api/admin/allowed-emails/:email", async (c) => {
    const actor = c.get("email");
    const email = parseEmail(decodeURIComponent(c.req.param("email")));
    if (!email) return apiError(c, 400, "INVALID_EMAIL", "El correo no es válido.");
    if (isAdminEmail(c.env, email)) {
      return apiError(c, 400, "ADMIN_EMAIL", "El administrador no se puede deshabilitar.");
    }

    let payload: { enabled?: unknown };
    try {
      payload = await c.req.json();
    } catch {
      return apiError(c, 400, "INVALID_JSON", "El cuerpo no es JSON válido.");
    }
    if (typeof payload.enabled !== "boolean") {
      return apiError(c, 400, "INVALID_ENABLED", "Indicá si el correo queda habilitado.");
    }

    const action = payload.enabled ? "enable" : "disable";
    const updated = await setEmailEnabled(c.env.DB, email, payload.enabled, actor);
    if (!updated) {
      await recordAudit(c.env.DB, { actor, action, email, ok: false });
      return apiError(c, 404, "NOT_FOUND", "Ese correo no está en la lista.");
    }
    await recordAudit(c.env.DB, { actor, action, email, ok: true });
    const result = await syncAndAudit(c, deps, actor);
    return c.json({ saved: true, synced: result.ok, error: result.error });
  });

  app.post("/api/admin/sync", async (c) => {
    const actor = c.get("email");
    const result = await syncAndAudit(c, deps, actor);
    return c.json({ saved: true, synced: result.ok, error: result.error });
  });
}
