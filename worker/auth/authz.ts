import { safeEqual } from "../lib/security";
import { findAllowedEmail } from "../db/allowedEmails";

export type Role = "admin" | "user";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isAdminEmail(env: Env, email: string): boolean {
  return safeEqual(normalizeEmail(email), normalizeEmail(env.ADMIN_EMAIL));
}

/**
 * Role is computed on every request. Disabling an email cuts AI immediately,
 * even if the session cookie is still valid.
 */
export async function resolveRole(env: Env, email: string): Promise<Role | null> {
  const normalized = normalizeEmail(email);
  if (isAdminEmail(env, normalized)) return "admin";
  const row = await findAllowedEmail(env.DB, normalized);
  if (row?.enabled) return "user";
  return null;
}
