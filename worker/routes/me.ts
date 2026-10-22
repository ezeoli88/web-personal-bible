import type { Hono } from "hono";
import { resolveRole } from "../auth/authz";
import { readSession } from "../auth/session";
import { readCookie, SESSION_COOKIE } from "../lib/cookies";
import type { AppEnv } from "../app-env";

export function registerMeRoute(app: Hono<AppEnv>): void {
  app.get("/api/me", async (c) => {
    c.header("Cache-Control", "no-store");
    const token = readCookie(c.req.header("cookie"), SESSION_COOKIE);
    if (!token) return c.json({ authenticated: false });
    const session = await readSession(c.env.SESSION_SECRET, token);
    if (!session) return c.json({ authenticated: false });
    const role = await resolveRole(c.env, session.email);
    return c.json({ authenticated: true, email: session.email, role });
  });
}
