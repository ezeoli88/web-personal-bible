import type { MiddlewareHandler } from "hono";
import { resolveRole, type Role } from "./authz";
import { readSession } from "./session";
import { readCookie, SESSION_COOKIE } from "../lib/cookies";
import { apiError } from "../lib/http";

export interface AuthVariables {
  email: string;
  role: Role | null;
}

type AuthEnv = { Bindings: Env; Variables: AuthVariables };

export const requireSession: MiddlewareHandler<AuthEnv> = async (c, next) => {
  const token = readCookie(c.req.header("cookie"), SESSION_COOKIE);
  if (!token) {
    return apiError(c, 401, "UNAUTHENTICATED", "Tenés que iniciar sesión.");
  }
  const session = await readSession(c.env.SESSION_SECRET, token);
  if (!session) {
    return apiError(c, 401, "UNAUTHENTICATED", "La sesión no es válida o venció.");
  }
  c.set("email", session.email);
  await next();
};

export const requireAllowed: MiddlewareHandler<AuthEnv> = async (c, next) => {
  const role = await resolveRole(c.env, c.get("email"));
  c.set("role", role);
  if (!role) {
    return apiError(c, 403, "NOT_ALLOWED", "Tu correo no tiene acceso a la IA.");
  }
  await next();
};

export const requireAdmin: MiddlewareHandler<AuthEnv> = async (c, next) => {
  const role = await resolveRole(c.env, c.get("email"));
  c.set("role", role);
  if (role !== "admin") {
    return apiError(c, 403, "FORBIDDEN", "No tenés permiso para administrar los accesos.");
  }
  await next();
};
